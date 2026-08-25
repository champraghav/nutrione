import { describe, expect, it } from 'vitest';
import {
  averageAdherence,
  coversDate,
  cycleDayFor,
  daysBetween,
  dietAdherence,
  LoggedFood,
  PlannedFood,
} from '../plans.calc';

function planned(id: string, foodId: string | null, meal: string, qty: number | null): PlannedFood {
  return { id, food_id: foodId, meal_type: meal, name: id, quantity: qty, unit: 'g' };
}

function logged(id: string, foodId: string, meal: string, qty: number): LoggedFood {
  return { id, food_id: foodId, meal_type: meal, name: id, quantity: qty, unit: 'g' };
}

describe('daysBetween', () => {
  it('counts whole calendar days across a month boundary', () => {
    expect(daysBetween('2026-08-30', '2026-09-02')).toBe(3);
  });

  it('is negative going backwards', () => {
    expect(daysBetween('2026-09-02', '2026-08-30')).toBe(-3);
  });
});

describe('cycleDayFor', () => {
  it('starts a plan on day 1', () => {
    expect(cycleDayFor('2026-08-10', '2026-08-10', 7)).toBe(1);
  });

  it('walks through the cycle and wraps back to day 1', () => {
    expect(cycleDayFor('2026-08-10', '2026-08-13', 7)).toBe(4);
    expect(cycleDayFor('2026-08-10', '2026-08-16', 7)).toBe(7);
    expect(cycleDayFor('2026-08-10', '2026-08-17', 7)).toBe(1);
  });

  it('keeps a weekly plan on the same weekdays weeks later', () => {
    // Started on a Monday, so every later Monday is day 1 again.
    expect(cycleDayFor('2026-08-10', '2026-09-07', 7)).toBe(1);
  });

  it('treats a 1-day plan as the same every day', () => {
    expect(cycleDayFor('2026-08-10', '2026-08-10', 1)).toBe(1);
    expect(cycleDayFor('2026-08-10', '2026-08-25', 1)).toBe(1);
  });

  it('returns null before the plan starts', () => {
    expect(cycleDayFor('2026-08-10', '2026-08-09', 7)).toBeNull();
  });
});

describe('coversDate', () => {
  const base = { start_date: '2026-08-10', end_date: '2026-08-20', active: true };

  it('covers dates inside the window, inclusive of both ends', () => {
    expect(coversDate(base, '2026-08-10')).toBe(true);
    expect(coversDate(base, '2026-08-15')).toBe(true);
    expect(coversDate(base, '2026-08-20')).toBe(true);
  });

  it('excludes dates outside the window', () => {
    expect(coversDate(base, '2026-08-09')).toBe(false);
    expect(coversDate(base, '2026-08-21')).toBe(false);
  });

  it('runs open-ended when there is no end date', () => {
    expect(coversDate({ ...base, end_date: null }, '2027-01-01')).toBe(true);
  });

  it('ignores an inactive assignment entirely', () => {
    expect(coversDate({ ...base, active: false }, '2026-08-15')).toBe(false);
  });
});

describe('dietAdherence', () => {
  it('marks a plan followed when the right food is logged at the right amount', () => {
    const result = dietAdherence(
      [planned('p1', 'rice', 'lunch', 100)],
      [logged('l1', 'rice', 'lunch', 100)]
    );
    expect(result.percent).toBe(100);
    expect(result.followed).toBe(1);
    expect(result.lines[0].loggedId).toBe('l1');
  });

  it('tolerates an eyeballed portion within 25%', () => {
    const result = dietAdherence([planned('p1', 'rice', 'lunch', 100)], [logged('l1', 'rice', 'lunch', 120)]);
    expect(result.lines[0].status).toBe('followed');
  });

  it('counts a badly wrong portion as partial, not a miss', () => {
    const result = dietAdherence([planned('p1', 'rice', 'lunch', 100)], [logged('l1', 'rice', 'lunch', 300)]);
    expect(result.lines[0].status).toBe('partial');
    expect(result.percent).toBe(50);
  });

  it('marks a planned food that was never logged as missed', () => {
    const result = dietAdherence([planned('p1', 'rice', 'lunch', 100)], []);
    expect(result.lines[0].status).toBe('missed');
    expect(result.percent).toBe(0);
  });

  it('still credits the planned food when eaten at a different meal', () => {
    const result = dietAdherence([planned('p1', 'rice', 'lunch', 100)], [logged('l1', 'rice', 'dinner', 100)]);
    expect(result.lines[0].status).toBe('followed');
  });

  it('prefers the matching meal slot when the same food appears twice', () => {
    const result = dietAdherence(
      [planned('p1', 'rice', 'dinner', 100)],
      [logged('breakfastRice', 'rice', 'breakfast', 500), logged('dinnerRice', 'rice', 'dinner', 100)]
    );
    expect(result.lines[0].loggedId).toBe('dinnerRice');
    expect(result.lines[0].status).toBe('followed');
  });

  it('never lets one logged item satisfy two planned lines', () => {
    const result = dietAdherence(
      [planned('p1', 'rice', 'lunch', 100), planned('p2', 'rice', 'dinner', 100)],
      [logged('l1', 'rice', 'lunch', 100)]
    );
    expect(result.followed).toBe(1);
    expect(result.missed).toBe(1);
    expect(result.percent).toBe(50);
  });

  it('reports food eaten off-plan as extras', () => {
    const result = dietAdherence(
      [planned('p1', 'rice', 'lunch', 100)],
      [logged('l1', 'rice', 'lunch', 100), logged('l2', 'cake', 'snack', 200)]
    );
    expect(result.extras.map((e) => e.id)).toEqual(['l2']);
    // Extras do not reduce adherence; they are shown separately so the coach
    // can see both "followed the plan" and "also ate this".
    expect(result.percent).toBe(100);
  });

  it('accepts any amount for a plan line with no quantity set', () => {
    const result = dietAdherence([planned('p1', 'rice', 'lunch', null)], [logged('l1', 'rice', 'lunch', 999)]);
    expect(result.lines[0].status).toBe('followed');
  });

  it('returns null rather than 0% for a day with nothing planned', () => {
    expect(dietAdherence([], [logged('l1', 'rice', 'lunch', 100)]).percent).toBeNull();
  });

  it('never matches a free-text plan line to a logged food', () => {
    // A custom_name line has no food_id, so there is nothing to match on.
    const result = dietAdherence([planned('p1', null, 'lunch', 100)], [logged('l1', 'rice', 'lunch', 100)]);
    expect(result.lines[0].status).toBe('missed');
    expect(result.extras).toHaveLength(1);
  });
});

describe('dietAdherence with manual check-offs', () => {
  it('lets a hand tick satisfy a free-text plan line', () => {
    // Without this, "handful of chana" could never be satisfied and would
    // drag every adherence score down forever.
    const line = planned('p1', null, 'snack', 30);
    const result = dietAdherence([line], [], new Set(['p1']));
    expect(result.lines[0].status).toBe('followed');
    expect(result.lines[0].checkedOff).toBe(true);
    expect(result.percent).toBe(100);
  });

  it('marks a free-text line as manual-only so the UI can offer a checkbox', () => {
    const result = dietAdherence([planned('p1', null, 'snack', 30)], []);
    expect(result.lines[0].manualOnly).toBe(true);
    expect(result.lines[0].status).toBe('missed');
  });

  it('does not mark a food-backed line as manual-only', () => {
    const result = dietAdherence([planned('p1', 'rice', 'lunch', 100)], []);
    expect(result.lines[0].manualOnly).toBe(false);
  });

  it('lets a tick override a food line the client logged under another name', () => {
    const result = dietAdherence([planned('p1', 'rice', 'lunch', 100)], [], new Set(['p1']));
    expect(result.lines[0].status).toBe('followed');
  });

  it('leaves the logged food available as an extra when the line was ticked instead', () => {
    const result = dietAdherence(
      [planned('p1', 'rice', 'lunch', 100)],
      [logged('l1', 'rice', 'lunch', 100)],
      new Set(['p1'])
    );
    expect(result.lines[0].checkedOff).toBe(true);
    expect(result.extras.map((e) => e.id)).toEqual(['l1']);
  });
});

describe('averageAdherence', () => {
  it('averages the days that had a plan', () => {
    expect(averageAdherence([100, 50, 0])).toBe(50);
  });

  it('skips unplanned days instead of counting them as zero', () => {
    expect(averageAdherence([100, null, null, 50])).toBe(75);
  });

  it('is null when no day had a plan', () => {
    expect(averageAdherence([null, null])).toBeNull();
  });
});
