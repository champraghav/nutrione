import { describe, it, expect } from 'vitest';
import {
  calculateTargets,
  calculateAge,
  scaleNutrient,
  sizeSuggestion,
  calculateHydrationTarget,
  portionFromGrams,
  computeSleepDuration,
  extractJsonObject,
} from '../nutrition.calc';

describe('calculateTargets', () => {
  it('matches a hand-computed Mifflin-St Jeor result for a male profile', () => {
    // BMR = 10*75 + 6.25*178 - 5*32 + 5 = 750 + 1112.5 - 160 + 5 = 1707.5
    // active multiplier 1.725 -> 2945.4 -> 2945
    const t = calculateTargets({
      weightKg: 75,
      heightCm: 178,
      ageYears: 32,
      sex: 'male',
      activityLevel: 'active',
    });
    expect(t.calories).toBe(2945);
    expect(t.protein_g).toBe(120); // 75 * 1.6
    expect(t.fat_g).toBe(98); // 2945*0.3/9 = 98.2 -> 98
    expect(t.sugar_g).toBe(74); // 2945*0.1/4 = 73.6 -> 74
    expect(t.saturated_fat_g).toBe(33); // 2945*0.1/9 = 32.7 -> 33
  });

  it('applies the female offset (-161 vs +5), a 166 kcal BMR difference', () => {
    const male = calculateTargets({
      weightKg: 70,
      heightCm: 170,
      ageYears: 30,
      sex: 'male',
      activityLevel: 'sedentary',
    });
    const female = calculateTargets({
      weightKg: 70,
      heightCm: 170,
      ageYears: 30,
      sex: 'female',
      activityLevel: 'sedentary',
    });
    // 166 kcal of BMR difference, scaled by the 1.2 sedentary multiplier.
    expect(male.calories - female.calories).toBe(Math.round(166 * 1.2));
  });

  it('falls back to 2000 kcal / 60 g protein when the profile is empty', () => {
    const t = calculateTargets({
      weightKg: null,
      heightCm: null,
      ageYears: null,
      sex: null,
      activityLevel: null,
    });
    expect(t.calories).toBe(2000);
    expect(t.protein_g).toBe(60);
  });

  it('never returns a starvation-level calorie target', () => {
    const t = calculateTargets({
      weightKg: 35,
      heightCm: 140,
      ageYears: 90,
      sex: 'female',
      activityLevel: 'sedentary',
    });
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });

  it('keeps carbs non-negative when protein and fat already fill the budget', () => {
    const t = calculateTargets({
      weightKg: 200,
      heightCm: 150,
      ageYears: 25,
      sex: 'male',
      activityLevel: 'sedentary',
    });
    expect(t.carbs_g).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateAge', () => {
  it('computes whole years from a date of birth', () => {
    expect(calculateAge('1994-05-15', new Date('2026-08-14T00:00:00Z'))).toBe(32);
  });

  it('returns null for an unparseable date rather than NaN', () => {
    expect(calculateAge('not-a-date')).toBeNull();
  });
});

describe('scaleNutrient', () => {
  it('scales up from a 100 g serving', () => {
    expect(scaleNutrient(31, 200, 100)).toBe(62); // 200 g chicken breast
  });

  it('scales down below one serving', () => {
    expect(scaleNutrient(31, 50, 100)).toBe(15.5);
  });

  it('returns 0 rather than dividing by zero on a malformed serving size', () => {
    expect(scaleNutrient(31, 100, 0)).toBe(0);
  });
});

describe('sizeSuggestion', () => {
  it('caps a suggestion at two servings instead of closing the whole gap', () => {
    // 120 g protein short, egg white has 3.6 g per piece: closing it outright
    // would suggest 33 egg whites.
    const s = sizeSuggestion(120, 3.6, 1, 'piece')!;
    expect(s.quantity).toBe(2);
    expect(s.closesGapPct).toBeLessThan(15);
  });

  it('rounds gram portions to a tidy multiple of 5', () => {
    const s = sizeSuggestion(120, 24, 100, 'g')!;
    expect(s.quantity % 5).toBe(0);
  });

  it('caps reported gap coverage at 100%', () => {
    const s = sizeSuggestion(5, 50, 100, 'g')!;
    expect(s.closesGapPct).toBeLessThanOrEqual(100);
  });

  it('returns null when the food provides none of the nutrient', () => {
    expect(sizeSuggestion(50, 0, 100, 'g')).toBeNull();
  });
});

describe('calculateHydrationTarget', () => {
  it('uses ~35 ml per kg with an activity bump', () => {
    expect(calculateHydrationTarget(75, 'active')).toBe(75 * 35 + 350); // 2975
    expect(calculateHydrationTarget(75, 'very_active')).toBe(75 * 35 + 700);
    expect(calculateHydrationTarget(75, 'moderate')).toBe(75 * 35);
  });

  it('defaults to 2500 ml without a weight', () => {
    expect(calculateHydrationTarget(null, 'moderate')).toBe(2500);
  });

  it('clamps absurd weights into a sane range', () => {
    expect(calculateHydrationTarget(300, 'very_active')).toBe(5000);
    expect(calculateHydrationTarget(20, 'sedentary')).toBe(1500);
  });
});

describe('portionFromGrams', () => {
  it('converts a gram estimate into a piece count for piece-based foods', () => {
    // The bug this guards: 160 g of dosa logging as 160 dosas.
    expect(portionFromGrams(160, 'piece', 1)).toBe(2);
  });

  it('never rounds a real portion down to zero pieces', () => {
    expect(portionFromGrams(10, 'piece', 1)).toBe(1);
  });

  it('passes grams and millilitres through untouched', () => {
    expect(portionFromGrams(150, 'g', 100)).toBe(150);
    expect(portionFromGrams(250, 'ml', 250)).toBe(250);
  });
});

describe('computeSleepDuration', () => {
  it('handles sleep that crosses midnight', () => {
    const bed = new Date('2026-08-13T23:00:00Z');
    const wake = new Date('2026-08-13T07:00:00Z'); // same calendar date
    expect(computeSleepDuration(bed, wake)).toBe(480); // 8 hours, not negative
  });

  it('handles a same-day nap', () => {
    expect(
      computeSleepDuration(new Date('2026-08-13T13:00:00Z'), new Date('2026-08-13T14:30:00Z'))
    ).toBe(90);
  });
});

describe('extractJsonObject', () => {
  it('parses a bare JSON object', () => {
    expect(extractJsonObject('{"foods":[]}')).toEqual({ foods: [] });
  });

  it('parses JSON wrapped in a markdown fence', () => {
    expect(extractJsonObject('```json\n{"foods":[{"name":"Idli"}]}\n```')).toEqual({
      foods: [{ name: 'Idli' }],
    });
  });

  it('parses JSON surrounded by prose', () => {
    expect(extractJsonObject('Sure! Here you go:\n{"foods":[]}\nHope that helps.')).toEqual({
      foods: [],
    });
  });

  it('throws a clear error when there is no JSON at all', () => {
    expect(() => extractJsonObject('I cannot see any food.')).toThrow(/No JSON object/);
  });
});
