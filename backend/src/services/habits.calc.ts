/**
 * Streak and schedule maths for habits.
 *
 * Kept free of the database so the rules that decide "did I keep my streak?"
 * can be tested directly — that number is the whole point of a habit tracker,
 * and it is easy to get subtly wrong around skipped days and weekly habits.
 *
 * Dates are 'YYYY-MM-DD' strings throughout. They are the user's local dates
 * (the frontend sends its own local date, never a UTC-shifted one), so all
 * arithmetic here is done on the string parts rather than on Date objects in
 * some ambient timezone.
 */

export type Cadence = 'daily' | 'weekly';

export interface HabitSchedule {
  cadence: Cadence;
  /** How many times a day counts as done. 1 for a plain yes/no habit. */
  targetPerDay: number;
  /** For weekly habits: which weekdays it is due on, 0 = Sunday. */
  daysOfWeek: number[] | null;
}

export function parseYmd(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map((part) => parseInt(part, 10));
  return { year, month, day };
}

/** Shifts a 'YYYY-MM-DD' by whole days, staying on calendar days (no DST drift). */
export function shiftYmd(date: string, days: number): string {
  const { year, month, day } = parseYmd(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day of week for a local date string. 0 = Sunday, matching Date#getDay. */
export function weekdayOf(date: string): number {
  const { year, month, day } = parseYmd(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Whether the habit is scheduled on this date at all. */
export function isDueOn(schedule: HabitSchedule, date: string): boolean {
  if (schedule.cadence === 'daily') return true;
  const days = schedule.daysOfWeek;
  if (!days || days.length === 0) return false;
  return days.includes(weekdayOf(date));
}

/** Whether the logged count for a date satisfies the habit's daily target. */
export function isDoneOn(schedule: HabitSchedule, counts: Map<string, number>, date: string): boolean {
  const target = Math.max(1, schedule.targetPerDay);
  return (counts.get(date) ?? 0) >= target;
}

export interface StreakResult {
  /** Consecutive due days completed, counting back from today. */
  current: number;
  /** Best run of consecutive due days ever completed. */
  longest: number;
}

/**
 * Walks backwards from today over the days the habit is *due*, so skipping a
 * Tuesday never breaks a Mon/Wed/Fri habit.
 *
 * Today counts only once it is done, but an unfinished today does not break
 * the streak either — the day is not over yet. That is what every habit app
 * does, and the alternative (streak drops to zero at midnight and comes back
 * when you tick the box) reads as a bug to the user.
 */
export function computeStreaks(
  schedule: HabitSchedule,
  counts: Map<string, number>,
  today: string,
  lookbackDays = 400
): StreakResult {
  let current = 0;
  let cursor = today;

  // If today is due but not yet done, start counting from the previous day.
  if (isDueOn(schedule, cursor) && !isDoneOn(schedule, counts, cursor)) {
    cursor = shiftYmd(cursor, -1);
  }

  for (let i = 0; i < lookbackDays; i += 1) {
    if (isDueOn(schedule, cursor)) {
      if (!isDoneOn(schedule, counts, cursor)) break;
      current += 1;
    }
    cursor = shiftYmd(cursor, -1);
  }

  // Longest run: scan the whole logged history, not just the recent window.
  const logged = [...counts.keys()].sort();
  let longest = current;
  if (logged.length > 0) {
    let run = 0;
    let day = logged[0];
    while (day <= today) {
      if (isDueOn(schedule, day)) {
        if (isDoneOn(schedule, counts, day)) {
          run += 1;
          if (run > longest) longest = run;
        } else {
          run = 0;
        }
      }
      day = shiftYmd(day, 1);
    }
  }

  return { current, longest };
}

/**
 * Share of due days in a window that were completed, as a 0-100 percentage.
 * Returns null when nothing was due, so the UI can say "not scheduled"
 * instead of a misleading 0%.
 */
export function completionRate(
  schedule: HabitSchedule,
  counts: Map<string, number>,
  from: string,
  to: string
): number | null {
  let due = 0;
  let done = 0;

  for (let day = from; day <= to; day = shiftYmd(day, 1)) {
    if (!isDueOn(schedule, day)) continue;
    due += 1;
    if (isDoneOn(schedule, counts, day)) done += 1;
  }

  if (due === 0) return null;
  return Math.round((done / due) * 100);
}

/** Last N days as date strings, oldest first — the little dot row in the UI. */
export function recentDays(today: string, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(shiftYmd(today, -i));
  return out;
}
