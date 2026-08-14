import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { parseCsv, findColumn, parseNumber, parseDate } from './csv';

export type ImportKind = 'nutrition' | 'weight' | 'exercise' | 'unknown';

export interface NutritionRow {
  date: string;
  meal: string;
  food: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
}

export interface WeightRow {
  date: string;
  weightKg: number;
}

export interface ExerciseRow {
  date: string;
  name: string;
  minutes: number;
  calories: number;
}

export interface ImportPreview {
  kind: ImportKind;
  detectedFrom: string;
  totalRows: number;
  validRows: number;
  skipped: Array<{ line: number; reason: string }>;
  dateRange: { from: string; to: string } | null;
  sample: Array<NutritionRow | WeightRow | ExerciseRow>;
  rows: Array<NutritionRow | WeightRow | ExerciseRow>;
}

const MEAL_MAP: Record<string, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
  snacks: 'snack',
  brunch: 'lunch',
  'morning snack': 'snack',
  'evening snack': 'snack',
};

function normaliseMeal(raw: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const key = raw.trim().toLowerCase();
  return (MEAL_MAP[key] as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? 'snack';
}

/**
 * Works out what a CSV contains from its headers rather than requiring the
 * user to tell us. These exports vary between apps and versions, so matching
 * on column meaning is far more robust than matching on an exact template.
 */
export function detectKind(headers: string[]): { kind: ImportKind; detectedFrom: string } {
  const hasDate = findColumn(headers, ['date', 'day']) !== -1;
  const hasFood = findColumn(headers, ['food', 'fooditem', 'item', 'name', 'description']) !== -1;
  const hasCalories = findColumn(headers, ['calories', 'energy', 'kcal', 'calorieskcal']) !== -1;
  const hasWeight = findColumn(headers, ['weight', 'weightkg', 'bodyweight']) !== -1;
  const hasExercise = findColumn(headers, ['exercise', 'activity', 'workout']) !== -1;
  const hasMinutes = findColumn(headers, ['minutes', 'duration', 'durationminutes']) !== -1;

  if (hasDate && hasFood && hasCalories) {
    return { kind: 'nutrition', detectedFrom: 'Food/nutrition diary export' };
  }
  if (hasDate && hasExercise && (hasMinutes || hasCalories)) {
    return { kind: 'exercise', detectedFrom: 'Exercise diary export' };
  }
  if (hasDate && hasWeight) {
    return { kind: 'weight', detectedFrom: 'Weight / measurements export' };
  }
  return { kind: 'unknown', detectedFrom: 'Unrecognised format' };
}

/**
 * Parses an uploaded CSV into typed rows without touching the database, so
 * the user can see exactly what would be imported before committing.
 */
export function buildPreview(csvText: string, dayFirst = false): ImportPreview {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw AppError.badRequest('That file has no data rows. Check you exported the right file.', 'IMPORT_EMPTY');
  }

  const headers = rows[0];
  const { kind, detectedFrom } = detectKind(headers);

  if (kind === 'unknown') {
    throw AppError.badRequest(
      `Could not tell what this file contains. Columns found: ${headers.slice(0, 8).join(', ')}. ` +
        'A food export needs date, food and calories columns; a weight export needs date and weight.',
      'IMPORT_UNKNOWN_FORMAT'
    );
  }

  const dateCol = findColumn(headers, ['date', 'day']);
  const skipped: ImportPreview['skipped'] = [];
  const parsed: Array<NutritionRow | WeightRow | ExerciseRow> = [];

  const cols: Record<string, number> =
    kind === 'nutrition'
      ? {
          meal: findColumn(headers, ['meal', 'mealtype', 'mealname']),
          food: findColumn(headers, ['food', 'fooditem', 'item', 'name', 'description']),
          calories: findColumn(headers, ['calories', 'energy', 'kcal']),
          protein: findColumn(headers, ['proteing', 'protein']),
          carbs: findColumn(headers, ['carbohydratesg', 'carbohydrates', 'carbsg', 'carbs']),
          fat: findColumn(headers, ['fatg', 'totalfat', 'fat']),
          fiber: findColumn(headers, ['fiberg', 'fibreg', 'fiber', 'fibre']),
          sugar: findColumn(headers, ['sugarsg', 'sugarg', 'sugars', 'sugar']),
          sodium: findColumn(headers, ['sodiummg', 'sodium']),
          satFat: findColumn(headers, ['saturatedfatg', 'saturatedfat']),
        }
      : kind === 'exercise'
        ? {
            name: findColumn(headers, ['exercise', 'activity', 'workout', 'name']),
            minutes: findColumn(headers, ['minutes', 'duration', 'durationminutes']),
            calories: findColumn(headers, ['caloriesburned', 'calories', 'energy']),
          }
        : { weight: findColumn(headers, ['weightkg', 'weight', 'bodyweight']) };

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const line = i + 1;
    const date = parseDate(row[dateCol], dayFirst);

    if (!date) {
      skipped.push({ line, reason: `Could not read a date from "${row[dateCol] ?? ''}"` });
      continue;
    }

    if (kind === 'nutrition') {
      const c = cols;
      const food = (row[c.food] ?? '').trim();
      if (!food) {
        skipped.push({ line, reason: 'No food name' });
        continue;
      }
      const calories = parseNumber(row[c.calories]);
      if (calories <= 0) {
        skipped.push({ line, reason: `"${food}" has no calories` });
        continue;
      }
      parsed.push({
        date,
        meal: normaliseMeal(c.meal !== -1 ? (row[c.meal] ?? '') : ''),
        food,
        calories,
        protein_g: c.protein !== -1 ? parseNumber(row[c.protein]) : 0,
        carbs_g: c.carbs !== -1 ? parseNumber(row[c.carbs]) : 0,
        fat_g: c.fat !== -1 ? parseNumber(row[c.fat]) : 0,
        fiber_g: c.fiber !== -1 ? parseNumber(row[c.fiber]) : 0,
        sugar_g: c.sugar !== -1 ? parseNumber(row[c.sugar]) : 0,
        sodium_mg: c.sodium !== -1 ? parseNumber(row[c.sodium]) : 0,
        saturated_fat_g: c.satFat !== -1 ? parseNumber(row[c.satFat]) : 0,
      });
    } else if (kind === 'exercise') {
      const c = cols;
      const name = (row[c.name] ?? '').trim();
      if (!name) {
        skipped.push({ line, reason: 'No exercise name' });
        continue;
      }
      parsed.push({
        date,
        name,
        minutes: c.minutes !== -1 ? parseNumber(row[c.minutes]) : 0,
        calories: c.calories !== -1 ? parseNumber(row[c.calories]) : 0,
      });
    } else {
      const c = cols;
      const weightKg = parseNumber(row[c.weight]);
      if (weightKg <= 0) {
        skipped.push({ line, reason: 'No usable weight value' });
        continue;
      }
      parsed.push({ date, weightKg });
    }
  }

  const dates = parsed.map((r) => r.date).sort();

  return {
    kind,
    detectedFrom,
    totalRows: rows.length - 1,
    validRows: parsed.length,
    skipped: skipped.slice(0, 20),
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    sample: parsed.slice(0, 8),
    rows: parsed,
  };
}

/**
 * Finds or creates a food row carrying the exact nutrients from the export.
 *
 * Deliberately does NOT try to match imported names against our own food
 * database: the export already states what that item contained, and
 * substituting our numbers would quietly rewrite the user's history.
 */
async function findOrCreateImportedFood(row: NutritionRow): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM foods
     WHERE name = $1 AND region = 'imported'
       AND calories = $2 AND protein_g = $3 AND carbs_g = $4 AND fat_g = $5
     LIMIT 1`,
    [row.food, row.calories, row.protein_g, row.carbs_g, row.fat_g]
  );
  if (existing) return existing.id;

  const created = await queryOne<{ id: string }>(
    `INSERT INTO foods (name, region, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g)
     VALUES ($1, 'imported', 1, 'serving', $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      row.food,
      row.calories,
      row.protein_g,
      row.carbs_g,
      row.fat_g,
      row.fiber_g,
      row.sugar_g,
      row.sodium_mg,
      row.saturated_fat_g,
    ]
  );
  return created!.id;
}

export interface ImportResult {
  imported: number;
  duplicatesSkipped: number;
  datesTouched: string[];
}

/**
 * Writes previewed rows to the database. Re-importing the same export is
 * safe: an identical entry on the same date is treated as a duplicate and
 * skipped, so overlapping exports don't double-count.
 */
export async function commitImport(
  userId: string,
  preview: ImportPreview
): Promise<ImportResult> {
  let imported = 0;
  let duplicatesSkipped = 0;
  const datesTouched = new Set<string>();

  if (preview.kind === 'nutrition') {
    for (const row of preview.rows as NutritionRow[]) {
      const foodId = await findOrCreateImportedFood(row);

      const dupe = await queryOne(
        `SELECT id FROM meal_items
         WHERE user_id = $1 AND log_date = $2 AND food_id = $3 AND meal_type = $4
         LIMIT 1`,
        [userId, row.date, foodId, row.meal]
      );
      if (dupe) {
        duplicatesSkipped += 1;
        continue;
      }

      await query(
        `INSERT INTO meal_items (user_id, food_id, log_date, meal_type, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g)
         VALUES ($1, $2, $3, $4, 1, 'serving', $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          userId,
          foodId,
          row.date,
          row.meal,
          row.calories,
          row.protein_g,
          row.carbs_g,
          row.fat_g,
          row.fiber_g,
          row.sugar_g,
          row.sodium_mg,
          row.saturated_fat_g,
        ]
      );
      imported += 1;
      datesTouched.add(row.date);
    }

    // Rebuild the daily totals for every date we touched, so the targets and
    // health score reflect the imported history straight away.
    for (const date of datesTouched) {
      await query(
        `INSERT INTO nutrition_logs (user_id, log_date, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_sugar_g, total_sodium_mg, total_saturated_fat_g)
         SELECT $1, $2,
           COALESCE(SUM(calories),0), COALESCE(SUM(protein_g),0), COALESCE(SUM(carbs_g),0), COALESCE(SUM(fat_g),0),
           COALESCE(SUM(fiber_g),0), COALESCE(SUM(sugar_g),0), COALESCE(SUM(sodium_mg),0), COALESCE(SUM(saturated_fat_g),0)
         FROM meal_items WHERE user_id = $1 AND log_date = $2
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
        [userId, date]
      );
    }
  } else if (preview.kind === 'weight') {
    for (const row of preview.rows as WeightRow[]) {
      const dupe = await queryOne(
        `SELECT id FROM health_metrics
         WHERE user_id = $1 AND metric_type = 'weight' AND recorded_at::date = $2
         LIMIT 1`,
        [userId, row.date]
      );
      if (dupe) {
        duplicatesSkipped += 1;
        continue;
      }
      await query(
        `INSERT INTO health_metrics (user_id, metric_type, value, unit, recorded_at, source)
         VALUES ($1, 'weight', $2, 'kg', $3, 'import')`,
        [userId, row.weightKg, `${row.date}T12:00:00Z`]
      );
      imported += 1;
      datesTouched.add(row.date);
    }
  } else if (preview.kind === 'exercise') {
    for (const row of preview.rows as ExerciseRow[]) {
      const dupe = await queryOne(
        `SELECT id FROM workout_sessions
         WHERE user_id = $1 AND workout_date = $2 AND notes = $3
         LIMIT 1`,
        [userId, row.date, row.name]
      );
      if (dupe) {
        duplicatesSkipped += 1;
        continue;
      }
      await query(
        `INSERT INTO workout_sessions (user_id, workout_date, duration_minutes, workout_type, intensity, calories_burned, notes)
         VALUES ($1, $2, $3, 'cardio', 'moderate', $4, $5)`,
        [userId, row.date, Math.round(row.minutes), row.calories, row.name]
      );
      imported += 1;
      datesTouched.add(row.date);
    }
  }

  if (imported > 0) {
    await query(
      `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
       VALUES ($1, 'data_imported', $2, $3)`,
      [
        userId,
        `Imported ${imported} ${preview.kind} entries from another app`,
        JSON.stringify({ kind: preview.kind, imported, duplicatesSkipped }),
      ]
    );
  }

  return { imported, duplicatesSkipped, datesTouched: Array.from(datesTouched).sort() };
}
