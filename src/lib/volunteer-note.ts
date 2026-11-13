import { GALA_DAY } from "@/lib/venue";
import { zonedToIso } from "@/lib/shifts";
import type { PlanShift } from "@/lib/email/plan";

/**
 * Volunteers imported with a note (for example "9 AM to 12 AM") have no shift
 * bookings. The note holds their check-in and check-out times on the gala day.
 * These helpers turn that note into shift-like times, so the counts and the
 * email planner treat them as signed up for a shift.
 */

const NOTE_PATTERN = /^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*(?:to|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i;

/** "9 AM" -> 9, "12 PM" -> 12, "12 AM" -> 0. Returns null if the value is out of range. */
function to24(hour: string, ampm: string): number | null {
  const h = Number(hour);
  if (h < 1 || h > 12) return null;
  const base = h % 12;
  return ampm.toUpperCase() === "PM" ? base + 12 : base;
}

/** Parses a note like "4 PM to 8 PM" into 24-hour start and end values. Null if it does not match. */
export function parseVolunteerNote(note: string | null | undefined): { startMinutes: number; endMinutes: number } | null {
  if (!note) return null;
  const m = NOTE_PATTERN.exec(note);
  if (!m) return null;
  const startH = to24(m[1], m[3]);
  const endH = to24(m[4], m[6]);
  if (startH === null || endH === null) return null;
  const startMinutes = startH * 60 + Number(m[2] ?? 0);
  const endMinutes = endH * 60 + Number(m[5] ?? 0);
  return { startMinutes, endMinutes };
}

/** True when the note says the volunteer starts at exactly 9 AM. */
export function noteStartsAtNine(note: string | null | undefined): boolean {
  return parseVolunteerNote(note)?.startMinutes === 9 * 60;
}

/** The day after a Toronto calendar date ("2026-11-14" -> "2026-11-15"). */
function nextDay(date: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function hhmm(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** True when a volunteer counts as signed up for at least one shift, from a booking or a readable note. */
export function hasNoteShift(note: string | null | undefined): boolean {
  return noteShifts(note).length > 0;
}

/**
 * Admin dashboard counts. `total` is every volunteer. `booked` is every volunteer
 * with a shift booking or a readable note. Each volunteer is counted once.
 */
export function countSignedUp(
  volunteers: { id: string; note?: string | null }[],
  bookedUserIds: Iterable<string>,
): { total: number; booked: number } {
  const booked = new Set(bookedUserIds);
  let bookedCount = 0;
  for (const v of volunteers) {
    if (booked.has(v.id) || hasNoteShift(v.note)) bookedCount += 1;
  }
  return { total: volunteers.length, booked: bookedCount };
}

/**
 * The note as a shift on the gala day. An end time at or before the start
 * (for example "12 AM") is read as the next morning. Returns [] if the note
 * cannot be read.
 */
export function noteShifts(note: string | null | undefined): PlanShift[] {
  const parsed = parseVolunteerNote(note);
  if (!parsed) return [];
  const endDay = parsed.endMinutes <= parsed.startMinutes ? nextDay(GALA_DAY) : GALA_DAY;
  return [
    {
      title: "Check-in and check-out",
      department: "",
      start_time: zonedToIso(GALA_DAY, hhmm(parsed.startMinutes)),
      end_time: zonedToIso(endDay, hhmm(parsed.endMinutes)),
    },
  ];
}
