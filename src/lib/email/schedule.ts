import { isoToZoned, zonedToIso } from "@/lib/shifts";

/**
 * Email schedule (Toronto time). Shared by the server planner and the admin
 * panel, so both always agree on when each email goes out.
 *
 *   Morning shift reminder (starts before 12:00): today, 13 Nov, at 5:30 PM
 *   Later shift reminder (starts at 12:00 or after): 14 Nov at 8:00 AM
 *
 * Volunteers with no shift get no automatic email.
 */
export const MORNING_CUTOFF_HOUR = 12;

export function isMorningShift(startIso: string): boolean {
  const { time } = isoToZoned(startIso);
  return Number(time.slice(0, 2)) < MORNING_CUTOFF_HOUR;
}

/** When the morning shift reminder goes out. */
export function morningReminderSendAt(): string {
  return zonedToIso("2026-11-13", "17:30");
}

/** When the later shift reminder goes out. */
export function laterReminderSendAt(): string {
  return zonedToIso("2026-11-14", "08:00");
}
