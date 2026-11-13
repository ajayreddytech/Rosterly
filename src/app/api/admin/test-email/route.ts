import { NextResponse } from "next/server";
import { emailConfigured, sendEmail } from "@/lib/email/brevo";
import { renderEmail, type EmailKind } from "@/lib/email/outbox";
import type { ReminderPayload } from "@/lib/email/templates";
import { zonedToIso } from "@/lib/shifts";
import { GALA_DAY } from "@/lib/venue";
import { createClient } from "@/lib/supabase/server";

const MAX_RECIPIENTS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEST_KINDS = ["reminder_morning", "reminder_later", "reminder_event"] as const;
type TestKind = (typeof TEST_KINDS)[number];

/** Sample data so a test looks like a real email. Nothing is written to the queue. */
function sampleFor(kind: TestKind): ReminderPayload {
  const at = (time: string) => zonedToIso(GALA_DAY, time);
  if (kind === "reminder_morning") {
    return {
      full_name: "Test Volunteer",
      email: "",
      shifts: [
        { title: "Test morning shift", department: "Test department", start_time: at("09:00"), end_time: at("12:00") },
        { title: "Test shift 2", department: "Test department", start_time: at("13:00"), end_time: at("15:00") },
      ],
    };
  }
  if (kind === "reminder_later") {
    return {
      full_name: "Test Volunteer",
      email: "",
      shifts: [
        { title: "Test afternoon shift", department: "Test department", start_time: at("13:00"), end_time: at("16:00") },
      ],
    };
  }
  return { full_name: "Test Volunteer", email: "", shifts: [] };
}

// Admin only. Sends one of the three emails to the addresses typed in the admin panel.
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

  const sample = sampleFor(kind);
  const results = await Promise.all(
    recipients.map(async (to) => {
      try {
        const email = renderEmail(kind as EmailKind, { ...sample, email: to });
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
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
