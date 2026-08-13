import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';

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

async function recalcDailyTotals(userId: string, logDate: string): Promise<void> {
  const totals = await queryOne<{ calories: string; protein: string; carbs: string; fat: string }>(
    `SELECT
       COALESCE(SUM(calories), 0) AS calories,
       COALESCE(SUM(protein_g), 0) AS protein,
       COALESCE(SUM(carbs_g), 0) AS carbs,
       COALESCE(SUM(fat_g), 0) AS fat
     FROM meal_items WHERE user_id = $1 AND log_date = $2`,
    [userId, logDate]
  );

  await query(
    `INSERT INTO nutrition_logs (user_id, log_date, total_calories, total_protein_g, total_carbs_g, total_fat_g)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, log_date) DO UPDATE SET
       total_calories = EXCLUDED.total_calories,
       total_protein_g = EXCLUDED.total_protein_g,
       total_carbs_g = EXCLUDED.total_carbs_g,
       total_fat_g = EXCLUDED.total_fat_g,
       updated_at = now()`,
    [userId, logDate, totals!.calories, totals!.protein, totals!.carbs, totals!.fat]
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
    `INSERT INTO meal_items (user_id, food_id, log_date, meal_type, quantity, unit, calories, protein_g, carbs_g, fat_g)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
