import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { SEED_FOODS } from './foods.data';

const exercises: Array<{ name: string; category: string; muscle_group: string; equipment: string }> = [
  { name: 'Barbell Squat', category: 'strength', muscle_group: 'legs', equipment: 'barbell' },
  { name: 'Deadlift', category: 'strength', muscle_group: 'back', equipment: 'barbell' },
  { name: 'Bench Press', category: 'strength', muscle_group: 'chest', equipment: 'barbell' },
  { name: 'Overhead Press', category: 'strength', muscle_group: 'shoulders', equipment: 'barbell' },
  { name: 'Pull-up', category: 'strength', muscle_group: 'back', equipment: 'bodyweight' },
  { name: 'Push-up', category: 'strength', muscle_group: 'chest', equipment: 'bodyweight' },
  { name: 'Dumbbell Row', category: 'strength', muscle_group: 'back', equipment: 'dumbbell' },
  { name: 'Dumbbell Curl', category: 'strength', muscle_group: 'arms', equipment: 'dumbbell' },
  { name: 'Tricep Dip', category: 'strength', muscle_group: 'arms', equipment: 'bodyweight' },
  { name: 'Lunge', category: 'strength', muscle_group: 'legs', equipment: 'bodyweight' },
  { name: 'Plank', category: 'strength', muscle_group: 'core', equipment: 'bodyweight' },
  { name: 'Running', category: 'cardio', muscle_group: 'full_body', equipment: 'none' },
  { name: 'Cycling', category: 'cardio', muscle_group: 'legs', equipment: 'bike' },
  { name: 'Jump Rope', category: 'cardio', muscle_group: 'full_body', equipment: 'rope' },
  { name: 'Rowing', category: 'cardio', muscle_group: 'full_body', equipment: 'rower' },
  { name: 'Yoga Flow', category: 'flexibility', muscle_group: 'full_body', equipment: 'mat' },
  { name: 'Hamstring Stretch', category: 'flexibility', muscle_group: 'legs', equipment: 'none' },
  { name: 'Kettlebell Swing', category: 'strength', muscle_group: 'full_body', equipment: 'kettlebell' },
  { name: 'Burpee', category: 'cardio', muscle_group: 'full_body', equipment: 'bodyweight' },
  { name: 'Mountain Climber', category: 'cardio', muscle_group: 'core', equipment: 'bodyweight' },
];

async function seed(): Promise<void> {
  logger.info('Seeding exercises...');
  for (const ex of exercises) {
    await pool.query(
      `INSERT INTO exercises (name, category, muscle_group, equipment)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = $1)`,
      [ex.name, ex.category, ex.muscle_group, ex.equipment]
    );
  }

  logger.info('Seeding foods...');
  let inserted = 0;
  let updated = 0;

  for (const food of SEED_FOODS) {
    const values = [
      food.name,
      food.name_hi ?? null,
      food.region,
      food.serving_size,
      food.serving_unit,
      food.serving_grams,
      food.calories,
      food.protein_g,
      food.carbs_g,
      food.fat_g,
      food.fiber_g,
      food.sugar_g,
      food.sodium_mg,
      food.saturated_fat_g,
    ];

    // Update first so re-running the seed backfills nutrients onto foods that
    // were created before those columns existed, rather than skipping them.
    // Scoped to shared foods: a user's imported row can share a name with a
    // reference food, and overwriting their numbers would silently rewrite
    // their own logged history.
    const res = await pool.query(
      `UPDATE foods SET
         name_hi = $2, region = $3, serving_size = $4, serving_unit = $5, serving_grams = $6,
         calories = $7, protein_g = $8, carbs_g = $9, fat_g = $10,
         fiber_g = $11, sugar_g = $12, sodium_mg = $13, saturated_fat_g = $14
       WHERE name = $1 AND barcode IS NULL AND owner_user_id IS NULL`,
      values
    );

    if (res.rowCount && res.rowCount > 0) {
      updated += res.rowCount;
    } else {
      await pool.query(
        `INSERT INTO foods (name, name_hi, region, serving_size, serving_unit, serving_grams, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
         WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name = $1 AND owner_user_id IS NULL)`,
        values
      );
      inserted += 1;
    }
  }

  logger.info(
    `Seed complete: ${exercises.length} exercises, ${SEED_FOODS.length} foods (${inserted} new, ${updated} updated)`
  );
  await pool.end();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
