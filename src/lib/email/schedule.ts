import { GALA_DAY } from "@/lib/venue";
import { isoToZoned, zonedToIso } from "@/lib/shifts";

/**
 * Email schedule (Toronto time). Shared by the server planner and the admin
 * panel, so both always agree on when each email goes out.
 *
 *   Morning shift (starts before 12:00): previous day at 4:00 PM
 *   Any other shift:                     same day at 7:00 AM
 *   Registered but no shift at all:      gala day at 7:00 AM (event email)
 */
export const MORNING_CUTOFF_HOUR = 12;

export function isMorningShift(startIso: string): boolean {
  const { time } = isoToZoned(startIso);
  return Number(time.slice(0, 2)) < MORNING_CUTOFF_HOUR;
}

/** When the reminder for a shift is due. */
export function reminderSendAt(startIso: string): string {
  const { date } = isoToZoned(startIso);
  if (isMorningShift(startIso)) {
    const [y, m, d] = date.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
    return zonedToIso(prev, "16:00");
  }
  return zonedToIso(date, "07:00");
}

/** When the event email goes to volunteers who have not booked a shift. */
export function eventEmailSendAt(): string {
  return zonedToIso(GALA_DAY, "07:00");
}
