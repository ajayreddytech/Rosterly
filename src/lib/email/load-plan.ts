import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReminderPlan, type PlanBooking, type PlannedReminder, type PlanVolunteer } from "./plan";
import { noteShifts } from "@/lib/volunteer-note";
import type { NewEmail } from "./outbox";
import type { PlanShift } from "./plan";

/** Turns plan rows into queue rows. `sendAt` overrides the scheduled time (used for "send now"). */
export function toQueueRows(plan: PlannedReminder[], sendAt?: string): NewEmail[] {
  return plan.map((r) => ({
    kind: r.kind,
    user_id: r.user_id,
    send_at: sendAt ?? r.send_at,
    dedupe_key: r.dedupe_key,
    payload: { full_name: r.full_name, email: r.email, shifts: r.shifts },
  }));
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

/** A volunteer's details and shifts as they are in the database right now. */
export interface CurrentVolunteer {
  full_name: string;
  email: string;
  shifts: PlanShift[];
}

/**
 * Reads one volunteer's current profile and shifts. Called right before an email
 * is sent, so the email reflects any change made after it was queued.
 * Returns null if the profile no longer exists.
 */
export async function loadCurrentVolunteer(userId: string): Promise<CurrentVolunteer | null> {
  const admin = createAdminClient();
  const [prof, assigns] = await Promise.all([
    admin.from("profiles").select("full_name, email, note").eq("id", userId).maybeSingle(),
    admin
      .from("shift_assignments")
      .select("shifts(title, start_time, end_time, departments(name))")
      .eq("user_id", userId),
  ]);
  if (prof.error) throw new Error(`Could not read volunteer: ${prof.error.message}`);
  if (assigns.error) throw new Error(`Could not read shifts: ${assigns.error.message}`);
  if (!prof.data) return null;

  const shifts: PlanShift[] = [];
  for (const row of (assigns.data ?? []) as unknown as { shifts: AssignmentRow["shifts"] }[]) {
    const s = row.shifts;
    if (!s) continue;
    const dept = Array.isArray(s.departments) ? s.departments[0] : s.departments;
    shifts.push({
      title: s.title,
      department: dept?.name ?? "",
      start_time: s.start_time,
      end_time: s.end_time,
    });
  }

  shifts.push(...noteShifts(prof.data.note as string | null));
  shifts.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));

  return {
    full_name: (prof.data.full_name as string) ?? "",
    email: prof.data.email as string,
    shifts,
  };
}

/** Reads every volunteer and booking, then works out the full reminder plan. */
export async function loadReminderPlan(now: Date = new Date()): Promise<PlannedReminder[]> {
  const admin = createAdminClient();
  const [vols, assigns] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, note").eq("role", "volunteer"),
    admin
      .from("shift_assignments")
      .select("user_id, shifts(title, start_time, end_time, departments(name))"),
  ]);
  if (vols.error) throw new Error(`Could not read volunteers: ${vols.error.message}`);
  if (assigns.error) throw new Error(`Could not read bookings: ${assigns.error.message}`);

  const volunteers: PlanVolunteer[] = (vols.data ?? []).map((v) => ({
    id: v.id as string,
    full_name: (v.full_name as string) ?? "",
    email: v.email as string,
    note: (v.note as string | null) ?? null,
  }));

  const bookings: PlanBooking[] = [];
  for (const row of (assigns.data ?? []) as unknown as AssignmentRow[]) {
    const s = row.shifts;
    if (!s) continue;
    const dept = Array.isArray(s.departments) ? s.departments[0] : s.departments;
    bookings.push({
      user_id: row.user_id,
      title: s.title,
      department: dept?.name ?? "",
      start_time: s.start_time,
      end_time: s.end_time,
    });
  }

  return buildReminderPlan(volunteers, bookings, now);
}
