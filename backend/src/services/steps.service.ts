import { query, queryOne } from '../config/database';
import { stepsToCalories } from './nutrition.calc';

export interface StepDay {
  date: string;
  steps: number;
  target: number;
  calories: number;
  percent: number;
}

/** 10,000 is the convention people actually aim at, and every rival app uses it. */
export const DEFAULT_STEP_TARGET = 10000;

async function stepTargetFor(userId: string): Promise<number> {
  // A steps goal, if the user set one, otherwise the conventional default.
  const goal = await queryOne<{ target_value: string }>(
    `SELECT target_value FROM goals
     WHERE user_id = $1 AND type = 'steps' AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const target = Number(goal?.target_value ?? 0);
  return target > 0 ? Math.round(target) : DEFAULT_STEP_TARGET;
}

async function weightFor(userId: string): Promise<number | null> {
  const profile = await queryOne<{ weight_kg: string | null }>(
    'SELECT weight_kg FROM profiles WHERE user_id = $1',
    [userId]
  );
  return profile?.weight_kg ? Number(profile.weight_kg) : null;
}

export async function getSteps(userId: string, date: string): Promise<StepDay> {
  const [row, target, weight] = await Promise.all([
    queryOne<{ steps: number }>('SELECT steps FROM step_logs WHERE user_id = $1 AND log_date = $2', [userId, date]),
    stepTargetFor(userId),
    weightFor(userId),
  ]);

  const steps = Number(row?.steps ?? 0);
  return {
    date,
    steps,
    target,
    calories: stepsToCalories(steps, weight),
    percent: target > 0 ? Math.min(100, Math.round((steps / target) * 100)) : 0,
  };
}

/**
 * Sets the day's step count outright rather than adding to it. Steps come from
 * a phone or band that already knows the running total for the day, so
 * incrementing would double-count on every sync.
 */
export async function setSteps(userId: string, date: string, steps: number, source = 'manual'): Promise<StepDay> {
  await query(
    `INSERT INTO step_logs (user_id, log_date, steps, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, log_date)
     DO UPDATE SET steps = EXCLUDED.steps, source = EXCLUDED.source, updated_at = now()`,
    [userId, date, Math.max(0, Math.round(steps)), source]
  );
  return getSteps(userId, date);
}

export async function getStepHistory(userId: string, days = 14) {
  return query(
    `SELECT log_date::text AS date, steps FROM step_logs
     WHERE user_id = $1 AND log_date >= (CURRENT_DATE - $2::int)
     ORDER BY log_date ASC`,
    [userId, days]
  );
}

/**
 * Calories burned on a date: logged workouts plus a walking estimate from
 * steps. Steps and a logged walk overlap, so this is an approximation — it is
 * labelled as such wherever it is shown.
 */
export async function caloriesBurnedOn(userId: string, date: string): Promise<number> {
  const [workout, stepDay] = await Promise.all([
    queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(calories_burned), 0)::text AS total
       FROM workout_sessions WHERE user_id = $1 AND workout_date = $2`,
      [userId, date]
    ),
    getSteps(userId, date),
  ]);

  return Math.round(Number(workout?.total ?? 0) + stepDay.calories);
}
