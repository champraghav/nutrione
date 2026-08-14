import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { getHydrationTarget } from './hydration.service';

const WEIGHTS = {
  sleep: 0.2,
  activity: 0.2,
  nutrition: 0.15,
  recovery: 0.1,
  hydration: 0.1,
  wellbeing: 0.1,
  vitals: 0.1,
  goalProgress: 0.05,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

async function scoreSleep(userId: string, date: string): Promise<number> {
  const session = await queryOne<{ duration_minutes: number; quality: number | null }>(
    'SELECT duration_minutes, quality FROM sleep_sessions WHERE user_id = $1 AND sleep_date = $2',
    [userId, date]
  );
  if (!session) return 50;
  const hours = session.duration_minutes / 60;
  const durationScore = clamp(100 - Math.abs(8 - hours) * 15);
  const qualityScore = ((session.quality ?? 3) / 5) * 100;
  return clamp(durationScore * 0.6 + qualityScore * 0.4);
}

async function scoreActivity(userId: string, date: string): Promise<number> {
  const workout = await queryOne<{ total_minutes: string; total_calories: string }>(
    `SELECT COALESCE(SUM(duration_minutes), 0)::text AS total_minutes,
            COALESCE(SUM(calories_burned), 0)::text AS total_calories
     FROM workout_sessions WHERE user_id = $1 AND workout_date = $2`,
    [userId, date]
  );
  const minutes = Number(workout?.total_minutes ?? 0);
  return clamp((minutes / 30) * 100);
}

async function scoreNutrition(userId: string, date: string): Promise<number> {
  const log = await queryOne<{ total_calories: number; total_protein_g: number }>(
    'SELECT total_calories, total_protein_g FROM nutrition_logs WHERE user_id = $1 AND log_date = $2',
    [userId, date]
  );
  if (!log) return 50;
  const targetCalories = 2000;
  const calorieScore = clamp(100 - (Math.abs(targetCalories - log.total_calories) / targetCalories) * 100);
  const proteinScore = clamp((log.total_protein_g / 80) * 100);
  return clamp(calorieScore * 0.6 + proteinScore * 0.4);
}

async function scoreRecovery(userId: string, date: string): Promise<number> {
  const [sleep, workout] = await Promise.all([scoreSleep(userId, date), scoreActivity(userId, date)]);
  return clamp(sleep * 0.7 + (100 - Math.abs(workout - 60)) * 0.3);
}

async function scoreHydration(userId: string, date: string): Promise<number> {
  // Uses the same personalised target the hydration page shows, so the score
  // and the "x of y ml" the user sees can never disagree.
  const [log, targetMl] = await Promise.all([
    queryOne<{ total_ml: number }>('SELECT total_ml FROM hydration_logs WHERE user_id = $1 AND log_date = $2', [
      userId,
      date,
    ]),
    getHydrationTarget(userId),
  ]);
  return clamp(((log?.total_ml ?? 0) / targetMl) * 100);
}

async function scoreWellbeing(userId: string, date: string): Promise<number> {
  const metric = await queryOne<{ value: number }>(
    `SELECT value FROM health_metrics WHERE user_id = $1 AND metric_type = 'mood' AND recorded_at::date = $2
     ORDER BY recorded_at DESC LIMIT 1`,
    [userId, date]
  );
  if (!metric) return 70;
  return clamp((metric.value / 10) * 100);
}

async function scoreVitals(userId: string, date: string): Promise<number> {
  const metrics = await query<{ metric_type: string; value: number }>(
    `SELECT metric_type, value FROM health_metrics
     WHERE user_id = $1 AND recorded_at::date = $2 AND metric_type IN ('heart_rate', 'blood_pressure_systolic')`,
    [userId, date]
  );
  if (metrics.length === 0) return 75;

  let score = 100;
  for (const m of metrics) {
    if (m.metric_type === 'heart_rate' && (m.value < 40 || m.value > 100)) score -= 20;
    if (m.metric_type === 'blood_pressure_systolic' && (m.value < 90 || m.value > 140)) score -= 20;
  }
  return clamp(score);
}

async function scoreGoalProgress(userId: string): Promise<number> {
  const goals = await query<{ target_value: number | null; current_value: number | null }>(
    `SELECT target_value, current_value FROM goals WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );
  if (goals.length === 0) return 60;

  const progresses = goals
    .filter((g) => g.target_value && g.target_value > 0)
    .map((g) => clamp(((g.current_value ?? 0) / (g.target_value as number)) * 100));

  if (progresses.length === 0) return 60;
  return progresses.reduce((sum, p) => sum + p, 0) / progresses.length;
}

export interface HealthScoreBreakdown {
  score_date: string;
  overall_score: number;
  sleep_score: number;
  activity_score: number;
  nutrition_score: number;
  recovery_score: number;
  hydration_score: number;
  wellbeing_score: number;
  vitals_score: number;
  goal_progress_score: number;
}

export async function calculateHealthScore(userId: string, date: string): Promise<HealthScoreBreakdown> {
  const [sleep, activity, nutrition, recovery, hydration, wellbeing, vitals, goalProgress] = await Promise.all([
    scoreSleep(userId, date),
    scoreActivity(userId, date),
    scoreNutrition(userId, date),
    scoreRecovery(userId, date),
    scoreHydration(userId, date),
    scoreWellbeing(userId, date),
    scoreVitals(userId, date),
    scoreGoalProgress(userId),
  ]);

  const overall =
    sleep * WEIGHTS.sleep +
    activity * WEIGHTS.activity +
    nutrition * WEIGHTS.nutrition +
    recovery * WEIGHTS.recovery +
    hydration * WEIGHTS.hydration +
    wellbeing * WEIGHTS.wellbeing +
    vitals * WEIGHTS.vitals +
    goalProgress * WEIGHTS.goalProgress;

  const breakdown: HealthScoreBreakdown = {
    score_date: date,
    overall_score: Math.round(overall * 10) / 10,
    sleep_score: Math.round(sleep * 10) / 10,
    activity_score: Math.round(activity * 10) / 10,
    nutrition_score: Math.round(nutrition * 10) / 10,
    recovery_score: Math.round(recovery * 10) / 10,
    hydration_score: Math.round(hydration * 10) / 10,
    wellbeing_score: Math.round(wellbeing * 10) / 10,
    vitals_score: Math.round(vitals * 10) / 10,
    goal_progress_score: Math.round(goalProgress * 10) / 10,
  };

  await query(
    `INSERT INTO health_scores (user_id, score_date, overall_score, sleep_score, activity_score, nutrition_score,
       recovery_score, hydration_score, wellbeing_score, vitals_score, goal_progress_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id, score_date) DO UPDATE SET
       overall_score = EXCLUDED.overall_score, sleep_score = EXCLUDED.sleep_score,
       activity_score = EXCLUDED.activity_score, nutrition_score = EXCLUDED.nutrition_score,
       recovery_score = EXCLUDED.recovery_score, hydration_score = EXCLUDED.hydration_score,
       wellbeing_score = EXCLUDED.wellbeing_score, vitals_score = EXCLUDED.vitals_score,
       goal_progress_score = EXCLUDED.goal_progress_score`,
    [
      userId,
      date,
      breakdown.overall_score,
      breakdown.sleep_score,
      breakdown.activity_score,
      breakdown.nutrition_score,
      breakdown.recovery_score,
      breakdown.hydration_score,
      breakdown.wellbeing_score,
      breakdown.vitals_score,
      breakdown.goal_progress_score,
    ]
  );

  return breakdown;
}

export async function getTodayScore(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const breakdown = await calculateHealthScore(userId, today);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const previous = await queryOne<{ overall_score: number }>(
    'SELECT overall_score FROM health_scores WHERE user_id = $1 AND score_date = $2',
    [userId, yesterday]
  );

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (previous) {
    if (breakdown.overall_score > previous.overall_score) trend = 'up';
    else if (breakdown.overall_score < previous.overall_score) trend = 'down';
  }

  return { ...breakdown, trend, previous_score: previous?.overall_score ?? null };
}

export async function getScoreHistory(userId: string, days = 30) {
  return query(
    `SELECT * FROM health_scores WHERE user_id = $1 AND score_date >= (CURRENT_DATE - $2::int)
     ORDER BY score_date DESC`,
    [userId, days]
  );
}

export async function logMetric(userId: string, metricType: string, value: number, unit?: string) {
  return queryOne(
    `INSERT INTO health_metrics (user_id, metric_type, value, unit) VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, metricType, value, unit ?? null]
  );
}

export async function getMetrics(userId: string, metricType?: string, days = 30) {
  if (metricType) {
    return query(
      `SELECT * FROM health_metrics WHERE user_id = $1 AND metric_type = $2 AND recorded_at >= (now() - ($3 || ' days')::interval)
       ORDER BY recorded_at DESC`,
      [userId, metricType, days]
    );
  }
  return query(
    `SELECT * FROM health_metrics WHERE user_id = $1 AND recorded_at >= (now() - ($2 || ' days')::interval)
     ORDER BY recorded_at DESC`,
    [userId, days]
  );
}

export async function getTimeline(userId: string, limit = 50) {
  return query(
    'SELECT * FROM health_timeline_events WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT $2',
    [userId, limit]
  );
}

export async function getHealthProfile(userId: string) {
  const profile = await queryOne(
    `SELECT p.*, u.email FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1`,
    [userId]
  );
  if (!profile) throw AppError.notFound('Profile not found');
  return profile;
}

export interface UpdateHealthProfileInput {
  dateOfBirth?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
}

export async function updateHealthProfile(userId: string, input: UpdateHealthProfileInput) {
  await query(
    `UPDATE profiles SET
       date_of_birth = COALESCE($2, date_of_birth),
       sex = COALESCE($3, sex),
       height_cm = COALESCE($4, height_cm),
       weight_kg = COALESCE($5, weight_kg),
       activity_level = COALESCE($6, activity_level),
       updated_at = now()
     WHERE user_id = $1`,
    [userId, input.dateOfBirth ?? null, input.sex ?? null, input.heightCm ?? null, input.weightKg ?? null, input.activityLevel ?? null]
  );
  return getHealthProfile(userId);
}
