import { NextResponse } from "next/server";
import { emailConfigured, sendEmail } from "@/lib/email/brevo";
import { loadCurrentVolunteer } from "@/lib/email/load-plan";
import { renderEmail, type EmailKind } from "@/lib/email/outbox";
import type { PlanShift } from "@/lib/email/plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_RECIPIENTS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEST_KINDS = ["reminder_morning", "reminder_later", "reminder_event"] as const;
type TestKind = (typeof TEST_KINDS)[number];

interface PickedVolunteer {
  full_name: string;
  email: string;
  shifts: PlanShift[];
}

/**
 * Picks a random volunteer whose real email would be of this type: reminders go to
 * volunteers with at least one shift, the event email to volunteers with none.
 * Returns their details as they are right now.
 */
async function pickVolunteer(kind: TestKind): Promise<PickedVolunteer | null> {
  const admin = createAdminClient();
  const [vols, assigned] = await Promise.all([
    admin.from("profiles").select("id").eq("role", "volunteer"),
    admin.from("shift_assignments").select("user_id"),
  ]);
  if (vols.error) throw new Error(`Could not read volunteers: ${vols.error.message}`);
  if (assigned.error) throw new Error(`Could not read shifts: ${assigned.error.message}`);

  const withShift = new Set((assigned.data ?? []).map((r) => r.user_id as string));
  const wantShift = kind !== "reminder_event";
  const eligible = (vols.data ?? [])
    .map((v) => v.id as string)
    .filter((id) => withShift.has(id) === wantShift);
  if (eligible.length === 0) return null;

  const id = eligible[Math.floor(Math.random() * eligible.length)];
  const current = await loadCurrentVolunteer(id);
  return current ? { full_name: current.full_name, email: current.email, shifts: current.shifts } : null;
}

// Admin only. Picks a random volunteer, builds the email they would really get, and sends it
// to the test addresses typed in the admin panel. Nothing is written to the queue.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured yet (BREVO_API_KEY and EMAIL_FROM are missing)." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { kind?: string; emails?: unknown };
  if (!TEST_KINDS.includes(body.kind as TestKind)) {
    return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
  }
  const kind = body.kind as TestKind;

  const raw = Array.isArray(body.emails) ? body.emails.join(" ") : String(body.emails ?? "");
  const recipients = [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean))];
  if (recipients.length === 0) {
    return NextResponse.json({ error: "Enter at least one email address." }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `Up to ${MAX_RECIPIENTS} test addresses at a time.` }, { status: 400 });
  }
  const invalid = recipients.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Not an email address: ${invalid.join(", ")}` }, { status: 400 });
  }

  const volunteer = await pickVolunteer(kind);
  if (!volunteer) {
    return NextResponse.json(
      { error: `No volunteer ${kind === "reminder_event" ? "without a shift" : "with a shift"} to pick from.` },
      { status: 400 },
    );
  }

  // The email this volunteer would really get, built from their current details.
  const email = renderEmail(kind as EmailKind, {
    full_name: volunteer.full_name,
    email: volunteer.email,
    shifts: kind === "reminder_event" ? [] : volunteer.shifts,
  });

  const results = await Promise.all(
    recipients.map(async (to) => {
      try {
        await sendEmail({ to, subject: `[TEST] ${email.subject}`, html: email.html, text: email.text });
        return { to, ok: true as const };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[admin/test-email] ${kind} to ${to} failed: ${error}`);
        return { to, ok: false as const, error };
      }
    }),
  );

  return NextResponse.json({
    kind,
    volunteer: volunteer.full_name || "Volunteer",
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
