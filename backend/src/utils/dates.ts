/**
 * Calendar-date helpers.
 *
 * A "day" in this app is a calendar day in the *user's* timezone, not in UTC.
 * `new Date().toISOString().slice(0, 10)` is the UTC date, and using it as
 * "today" is wrong for everyone who does not live on the prime meridian:
 *
 * - East of UTC (IST is +05:30), between local midnight and 05:30 the UTC date
 *   is still yesterday, so a fresh morning is treated as the previous day.
 * - West of UTC (PDT is -07:00), from 17:00 local onward the UTC date has
 *   already rolled over, so the evening is treated as tomorrow — a day with
 *   nothing logged in it.
 *
 * The web client already sends its own local date on every request. These
 * helpers cover the server-side fallbacks for when it does not.
 */

/** Formats an instant as YYYY-MM-DD in the given IANA timezone. */
export function localDateInZone(timeZone: string, now: Date = new Date()): string {
  try {
    // en-CA renders as YYYY-MM-DD, which is the format used throughout.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    // An unknown or corrupt timezone should not take a request down; UTC is a
    // defensible fallback and matches the column default.
    return now.toISOString().slice(0, 10);
  }
}

/** Shifts a YYYY-MM-DD string by whole days without touching timezones. */
export function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/** True when the string is a well-formed YYYY-MM-DD calendar date. */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Round-tripping rejects the likes of 2026-02-31, which Date would roll over
  // to March rather than refuse.
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
}
