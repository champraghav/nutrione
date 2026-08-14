import { describe, expect, it } from 'vitest';
import {
  completionRate,
  computeStreaks,
  HabitSchedule,
  isDoneOn,
  isDueOn,
  recentDays,
  shiftYmd,
  weekdayOf,
} from '../habits.calc';

const daily: HabitSchedule = { cadence: 'daily', targetPerDay: 1, daysOfWeek: null };
const thriceDaily: HabitSchedule = { cadence: 'daily', targetPerDay: 3, daysOfWeek: null };
// 2026-08-10 is a Monday.
const mwf: HabitSchedule = { cadence: 'weekly', targetPerDay: 1, daysOfWeek: [1, 3, 5] };

function counts(...days: Array<[string, number]>): Map<string, number> {
  return new Map(days);
}

function done(...days: string[]): Map<string, number> {
  return new Map(days.map((d) => [d, 1]));
}

describe('date helpers', () => {
  it('shifts across a month boundary', () => {
    expect(shiftYmd('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftYmd('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('shifts across a leap day', () => {
    expect(shiftYmd('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('reads weekdays with Sunday as 0', () => {
    expect(weekdayOf('2026-08-10')).toBe(1); // Monday
    expect(weekdayOf('2026-08-16')).toBe(0); // Sunday
  });
});

describe('isDueOn', () => {
  it('says a daily habit is due every day', () => {
    expect(isDueOn(daily, '2026-08-11')).toBe(true);
    expect(isDueOn(daily, '2026-08-16')).toBe(true);
  });

  it('only schedules a weekly habit on its own weekdays', () => {
    expect(isDueOn(mwf, '2026-08-10')).toBe(true); // Mon
    expect(isDueOn(mwf, '2026-08-11')).toBe(false); // Tue
    expect(isDueOn(mwf, '2026-08-12')).toBe(true); // Wed
  });

  it('is never due when a weekly habit has no days set', () => {
    expect(isDueOn({ cadence: 'weekly', targetPerDay: 1, daysOfWeek: [] }, '2026-08-10')).toBe(false);
    expect(isDueOn({ cadence: 'weekly', targetPerDay: 1, daysOfWeek: null }, '2026-08-10')).toBe(false);
  });
});

describe('isDoneOn', () => {
  it('needs the full count for a multi-times-a-day habit', () => {
    const c = counts(['2026-08-14', 2]);
    expect(isDoneOn(thriceDaily, c, '2026-08-14')).toBe(false);
    c.set('2026-08-14', 3);
    expect(isDoneOn(thriceDaily, c, '2026-08-14')).toBe(true);
  });

  it('treats an unlogged day as not done', () => {
    expect(isDoneOn(daily, counts(), '2026-08-14')).toBe(false);
  });
});

describe('computeStreaks', () => {
  it('counts consecutive completed days ending today', () => {
    const c = done('2026-08-12', '2026-08-13', '2026-08-14');
    expect(computeStreaks(daily, c, '2026-08-14').current).toBe(3);
  });

  it('does not break the streak just because today is not done yet', () => {
    const c = done('2026-08-12', '2026-08-13');
    expect(computeStreaks(daily, c, '2026-08-14').current).toBe(2);
  });

  it('breaks the streak on a missed day', () => {
    const c = done('2026-08-10', '2026-08-11', '2026-08-13');
    expect(computeStreaks(daily, c, '2026-08-13').current).toBe(1);
  });

  it('is zero with nothing logged', () => {
    expect(computeStreaks(daily, counts(), '2026-08-14')).toEqual({ current: 0, longest: 0 });
  });

  it('ignores off-days for a weekly habit', () => {
    // Mon 10th, Wed 12th, Fri 14th done; Tue/Thu skipped and irrelevant.
    const c = done('2026-08-10', '2026-08-12', '2026-08-14');
    expect(computeStreaks(mwf, c, '2026-08-14').current).toBe(3);
  });

  it('breaks a weekly streak when a scheduled day is missed', () => {
    const c = done('2026-08-10', '2026-08-14'); // Wed the 12th missed
    expect(computeStreaks(mwf, c, '2026-08-14').current).toBe(1);
  });

  it('reports the longest run from history, not just the current one', () => {
    const c = done(
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05',
      // 6th and 7th missed
      '2026-08-13', '2026-08-14'
    );
    expect(computeStreaks(daily, c, '2026-08-14')).toEqual({ current: 2, longest: 5 });
  });

  it('never reports a longest shorter than the current streak', () => {
    const c = done('2026-08-13', '2026-08-14');
    const result = computeStreaks(daily, c, '2026-08-14');
    expect(result.longest).toBeGreaterThanOrEqual(result.current);
  });

  it('does not count partial days towards a multi-count streak', () => {
    const c = counts(['2026-08-13', 3], ['2026-08-14', 1]);
    // Today is short of target, so it counts back from yesterday.
    expect(computeStreaks(thriceDaily, c, '2026-08-14').current).toBe(1);
  });
});

describe('completionRate', () => {
  it('is the share of due days completed', () => {
    const c = done('2026-08-10', '2026-08-12', '2026-08-14');
    // 5 due days (10th-14th), 3 done.
    expect(completionRate(daily, c, '2026-08-10', '2026-08-14')).toBe(60);
  });

  it('only counts scheduled days for a weekly habit', () => {
    const c = done('2026-08-10', '2026-08-12');
    // Mon/Wed/Fri due in that window = 3 days, 2 done.
    expect(completionRate(mwf, c, '2026-08-10', '2026-08-14')).toBe(67);
  });

  it('returns null rather than 0% when nothing was due', () => {
    // Tue-Thu contains no Mon/Wed/Fri... except Wed. Use Sat-Sun instead.
    expect(completionRate(mwf, counts(), '2026-08-15', '2026-08-16')).toBeNull();
  });

  it('is 100 when every due day is done', () => {
    const c = done('2026-08-13', '2026-08-14');
    expect(completionRate(daily, c, '2026-08-13', '2026-08-14')).toBe(100);
  });
});

describe('recentDays', () => {
  it('returns the window oldest first, ending today', () => {
    expect(recentDays('2026-08-14', 3)).toEqual(['2026-08-12', '2026-08-13', '2026-08-14']);
  });
});
