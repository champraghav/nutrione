import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import {
  calculateTargets,
  calculateAge,
  sizeSuggestion,
  calorieBudget,
  DailyTargets as PureTargets,
} from './nutrition.calc';

export interface Food {
  id: string;
  name: string;
  name_hi: string | null;
  region: string;
  serving_size: number;
  serving_unit: string;
  serving_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
  barcode: string | null;
  owner_user_id: string | null;
}

/**
 * Foods visible to a user: the shared reference database plus anything their
 * own import created. Foods imported from someone else's export carry their
 * own numbers and their own naming, so they must never surface in another
 * person's search results.
 */
const VISIBLE_TO_USER = '(owner_user_id IS NULL OR owner_user_id = $1)';

export async function searchFoods(userId: string, searchTerm: string, limit = 20): Promise<Food[]> {
  if (!searchTerm.trim()) {
    return query<Food>(
      `SELECT * FROM foods WHERE ${VISIBLE_TO_USER} ORDER BY name ASC LIMIT $2`,
      [userId, limit]
    );
  }
  return query<Food>(
    `SELECT * FROM foods
     WHERE ${VISIBLE_TO_USER}
       AND (name ILIKE $2 OR name_hi ILIKE $2)
     ORDER BY similarity(name, $3) DESC, name ASC
     LIMIT $4`,
    [userId, `%${searchTerm}%`, searchTerm, limit]
  );
}

export async function getFoodById(userId: string, id: string): Promise<Food> {
  const food = await queryOne<Food>(
    `SELECT * FROM foods
     WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)`,
    [id, userId]
  );
  if (!food) throw AppError.notFound('Food not found');
  return food;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: {
    product_name?: string;
    brands?: string;
    nutriments?: {
      'energy-kcal_100g'?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      sugars_100g?: number;
      fat_100g?: number;
      'saturated-fat_100g'?: number;
      fiber_100g?: number;
      sodium_100g?: number; // grams, per Open Food Facts convention
    };
  };
}

/**
 * Looks up a packaged food by barcode. Checks our own DB first (foods.barcode
 * is unique), then falls back to the free Open Food Facts database and caches
 * the result locally so future scans of the same product are instant.
 */
export async function getFoodByBarcode(barcode: string): Promise<Food> {
  const existing = await queryOne<Food>('SELECT * FROM foods WHERE barcode = $1', [barcode]);
  if (existing) return existing;

  let data: OpenFoodFactsResponse;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`, {
      headers: { 'User-Agent': 'HealthOS-Prototype/1.0 (contact: n/a)' },
    });
    if (!res.ok) throw new Error(`Open Food Facts responded with status ${res.status}`);
    data = (await res.json()) as OpenFoodFactsResponse;
  } catch (err) {
    logger.error({ err, barcode }, 'Open Food Facts lookup failed');
    throw AppError.badRequest(
      'Could not reach the food database right now. Please try again or search by name instead.',
      'BARCODE_LOOKUP_FAILED'
    );
  }

  if (data.status !== 1 || !data.product) {
    throw AppError.notFound('No food found for this barcode. Try searching by name instead.', 'BARCODE_NOT_FOUND');
  }

  const n = data.product.nutriments ?? {};
  const name = data.product.product_name?.trim() || 'Unknown product';

  const food = await queryOne<Food>(
    `INSERT INTO foods (name, brand, region, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g, barcode)
     VALUES ($1, $2, 'packaged', 100, 'g', $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (barcode) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [
      name,
      data.product.brands ?? null,
      n['energy-kcal_100g'] ?? 0,
      n.proteins_100g ?? 0,
      n.carbohydrates_100g ?? 0,
      n.fat_100g ?? 0,
      n.fiber_100g ?? 0,
      n.sugars_100g ?? 0,
      (n.sodium_100g ?? 0) * 1000,
      n['saturated-fat_100g'] ?? 0,
      barcode,
    ]
  );

  return food!;
}

async function recalcDailyTotals(userId: string, logDate: string): Promise<void> {
  const totals = await queryOne<{
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
    sugar: string;
    sodium: string;
    saturatedFat: string;
  }>(
    `SELECT
       COALESCE(SUM(calories), 0) AS calories,
       COALESCE(SUM(protein_g), 0) AS protein,
       COALESCE(SUM(carbs_g), 0) AS carbs,
       COALESCE(SUM(fat_g), 0) AS fat,
       COALESCE(SUM(fiber_g), 0) AS fiber,
       COALESCE(SUM(sugar_g), 0) AS sugar,
       COALESCE(SUM(sodium_mg), 0) AS sodium,
       COALESCE(SUM(saturated_fat_g), 0) AS "saturatedFat"
     FROM meal_items WHERE user_id = $1 AND log_date = $2`,
    [userId, logDate]
  );

  await query(
    `INSERT INTO nutrition_logs (user_id, log_date, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_sugar_g, total_sodium_mg, total_saturated_fat_g)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id, log_date) DO UPDATE SET
       total_calories = EXCLUDED.total_calories,
       total_protein_g = EXCLUDED.total_protein_g,
       total_carbs_g = EXCLUDED.total_carbs_g,
       total_fat_g = EXCLUDED.total_fat_g,
       total_fiber_g = EXCLUDED.total_fiber_g,
       total_sugar_g = EXCLUDED.total_sugar_g,
       total_sodium_mg = EXCLUDED.total_sodium_mg,
       total_saturated_fat_g = EXCLUDED.total_saturated_fat_g,
       updated_at = now()`,
    [
      userId,
      logDate,
      totals!.calories,
      totals!.protein,
      totals!.carbs,
      totals!.fat,
      totals!.fiber,
      totals!.sugar,
      totals!.sodium,
      totals!.saturatedFat,
    ]
  );
}

export interface AddMealItemInput {
  foodId: string;
  quantity: number;
  unit: string;
  logDate: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export async function addMealItem(userId: string, input: AddMealItemInput) {
  const food = await getFoodById(userId, input.foodId);
  const ratio = input.quantity / food.serving_size;

  const item = await queryOne(
    `INSERT INTO meal_items (user_id, food_id, log_date, meal_type, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      userId,
      input.foodId,
      input.logDate,
      input.mealType ?? 'snack',
      input.quantity,
      input.unit,
      food.calories * ratio,
      food.protein_g * ratio,
      food.carbs_g * ratio,
      food.fat_g * ratio,
      (food.fiber_g ?? 0) * ratio,
      (food.sugar_g ?? 0) * ratio,
      (food.sodium_mg ?? 0) * ratio,
      (food.saturated_fat_g ?? 0) * ratio,
    ]
  );

  await query(
    `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
     VALUES ($1, 'meal_logged', $2, $3)`,
    [userId, `Logged ${food.name}`, JSON.stringify({ foodId: food.id, quantity: input.quantity })]
  );

  await recalcDailyTotals(userId, input.logDate);
  return item;
}

export async function removeMealItem(userId: string, itemId: string): Promise<void> {
  const item = await queryOne<{ log_date: string }>(
    'SELECT log_date FROM meal_items WHERE id = $1 AND user_id = $2',
    [itemId, userId]
  );
  if (!item) throw AppError.notFound('Meal item not found');

  await query('DELETE FROM meal_items WHERE id = $1 AND user_id = $2', [itemId, userId]);
  await recalcDailyTotals(userId, item.log_date);
}

export async function getLogsForDate(userId: string, logDate: string) {
  return query(
    `SELECT mi.*, COALESCE(f.name, mi.label) AS food_name, f.name_hi AS food_name_hi
     FROM meal_items mi
     LEFT JOIN foods f ON f.id = mi.food_id
     WHERE mi.user_id = $1 AND mi.log_date = $2
     ORDER BY mi.created_at ASC`,
    [userId, logDate]
  );
}

export async function getSummary(userId: string, logDate: string) {
  const summary = await queryOne(
    'SELECT * FROM nutrition_logs WHERE user_id = $1 AND log_date = $2',
    [userId, logDate]
  );
  return (
    summary ?? {
      user_id: userId,
      log_date: logDate,
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
      total_fiber_g: 0,
      total_sugar_g: 0,
      total_sodium_mg: 0,
      total_saturated_fat_g: 0,
    }
  );
}

export async function getHistory(userId: string, days = 30) {
  return query(
    `SELECT * FROM nutrition_logs
     WHERE user_id = $1 AND log_date >= (CURRENT_DATE - $2::int)
     ORDER BY log_date DESC`,
    [userId, days]
  );
}

export interface DailyTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number; // upper limit, not a goal to reach
  sodium_mg: number; // upper limit
  saturated_fat_g: number; // upper limit
}

export async function getDailyTargets(userId: string): Promise<DailyTargets> {
  const profile = await queryOne<{
    weight_kg: string | number | null;
    height_cm: string | number | null;
    date_of_birth: string | null;
    sex: string | null;
    activity_level: string | null;
  }>('SELECT weight_kg, height_cm, date_of_birth, sex, activity_level FROM profiles WHERE user_id = $1', [userId]);

  return calculateTargets({
    weightKg: profile?.weight_kg ? Number(profile.weight_kg) : null,
    heightCm: profile?.height_cm ? Number(profile.height_cm) : null,
    ageYears: profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null,
    sex: profile?.sex ?? null,
    activityLevel: profile?.activity_level ?? null,
  });
}

export interface DailyNutrition {
  date: string;
  consumed: Record<keyof DailyTargets, number>;
  targets: DailyTargets;
  remaining: Record<keyof DailyTargets, number>;
  /** target - eaten + exercise, the headline number people actually read. */
  budget: { target: number; eaten: number; burned: number; remaining: number; over: boolean };
}

/**
 * The full picture for the nutrition page: what's been eaten today, what the
 * user's targets are, and how much of each is left (negative = over the
 * limit, for sugar/sodium/saturated fat that's a bad sign rather than "more
 * room to eat").
 */
export async function getDailyNutrition(userId: string, logDate: string): Promise<DailyNutrition> {
  // Imported lazily to avoid a circular import: steps needs nutrition.calc,
  // which this module also uses.
  const { caloriesBurnedOn } = await import('./steps.service');
  const [rawConsumed, targets, burned] = await Promise.all([
    getSummary(userId, logDate),
    getDailyTargets(userId),
    caloriesBurnedOn(userId, logDate),
  ]);

  const c = rawConsumed as Record<string, string | number>;
  const consumed: Record<keyof DailyTargets, number> = {
    calories: Number(c.total_calories ?? 0),
    protein_g: Number(c.total_protein_g ?? 0),
    carbs_g: Number(c.total_carbs_g ?? 0),
    fat_g: Number(c.total_fat_g ?? 0),
    fiber_g: Number(c.total_fiber_g ?? 0),
    sugar_g: Number(c.total_sugar_g ?? 0),
    sodium_mg: Number(c.total_sodium_mg ?? 0),
    saturated_fat_g: Number(c.total_saturated_fat_g ?? 0),
  };

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const remaining: Record<keyof DailyTargets, number> = {
    calories: round1(targets.calories - consumed.calories),
    protein_g: round1(targets.protein_g - consumed.protein_g),
    carbs_g: round1(targets.carbs_g - consumed.carbs_g),
    fat_g: round1(targets.fat_g - consumed.fat_g),
    fiber_g: round1(targets.fiber_g - consumed.fiber_g),
    sugar_g: round1(targets.sugar_g - consumed.sugar_g),
    sodium_mg: round1(targets.sodium_mg - consumed.sodium_mg),
    saturated_fat_g: round1(targets.saturated_fat_g - consumed.saturated_fat_g),
  };

  return {
    date: logDate,
    consumed,
    targets,
    remaining,
    budget: calorieBudget(targets.calories, consumed.calories, burned),
  };
}

export interface NutrientGap {
  nutrient: 'protein_g' | 'fiber_g' | 'calories';
  label: string;
  shortBy: number;
  unit: string;
  /** Concrete ways to close the gap, drawn from the food database. */
  suggestions: Array<{
    foodId: string;
    name: string;
    /** A realistic portion, in the food's own serving unit. */
    quantity: number;
    unit: string;
    calories: number;
    /** How much of the nutrient that portion provides. */
    delivers: number;
    /** What share of the outstanding gap this portion closes, 0-100. */
    closesGapPct: number;
  }>;
}

const GAP_CONFIG: Array<{
  nutrient: NutrientGap['nutrient'];
  column: string;
  label: string;
  unit: string;
  /** Ignore trivial gaps — nobody needs a suggestion for 3g of protein. */
  minGap: number;
  /** Don't suggest a food if closing the gap with it costs more than this. */
  maxCaloriesPerServing: number;
}> = [
  { nutrient: 'protein_g', column: 'protein_g', label: 'Protein', unit: 'g', minGap: 10, maxCaloriesPerServing: 400 },
  { nutrient: 'fiber_g', column: 'fiber_g', label: 'Fiber', unit: 'g', minGap: 5, maxCaloriesPerServing: 300 },
];

/**
 * Answers "what am I missing today, and what should I eat to fix it?" —
 * finds the nutrients still short of target and picks dense, reasonable
 * foods from the database that would close each gap, with the portion
 * needed and what that portion costs in calories.
 */
export async function getNutrientGaps(userId: string, logDate: string): Promise<NutrientGap[]> {
  const daily = await getDailyNutrition(userId, logDate);
  const gaps: NutrientGap[] = [];

  for (const cfg of GAP_CONFIG) {
    const shortBy = daily.remaining[cfg.nutrient];
    if (shortBy < cfg.minGap) continue;

    // Rank by nutrient density per calorie so suggestions are efficient
    // rather than just "eat a lot of this".
    const candidates = await query<Food>(
      `SELECT * FROM foods
       WHERE owner_user_id IS NULL
         AND ${cfg.column} > 0
         AND calories > 0
         AND calories <= $1
       ORDER BY (${cfg.column} / NULLIF(calories, 0)) DESC
       LIMIT 6`,
      [cfg.maxCaloriesPerServing]
    );

    const suggestions = candidates
      .map((food) => {
        const perServing = Number(food[cfg.nutrient === 'protein_g' ? 'protein_g' : 'fiber_g'] ?? 0);
        const sized = sizeSuggestion(shortBy, perServing, Number(food.serving_size) || 1, food.serving_unit);
        if (!sized) return null;

        const ratio = sized.quantity / (Number(food.serving_size) || 1);
        return {
          foodId: food.id,
          name: food.name,
          quantity: sized.quantity,
          unit: food.serving_unit,
          calories: Math.round(Number(food.calories) * ratio),
          delivers: sized.delivers,
          closesGapPct: sized.closesGapPct,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.delivers / Math.max(1, b.calories) - a.delivers / Math.max(1, a.calories))
      .slice(0, 3);

    if (suggestions.length > 0) {
      gaps.push({
        nutrient: cfg.nutrient,
        label: cfg.label,
        shortBy: Math.round(shortBy * 10) / 10,
        unit: cfg.unit,
        suggestions,
      });
    }
  }

  return gaps;
}


// ---------------------------------------------------------------------------
// Fast logging
//
// Most days you eat the same handful of things. Making those one tap is the
// single biggest difference between a food diary someone keeps and one they
// abandon in a week.
// ---------------------------------------------------------------------------

export interface QuickFood {
  id: string;
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  /** How many separate days this food was logged on, for the frequent list. */
  times_logged?: number;
  /** The quantity used last time, so re-logging defaults to your usual portion. */
  last_quantity: number;
  last_unit: string;
  last_meal_type: string | null;
}

/** Distinct foods logged most recently, newest first. */
export async function getRecentFoods(userId: string, limit = 20): Promise<QuickFood[]> {
  return query<QuickFood>(
    `SELECT DISTINCT ON (f.id)
            f.id, f.name, f.serving_size, f.serving_unit, f.calories, f.protein_g,
            mi.quantity AS last_quantity, mi.unit AS last_unit, mi.meal_type AS last_meal_type
     FROM meal_items mi
     JOIN foods f ON f.id = mi.food_id
     WHERE mi.user_id = $1
     ORDER BY f.id, mi.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

/**
 * Foods logged on the most separate days. Counting days rather than rows stops
 * one day of obsessive snack logging from dominating the list forever.
 */
export async function getFrequentFoods(userId: string, limit = 20): Promise<QuickFood[]> {
  return query<QuickFood>(
    `WITH counted AS (
       SELECT food_id, COUNT(DISTINCT log_date)::int AS times_logged, MAX(created_at) AS last_at
       FROM meal_items WHERE user_id = $1 AND food_id IS NOT NULL
       GROUP BY food_id
     ),
     latest AS (
       SELECT DISTINCT ON (food_id) food_id, quantity, unit, meal_type
       FROM meal_items WHERE user_id = $1 AND food_id IS NOT NULL
       ORDER BY food_id, created_at DESC
     )
     SELECT f.id, f.name, f.serving_size, f.serving_unit, f.calories, f.protein_g,
            c.times_logged,
            l.quantity AS last_quantity, l.unit AS last_unit, l.meal_type AS last_meal_type
     FROM counted c
     JOIN foods f ON f.id = c.food_id
     JOIN latest l ON l.food_id = c.food_id
     ORDER BY c.times_logged DESC, c.last_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

/**
 * Logs calories without naming a food — "ate out, about 600 kcal". Stored with
 * no food_id so it never pollutes the food database, and macros are optional
 * because the whole point is that you do not know them.
 */
export async function quickAdd(
  userId: string,
  input: { logDate: string; mealType: string; label: string; calories: number; proteinG?: number; carbsG?: number; fatG?: number }
) {
  const item = await queryOne(
    `INSERT INTO meal_items (user_id, food_id, label, log_date, meal_type, quantity, unit,
                             calories, protein_g, carbs_g, fat_g)
     VALUES ($1, NULL, $2, $3, $4, 1, 'serving', $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      input.label.trim() || 'Quick add',
      input.logDate,
      input.mealType,
      input.calories,
      input.proteinG ?? 0,
      input.carbsG ?? 0,
      input.fatG ?? 0,
    ]
  );

  await recalcDailyTotals(userId, input.logDate);
  return item;
}

export interface CopyDayResult {
  copied: number;
  skipped: number;
}

/**
 * Copies a day's meals onto another day. "Same as yesterday" is how a large
 * share of real logging happens, and retyping six items to say so is exactly
 * the friction that kills the habit.
 *
 * Meals already present on the target date are skipped rather than duplicated,
 * so pressing it twice is harmless.
 */
export async function copyMealsFromDay(
  userId: string,
  fromDate: string,
  toDate: string,
  mealTypes?: string[]
): Promise<CopyDayResult> {
  const filter = mealTypes && mealTypes.length > 0 ? mealTypes : null;

  const source = await query<{ id: string; food_id: string | null; label: string | null; meal_type: string; quantity: string; unit: string }>(
    `SELECT id, food_id, label, meal_type, quantity, unit
     FROM meal_items
     WHERE user_id = $1 AND log_date = $2
       AND ($3::text[] IS NULL OR meal_type = ANY($3))
     ORDER BY created_at ASC`,
    [userId, fromDate, filter]
  );

  let copied = 0;
  let skipped = 0;

  for (const row of source) {
    const dupe = await queryOne<{ id: string }>(
      `SELECT id FROM meal_items
       WHERE user_id = $1 AND log_date = $2 AND meal_type = $3 AND quantity = $4
         AND food_id IS NOT DISTINCT FROM $5 AND label IS NOT DISTINCT FROM $6
       LIMIT 1`,
      [userId, toDate, row.meal_type, row.quantity, row.food_id, row.label]
    );
    if (dupe) {
      skipped += 1;
      continue;
    }

    // Re-inserting by copying the stored nutrition keeps the copy identical to
    // the original even if the underlying food has since been edited.
    await query(
      `INSERT INTO meal_items (user_id, food_id, label, log_date, meal_type, quantity, unit,
                               calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g)
       SELECT user_id, food_id, label, $3, meal_type, quantity, unit,
              calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g
       FROM meal_items WHERE id = $1 AND user_id = $2`,
      [row.id, userId, toDate]
    );
    copied += 1;
  }

  if (copied > 0) await recalcDailyTotals(userId, toDate);
  return { copied, skipped };
}

/** Days that actually have meals logged, for the "copy from" picker. */
export async function getLoggedDates(userId: string, limit = 14): Promise<string[]> {
  const rows = await query<{ log_date: string }>(
    `SELECT DISTINCT log_date::text AS log_date FROM meal_items
     WHERE user_id = $1 ORDER BY log_date DESC LIMIT $2`,
    [userId, limit]
  );
  return rows.map((r) => r.log_date);
}
