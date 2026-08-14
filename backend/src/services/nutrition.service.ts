import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export interface Food {
  id: string;
  name: string;
  name_hi: string | null;
  region: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
  barcode: string | null;
}

export async function searchFoods(searchTerm: string, limit = 20): Promise<Food[]> {
  if (!searchTerm.trim()) {
    return query<Food>('SELECT * FROM foods ORDER BY name ASC LIMIT $1', [limit]);
  }
  return query<Food>(
    `SELECT * FROM foods
     WHERE name ILIKE $1 OR name_hi ILIKE $1
     ORDER BY similarity(name, $2) DESC, name ASC
     LIMIT $3`,
    [`%${searchTerm}%`, searchTerm, limit]
  );
}

export async function getFoodById(id: string): Promise<Food> {
  const food = await queryOne<Food>('SELECT * FROM foods WHERE id = $1', [id]);
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
  const food = await getFoodById(input.foodId);
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
    `SELECT mi.*, f.name AS food_name, f.name_hi AS food_name_hi
     FROM meal_items mi
     JOIN foods f ON f.id = mi.food_id
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

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function calculateAge(dob: string): number | null {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const ageMs = Date.now() - birth.getTime();
  return Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Computes daily nutrient targets from the user's profile using the
 * Mifflin-St Jeor equation for calorie needs, with generally-accepted
 * guideline values for macro split and limits. Falls back to reasonable
 * flat defaults when the profile is incomplete, so the feature is useful
 * from day one rather than requiring a fully filled-out profile first.
 */
export async function getDailyTargets(userId: string): Promise<DailyTargets> {
  const profile = await queryOne<{
    weight_kg: string | number | null;
    height_cm: string | number | null;
    date_of_birth: string | null;
    sex: string | null;
    activity_level: string | null;
  }>('SELECT weight_kg, height_cm, date_of_birth, sex, activity_level FROM profiles WHERE user_id = $1', [userId]);

  const weight = profile?.weight_kg ? Number(profile.weight_kg) : null;
  const height = profile?.height_cm ? Number(profile.height_cm) : null;
  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null;
  const activityMultiplier = ACTIVITY_MULTIPLIERS[profile?.activity_level ?? 'moderate'] ?? 1.55;

  let calories = 2000;
  if (weight && height && age) {
    const bmr =
      profile?.sex === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : profile?.sex === 'female'
          ? 10 * weight + 6.25 * height - 5 * age - 161
          : 10 * weight + 6.25 * height - 5 * age - 78;
    calories = Math.max(1200, Math.round(bmr * activityMultiplier));
  }

  const proteinG = weight ? Math.round(weight * 1.6) : 60;
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

export interface DailyNutrition {
  date: string;
  consumed: Record<keyof DailyTargets, number>;
  targets: DailyTargets;
  remaining: Record<keyof DailyTargets, number>;
}

/**
 * The full picture for the nutrition page: what's been eaten today, what the
 * user's targets are, and how much of each is left (negative = over the
 * limit, for sugar/sodium/saturated fat that's a bad sign rather than "more
 * room to eat").
 */
export async function getDailyNutrition(userId: string, logDate: string): Promise<DailyNutrition> {
  const [rawConsumed, targets] = await Promise.all([getSummary(userId, logDate), getDailyTargets(userId)]);

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

  return { date: logDate, consumed, targets, remaining };
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
       WHERE ${cfg.column} > 0
         AND calories > 0
         AND calories <= $1
       ORDER BY (${cfg.column} / NULLIF(calories, 0)) DESC
       LIMIT 6`,
      [cfg.maxCaloriesPerServing]
    );

    const suggestions = candidates
      .map((food) => {
        const perServing = Number(food[cfg.nutrient === 'protein_g' ? 'protein_g' : 'fiber_g'] ?? 0);
        if (perServing <= 0) return null;

        const servingSize = Number(food.serving_size) || 1;
        const isPiece = food.serving_unit !== 'g' && food.serving_unit !== 'ml';

        // Suggest a realistic helping rather than however much would close the
        // whole gap in one food — "33 egg whites" is arithmetically correct and
        // completely useless. Cap at 2 servings and report the share it covers.
        const servingsNeeded = shortBy / perServing;
        const servings = Math.min(servingsNeeded, 2);

        const quantity = isPiece
          ? Math.max(1, Math.round(servings * servingSize))
          : Math.max(1, Math.round((servings * servingSize) / 5) * 5);

        const ratio = quantity / servingSize;
        const delivers = Math.round(perServing * ratio * 10) / 10;

        return {
          foodId: food.id,
          name: food.name,
          quantity,
          unit: food.serving_unit,
          calories: Math.round(Number(food.calories) * ratio),
          delivers,
          closesGapPct: Math.min(100, Math.round((delivers / shortBy) * 100)),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      // Most gap closed per calorie spent.
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
