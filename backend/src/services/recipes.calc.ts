/**
 * Recipe nutrition maths.
 *
 * A recipe's numbers are derived, not entered, so getting this wrong silently
 * mis-states every meal logged from it. Kept pure so the arithmetic is
 * testable on its own.
 */

export interface IngredientNutrition {
  /** Nutrition per the ingredient food's own serving size. */
  serving_size: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
  /** How much of it the recipe uses, in the food's serving unit. */
  quantity: number;
}

export interface Nutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
}

const EMPTY: Nutrition = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  sugar_g: 0,
  sodium_mg: 0,
  saturated_fat_g: 0,
};

const KEYS = Object.keys(EMPTY) as Array<keyof Nutrition>;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Totals for the whole recipe, summing each ingredient scaled to its quantity. */
export function recipeTotals(ingredients: IngredientNutrition[]): Nutrition {
  const total: Nutrition = { ...EMPTY };

  for (const ing of ingredients) {
    const serving = Number(ing.serving_size) > 0 ? Number(ing.serving_size) : 1;
    const ratio = Number(ing.quantity) / serving;
    if (!Number.isFinite(ratio)) continue;
    for (const key of KEYS) {
      total[key] += Number(ing[key] ?? 0) * ratio;
    }
  }

  for (const key of KEYS) total[key] = round1(total[key]);
  return total;
}

/**
 * Nutrition for one serving. Servings below 1 are treated as 1: a recipe that
 * "makes 0 servings" is a data-entry slip, and dividing by it would produce
 * Infinity calories rather than an obviously wrong number.
 */
export function perServing(totals: Nutrition, servings: number): Nutrition {
  const divisor = Number(servings) > 0 ? Number(servings) : 1;
  const out: Nutrition = { ...EMPTY };
  for (const key of KEYS) out[key] = round1(totals[key] / divisor);
  return out;
}
