/**
 * Pure nutrition maths, kept free of database access so it can be unit
 * tested directly and reasoned about in isolation.
 */

export interface DailyTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
}

export interface TargetInputs {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  sex: string | null;
  activityLevel: string | null;
}

export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateAge(dob: string, now: Date = new Date()): number | null {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  return Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Mifflin-St Jeor for basal metabolic rate, scaled by activity. Falls back to
 * a flat 2000 kcal when the profile lacks weight/height/age, so targets are
 * usable before the user has filled anything in.
 */
export function calculateTargets(input: TargetInputs): DailyTargets {
  const { weightKg, heightCm, ageYears, sex } = input;
  const activityMultiplier = ACTIVITY_MULTIPLIERS[input.activityLevel ?? 'moderate'] ?? 1.55;

  let calories = 2000;
  if (weightKg && heightCm && ageYears !== null) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
    const bmr = sex === 'male' ? base + 5 : sex === 'female' ? base - 161 : base - 78;
    calories = Math.max(1200, Math.round(bmr * activityMultiplier));
  }

  const proteinG = weightKg ? Math.round(weightKg * 1.6) : 60;
  const fatG = Math.round((calories * 0.3) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return {
    calories,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
    fiber_g: 28,
    sugar_g: Math.round((calories * 0.1) / 4),
    sodium_mg: 2300,
    saturated_fat_g: Math.round((calories * 0.1) / 9),
  };
}

/**
 * Scales a food's per-serving nutrients to an arbitrary quantity.
 */
export function scaleNutrient(perServing: number, quantity: number, servingSize: number): number {
  if (!servingSize) return 0;
  return Math.round(perServing * (quantity / servingSize) * 10) / 10;
}

/**
 * Sizes a gap-closing suggestion. Deliberately capped at two servings —
 * sizing a portion to close the whole gap with one food produces advice like
 * "33 egg whites", which is arithmetically right and practically useless.
 */
export function sizeSuggestion(
  shortBy: number,
  perServing: number,
  servingSize: number,
  servingUnit: string
): { quantity: number; delivers: number; closesGapPct: number } | null {
  if (perServing <= 0 || shortBy <= 0) return null;

  const isPiece = servingUnit !== 'g' && servingUnit !== 'ml';
  const servings = Math.min(shortBy / perServing, 2);

  const quantity = isPiece
    ? Math.max(1, Math.round(servings * servingSize))
    : Math.max(1, Math.round((servings * servingSize) / 5) * 5);

  const delivers = Math.round(perServing * (quantity / servingSize) * 10) / 10;
  return { quantity, delivers, closesGapPct: Math.min(100, Math.round((delivers / shortBy) * 100)) };
}

/**
 * Baseline 2 L, ~35 ml per kg of body weight, more for higher activity,
 * clamped to a sane range regardless of odd profile data.
 */
export function calculateHydrationTarget(weightKg: number | null, activityLevel: string | null): number {
  let target = weightKg ? Math.round(weightKg * 35) : 2500;
  if (activityLevel === 'active') target += 350;
  if (activityLevel === 'very_active') target += 700;
  return Math.min(5000, Math.max(1500, target));
}

/**
 * Turns the vision model's gram estimate into a quantity in the food's own
 * unit. Piece-based foods (a dosa, a roti) must not be logged as "160 pieces"
 * just because the model estimated 160 grams.
 */
export const APPROX_GRAMS_PER_PIECE = 80;

export function portionFromGrams(
  grams: number,
  servingUnit: string,
  servingSize: number,
  servingGrams?: number | null
): number {
  const isPiece = servingUnit !== 'g' && servingUnit !== 'ml';
  if (!isPiece) return grams;

  // Prefer the food's own weight per serving. Falling back to one average
  // piece weight for everything is what made a 150 g masala dosa log as two
  // dosas and a 40 g idli log as one — off by 2x in opposite directions.
  const perServing = Number(servingGrams) > 0 ? Number(servingGrams) : APPROX_GRAMS_PER_PIECE;
  const size = Number(servingSize) > 0 ? Number(servingSize) : 1;

  // Round to halves, so half a paratha is expressible but we never invent
  // spurious precision like 1.37 dosas.
  const servings = grams / perServing;
  const rounded = Math.round(servings * 2) / 2;
  return Math.max(0.5, rounded) * size;
}

/**
 * Minutes between bedtime and wake time, accounting for the common case of
 * sleep crossing midnight (bed 23:00, wake 07:00 is 8 hours, not -16).
 */
export function computeSleepDuration(bedtime: Date, wakeTime: Date): number {
  let ms = wakeTime.getTime() - bedtime.getTime();
  if (ms <= 0) ms += 24 * 60 * 60 * 1000;
  return Math.round(ms / 60000);
}

/**
 * Pulls the JSON object out of a model reply, tolerating markdown fences or
 * surrounding prose that models emit despite being told not to.
 */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response');
  return JSON.parse(candidate.slice(start, end + 1));
}
