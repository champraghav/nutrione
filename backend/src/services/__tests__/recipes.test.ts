import { describe, expect, it } from 'vitest';
import { IngredientNutrition, perServing, recipeTotals } from '../recipes.calc';

function ing(over: Partial<IngredientNutrition>): IngredientNutrition {
  return {
    serving_size: 100,
    calories: 100,
    protein_g: 10,
    carbs_g: 20,
    fat_g: 5,
    fiber_g: 2,
    sugar_g: 1,
    sodium_mg: 50,
    saturated_fat_g: 1,
    quantity: 100,
    ...over,
  };
}

describe('recipeTotals', () => {
  it('sums ingredients at their own serving sizes', () => {
    const totals = recipeTotals([ing({}), ing({})]);
    expect(totals.calories).toBe(200);
    expect(totals.protein_g).toBe(20);
  });

  it('scales an ingredient used in a different amount than its serving', () => {
    // 250 g of a food whose serving is 100 g = 2.5x.
    expect(recipeTotals([ing({ quantity: 250 })]).calories).toBe(250);
  });

  it('handles a piece-based ingredient whose serving size is 1', () => {
    // 3 eggs at 78 kcal each.
    const totals = recipeTotals([ing({ serving_size: 1, calories: 78, quantity: 3 })]);
    expect(totals.calories).toBe(234);
  });

  it('does not divide by zero when an ingredient has no serving size', () => {
    const totals = recipeTotals([ing({ serving_size: 0, calories: 50, quantity: 2 })]);
    expect(Number.isFinite(totals.calories)).toBe(true);
    expect(totals.calories).toBe(100);
  });

  it('is all zeros for an empty recipe', () => {
    expect(recipeTotals([]).calories).toBe(0);
  });

  it('carries every nutrient through, not just calories', () => {
    const totals = recipeTotals([ing({ quantity: 200 })]);
    expect(totals.sodium_mg).toBe(100);
    expect(totals.fiber_g).toBe(4);
    expect(totals.saturated_fat_g).toBe(2);
  });
});

describe('perServing', () => {
  it('divides the totals by the number of servings', () => {
    const totals = recipeTotals([ing({ quantity: 400 })]); // 400 kcal
    expect(perServing(totals, 4).calories).toBe(100);
  });

  it('rounds to one decimal rather than inventing precision', () => {
    const totals = recipeTotals([ing({ quantity: 100 })]); // 100 kcal
    expect(perServing(totals, 3).calories).toBe(33.3);
  });

  it('treats a zero or negative serving count as one whole recipe', () => {
    const totals = recipeTotals([ing({})]);
    expect(perServing(totals, 0).calories).toBe(100);
    expect(perServing(totals, -2).calories).toBe(100);
  });
});
