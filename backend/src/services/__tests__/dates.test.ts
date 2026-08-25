import { describe, it, expect } from 'vitest';
import { localDateInZone, shiftDate, isValidDateString } from '../../utils/dates';
import { maxLogDate } from '../../routes/logDate';

describe('localDateInZone', () => {
  it('gives the previous day east of UTC before the local dawn', () => {
    // 19:00 UTC on the 25th is 00:30 on the 26th in Kolkata. The UTC date is
    // still the 25th, so treating it as "today" loses the user a whole day.
    const instant = new Date('2026-08-25T19:00:00Z');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-08-25');
    expect(localDateInZone('Asia/Kolkata', instant)).toBe('2026-08-26');
  });

  it('gives the current day west of UTC after the UTC rollover', () => {
    // 01:00 UTC on the 26th is 18:00 on the 25th in Los Angeles. The UTC date
    // has already rolled over to a day the user has not reached yet.
    const instant = new Date('2026-08-26T01:00:00Z');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-08-26');
    expect(localDateInZone('America/Los_Angeles', instant)).toBe('2026-08-25');
  });

  it('agrees with UTC for a user actually on UTC', () => {
    const instant = new Date('2026-08-25T12:00:00Z');
    expect(localDateInZone('UTC', instant)).toBe('2026-08-25');
  });

  it('falls back to the UTC date rather than throwing on a bad timezone', () => {
    const instant = new Date('2026-08-25T12:00:00Z');
    expect(localDateInZone('Not/AZone', instant)).toBe('2026-08-25');
  });

  it('handles a zone with a half-hour offset', () => {
    // Kathmandu is +05:45.
    expect(localDateInZone('Asia/Kathmandu', new Date('2026-08-25T18:20:00Z'))).toBe('2026-08-26');
  });
});

describe('shiftDate', () => {
  it('steps backwards and forwards', () => {
    expect(shiftDate('2026-08-25', -1)).toBe('2026-08-24');
    expect(shiftDate('2026-08-25', 1)).toBe('2026-08-26');
  });

  it('crosses month and year boundaries', () => {
    expect(shiftDate('2026-09-01', -1)).toBe('2026-08-31');
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles a leap day', () => {
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('does not drift across a daylight-saving boundary', () => {
    // Stepping day by day through a DST change must land on real dates rather
    // than repeating or skipping one, which a local-time Date would do.
    let d = '2026-03-07';
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      seen.push(d);
      d = shiftDate(d, 1);
    }
    expect(seen).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
  });
});

describe('isValidDateString', () => {
  it('accepts a well-formed date', () => {
    expect(isValidDateString('2026-08-25')).toBe(true);
  });

  it('rejects a day that does not exist in that month', () => {
    // Date would silently roll this into March rather than refuse it.
    expect(isValidDateString('2026-02-31')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
  });

  it('rejects the wrong shape entirely', () => {
    expect(isValidDateString('25-08-2026')).toBe(false);
    expect(isValidDateString('2026-8-5')).toBe(false);
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString(undefined)).toBe(false);
    expect(isValidDateString(20260825)).toBe(false);
  });

  it('accepts a real leap day and rejects a fake one', () => {
    expect(isValidDateString('2028-02-29')).toBe(true);
    expect(isValidDateString('2026-02-29')).toBe(false);
  });
});

describe('maxLogDate', () => {
  it('allows one day past UTC, for timezones ahead of the server', () => {
    // Kiritimati is UTC+14, so someone there logging their genuine today is a
    // calendar day ahead of a UTC server. Rejecting that would break the app
    // for them in order to catch data nobody is entering.
    expect(maxLogDate(new Date('2026-08-25T12:00:00Z'))).toBe('2026-08-26');
  });

  it('rolls over with the month', () => {
    expect(maxLogDate(new Date('2026-08-31T23:00:00Z'))).toBe('2026-09-01');
  });
});
