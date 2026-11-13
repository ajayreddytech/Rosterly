import { NextResponse } from "next/server";
import { processOutbox, queueEmails } from "@/lib/email/outbox";
import { loadReminderPlan, toQueueRows } from "@/lib/email/load-plan";

// Called every minute by Supabase pg_cron (see supabase/setup/email-cron.sql).
// Queues any reminder that is now due, then sends everything pending.
// Queueing is idempotent (dedupe_key), so a volunteer never gets the same
// reminder twice even though this runs every minute.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const plan = await loadReminderPlan(now);
    const due = plan.filter((r) => Date.parse(r.send_at) <= now.getTime());
    const queued = await queueEmails(toQueueRows(due));

    const result = await processOutbox({ limit: 200 });
    return NextResponse.json({ queuedReminders: queued, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/emails]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
