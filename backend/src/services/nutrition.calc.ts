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

/** Lose weight, hold it, or put it on. */
export type WeightGoal = 'lose' | 'maintain' | 'gain';

export interface TargetInputs {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  sex: string | null;
  activityLevel: string | null;
  /** Defaults to 'maintain', which is what a profile with no goal set means. */
  goal?: WeightGoal | null;
  /** Kilograms per week, always a magnitude — the goal supplies the sign. */
  rateKgPerWeek?: number | null;
}

export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * A kilogram of body mass is worth roughly 7,700 kcal, so a kilo a week is a
 * 1,100 kcal daily gap. The figure is a population average for fat tissue and
 * the real number drifts as body composition changes; it is the standard
 * planning constant, not a promise.
 */
export const KCAL_PER_KG = 7700;

/**
 * Ceilings on how fast a plan may aim to change weight. Losing faster than a
 * kilo a week costs mostly lean mass, and gaining faster than half a kilo is
 * mostly fat, so asking for more is not a preference the app can honour.
 */
export const MAX_LOSS_KG_PER_WEEK = 1;
export const MAX_GAIN_KG_PER_WEEK = 0.5;

/**
 * Intakes nothing may be prescribed below. Eating under these is a clinical
 * decision, not a slider position, so the deficit gets cut instead — the user
 * is told their achievable rate rather than handed an unsafe number.
 */
export const MIN_CALORIES_MALE = 1500;
export const MIN_CALORIES_OTHER = 1200;

export function calculateAge(dob: string, now: Date = new Date()): number | null {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  return Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export interface TargetPlan {
  targets: DailyTargets;
  /** What this body burns in a day. The target is this plus or minus the gap. */
  maintenanceCalories: number;
  goal: WeightGoal;
  /** What the user asked for, after the safe ceiling on pace. */
  requestedRateKgPerWeek: number;
  /**
   * What the prescribed intake actually delivers. Lower than requested when
   * the minimum-intake floor cut the deficit short.
   */
  actualRateKgPerWeek: number;
  /** True when that floor bound the result, so the UI can say why. */
  floored: boolean;
  /** False when the profile lacks weight/height/age and 2000 kcal is a guess. */
  personalised: boolean;
}

/**
 * Mifflin-St Jeor for basal metabolic rate, scaled by activity. Falls back to
 * a flat 2000 kcal when the profile lacks weight/height/age, so targets are
 * usable before the user has filled anything in.
 */
export function maintenanceCalories(input: TargetInputs): { calories: number; personalised: boolean } {
  const { weightKg, heightCm, ageYears, sex } = input;
  const activityMultiplier = ACTIVITY_MULTIPLIERS[input.activityLevel ?? 'moderate'] ?? 1.55;

  if (!weightKg || !heightCm || ageYears === null || ageYears === undefined) {
    return { calories: 2000, personalised: false };
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const bmr = sex === 'male' ? base + 5 : sex === 'female' ? base - 161 : base - 78;
  return { calories: Math.max(1200, Math.round(bmr * activityMultiplier)), personalised: true };
}

/**
 * The full target plan: maintenance, the gap the goal asks for, and the pace
 * that gap actually buys.
 *
 * The deficit is capped twice — once at a sane weekly pace, and again by the
 * minimum intake nobody should be prescribed below. When the floor bites, the
 * plan reports the slower rate it can really deliver rather than quietly
 * printing a target that will not produce the promised result.
 */
export function calculatePlan(input: TargetInputs): TargetPlan {
  const { weightKg } = input;
  const goal: WeightGoal = input.goal ?? 'maintain';
  const { calories: maintenance, personalised } = maintenanceCalories(input);

  const ceiling = goal === 'gain' ? MAX_GAIN_KG_PER_WEEK : MAX_LOSS_KG_PER_WEEK;
  const requestedRate =
    goal === 'maintain' ? 0 : Math.min(Math.abs(input.rateKgPerWeek ?? 0.5), ceiling);

  const dailyGap = Math.round((requestedRate * KCAL_PER_KG) / 7);
  const floor = input.sex === 'male' ? MIN_CALORIES_MALE : MIN_CALORIES_OTHER;

  const unbounded = goal === 'lose' ? maintenance - dailyGap : maintenance + dailyGap;
  const calories = goal === 'lose' ? Math.max(floor, unbounded) : unbounded;
  const floored = goal === 'lose' && unbounded < floor;

  // Back out the pace the prescribed intake really buys, so a floored plan is
  // honest about being slower than the one that was asked for.
  const actualGap = Math.abs(calories - maintenance);
  const actualRate =
    goal === 'maintain' ? 0 : Math.round(((actualGap * 7) / KCAL_PER_KG) * 100) / 100;

  return {
    targets: macrosFor(calories, weightKg, goal),
    maintenanceCalories: maintenance,
    goal,
    requestedRateKgPerWeek: requestedRate,
    actualRateKgPerWeek: actualRate,
    floored,
    personalised,
  };
}

/**
 * Splits a calorie target into macros.
 *
 * Protein is set per kilo of body weight rather than as a share of calories,
 * because the requirement tracks the body, not the diet: cutting it as
 * calories fall is exactly backwards. It goes *up* on a deficit, where eating
 * less risks losing muscle along with the fat.
 */
function macrosFor(calories: number, weightKg: number | null, goal: WeightGoal): DailyTargets {
  const perKg = goal === 'lose' ? 2 : goal === 'gain' ? 1.8 : 1.6;
  const proteinG = weightKg ? Math.round(weightKg * perKg) : 60;
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

export function calculateTargets(input: TargetInputs): DailyTargets {
  return calculatePlan(input).targets;
}

/**
 * When the goal weight arrives at the plan's actual pace. Returns null when
 * the goal is maintenance, already met, or moving the wrong way — none of
 * which have a finish line to put on a chart.
 */
export function projectGoalDate(
  currentKg: number,
  goalKg: number,
  ratePerWeek: number,
  from: Date = new Date()
): { weeks: number; date: string } | null {
  const remaining = Math.abs(currentKg - goalKg);
  if (ratePerWeek <= 0 || remaining < 0.1) return null;

  const weeks = Math.ceil(remaining / ratePerWeek);
  const date = new Date(from.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  return { weeks, date: date.toISOString().slice(0, 10) };
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
 * The longest night this will accept as real. Anything above it is a typo —
 * most often the two times entered the wrong way round — and recording it
 * would drag the sleep score and the whole trend chart with it.
 */
export const MAX_SLEEP_MINUTES = 16 * 60;

/**
 * Minutes between bedtime and wake time, accounting for the common case of
 * sleep crossing midnight (bed 23:00, wake 07:00 is 8 hours, not -16).
 *
 * Returns null for a span that cannot be a night's sleep. Rolling every
 * non-positive difference forward by a day turned two identical times into a
 * 24-hour sleep and a reversed pair into 23.5 hours, both of which were
 * recorded without complaint.
 */
export function computeSleepDuration(bedtime: Date, wakeTime: Date): number | null {
  let ms = wakeTime.getTime() - bedtime.getTime();
  if (ms <= 0) ms += 24 * 60 * 60 * 1000;

  const minutes = Math.round(ms / 60000);
  if (minutes <= 0 || minutes > MAX_SLEEP_MINUTES) return null;
  return minutes;
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


/**
 * Calories still available to eat, the MyFitnessPal way:
 *
 *     remaining = target - eaten + burned
 *
 * Exercise credits the budget back. That is what people expect, and hiding it
 * makes an active day look like a blown one. It is capped at the target so a
 * three-hour ride cannot licence an unbounded binge.
 */
export function calorieBudget(
  target: number,
  eaten: number,
  burned: number
): { target: number; eaten: number; burned: number; remaining: number; over: boolean } {
  const credited = Math.max(0, Math.min(burned, target));
  const remaining = Math.round(target + credited - eaten);
  return {
    target: Math.round(target),
    eaten: Math.round(eaten),
    burned: Math.round(credited),
    remaining,
    over: remaining < 0,
  };
}

/**
 * Rough calories burned walking. Used only to show steps in the same units as
 * everything else; the coefficient is a population average (about 0.04 kcal
 * per step per kg) and is not a substitute for a measured burn.
 */
export function stepsToCalories(steps: number, weightKg: number | null): number {
  const weight = weightKg && weightKg > 0 ? weightKg : 70;
  return Math.round(steps * 0.0005 * weight);
}
