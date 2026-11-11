/** Turns raw Postgres/RPC error messages into friendly UI copy. */
export function friendlyBookingError(raw: string | undefined | null): string {
  const msg = raw ?? "";
  if (msg.includes("SLOT_FULL")) {
    return "Slot just filled up! Someone grabbed the last spot. Try another shift.";
  }
  if (msg.includes("TIME_CONFLICT")) {
    return "Time Conflict: This shift overlaps with a shift you are already registered for.";
  }
  if (msg.includes("ALREADY_BOOKED") || msg.includes("duplicate key")) {
    return "You are already registered for this shift.";
  }
  if (msg.includes("SHIFT_NOT_FOUND")) {
    return "This shift no longer exists. Refresh the page and try again.";
  }
  if (msg.includes("NOT_AUTHENTICATED") || msg.includes("JWT")) {
    return "Your session has expired. Please sign in again.";
  }
  if (msg.includes("NOT_BOOKED")) {
    return "You are not registered for this shift.";
  }
  return "Something went wrong. Please try again.";
}
