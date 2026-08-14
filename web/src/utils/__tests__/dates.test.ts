import { describe, expect, it } from 'vitest';
import { friendlyDateLabel, isFuture, shiftDate, toLocalDateString, todayLocal } from '../dates';

describe('local vs UTC date', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 01:00 on 15 Aug in IST is still 19:30 on 14 Aug in UTC.
    const istEarlyMorning = new Date('2026-08-14T19:30:00Z');
    const local = new Date(istEarlyMorning.getTime() + 5.5 * 3600 * 1000);

    // What the old code did:
    expect(istEarlyMorning.toISOString().slice(0, 10)).toBe('2026-08-14');
    // What a +5:30 user actually sees on their calendar:
    expect(toLocalDateString(local)).toBe('2026-08-15');
  });

  it('pads single-digit months and days', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('shiftDate', () => {
  it('crosses month boundaries', () => {
    expect(shiftDate('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('crosses year boundaries', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('round-trips', () => {
    expect(shiftDate(shiftDate('2026-08-14', -7), 7)).toBe('2026-08-14');
  });
});

describe('friendlyDateLabel', () => {
  it('names today and yesterday relative to the local date', () => {
    const today = todayLocal();
    expect(friendlyDateLabel(today)).toBe('Today');
    expect(friendlyDateLabel(shiftDate(today, -1))).toBe('Yesterday');
    expect(friendlyDateLabel(shiftDate(today, 1))).toBe('Tomorrow');
  });

  it('falls back to a weekday and date further out', () => {
    const label = friendlyDateLabel(shiftDate(todayLocal(), -10));
    expect(label).not.toBe('Today');
    expect(label.length).toBeGreaterThan(3);
  });
});

describe('isFuture', () => {
  it('guards the date picker against logging ahead of today', () => {
    expect(isFuture(shiftDate(todayLocal(), 1))).toBe(true);
    expect(isFuture(todayLocal())).toBe(false);
    expect(isFuture(shiftDate(todayLocal(), -1))).toBe(false);
  });
});
