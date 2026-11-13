import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "./brevo";
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
    .select("id, kind, payload, attempts")
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
    const res = await sendEmail(toMessage(row));
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

function toMessage(row: OutboxRow): RenderedEmail & { to: string } {
  return { ...renderEmail(row.kind, row.payload), to: row.payload.email };
}
