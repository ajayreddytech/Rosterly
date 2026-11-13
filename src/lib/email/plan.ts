import { isMorningShift, laterReminderSendAt, morningReminderSendAt } from "./schedule";

/**
 * Decides which reminder emails are queued automatically. Pure function, no
 * database or network access, so the cron job and the admin panel share it.
 *
 * Each volunteer gets at most ONE email, however many shifts they hold. The
 * email lists all their upcoming shifts. A volunteer with any morning shift gets
 * the morning reminder; a volunteer with only later shifts gets the later reminder.
 * Volunteers with no shift are not queued.
 */

export type ReminderKind = "reminder_morning" | "reminder_later" | "reminder_event";

export interface PlanVolunteer {
  id: string;
  full_name: string;
  email: string;
}

/** One booking, flattened from shift_assignments + shifts + departments. */
export interface PlanBooking {
  user_id: string;
  title: string;
  department: string;
  start_time: string;
  end_time: string;
}

export interface PlanShift {
  title: string;
  department: string;
  start_time: string;
  end_time: string;
}

export interface PlannedReminder {
  kind: ReminderKind;
  user_id: string;
  full_name: string;
  email: string;
  /** ISO time the email is due. Past or present means it is ready to send. */
  send_at: string;
  /** Unique per volunteer and group, so a re-run never sends twice. */
  dedupe_key: string;
  /** Upcoming shifts shown in the email, earliest first. Empty for event emails. */
  shifts: PlanShift[];
}

export function buildReminderPlan(
  volunteers: PlanVolunteer[],
  bookings: PlanBooking[],
  now: Date = new Date(),
): PlannedReminder[] {
  const nowMs = now.getTime();

  const upcomingByUser = new Map<string, PlanBooking[]>();
  for (const b of bookings) {
    if (Date.parse(b.start_time) <= nowMs) continue;
    const list = upcomingByUser.get(b.user_id) ?? [];
    list.push(b);
    upcomingByUser.set(b.user_id, list);
  }

  const plan: PlannedReminder[] = [];

  for (const v of volunteers) {
    const mine = (upcomingByUser.get(v.id) ?? []).sort(
      (a, b) => Date.parse(a.start_time) - Date.parse(b.start_time),
    );
    if (mine.length === 0) continue; // no shift: no automatic email

    const hasMorning = mine.some((b) => isMorningShift(b.start_time));
    const kind: ReminderKind = hasMorning ? "reminder_morning" : "reminder_later";
    const sendAt = hasMorning ? morningReminderSendAt() : laterReminderSendAt();

    plan.push({
      user_id: v.id,
      full_name: v.full_name,
      email: v.email,
      kind,
      send_at: sendAt,
      dedupe_key: `${kind}:${v.id}`,
      shifts: mine.map(toShift),
    });
  }

  return plan;
}

function toShift(b: PlanBooking): PlanShift {
  return {
    title: b.title,
    department: b.department,
    start_time: b.start_time,
    end_time: b.end_time,
  };
}
