/** Capitalize the first letter of each word as the user types (spaces and hyphens start a new word). */
export function capitalizeWords(value: string): string {
  return value.replace(/(^|[\s-])(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Format a Canadian phone number as the user types, e.g. "+1 416 555 0123".
 * The +1 prefix is added automatically; a leading "1" typed by the user is treated as the country code.
 */
export function formatCanadianPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return "";

  let out = `+1 ${digits.slice(0, 3)}`;
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += ` ${digits.slice(6, 10)}`;
  return out;
}

/** True when the phone holds exactly 10 Canadian digits. */
export function isCanadianPhone(value: string): boolean {
  return value.replace(/\D/g, "").replace(/^1/, "").length === 10;
}
