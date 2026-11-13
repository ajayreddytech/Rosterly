import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "./brevo";
import { loadCurrentVolunteer } from "./load-plan";
import type { ReminderKind } from "./plan";
import {
  renderBookingCancelled,
  renderBookingConfirmed,
  renderEventEmail,
  renderShiftReminder,
  type RenderedEmail,
  type ReminderPayload,
  type ShiftEmailPayload,
} from "./templates";

export type EmailKind = "booking_confirmed" | "booking_cancelled" | ReminderKind;

export type EmailPayload = ShiftEmailPayload | ReminderPayload;

/** A row ready to be queued. Reminder rows carry a dedupe_key; booking rows do not. */
export interface NewEmail {
  kind: EmailKind;
  user_id: string;
  send_at: string;
  payload: EmailPayload;
  dedupe_key: string | null;
}

const MAX_ATTEMPTS = 3;
const CONCURRENCY = 8;
const RETRY_DELAY_MS = 5 * 60 * 1000;

interface OutboxRow {
  id: string;
  user_id: string;
  kind: EmailKind;
  payload: EmailPayload;
  attempts: number;
}

export interface ProcessResult {
  sent: number;
  failed: number;
  /** True when BREVO_API_KEY / EMAIL_FROM are missing: nothing was sent or changed. */
  notConfigured: boolean;
}

/** Builds the email for a kind. Also used by the admin test buttons. */
export function renderEmail(kind: EmailKind, payload: EmailPayload): RenderedEmail {
  switch (kind) {
    case "booking_confirmed":
      return renderBookingConfirmed(payload as ShiftEmailPayload);
    case "booking_cancelled":
      return renderBookingCancelled(payload as ShiftEmailPayload);
    case "reminder_morning":
    case "reminder_later":
      return renderShiftReminder(payload as ReminderPayload);
    case "reminder_event":
      return renderEventEmail(payload as ReminderPayload);
  }
}

/**
 * Adds rows to the queue. A row whose dedupe_key already exists is skipped,
 * so the same volunteer never gets the same reminder twice.
 * Returns how many rows were newly added.
 */
export async function queueEmails(rows: NewEmail[]): Promise<number> {
  if (rows.length === 0) return 0;
  const admin = createAdminClient();
  const keyed = rows.filter((r) => r.dedupe_key !== null);
  const unkeyed = rows.filter((r) => r.dedupe_key === null);
  let added = 0;

  if (keyed.length > 0) {
    // ignoreDuplicates makes this ON CONFLICT DO NOTHING, so only new rows come back.
    const { data, error } = await admin
      .from("email_outbox")
      .upsert(keyed, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Could not queue emails: ${error.message}`);
    added += data?.length ?? 0;
  }
  if (unkeyed.length > 0) {
    const { data, error } = await admin.from("email_outbox").insert(unkeyed).select("id");
    if (error) throw new Error(`Could not queue emails: ${error.message}`);
    added += data?.length ?? 0;
  }
  return added;
}

/**
 * Sends pending rows that are due. Each row is claimed before sending
 * (status pending -> sending), so the cron job and the admin button can run
 * at the same time without sending one email twice.
 */
export async function processOutbox(opts: { kind?: EmailKind; limit: number }): Promise<ProcessResult> {
  const result: ProcessResult = { sent: 0, failed: 0, notConfigured: false };
  if (!emailConfigured()) {
    result.notConfigured = true;
    return result;
  }

  const admin = createAdminClient();
  let query = admin
    .from("email_outbox")
    .select("id, user_id, kind, payload, attempts")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(opts.limit);
  if (opts.kind) query = query.eq("kind", opts.kind);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the email queue: ${error.message}`);

  const rows = (data ?? []) as unknown as OutboxRow[];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map((row) => deliver(admin, row, result)));
  }
  return result;
}

async function deliver(
  admin: ReturnType<typeof createAdminClient>,
  row: OutboxRow,
  result: ProcessResult,
) {
  const { data: claimed, error: claimError } = await admin
    .from("email_outbox")
    .update({ status: "sending", attempts: row.attempts + 1 })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  if (claimError || !claimed || claimed.length === 0) return;

  try {
    // Rebuild from the database right now, so the email matches the volunteer's current shifts.
    const message = await buildCurrentMessage(row);
    if (!message.ok) {
      // The volunteer's shifts changed since this was queued, so this email no longer applies.
      await admin
        .from("email_outbox")
        .update({ status: "failed", last_error: `skipped: ${message.reason}`.slice(0, 500) })
        .eq("id", row.id);
      return;
    }
    const res = await sendEmail(message.email);
    await admin
      .from("email_outbox")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: res.dryRun ? null : res.messageId,
        last_error: null,
      })
      .eq("id", row.id);
    result.sent += 1;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const giveUp = row.attempts + 1 >= MAX_ATTEMPTS;
    await admin
      .from("email_outbox")
      .update({
        status: giveUp ? "failed" : "pending",
        last_error: reason.slice(0, 500),
        send_at: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
      })
      .eq("id", row.id);
    if (giveUp) result.failed += 1;
  }
}

type BuiltMessage =
  | { ok: true; email: RenderedEmail & { to: string } }
  | { ok: false; reason: string };

/**
 * Builds the email from the volunteer's shifts as they are now, not as they were
 * when the email was queued. Returns ok:false when the email no longer applies.
 */
async function buildCurrentMessage(row: OutboxRow): Promise<BuiltMessage> {
  const current = await loadCurrentVolunteer(row.user_id);
  if (!current) return { ok: false, reason: "volunteer profile no longer exists" };
  const base = { full_name: current.full_name, email: current.email };

  switch (row.kind) {
    case "reminder_morning":
    case "reminder_later": {
      if (current.shifts.length === 0) return { ok: false, reason: "no shifts left to remind about" };
      const payload: ReminderPayload = { ...base, shifts: current.shifts };
      return { ok: true, email: { ...renderEmail(row.kind, payload), to: current.email } };
    }
    case "reminder_event": {
      if (current.shifts.length > 0) return { ok: false, reason: "volunteer now has a shift" };
      const payload: ReminderPayload = { ...base, shifts: [] };
      return { ok: true, email: { ...renderEmail(row.kind, payload), to: current.email } };
    }
    case "booking_confirmed": {
      const booked = row.payload as ShiftEmailPayload;
      const stillBooked = current.shifts.some(
        (s) => s.title === booked.title && s.start_time === booked.start_time,
      );
      if (!stillBooked) return { ok: false, reason: "shift was removed before the confirmation was sent" };
      const payload: ShiftEmailPayload = { ...booked, ...base };
      return { ok: true, email: { ...renderEmail(row.kind, payload), to: current.email } };
    }
    case "booking_cancelled": {
      // The cancelled shift is no longer assigned, so it is sent as stored.
      const payload: ShiftEmailPayload = { ...(row.payload as ShiftEmailPayload), ...base };
      return { ok: true, email: { ...renderEmail(row.kind, payload), to: current.email } };
    }
  }
}
