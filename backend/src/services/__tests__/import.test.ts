import { describe, it, expect } from 'vitest';
import { parseCsv, findColumn, parseNumber, parseDate } from '../csv';
import { detectKind, buildPreview } from '../import.service';

describe('parseCsv', () => {
  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('Date,Food\n2026-01-05,"Rice, cooked"');
    expect(rows[1]).toEqual(['2026-01-05', 'Rice, cooked']);
  });

  it('handles escaped double quotes inside a quoted field', () => {
    expect(parseCsv('a\n"He said ""hi"""')[1]).toEqual(['He said "hi"']);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('strips a UTF-8 BOM so the first header still matches', () => {
    const rows = parseCsv('﻿Date,Food\n2026-01-05,Idli');
    expect(rows[0][0]).toBe('Date');
  });

  it('keeps empty fields in position', () => {
    expect(parseCsv('a,b,c\n1,,3')[1]).toEqual(['1', '', '3']);
  });
});

describe('findColumn', () => {
  const headers = ['Date', 'Meal', 'Food', 'Calories', 'Fat (g)', 'Saturated Fat', 'Protein (g)'];

  it('matches ignoring case, spaces and punctuation', () => {
    expect(findColumn(headers, ['proteing', 'protein'])).toBe(6);
  });

  it('prefers an exact match over a partial one', () => {
    // "Fat (g)" normalises to "fatg" and must win over "Saturated Fat".
    expect(findColumn(headers, ['fatg', 'fat'])).toBe(4);
  });

  it('returns -1 when nothing matches', () => {
    expect(findColumn(headers, ['zinc'])).toBe(-1);
  });
});

describe('parseNumber', () => {
  it('strips units and thousands separators', () => {
    expect(parseNumber('1,234 kcal')).toBe(1234);
    expect(parseNumber('12.5 g')).toBe(12.5);
  });

  it('returns 0 for blank or junk', () => {
    expect(parseNumber('')).toBe(0);
    expect(parseNumber(undefined)).toBe(0);
    expect(parseNumber('--')).toBe(0);
  });
});

describe('parseDate', () => {
  it('parses ISO dates', () => {
    expect(parseDate('2026-08-14')).toBe('2026-08-14');
  });

  it('parses US ordering by default', () => {
    expect(parseDate('08/14/2026')).toBe('2026-08-14');
  });

  it('parses day-first ordering when asked', () => {
    expect(parseDate('14/08/2026', true)).toBe('2026-08-14');
  });

  it('infers day-first when the first part cannot be a month', () => {
    // 25 can't be a month, so this is unambiguous regardless of the setting.
    expect(parseDate('25/12/2026', false)).toBe('2026-12-25');
  });

  it('returns null for unparseable input rather than a wrong date', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('detectKind', () => {
  it('detects a MyFitnessPal-style nutrition export', () => {
    const headers = ['Date', 'Meal', 'Food', 'Calories', 'Fat (g)', 'Carbohydrates (g)', 'Protein (g)'];
    expect(detectKind(headers).kind).toBe('nutrition');
  });

  it('detects a weight/measurement export', () => {
    expect(detectKind(['Date', 'Weight']).kind).toBe('weight');
  });

  it('detects an exercise export', () => {
    expect(detectKind(['Date', 'Exercise', 'Minutes', 'Calories Burned']).kind).toBe('exercise');
  });

  it('reports unknown rather than guessing', () => {
    expect(detectKind(['Foo', 'Bar']).kind).toBe('unknown');
  });
});

describe('buildPreview', () => {
  const MFP = [
    'Date,Meal,Food,Calories,Fat (g),Saturated Fat,Sodium (mg),Carbohydrates (g),Fiber,Sugar,Protein (g)',
    '2026-08-10,Breakfast,"Oats, rolled",150,2.6,0.5,2,27,4,0.4,5.3',
    '2026-08-10,Lunch,"Chicken Breast, grilled",330,7.2,2,148,0,0,0,62',
    '2026-08-11,Dinner,Paneer Butter Masala,230,17,9,480,10,1.8,4,8',
  ].join('\n');

  it('parses a MyFitnessPal-shaped export into typed rows', () => {
    const p = buildPreview(MFP);
    expect(p.kind).toBe('nutrition');
    expect(p.validRows).toBe(3);
    expect(p.dateRange).toEqual({ from: '2026-08-10', to: '2026-08-11' });

    const first = p.rows[0] as { food: string; calories: number; protein_g: number; meal: string };
    expect(first.food).toBe('Oats, rolled'); // comma inside quotes preserved
    expect(first.calories).toBe(150);
    expect(first.protein_g).toBe(5.3);
    expect(first.meal).toBe('breakfast');
  });

  it('skips unusable rows with a reason instead of importing zeros', () => {
    const csv = [
      'Date,Meal,Food,Calories,Protein (g)',
      '2026-08-10,Breakfast,Oats,150,5',
      'not-a-date,Lunch,Rice,200,4',
      '2026-08-10,Lunch,,200,4',
      '2026-08-10,Lunch,Water,0,0',
    ].join('\n');

    const p = buildPreview(csv);
    expect(p.validRows).toBe(1);
    expect(p.skipped).toHaveLength(3);
    expect(p.skipped.map((s) => s.reason).join(' ')).toMatch(/date/i);
  });

  it('rejects a file whose contents it cannot identify', () => {
    expect(() => buildPreview('Colour,Shape\nred,round')).toThrow(/Could not tell what this file contains/);
  });

  it('rejects a file with headers but no data', () => {
    expect(() => buildPreview('Date,Food,Calories')).toThrow(/no data rows/);
  });
});
