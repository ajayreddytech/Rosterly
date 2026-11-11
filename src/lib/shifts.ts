import type { Shift } from "@/lib/types";

/** The gala is held in Toronto; all times are displayed in this zone. */
export const EVENT_TZ = "America/Toronto";

const time12 = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: EVENT_TZ,
});

const time24 = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: EVENT_TZ,
});

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: EVENT_TZ,
});

/** "9:00 AM" */
export function formatTime12(iso: string): string {
  return time12.format(new Date(iso));
}

/** "09:00" / "14:00" (used in the clash message) */
export function formatTime24(iso: string): string {
  return time24.format(new Date(iso));
}

/** "9:00 AM – 1:30 PM" */
export function formatRange12(start: string, end: string): string {
  return `${formatTime12(start)} – ${formatTime12(end)}`;
}

/** "Sat, Nov 14" */
export function formatDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

/** "4h", "3h 30m" */
export function formatDuration(start: string, end: string): string {
  const minutes = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  );
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/**
 * Interval overlap test: (StartA < EndB) AND (EndA > StartB).
 * Touching intervals (one ends exactly when the next starts) do NOT clash.
 */
export function intervalsOverlap(
  a: { start_time: string; end_time: string },
  b: { start_time: string; end_time: string },
): boolean {
  const startA = new Date(a.start_time).getTime();
  const endA = new Date(a.end_time).getTime();
  const startB = new Date(b.start_time).getTime();
  const endB = new Date(b.end_time).getTime();
  return startA < endB && endA > startB;
}

/** First already-booked shift that clashes with `candidate`, if any. */
export function findConflict(
  candidate: Shift,
  bookedShifts: Shift[],
): Shift | undefined {
  return bookedShifts.find(
    (booked) => booked.id !== candidate.id && intervalsOverlap(candidate, booked),
  );
}

export function timeConflictMessage(conflict: Shift): string {
  return `Time Conflict: This shift overlaps with your registered shift '${conflict.title}' (${formatTime24(conflict.start_time)} - ${formatTime24(conflict.end_time)}).`;
}

/** Offset (ms) between a timezone's wall clock and UTC at instant `ts`. */
function tzOffsetMs(ts: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - ts;
}

/** Converts a Toronto wall-clock date ("2026-11-14") + time ("09:30") to a UTC ISO string. */
export function zonedToIso(date: string, time: string, tz: string = EVENT_TZ): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - tzOffsetMs(guess, tz)).toISOString();
}

/** Inverse of zonedToIso: UTC ISO → { date: "2026-11-14", time: "09:30" } in Toronto time. */
export function isoToZoned(iso: string, tz: string = EVENT_TZ): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
