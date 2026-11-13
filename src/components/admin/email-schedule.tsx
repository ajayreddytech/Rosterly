"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Mail } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { buildReminderPlan, type PlanBooking, type PlanVolunteer, type ReminderKind } from "@/lib/email/plan";
import { formatDay, formatTime12 } from "@/lib/shifts";
import { createClient } from "@/lib/supabase/client";

interface OutboxRow {
  kind: string;
  dedupe_key: string | null;
  status: string;
  last_error: string | null;
}

interface AssignmentRow {
  user_id: string;
  shifts: {
    title: string;
    start_time: string;
    end_time: string;
    departments: { name: string } | { name: string }[] | null;
  } | null;
}

const GROUPS: { kind: ReminderKind; label: string; hint: string }[] = [
  {
    kind: "reminder_morning",
    label: "Morning shifts (start before 12:00)",
    hint: "Sent today, 13 Nov, at 5:30 PM. One email per volunteer, listing all their shifts.",
  },
  {
    kind: "reminder_later",
    label: "Later shifts (start at 12:00 or after)",
    hint: "Sent 14 Nov at 8:00 AM. One email per volunteer, listing all their shifts.",
  },
];

function relative(ms: number): string {
  const mins = Math.round(Math.abs(ms) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const text = h ? `${h}h ${m}m` : `${m}m`;
  return ms >= 0 ? `in ${text}` : `${text} ago`;
}

/**
 * Admin panel: what has been emailed, what is still to go out, and when.
 * It uses the same planner as the cron job, so the numbers match what is sent.
 * Updates live as bookings and queue rows change.
 */
export function EmailSchedule() {
  const [volunteers, setVolunteers] = useState<PlanVolunteer[]>([]);
  const [bookings, setBookings] = useState<PlanBooking[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const supabase = createClient();
    const [v, a, o] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, note").eq("role", "volunteer"),
      supabase
        .from("shift_assignments")
        .select("user_id, shifts(title, start_time, end_time, departments(name))"),
      supabase.from("email_outbox").select("kind, dedupe_key, status, last_error"),
    ]);
    if (!v.error && v.data) {
      setVolunteers(
        v.data.map((r) => ({
          id: r.id as string,
          full_name: (r.full_name as string) ?? "",
          email: r.email as string,
          note: (r.note as string | null) ?? null,
        })),
      );
    }
    if (!a.error && a.data) {
      const rows: PlanBooking[] = [];
      for (const row of a.data as unknown as AssignmentRow[]) {
        if (!row.shifts) continue;
        const dept = Array.isArray(row.shifts.departments) ? row.shifts.departments[0] : row.shifts.departments;
        rows.push({
          user_id: row.user_id,
          title: row.shifts.title,
          department: dept?.name ?? "",
          start_time: row.shifts.start_time,
          end_time: row.shifts.end_time,
        });
      }
      setBookings(rows);
    }
    if (!o.error && o.data) setOutbox(o.data as unknown as OutboxRow[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-email-schedule")
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_assignments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "email_outbox" }, () => void load())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const view = useMemo(() => {
    const plan = buildReminderPlan(volunteers, bookings, new Date(now));
    const statusByKey = new Map<string, string>();
    for (const r of outbox) if (r.dedupe_key) statusByKey.set(r.dedupe_key, r.status);

    const groups = GROUPS.map((g) => {
      const rows = plan.filter((p) => p.kind === g.kind);
      let sent = 0;
      let failed = 0;
      for (const r of rows) {
        const s = statusByKey.get(r.dedupe_key);
        if (s === "sent") sent += 1;
        else if (s === "failed") failed += 1;
      }
      const sendAt = rows.length
        ? rows.map((r) => r.send_at).reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b))
        : null;
      return { ...g, planned: rows.length, sent, failed, waiting: rows.length - sent - failed, sendAt };
    });

    const bookingEmails = outbox.filter((r) => r.kind.startsWith("booking_"));
    const failures = outbox.filter((r) => r.status === "failed");
    return {
      groups,
      bookings: {
        sent: bookingEmails.filter((r) => r.status === "sent").length,
        pending: bookingEmails.filter((r) => r.status === "pending" || r.status === "sending").length,
      },
      failures,
    };
  }, [volunteers, bookings, outbox, now]);

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-amber-100">
          <Mail className="h-4 w-4" /> Email schedule
        </h2>
        <span className="text-xs text-slate-500">Updates live</span>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {view.groups.map((g) => {
            const future = g.sendAt !== null && Date.parse(g.sendAt) > now;
            const sendMs = g.sendAt ? Date.parse(g.sendAt) : 0;
            return (
              <section key={g.kind} className="rounded-xl border border-white/5 p-3">
                <p className="flex items-center gap-2 font-medium text-slate-100">
                  {g.sendAt === null ? (
                    <Clock3 className="h-4 w-4 text-slate-500" />
                  ) : future ? (
                    <Clock3 className="h-4 w-4 text-amber-300" />
                  ) : g.waiting > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  {g.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">{g.hint}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {g.planned === 0 ? (
                    "No volunteers in this group."
                  ) : (
                    <>
                      {g.planned} volunteer{g.planned === 1 ? "" : "s"} · {g.sent} sent
                      {g.waiting > 0 && ` · ${g.waiting} waiting`}
                      {g.failed > 0 && <span className="text-rose-300"> · {g.failed} failed</span>}
                    </>
                  )}
                </p>
                {g.sendAt && (
                  <p className="mt-1 text-xs text-slate-400">
                    {future
                      ? `Sends ${formatDay(g.sendAt)} at ${formatTime12(g.sendAt)} (${relative(sendMs - now)})`
                      : `Due since ${formatDay(g.sendAt)} at ${formatTime12(g.sendAt)}`}
                  </p>
                )}
              </section>
            );
          })}

          <section>
            <p className="text-xs uppercase tracking-wide text-slate-400">Booking confirmations and cancellations</p>
            <p className="mt-1 text-sm text-slate-200">
              {view.bookings.sent} sent · {view.bookings.pending} waiting to send
            </p>
          </section>

          {view.failures.length > 0 && (
            <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
              <p className="text-sm font-medium text-rose-200">
                {view.failures.length} email{view.failures.length === 1 ? "" : "s"} could not be sent
              </p>
              <p className="mt-1 break-words text-xs text-rose-200/80">
                Latest error: {view.failures[view.failures.length - 1].last_error ?? "unknown"}
              </p>
            </section>
          )}
        </div>
      )}
    </GlassCard>
  );
}
