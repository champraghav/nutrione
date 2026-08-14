import { describe, it, expect } from 'vitest';

/**
 * Mirrors web/src/utils/dates.ts. The bug being guarded: using
 * toISOString().slice(0,10) returns the UTC date, so a user in IST (+5:30)
 * logging at 01:00 on the 15th would have it recorded against the 14th.
 */
function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
