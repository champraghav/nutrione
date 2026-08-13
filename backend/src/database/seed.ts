import { pool } from '../config/database';
import { logger } from '../utils/logger';

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

const foods: Array<{
  name: string;
  name_hi?: string;
  region: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}> = [
  { name: 'Chicken Breast (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  { name: 'Basmati Rice (cooked)', name_hi: 'चावल', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 121, protein_g: 2.5, carbs_g: 25.6, fat_g: 0.4 },
  { name: 'Roti / Chapati', name_hi: 'रोटी', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 104, protein_g: 3, carbs_g: 18, fat_g: 2.5 },
  { name: 'Dal (Lentil Curry)', name_hi: 'दाल', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4 },
  { name: 'Paneer', name_hi: 'पनीर', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 265, protein_g: 18, carbs_g: 1.2, fat_g: 21 },
  { name: 'Egg (whole, boiled)', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 78, protein_g: 6.3, carbs_g: 0.6, fat_g: 5.3 },
  { name: 'Banana', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4 },
  { name: 'Almonds', region: 'generic', serving_size: 28, serving_unit: 'g', calories: 164, protein_g: 6, carbs_g: 6.1, fat_g: 14.2 },
  { name: 'Greek Yogurt', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 59, protein_g: 10, carbs_g: 3.6, fat_g: 0.4 },
  { name: 'Oats (dry)', region: 'generic', serving_size: 40, serving_unit: 'g', calories: 150, protein_g: 5.3, carbs_g: 27, fat_g: 2.6 },
  { name: 'Salmon (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13 },
  { name: 'Broccoli (steamed)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 35, protein_g: 2.4, carbs_g: 7.2, fat_g: 0.4 },
  { name: 'Sweet Potato (baked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 90, protein_g: 2, carbs_g: 21, fat_g: 0.1 },
  { name: 'Chana Masala', name_hi: 'चना मसाला', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 164, protein_g: 8, carbs_g: 27, fat_g: 3 },
  { name: 'Idli', name_hi: 'इडली', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 39, protein_g: 2, carbs_g: 8, fat_g: 0.1 },
  { name: 'Masala Dosa', name_hi: 'मसाला डोसा', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 168, protein_g: 3.9, carbs_g: 28, fat_g: 5 },
  { name: 'Whole Milk', region: 'generic', serving_size: 250, serving_unit: 'ml', calories: 149, protein_g: 8, carbs_g: 12, fat_g: 8 },
  { name: 'Peanut Butter', region: 'generic', serving_size: 32, serving_unit: 'g', calories: 190, protein_g: 8, carbs_g: 6, fat_g: 16 },
  { name: 'Apple', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3 },
  { name: 'Brown Bread (slice)', region: 'generic', serving_size: 1, serving_unit: 'slice', calories: 69, protein_g: 3.5, carbs_g: 12, fat_g: 0.9 },
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
  for (const food of foods) {
    await pool.query(
      `INSERT INTO foods (name, name_hi, region, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
       WHERE NOT EXISTS (SELECT 1 FROM foods WHERE name = $1)`,
      [food.name, food.name_hi ?? null, food.region, food.serving_size, food.serving_unit, food.calories, food.protein_g, food.carbs_g, food.fat_g]
    );
  }

  logger.info(`Seed complete: ${exercises.length} exercises, ${foods.length} foods`);
  await pool.end();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
