import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { Food } from './nutrition.service';
import { IngredientNutrition, perServing, recipeTotals } from './recipes.calc';

export interface RecipeIngredient {
  id: string;
  food_id: string;
  food_name: string;
  quantity: number;
  unit: string;
  serving_size: number;
  calories: number;
  protein_g: number;
}

/**
 * Custom foods and recipes are ordinary rows in `foods`, owned by their
 * creator. That means they are searchable, loggable, plan-able and
 * photo-matchable with no special cases anywhere else in the app — and the
 * ownership scoping already keeps them private.
 */
export async function createCustomFood(
  userId: string,
  input: {
    name: string;
    brand?: string | null;
    servingSize: number;
    servingUnit: string;
    servingGrams?: number | null;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    saturatedFatG?: number;
  }
): Promise<Food> {
  const created = await queryOne<Food>(
    `INSERT INTO foods (name, brand, region, owner_user_id, serving_size, serving_unit, serving_grams,
                        calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g)
     VALUES ($1, $2, 'custom', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      input.name.trim(),
      input.brand?.trim() || null,
      userId,
      input.servingSize,
      input.servingUnit,
      input.servingGrams ?? null,
      input.calories,
      input.proteinG,
      input.carbsG,
      input.fatG,
      input.fiberG ?? 0,
      input.sugarG ?? 0,
      input.sodiumMg ?? 0,
      input.saturatedFatG ?? 0,
    ]
  );
  return created!;
}

async function requireOwnFood(userId: string, foodId: string): Promise<Food> {
  const food = await queryOne<Food>('SELECT * FROM foods WHERE id = $1 AND owner_user_id = $2', [foodId, userId]);
  if (!food) throw AppError.notFound('Food not found');
  return food;
}

export async function deleteOwnFood(userId: string, foodId: string): Promise<void> {
  await requireOwnFood(userId, foodId);

  // A food already logged cannot be deleted without rewriting history, so it
  // is refused rather than silently taking the user's past meals with it.
  const inUse = await queryOne<{ count: string }>(
    'SELECT count(*)::text AS count FROM meal_items WHERE food_id = $1',
    [foodId]
  );
  if (Number(inUse?.count ?? 0) > 0) {
    throw AppError.badRequest(
      'This food is used in meals you have already logged, so it cannot be deleted.',
      'FOOD_IN_USE'
    );
  }

  await query('DELETE FROM foods WHERE id = $1 AND owner_user_id = $2', [foodId, userId]);
}

/** Foods and recipes this user created, for a "my foods" list. */
export async function listOwnFoods(userId: string) {
  return query(
    `SELECT f.*, (SELECT count(*)::int FROM recipe_ingredients ri WHERE ri.recipe_food_id = f.id) AS ingredient_count
     FROM foods f
     WHERE f.owner_user_id = $1 AND f.region IN ('custom', 'recipe')
     ORDER BY f.created_at DESC`,
    [userId]
  );
}

export async function createRecipe(
  userId: string,
  input: { name: string; servings: number }
): Promise<Food> {
  const created = await queryOne<Food>(
    `INSERT INTO foods (name, region, owner_user_id, recipe_servings, serving_size, serving_unit,
                        calories, protein_g, carbs_g, fat_g)
     VALUES ($1, 'recipe', $2, $3, 1, 'serving', 0, 0, 0, 0)
     RETURNING *`,
    [input.name.trim(), userId, Math.max(1, input.servings)]
  );
  return created!;
}

export async function getRecipeIngredients(recipeFoodId: string): Promise<RecipeIngredient[]> {
  return query<RecipeIngredient>(
    `SELECT ri.id, ri.food_id, ri.quantity, ri.unit, ri.sort_order,
            f.name AS food_name, f.serving_size, f.calories, f.protein_g
     FROM recipe_ingredients ri
     JOIN foods f ON f.id = ri.food_id
     WHERE ri.recipe_food_id = $1
     ORDER BY ri.sort_order ASC, ri.created_at ASC`,
    [recipeFoodId]
  );
}

/**
 * Recomputes the recipe food row from its ingredients. Called after every
 * ingredient change so the stored per-serving numbers can never drift from
 * what the recipe actually contains.
 */
async function recalcRecipe(recipeFoodId: string): Promise<void> {
  const rows = await query<IngredientNutrition>(
    `SELECT f.serving_size, f.calories, f.protein_g, f.carbs_g, f.fat_g,
            COALESCE(f.fiber_g, 0) AS fiber_g, COALESCE(f.sugar_g, 0) AS sugar_g,
            COALESCE(f.sodium_mg, 0) AS sodium_mg, COALESCE(f.saturated_fat_g, 0) AS saturated_fat_g,
            ri.quantity
     FROM recipe_ingredients ri
     JOIN foods f ON f.id = ri.food_id
     WHERE ri.recipe_food_id = $1`,
    [recipeFoodId]
  );

  const recipe = await queryOne<{ recipe_servings: string | null }>(
    'SELECT recipe_servings FROM foods WHERE id = $1',
    [recipeFoodId]
  );

  const each = perServing(recipeTotals(rows), Number(recipe?.recipe_servings ?? 1));

  await query(
    `UPDATE foods SET calories = $2, protein_g = $3, carbs_g = $4, fat_g = $5,
                      fiber_g = $6, sugar_g = $7, sodium_mg = $8, saturated_fat_g = $9
     WHERE id = $1`,
    [
      recipeFoodId,
      each.calories,
      each.protein_g,
      each.carbs_g,
      each.fat_g,
      each.fiber_g,
      each.sugar_g,
      each.sodium_mg,
      each.saturated_fat_g,
    ]
  );
}

export async function addIngredient(
  userId: string,
  recipeFoodId: string,
  input: { foodId: string; quantity: number; unit: string }
): Promise<{ recipe: Food; ingredients: RecipeIngredient[] }> {
  await requireOwnFood(userId, recipeFoodId);

  // The ingredient must be a food this user can actually see.
  const ingredient = await queryOne<{ id: string }>(
    'SELECT id FROM foods WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)',
    [input.foodId, userId]
  );
  if (!ingredient) throw AppError.notFound('Ingredient food not found');
  if (input.foodId === recipeFoodId) {
    throw AppError.badRequest('A recipe cannot contain itself.', 'RECIPE_SELF_REFERENCE');
  }

  const order = await queryOne<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM recipe_ingredients WHERE recipe_food_id = $1',
    [recipeFoodId]
  );

  await query(
    'INSERT INTO recipe_ingredients (recipe_food_id, food_id, quantity, unit, sort_order) VALUES ($1, $2, $3, $4, $5)',
    [recipeFoodId, input.foodId, input.quantity, input.unit, Number(order?.next ?? 1)]
  );

  await recalcRecipe(recipeFoodId);
  return {
    recipe: (await queryOne<Food>('SELECT * FROM foods WHERE id = $1', [recipeFoodId]))!,
    ingredients: await getRecipeIngredients(recipeFoodId),
  };
}

export async function removeIngredient(
  userId: string,
  recipeFoodId: string,
  ingredientId: string
): Promise<{ recipe: Food; ingredients: RecipeIngredient[] }> {
  await requireOwnFood(userId, recipeFoodId);
  await query('DELETE FROM recipe_ingredients WHERE id = $1 AND recipe_food_id = $2', [ingredientId, recipeFoodId]);
  await recalcRecipe(recipeFoodId);
  return {
    recipe: (await queryOne<Food>('SELECT * FROM foods WHERE id = $1', [recipeFoodId]))!,
    ingredients: await getRecipeIngredients(recipeFoodId),
  };
}

export async function setRecipeServings(
  userId: string,
  recipeFoodId: string,
  servings: number
): Promise<{ recipe: Food; ingredients: RecipeIngredient[] }> {
  await requireOwnFood(userId, recipeFoodId);
  await query('UPDATE foods SET recipe_servings = $2 WHERE id = $1', [recipeFoodId, Math.max(1, servings)]);
  await recalcRecipe(recipeFoodId);
  return {
    recipe: (await queryOne<Food>('SELECT * FROM foods WHERE id = $1', [recipeFoodId]))!,
    ingredients: await getRecipeIngredients(recipeFoodId),
  };
}

export async function getRecipe(userId: string, recipeFoodId: string) {
  const recipe = await requireOwnFood(userId, recipeFoodId);
  return { recipe, ingredients: await getRecipeIngredients(recipeFoodId) };
}
