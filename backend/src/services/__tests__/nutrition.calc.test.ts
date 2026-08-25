import { describe, it, expect } from 'vitest';
import {
  calorieBudget,
  stepsToCalories,
  calculateTargets,
  calculateAge,
  scaleNutrient,
  sizeSuggestion,
  calculateHydrationTarget,
  portionFromGrams,
  computeSleepDuration,
  extractJsonObject,
  calculatePlan,
  projectGoalDate,
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
    expect(portionFromGrams(160, 'piece', 1, 80)).toBe(2);
  });

  it('uses the food\'s own weight, not one average for everything', () => {
    // A masala dosa weighs 150 g and an idli 40 g. Against a flat 80 g/piece
    // the dosa logged as 2 (double the calories) and 3 idlis logged as 2.
    expect(portionFromGrams(150, 'piece', 1, 150)).toBe(1);
    expect(portionFromGrams(120, 'piece', 1, 40)).toBe(3);
  });

  it('allows half portions but invents no finer precision', () => {
    expect(portionFromGrams(60, 'piece', 1, 40)).toBe(1.5);
    expect(portionFromGrams(55, 'piece', 1, 40)).toBe(1.5);
  });

  it('never rounds a real portion down to zero pieces', () => {
    expect(portionFromGrams(10, 'piece', 1, 150)).toBe(0.5);
    expect(portionFromGrams(1, 'piece', 1, 150)).toBe(0.5);
  });

  it('falls back to an average piece weight when the food has none recorded', () => {
    expect(portionFromGrams(160, 'piece', 1, null)).toBe(2);
    expect(portionFromGrams(160, 'piece', 1)).toBe(2);
  });

  it('scales by the serving size when a serving is several pieces', () => {
    // "Idli, 3 pieces" is one serving of 3; 240 g is 2 such servings.
    expect(portionFromGrams(240, 'serving', 3, 120)).toBe(6);
  });

  it('passes grams and millilitres through untouched', () => {
    expect(portionFromGrams(150, 'g', 100, 100)).toBe(150);
    expect(portionFromGrams(250, 'ml', 250, 250)).toBe(250);
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


describe('calorieBudget', () => {
  it('credits exercise back to the budget', () => {
    const b = calorieBudget(2000, 1800, 300);
    expect(b.remaining).toBe(500);
    expect(b.over).toBe(false);
  });

  it('reports going over the target', () => {
    const b = calorieBudget(2000, 2400, 0);
    expect(b.remaining).toBe(-400);
    expect(b.over).toBe(true);
  });

  it('caps the exercise credit at the daily target', () => {
    // A 5000 kcal "burn" cannot licence eating 7000.
    const b = calorieBudget(2000, 0, 5000);
    expect(b.burned).toBe(2000);
    expect(b.remaining).toBe(4000);
  });

  it('ignores a negative burn', () => {
    expect(calorieBudget(2000, 500, -300).burned).toBe(0);
  });

  it('is exactly the target when nothing is eaten or burned', () => {
    expect(calorieBudget(1800, 0, 0).remaining).toBe(1800);
  });
});

describe('stepsToCalories', () => {
  it('scales with body weight', () => {
    expect(stepsToCalories(10000, 60)).toBeLessThan(stepsToCalories(10000, 90));
  });

  it('falls back to an average weight when the profile is empty', () => {
    expect(stepsToCalories(10000, null)).toBe(350);
  });

  it('is zero for no steps', () => {
    expect(stepsToCalories(0, 70)).toBe(0);
  });
});

describe('calculatePlan', () => {
  const ada = {
    weightKg: 70,
    heightCm: 170,
    ageYears: 30,
    sex: 'female' as const,
    activityLevel: 'moderate' as const,
  };
  // BMR = 10*70 + 6.25*170 - 5*30 - 161 = 700 + 1062.5 - 150 - 161 = 1451.5
  // moderate 1.55 -> 2249.8 -> 2250
  const ADA_MAINTENANCE = 2250;

  it('leaves the target at maintenance when the goal is to maintain', () => {
    const plan = calculatePlan({ ...ada, goal: 'maintain', rateKgPerWeek: 0.5 });
    expect(plan.targets.calories).toBe(ADA_MAINTENANCE);
    expect(plan.actualRateKgPerWeek).toBe(0);
  });

  it('subtracts 7700 kcal per kilo per week when losing', () => {
    // 0.5 kg/wk = 3850 kcal/wk = 550 kcal/day -> 2250 - 550 = 1700
    const plan = calculatePlan({ ...ada, goal: 'lose', rateKgPerWeek: 0.5 });
    expect(plan.targets.calories).toBe(1700);
    expect(plan.maintenanceCalories).toBe(ADA_MAINTENANCE);
    expect(plan.actualRateKgPerWeek).toBe(0.5);
    expect(plan.floored).toBe(false);
  });

  it('adds the same gap when gaining', () => {
    // gain is capped at 0.5 kg/wk -> +550 -> 2800
    const plan = calculatePlan({ ...ada, goal: 'gain', rateKgPerWeek: 0.5 });
    expect(plan.targets.calories).toBe(2800);
  });

  it('caps the pace rather than honouring a 2 kg per week request', () => {
    const plan = calculatePlan({ ...ada, goal: 'lose', rateKgPerWeek: 2 });
    expect(plan.requestedRateKgPerWeek).toBe(1);
    // 1 kg/wk = 1100/day -> 2250 - 1100 = 1150, below the 1200 floor
    expect(plan.targets.calories).toBe(1200);
    expect(plan.floored).toBe(true);
  });

  it('reports the slower rate a floored target actually delivers', () => {
    // Floored at 1200 from a 2250 maintenance is a 1050 kcal gap,
    // which is 7350 kcal a week = 0.95 kg, not the 1 kg asked for.
    const plan = calculatePlan({ ...ada, goal: 'lose', rateKgPerWeek: 1 });
    expect(plan.targets.calories).toBe(1200);
    expect(plan.actualRateKgPerWeek).toBe(0.95);
    expect(plan.actualRateKgPerWeek).toBeLessThan(plan.requestedRateKgPerWeek);
  });

  it('floors men at 1500 rather than 1200', () => {
    const plan = calculatePlan({
      weightKg: 60,
      heightCm: 165,
      ageYears: 45,
      sex: 'male',
      activityLevel: 'sedentary',
      goal: 'lose',
      rateKgPerWeek: 1,
    });
    expect(plan.targets.calories).toBe(1500);
    expect(plan.floored).toBe(true);
  });

  it('never prescribes a deficit off the 2000 kcal fallback without a floor', () => {
    const plan = calculatePlan({
      weightKg: null,
      heightCm: null,
      ageYears: null,
      sex: null,
      activityLevel: null,
      goal: 'lose',
      rateKgPerWeek: 1,
    });
    expect(plan.personalised).toBe(false);
    expect(plan.targets.calories).toBeGreaterThanOrEqual(1200);
  });

  it('raises protein on a cut and lowers it back at maintenance', () => {
    const cutting = calculatePlan({ ...ada, goal: 'lose', rateKgPerWeek: 0.5 });
    const holding = calculatePlan({ ...ada, goal: 'maintain' });
    expect(cutting.targets.protein_g).toBe(140); // 70 * 2.0
    expect(holding.targets.protein_g).toBe(112); // 70 * 1.6
    expect(cutting.targets.calories).toBeLessThan(holding.targets.calories);
  });

  it('treats a missing goal as maintenance, matching an untouched profile', () => {
    expect(calculatePlan(ada).targets).toEqual(calculateTargets(ada));
    expect(calculatePlan(ada).goal).toBe('maintain');
  });
});

describe('projectGoalDate', () => {
  const from = new Date('2026-01-01T00:00:00Z');

  it('counts the weeks to the goal weight at the plan rate', () => {
    // 5 kg to lose at 0.5 kg/wk = 10 weeks -> 2026-03-12
    const p = projectGoalDate(80, 75, 0.5, from);
    expect(p?.weeks).toBe(10);
    expect(p?.date).toBe('2026-03-12');
  });

  it('works the same for gaining, where the goal is above current', () => {
    expect(projectGoalDate(60, 63, 0.5, from)?.weeks).toBe(6);
  });

  it('has no finish line at maintenance or once the goal is met', () => {
    expect(projectGoalDate(75, 70, 0, from)).toBeNull();
    expect(projectGoalDate(70, 70, 0.5, from)).toBeNull();
  });
});
