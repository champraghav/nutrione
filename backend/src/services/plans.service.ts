import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { requireClientAccess } from './coach.service';
import {
  averageAdherence,
  coversDate,
  cycleDayFor,
  dietAdherence,
  DietAdherence,
  LoggedFood,
  PlannedFood,
  PlannedExercise,
  trainingAdherence,
  TrainingAdherence,
  shiftDays,
} from './plans.calc';

export interface Plan {
  id: string;
  coach_user_id: string;
  name: string;
  description: string | null;
  kind: 'diet' | 'training';
  cycle_days: number;
  created_at: string;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  day_number: number;
  sort_order: number;
  meal_type: string | null;
  food_id: string | null;
  custom_name: string | null;
  quantity: number | null;
  unit: string | null;
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  duration_minutes: number | null;
  notes: string | null;
  /** Joined display name and nutrition, so the UI never needs a second lookup. */
  food_name?: string | null;
  exercise_name?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  serving_size?: number | null;
}

async function requireOwnPlan(coachUserId: string, planId: string): Promise<Plan> {
  const plan = await queryOne<Plan>(
    'SELECT * FROM plans WHERE id = $1 AND coach_user_id = $2 AND archived_at IS NULL',
    [planId, coachUserId]
  );
  if (!plan) throw AppError.notFound('Plan not found');
  return plan;
}

export async function listPlans(coachUserId: string, kind?: string): Promise<Plan[]> {
  return query<Plan>(
    `SELECT * FROM plans
     WHERE coach_user_id = $1 AND archived_at IS NULL
       AND ($2::text IS NULL OR kind = $2)
     ORDER BY created_at DESC`,
    [coachUserId, kind ?? null]
  );
}

/**
 * Plan items with everything the UI needs to display and cost them. The food
 * join carries nutrition so a coach sees the calories of the plan they are
 * writing as they write it.
 */
export async function getPlanItems(planId: string): Promise<PlanItem[]> {
  return query<PlanItem>(
    `SELECT pi.*,
            f.name AS food_name, f.calories, f.protein_g, f.carbs_g, f.fat_g, f.serving_size,
            e.name AS exercise_name
     FROM plan_items pi
     LEFT JOIN foods f ON f.id = pi.food_id
     LEFT JOIN exercises e ON e.id = pi.exercise_id
     WHERE pi.plan_id = $1
     ORDER BY pi.day_number ASC, pi.sort_order ASC, pi.created_at ASC`,
    [planId]
  );
}

export async function getPlan(coachUserId: string, planId: string) {
  const plan = await requireOwnPlan(coachUserId, planId);
  const items = await getPlanItems(planId);
  return { plan, items };
}

export async function createPlan(
  coachUserId: string,
  input: { name: string; description?: string; kind: 'diet' | 'training'; cycleDays?: number }
): Promise<Plan> {
  const created = await queryOne<Plan>(
    `INSERT INTO plans (coach_user_id, name, description, kind, cycle_days)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [coachUserId, input.name.trim(), input.description ?? null, input.kind, input.cycleDays ?? 7]
  );
  return created!;
}

export async function updatePlan(
  coachUserId: string,
  planId: string,
  input: { name: string; description?: string; cycleDays?: number }
): Promise<void> {
  await requireOwnPlan(coachUserId, planId);
  await query(
    `UPDATE plans SET name = $3, description = $4, cycle_days = COALESCE($5, cycle_days), updated_at = now()
     WHERE id = $1 AND coach_user_id = $2`,
    [planId, coachUserId, input.name.trim(), input.description ?? null, input.cycleDays ?? null]
  );
}

export async function archivePlan(coachUserId: string, planId: string): Promise<void> {
  await requireOwnPlan(coachUserId, planId);
  await query('UPDATE plans SET archived_at = now() WHERE id = $1 AND coach_user_id = $2', [planId, coachUserId]);
  await query('UPDATE plan_assignments SET active = false WHERE plan_id = $1', [planId]);
}

export interface PlanItemInput {
  dayNumber: number;
  mealType?: string | null;
  foodId?: string | null;
  customName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  exerciseId?: string | null;
  sets?: number | null;
  reps?: number | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

export async function addPlanItem(coachUserId: string, planId: string, input: PlanItemInput): Promise<PlanItem[]> {
  const plan = await requireOwnPlan(coachUserId, planId);

  if (input.dayNumber > plan.cycle_days) {
    throw AppError.badRequest(`This plan only has ${plan.cycle_days} days.`, 'DAY_OUT_OF_RANGE');
  }
  if (plan.kind === 'diet' && !input.foodId && !input.customName?.trim()) {
    throw AppError.badRequest('Pick a food or give the item a name.', 'ITEM_EMPTY');
  }
  if (plan.kind === 'training' && !input.exerciseId && !input.customName?.trim()) {
    throw AppError.badRequest('Pick an exercise or give the item a name.', 'ITEM_EMPTY');
  }

  const order = await queryOne<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM plan_items WHERE plan_id = $1 AND day_number = $2',
    [planId, input.dayNumber]
  );

  await query(
    `INSERT INTO plan_items
       (plan_id, day_number, sort_order, meal_type, food_id, custom_name, quantity, unit,
        exercise_id, sets, reps, duration_minutes, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      planId,
      input.dayNumber,
      Number(order?.next ?? 1),
      input.mealType ?? null,
      input.foodId ?? null,
      input.customName?.trim() || null,
      input.quantity ?? null,
      input.unit ?? null,
      input.exerciseId ?? null,
      input.sets ?? null,
      input.reps ?? null,
      input.durationMinutes ?? null,
      input.notes ?? null,
    ]
  );

  return getPlanItems(planId);
}

export async function deletePlanItem(coachUserId: string, planId: string, itemId: string): Promise<PlanItem[]> {
  await requireOwnPlan(coachUserId, planId);
  await query('DELETE FROM plan_items WHERE id = $1 AND plan_id = $2', [itemId, planId]);
  return getPlanItems(planId);
}

/**
 * Copies a whole day of a plan onto another day. Writing a 7-day plan is
 * mostly "the same as Monday but swap the dinner", and retyping six near
 * identical days is the fastest way to make a coach abandon the tool.
 */
export async function copyPlanDay(
  coachUserId: string,
  planId: string,
  fromDay: number,
  toDay: number
): Promise<PlanItem[]> {
  const plan = await requireOwnPlan(coachUserId, planId);
  if (toDay > plan.cycle_days || fromDay > plan.cycle_days) {
    throw AppError.badRequest(`This plan only has ${plan.cycle_days} days.`, 'DAY_OUT_OF_RANGE');
  }
  if (fromDay === toDay) return getPlanItems(planId);

  await query('DELETE FROM plan_items WHERE plan_id = $1 AND day_number = $2', [planId, toDay]);
  await query(
    `INSERT INTO plan_items
       (plan_id, day_number, sort_order, meal_type, food_id, custom_name, quantity, unit,
        exercise_id, sets, reps, duration_minutes, notes)
     SELECT plan_id, $3, sort_order, meal_type, food_id, custom_name, quantity, unit,
            exercise_id, sets, reps, duration_minutes, notes
     FROM plan_items WHERE plan_id = $1 AND day_number = $2`,
    [planId, fromDay, toDay]
  );

  return getPlanItems(planId);
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export interface Assignment {
  id: string;
  plan_id: string;
  coach_client_id: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
  plan_name?: string;
  plan_kind?: string;
  cycle_days?: number;
}

export async function assignPlan(
  coachUserId: string,
  input: { planId: string; coachClientId: string; startDate: string; endDate?: string | null }
): Promise<Assignment> {
  await requireOwnPlan(coachUserId, input.planId);
  await requireClientAccess(coachUserId, input.coachClientId);

  const created = await queryOne<Assignment>(
    `INSERT INTO plan_assignments (plan_id, coach_client_id, start_date, end_date)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.planId, input.coachClientId, input.startDate, input.endDate ?? null]
  );

  const link = await queryOne<{ client_user_id: string; plan: string }>(
    `SELECT cc.client_user_id, p.name AS plan FROM coach_clients cc, plans p
     WHERE cc.id = $1 AND p.id = $2`,
    [input.coachClientId, input.planId]
  );

  if (link?.client_user_id) {
    await query(
      `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
       VALUES ($1, 'plan_assigned', $2, $3)`,
      [link.client_user_id, `Your coach assigned "${link.plan}"`, JSON.stringify({ planId: input.planId })]
    );
  }

  return created!;
}

export async function listAssignments(coachUserId: string, coachClientId: string): Promise<Assignment[]> {
  await requireClientAccess(coachUserId, coachClientId);
  return query<Assignment>(
    `SELECT pa.*, p.name AS plan_name, p.kind AS plan_kind, p.cycle_days
     FROM plan_assignments pa
     JOIN plans p ON p.id = pa.plan_id
     WHERE pa.coach_client_id = $1
     ORDER BY pa.active DESC, pa.start_date DESC`,
    [coachClientId]
  );
}

export async function endAssignment(coachUserId: string, assignmentId: string): Promise<void> {
  const rows = await query(
    `UPDATE plan_assignments pa SET active = false
     FROM plans p
     WHERE pa.id = $1 AND pa.plan_id = p.id AND p.coach_user_id = $2
     RETURNING pa.id`,
    [assignmentId, coachUserId]
  );
  if (rows.length === 0) throw AppError.notFound('Assignment not found');
}

// ---------------------------------------------------------------------------
// What is on the plan for a given day, and how closely it was followed
// ---------------------------------------------------------------------------

export interface DayPlan {
  date: string;
  assignmentId: string;
  planId: string;
  planName: string;
  kind: 'diet' | 'training';
  dayNumber: number;
  cycleDays: number;
  items: PlanItem[];
}

/**
 * Resolves the plans in force for a user on a date, and which day of each
 * cycle that is. A user can be on a diet plan and a training plan at once,
 * so this returns a list rather than one plan.
 */
export async function plansForUserOnDate(clientUserId: string, date: string): Promise<DayPlan[]> {
  const assignments = await query<Assignment & { plan_name: string; kind: 'diet' | 'training' }>(
    `SELECT pa.id, pa.plan_id, pa.coach_client_id, pa.start_date::text, pa.end_date::text, pa.active,
            p.name AS plan_name, p.kind, p.cycle_days
     FROM plan_assignments pa
     JOIN plans p ON p.id = pa.plan_id
     JOIN coach_clients cc ON cc.id = pa.coach_client_id
     WHERE cc.client_user_id = $1 AND cc.status = 'active' AND pa.active AND p.archived_at IS NULL
     ORDER BY pa.start_date DESC`,
    [clientUserId]
  );

  const out: DayPlan[] = [];
  for (const a of assignments) {
    if (!coversDate({ start_date: a.start_date, end_date: a.end_date, active: a.active }, date)) continue;

    const dayNumber = cycleDayFor(a.start_date, date, Number(a.cycle_days));
    if (dayNumber === null) continue;

    const allItems = await getPlanItems(a.plan_id);
    out.push({
      date,
      assignmentId: a.id,
      planId: a.plan_id,
      planName: a.plan_name,
      kind: a.kind,
      dayNumber,
      cycleDays: Number(a.cycle_days),
      items: allItems.filter((i) => i.day_number === dayNumber),
    });
  }
  return out;
}

function toPlannedFoods(items: PlanItem[]): PlannedFood[] {
  return items.map((i) => ({
    id: i.id,
    meal_type: i.meal_type,
    food_id: i.food_id,
    name: i.food_name ?? i.custom_name ?? 'Item',
    quantity: i.quantity === null ? null : Number(i.quantity),
    unit: i.unit,
  }));
}

async function checkedItemIds(clientUserId: string, date: string): Promise<Set<string>> {
  const rows = await query<{ plan_item_id: string }>(
    'SELECT plan_item_id FROM plan_item_checkins WHERE user_id = $1 AND log_date = $2',
    [clientUserId, date]
  );
  return new Set(rows.map((r) => r.plan_item_id));
}

/**
 * Ticks or un-ticks a plan line for a date. Guarded so a user can only ever
 * check off a line from a plan actually assigned to them.
 */
export async function setItemCheckin(
  clientUserId: string,
  planItemId: string,
  date: string,
  done: boolean
): Promise<void> {
  const dayPlans = await plansForUserOnDate(clientUserId, date);
  const allowed = dayPlans.some((p) => p.items.some((i) => i.id === planItemId));
  if (!allowed) throw AppError.notFound('That item is not on your plan for this date.');

  if (done) {
    await query(
      `INSERT INTO plan_item_checkins (plan_item_id, user_id, log_date)
       VALUES ($1, $2, $3) ON CONFLICT (plan_item_id, user_id, log_date) DO NOTHING`,
      [planItemId, clientUserId, date]
    );
  } else {
    await query('DELETE FROM plan_item_checkins WHERE plan_item_id = $1 AND user_id = $2 AND log_date = $3', [
      planItemId,
      clientUserId,
      date,
    ]);
  }
}

async function loggedFoodsFor(clientUserId: string, date: string): Promise<LoggedFood[]> {
  // LEFT JOIN so quick-add entries are still seen. They match no plan line,
  // which is right, but they must still show up as something eaten.
  const rows = await query<{
    id: string;
    meal_type: string | null;
    food_id: string | null;
    name: string;
    quantity: string;
    unit: string | null;
  }>(
    `SELECT mi.id, mi.meal_type, mi.food_id, COALESCE(f.name, mi.label, 'Quick add') AS name,
            mi.quantity, mi.unit
     FROM meal_items mi LEFT JOIN foods f ON f.id = mi.food_id
     WHERE mi.user_id = $1 AND mi.log_date = $2`,
    [clientUserId, date]
  );
  return rows.map((r) => ({ ...r, quantity: Number(r.quantity) }));
}

export interface DayAdherence {
  date: string;
  planName: string | null;
  adherence: DietAdherence | null;
  /** Null when no training plan covers the date. */
  training: TrainingAdherence | null;
}

/** Adherence for one client on one date. */
export async function adherenceForDate(clientUserId: string, date: string): Promise<DayAdherence> {
  const all = await plansForUserOnDate(clientUserId, date);
  const dietPlans = all.filter((p) => p.kind === 'diet');
  const trainingPlans = all.filter((p) => p.kind === 'training');

  if (dietPlans.length === 0 && trainingPlans.length === 0) {
    return { date, planName: null, adherence: null, training: null };
  }

  const checked = await checkedItemIds(clientUserId, date);

  let diet: DietAdherence | null = null;
  if (dietPlans.length > 0) {
    const logged = await loggedFoodsFor(clientUserId, date);
    diet = dietAdherence(dietPlans.flatMap((p) => toPlannedFoods(p.items)), logged, checked);
  }

  let training: TrainingAdherence | null = null;
  if (trainingPlans.length > 0) {
    const minutes = await queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(duration_minutes), 0)::text AS total
       FROM workout_sessions WHERE user_id = $1 AND workout_date = $2`,
      [clientUserId, date]
    );
    const planned: PlannedExercise[] = trainingPlans.flatMap((p) =>
      p.items.map((i) => ({
        id: i.id,
        name: i.exercise_name ?? i.custom_name ?? 'Exercise',
        sets: i.sets,
        reps: i.reps,
        duration_minutes: i.duration_minutes,
      }))
    );
    training = trainingAdherence(planned, Number(minutes?.total ?? 0), checked);
  }

  return {
    date,
    planName: all.map((p) => p.planName).join(', '),
    adherence: diet,
    training,
  };
}

// ---------------------------------------------------------------------------
// Weekly report
// ---------------------------------------------------------------------------

export interface WeeklyReport {
  from: string;
  to: string;
  dietAdherence: number | null;
  trainingAdherence: number | null;
  daysLogged: number;
  daysInWeek: number;
  avgCalories: number | null;
  avgProtein: number | null;
  workouts: number;
  workoutMinutes: number;
  avgSteps: number | null;
  habitsPercent: number | null;
  weightChangeKg: number | null;
  bestStreak: number;
}

/**
 * The week in one screen, which is the unit people actually review progress
 * in. Averages skip days with no data rather than counting them as zero — a
 * week where you logged four days at 2000 kcal averaged 2000, not 1140.
 */
export async function weeklyReport(clientUserId: string, endDate: string): Promise<WeeklyReport> {
  const days: string[] = [];
  for (let i = 6; i >= 0; i -= 1) days.push(shiftDays(endDate, -i));
  const from = days[0];

  const [adherences, nutrition, workouts, steps, weights, habits] = await Promise.all([
    Promise.all(days.map((d) => adherenceForDate(clientUserId, d))),
    query<{ total_calories: string; total_protein_g: string }>(
      `SELECT total_calories, total_protein_g FROM nutrition_logs
       WHERE user_id = $1 AND log_date BETWEEN $2 AND $3 AND total_calories > 0`,
      [clientUserId, from, endDate]
    ),
    queryOne<{ sessions: string; minutes: string }>(
      `SELECT count(*)::text AS sessions, COALESCE(SUM(duration_minutes), 0)::text AS minutes
       FROM workout_sessions WHERE user_id = $1 AND workout_date BETWEEN $2 AND $3`,
      [clientUserId, from, endDate]
    ),
    query<{ steps: number }>(
      'SELECT steps FROM step_logs WHERE user_id = $1 AND log_date BETWEEN $2 AND $3',
      [clientUserId, from, endDate]
    ),
    query<{ value: string }>(
      `SELECT value FROM health_metrics
       WHERE user_id = $1 AND metric_type = 'weight' AND recorded_at::date BETWEEN $2 AND $3
       ORDER BY recorded_at ASC`,
      [clientUserId, from, endDate]
    ),
    import('./habits.service').then((m) => m.getHabitsSummary(clientUserId, endDate)),
  ]);

  const mean = (values: number[]) =>
    values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return {
    from,
    to: endDate,
    dietAdherence: averageAdherence(adherences.map((a) => a.adherence?.percent ?? null)),
    trainingAdherence: averageAdherence(adherences.map((a) => a.training?.percent ?? null)),
    daysLogged: nutrition.length,
    daysInWeek: 7,
    avgCalories: mean(nutrition.map((r) => Number(r.total_calories))),
    avgProtein: mean(nutrition.map((r) => Number(r.total_protein_g))),
    workouts: Number(workouts?.sessions ?? 0),
    workoutMinutes: Number(workouts?.minutes ?? 0),
    avgSteps: mean(steps.map((r) => Number(r.steps))),
    habitsPercent: habits.percent,
    weightChangeKg:
      weights.length >= 2
        ? Math.round((Number(weights[weights.length - 1].value) - Number(weights[0].value)) * 10) / 10
        : null,
    bestStreak: habits.best_streak,
  };
}

export interface AdherenceTrend {
  days: Array<{ date: string; percent: number | null }>;
  average: number | null;
}

export async function adherenceTrend(clientUserId: string, dates: string[]): Promise<AdherenceTrend> {
  const days = await Promise.all(
    dates.map(async (date) => ({ date, percent: (await adherenceForDate(clientUserId, date)).adherence?.percent ?? null }))
  );
  return { days, average: averageAdherence(days.map((d) => d.percent)) };
}
