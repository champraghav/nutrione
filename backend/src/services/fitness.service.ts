import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';

export async function getExercises(category?: string, limit = 100) {
  if (category) {
    return query('SELECT * FROM exercises WHERE category = $1 ORDER BY name ASC LIMIT $2', [category, limit]);
  }
  return query('SELECT * FROM exercises ORDER BY name ASC LIMIT $1', [limit]);
}

export async function getExerciseById(id: string) {
  const exercise = await queryOne('SELECT * FROM exercises WHERE id = $1', [id]);
  if (!exercise) throw AppError.notFound('Exercise not found');
  return exercise;
}

export interface CreateWorkoutInput {
  date: string;
  durationMinutes: number;
  workoutType: string;
  intensity?: 'light' | 'moderate' | 'intense';
  caloriesBurned?: number;
  notes?: string;
}

export async function createWorkout(userId: string, input: CreateWorkoutInput) {
  const workout = await queryOne(
    `INSERT INTO workout_sessions (user_id, workout_date, duration_minutes, workout_type, intensity, calories_burned, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      input.date,
      input.durationMinutes,
      input.workoutType,
      input.intensity ?? 'moderate',
      input.caloriesBurned ?? 0,
      input.notes ?? null,
    ]
  );

  await query(
    `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
     VALUES ($1, 'workout_completed', $2, $3)`,
    [userId, `Completed a ${input.workoutType} workout`, JSON.stringify({ workoutId: (workout as any).id })]
  );

  return workout;
}

export async function getWorkouts(userId: string, days = 30) {
  return query(
    `SELECT * FROM workout_sessions
     WHERE user_id = $1 AND workout_date >= (CURRENT_DATE - $2::int)
     ORDER BY workout_date DESC`,
    [userId, days]
  );
}

export async function getWorkoutById(userId: string, id: string) {
  const workout = await queryOne('SELECT * FROM workout_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!workout) throw AppError.notFound('Workout not found');

  const exercises = await query(
    `SELECT we.*, e.name AS exercise_name, e.muscle_group
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_session_id = $1
     ORDER BY we.set_number ASC`,
    [id]
  );

  return { ...(workout as object), exercises };
}

export interface AddExerciseInput {
  exerciseId: string;
  setNumber?: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  rpe?: number;
}

async function updatePersonalRecords(userId: string, exerciseId: string, weightKg?: number, reps?: number) {
  if (weightKg) {
    await query(
      `INSERT INTO personal_records (user_id, exercise_id, record_type, value, achieved_at)
       VALUES ($1, $2, 'max_weight', $3, now())
       ON CONFLICT (user_id, exercise_id, record_type) DO UPDATE SET
         value = GREATEST(personal_records.value, EXCLUDED.value),
         achieved_at = CASE WHEN EXCLUDED.value > personal_records.value THEN now() ELSE personal_records.achieved_at END`,
      [userId, exerciseId, weightKg]
    );
  }
  if (reps) {
    await query(
      `INSERT INTO personal_records (user_id, exercise_id, record_type, value, achieved_at)
       VALUES ($1, $2, 'max_reps', $3, now())
       ON CONFLICT (user_id, exercise_id, record_type) DO UPDATE SET
         value = GREATEST(personal_records.value, EXCLUDED.value),
         achieved_at = CASE WHEN EXCLUDED.value > personal_records.value THEN now() ELSE personal_records.achieved_at END`,
      [userId, exerciseId, reps]
    );
  }
}

export async function addExerciseToWorkout(userId: string, workoutId: string, input: AddExerciseInput) {
  const workout = await queryOne('SELECT id FROM workout_sessions WHERE id = $1 AND user_id = $2', [workoutId, userId]);
  if (!workout) throw AppError.notFound('Workout not found');

  const entry = await queryOne(
    `INSERT INTO workout_exercises (workout_session_id, exercise_id, set_number, reps, weight_kg, duration_seconds, rpe)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      workoutId,
      input.exerciseId,
      input.setNumber ?? 1,
      input.reps ?? null,
      input.weightKg ?? null,
      input.durationSeconds ?? null,
      input.rpe ?? null,
    ]
  );

  await updatePersonalRecords(userId, input.exerciseId, input.weightKg, input.reps);

  return entry;
}

export async function deleteWorkout(userId: string, id: string): Promise<void> {
  const workout = await queryOne('SELECT id FROM workout_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!workout) throw AppError.notFound('Workout not found');
  await query('DELETE FROM workout_sessions WHERE id = $1', [id]);
}

export async function getPersonalRecords(userId: string) {
  return query(
    `SELECT pr.*, e.name AS exercise_name
     FROM personal_records pr
     JOIN exercises e ON e.id = pr.exercise_id
     WHERE pr.user_id = $1
     ORDER BY pr.achieved_at DESC`,
    [userId]
  );
}

export async function getSummary(userId: string, days = 7) {
  const rows = await query<{ total_workouts: string; total_minutes: string; total_calories: string }>(
    `SELECT COUNT(*)::text AS total_workouts,
            COALESCE(SUM(duration_minutes), 0)::text AS total_minutes,
            COALESCE(SUM(calories_burned), 0)::text AS total_calories
     FROM workout_sessions
     WHERE user_id = $1 AND workout_date >= (CURRENT_DATE - $2::int)`,
    [userId, days]
  );
  return rows[0];
}
