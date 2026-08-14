/**
 * Date helpers for daily logging.
 *
 * These deliberately use the *local* calendar date rather than
 * `new Date().toISOString().slice(0, 10)`, which returns the UTC date. For
 * anyone east of UTC (IST is +5:30) that older approach silently logged
 * late-night entries to the previous day, and "today" only rolled over at
 * 05:30 local time instead of midnight.
 */

/** Today's date in the user's own timezone, as YYYY-MM-DD. */
export function todayLocal(): string {
  return toLocalDateString(new Date());
}

/** Formats a Date as YYYY-MM-DD using local calendar fields, not UTC. */
export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Shifts a YYYY-MM-DD string by whole days, staying in local time. */
export function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return toLocalDateString(date);
}

/** "Today" / "Yesterday" / "Mon, 12 Aug" for a date picker label. */
export function friendlyDateLabel(dateStr: string): string {
  const today = todayLocal();
  if (dateStr === today) return 'Today';
  if (dateStr === shiftDate(today, -1)) return 'Yesterday';
  if (dateStr === shiftDate(today, 1)) return 'Tomorrow';

  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Guards the date picker against logging into the future. */
export function isFuture(dateStr: string): boolean {
  return dateStr > todayLocal();
}
