import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { getHydrationTarget } from './hydration.service';
import { getDailyTargets } from './nutrition.service';
import { stepsToCalories } from './nutrition.calc';
import {
  clamp,
  closenessToTarget,
  combineScore,
  nextBestDimension,
  Dimension,
  DimensionName,
  WEIGHTS,
} from './health-score.calc';

/**
 * Every dimension reports whether it had anything to look at. A day with no
 * sleep logged is not a zero-scoring night's sleep — it is a night this app
 * knows nothing about, and it is left out of the average rather than counted
 * against the user.
 */
const NO_DATA: Dimension = { score: 0, hasData: false };

/** Logged, but the day is not over — see scoreNutrition for the reasoning. */
const NOT_YET: Dimension = { score: 0, hasData: false, deferred: true };

async function scoreSleep(userId: string, date: string): Promise<Dimension> {
  const session = await queryOne<{ duration_minutes: number; quality: number | null }>(
    'SELECT duration_minutes, quality FROM sleep_sessions WHERE user_id = $1 AND sleep_date = $2',
    [userId, date]
  );
  if (!session) return NO_DATA;
  const hours = session.duration_minutes / 60;
  const durationScore = clamp(100 - Math.abs(8 - hours) * 15);
  const qualityScore = ((session.quality ?? 3) / 5) * 100;
  return { score: clamp(durationScore * 0.6 + qualityScore * 0.4), hasData: true };
}

/**
 * Movement, from workouts and steps together. Counting only logged workouts
 * scored a 12,000-step day as a zero, which is both wrong and the opposite of
 * the nudge that day deserves. 30 active minutes or 10,000 steps each earn
 * full marks, and they add.
 */
async function scoreActivity(userId: string, date: string): Promise<Dimension> {
  const [workout, steps] = await Promise.all([
    queryOne<{ total_minutes: string }>(
      `SELECT COALESCE(SUM(duration_minutes), 0)::text AS total_minutes
       FROM workout_sessions WHERE user_id = $1 AND workout_date = $2`,
      [userId, date]
    ),
    queryOne<{ steps: number }>('SELECT steps FROM step_logs WHERE user_id = $1 AND log_date = $2', [userId, date]),
  ]);

  const minutes = Number(workout?.total_minutes ?? 0);
  const stepCount = Number(steps?.steps ?? 0);
  if (minutes === 0 && stepCount === 0) return NO_DATA;

  return { score: clamp((minutes / 30) * 100 + (stepCount / 10000) * 100), hasData: true };
}

/**
 * Scored against the user's own targets. Measuring everyone against a flat
 * 2,000 kcal and 80 g of protein marked a 1,500 kcal plan followed exactly as
 * a 75 — punishing someone for hitting the target this same app set them.
 *
 * A day still in progress is left unscored while it is under target. Half a
 * day's food at two in the afternoon is not a bad day, it is an unfinished
 * one, and there is no fair way to grade it before it ends. Going *over* is
 * already final, so that is scored the moment it happens.
 */
async function scoreNutrition(userId: string, date: string, isToday: boolean): Promise<Dimension> {
  const log = await queryOne<{ total_calories: number; total_protein_g: number }>(
    'SELECT total_calories, total_protein_g FROM nutrition_logs WHERE user_id = $1 AND log_date = $2',
    [userId, date]
  );
  if (!log || Number(log.total_calories) === 0) return NO_DATA;

  const targets = await getDailyTargets(userId);
  const eaten = Number(log.total_calories);
  if (isToday && eaten < targets.calories) return NOT_YET;

  const calorieScore = closenessToTarget(eaten, targets.calories);
  const proteinScore = clamp((Number(log.total_protein_g) / targets.protein_g) * 100);
  return { score: clamp(calorieScore * 0.6 + proteinScore * 0.4), hasData: true };
}

/**
 * Derived from sleep and activity rather than logged, so it has data whenever
 * either of those does. Rest is scored as a balance: training hard on no sleep
 * and never moving at all are both poor recovery.
 */
async function scoreRecovery(sleep: Dimension, activity: Dimension): Promise<Dimension> {
  if (!sleep.hasData && !activity.hasData) return NO_DATA;
  const sleepPart = sleep.hasData ? sleep.score : 50;
  const activityPart = activity.hasData ? activity.score : 0;
  return { score: clamp(sleepPart * 0.7 + (100 - Math.abs(activityPart - 60)) * 0.3), hasData: true };
}

async function scoreHydration(userId: string, date: string, isToday: boolean): Promise<Dimension> {
  // Uses the same personalised target the hydration page shows, so the score
  // and the "x of y ml" the user sees can never disagree.
  const [log, targetMl] = await Promise.all([
    queryOne<{ total_ml: number }>('SELECT total_ml FROM hydration_logs WHERE user_id = $1 AND log_date = $2', [
      userId,
      date,
    ]),
    getHydrationTarget(userId),
  ]);
  const ml = Number(log?.total_ml ?? 0);
  if (ml === 0) return NO_DATA;

  // Same reasoning as food: there are hours left to finish the bottle.
  if (isToday && ml < targetMl) return NOT_YET;
  return { score: clamp((ml / targetMl) * 100), hasData: true };
}

async function scoreWellbeing(userId: string, date: string): Promise<Dimension> {
  const metric = await queryOne<{ value: number }>(
    `SELECT value FROM health_metrics WHERE user_id = $1 AND metric_type = 'mood' AND recorded_at::date = $2
     ORDER BY recorded_at DESC LIMIT 1`,
    [userId, date]
  );
  if (!metric) return NO_DATA;
  return { score: clamp((Number(metric.value) / 10) * 100), hasData: true };
}

async function scoreVitals(userId: string, date: string): Promise<Dimension> {
  const metrics = await query<{ metric_type: string; value: number }>(
    `SELECT metric_type, value FROM health_metrics
     WHERE user_id = $1 AND recorded_at::date = $2 AND metric_type IN ('heart_rate', 'blood_pressure_systolic')`,
    [userId, date]
  );
  if (metrics.length === 0) return NO_DATA;

  let score = 100;
  for (const m of metrics) {
    if (m.metric_type === 'heart_rate' && (m.value < 40 || m.value > 100)) score -= 20;
    if (m.metric_type === 'blood_pressure_systolic' && (m.value < 90 || m.value > 140)) score -= 20;
  }
  return { score: clamp(score), hasData: true };
}

async function scoreGoalProgress(userId: string): Promise<Dimension> {
  const goals = await query<{ target_value: number | null; current_value: number | null }>(
    `SELECT target_value, current_value FROM goals WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );

  const progresses = goals
    .filter((g) => g.target_value && Number(g.target_value) > 0)
    .map((g) => clamp((Number(g.current_value ?? 0) / Number(g.target_value)) * 100));

  if (progresses.length === 0) return NO_DATA;
  return { score: progresses.reduce((sum, p) => sum + p, 0) / progresses.length, hasData: true };
}

export interface HealthScoreBreakdown {
  score_date: string;
  /** null until something has been logged — an unscored day, not a bad one. */
  overall_score: number | null;
  /** Each dimension is null when there was nothing logged for it that day. */
  sleep_score: number | null;
  activity_score: number | null;
  nutrition_score: number | null;
  recovery_score: number | null;
  hydration_score: number | null;
  wellbeing_score: number | null;
  vitals_score: number | null;
  goal_progress_score: number | null;
  /** Share of the scoring weight that had data behind it, 0-1. */
  coverage: number;
  /** What is missing, heaviest first — what to log to make the score mean more. */
  missing: DimensionName[];
  /** Logged but not yet judgeable today, so not something to nudge about. */
  deferred: DimensionName[];
  /** The single most worthwhile thing to log next, or null when nothing is. */
  next_best: DimensionName | null;
}

export async function calculateHealthScore(userId: string, date: string): Promise<HealthScoreBreakdown> {
  // Targets that accumulate through the day can only be judged once the day is
  // done, so today is scored differently from the days behind it.
  const isToday = date === new Date().toISOString().slice(0, 10);

  const [sleep, activity, nutrition, hydration, wellbeing, vitals, goalProgress] = await Promise.all([
    scoreSleep(userId, date),
    scoreActivity(userId, date),
    scoreNutrition(userId, date, isToday),
    scoreHydration(userId, date, isToday),
    scoreWellbeing(userId, date),
    scoreVitals(userId, date),
    scoreGoalProgress(userId),
  ]);
  const recovery = await scoreRecovery(sleep, activity);

  const dimensions: Record<DimensionName, Dimension> = {
    sleep,
    activity,
    nutrition,
    recovery,
    hydration,
    wellbeing,
    vitals,
    goalProgress,
  };
  const combined = combineScore(dimensions);
  const show = (d: Dimension) => (d.hasData ? Math.round(d.score * 10) / 10 : null);

  const breakdown: HealthScoreBreakdown = {
    score_date: date,
    overall_score: combined.overall,
    sleep_score: show(sleep),
    activity_score: show(activity),
    nutrition_score: show(nutrition),
    recovery_score: show(recovery),
    hydration_score: show(hydration),
    wellbeing_score: show(wellbeing),
    vitals_score: show(vitals),
    goal_progress_score: show(goalProgress),
    coverage: combined.coverage,
    missing: combined.missing.sort((a, b) => WEIGHTS[b] - WEIGHTS[a]),
    deferred: combined.deferred,
    next_best: nextBestDimension(combined.missing),
  };

  // Nothing logged means nothing to store. Writing a row of nulls would put a
  // phantom point on the history chart for a day the user never opened.
  if (combined.overall === null) return breakdown;

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
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Yesterday is re-scored on the way past. Its stored row is whatever was
  // computed while it was still the current day, with the accumulating
  // dimensions deferred — so without this, every day in the history keeps the
  // provisional score it had at noon and the trend is permanently flattering.
  const [breakdown, sealed] = await Promise.all([
    calculateHealthScore(userId, today),
    calculateHealthScore(userId, yesterday),
  ]);

  const previous = sealed.overall_score === null ? null : { overall_score: sealed.overall_score };

  // No score today means no direction to report — an unscored day is not a
  // fall from yesterday's.
  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (previous && breakdown.overall_score !== null) {
    if (breakdown.overall_score > Number(previous.overall_score)) trend = 'up';
    else if (breakdown.overall_score < Number(previous.overall_score)) trend = 'down';
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
