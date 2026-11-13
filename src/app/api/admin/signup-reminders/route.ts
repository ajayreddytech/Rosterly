import { NextResponse } from "next/server";
import { processOutbox, queueEmails } from "@/lib/email/outbox";
import { emailConfigured } from "@/lib/email/brevo";
import { loadReminderPlan, toQueueRows } from "@/lib/email/load-plan";
import { createClient } from "@/lib/supabase/server";

// Admin button: sends the event email now to every volunteer with no shift.
// Anyone who already received it is skipped (dedupe_key), so it is safe to repeat.
export async function POST() {
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

  try {
    const now = new Date();
    const plan = await loadReminderPlan(now);
    const unbooked = plan.filter((r) => r.kind === "reminder_event");
    const queued = await queueEmails(toQueueRows(unbooked, now.toISOString()));

    const result = await processOutbox({ kind: "reminder_event", limit: 300 });
    return NextResponse.json({
      unbookedVolunteers: unbooked.length,
      alreadyEmailed: unbooked.length - queued,
      queued,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/signup-reminders]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
