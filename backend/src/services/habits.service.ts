import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import {
  Cadence,
  completionRate,
  computeStreaks,
  HabitSchedule,
  isDoneOn,
  isDueOn,
  recentDays,
  shiftYmd,
} from './habits.calc';

interface HabitRow {
  id: string;
  name: string;
  icon: string;
  cadence: Cadence;
  target_per_day: number;
  days_of_week: number[] | null;
  reminder_time: string | null;
  sort_order: number;
  created_at: string;
}

export interface HabitWithProgress {
  id: string;
  name: string;
  icon: string;
  cadence: Cadence;
  target_per_day: number;
  days_of_week: number[] | null;
  reminder_time: string | null;
  /** Is it scheduled for the requested date at all? */
  due_today: boolean;
  /** Times ticked off on the requested date. */
  count_today: number;
  done_today: boolean;
  current_streak: number;
  longest_streak: number;
  /** Percentage of scheduled days kept over the last 30 days; null if none. */
  rate_30d: number | null;
  /** Last 14 days, oldest first, for the dot row. */
  history: Array<{ date: string; due: boolean; done: boolean; count: number }>;
}

export interface HabitInput {
  name: string;
  icon?: string;
  cadence?: Cadence;
  targetPerDay?: number;
  daysOfWeek?: number[] | null;
  reminderTime?: string | null;
}

const HISTORY_DAYS = 14;
const RATE_WINDOW_DAYS = 30;
/** Enough history to resolve a long streak without loading a user's whole life. */
const STREAK_WINDOW_DAYS = 400;

function scheduleOf(row: HabitRow): HabitSchedule {
  return {
    cadence: row.cadence,
    targetPerDay: row.target_per_day,
    daysOfWeek: row.days_of_week,
  };
}

/**
 * Loads every habit plus its entries in two queries rather than two per habit,
 * so the dashboard card stays fast as the habit list grows.
 */
export async function listHabits(userId: string, date: string): Promise<HabitWithProgress[]> {
  const habits = await query<HabitRow>(
    `SELECT id, name, icon, cadence, target_per_day, days_of_week, reminder_time, sort_order, created_at
     FROM habits
     WHERE user_id = $1 AND archived_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    [userId]
  );
  if (habits.length === 0) return [];

  const since = shiftYmd(date, -STREAK_WINDOW_DAYS);
  const entries = await query<{ habit_id: string; log_date: string; count: number }>(
    `SELECT habit_id, to_char(log_date, 'YYYY-MM-DD') AS log_date, count
     FROM habit_entries
     WHERE user_id = $1 AND log_date BETWEEN $2 AND $3`,
    [userId, since, date]
  );

  const byHabit = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    let counts = byHabit.get(entry.habit_id);
    if (!counts) {
      counts = new Map();
      byHabit.set(entry.habit_id, counts);
    }
    counts.set(entry.log_date, Number(entry.count));
  }

  return habits.map((row) => {
    const schedule = scheduleOf(row);
    const counts = byHabit.get(row.id) ?? new Map<string, number>();
    const streaks = computeStreaks(schedule, counts, date, STREAK_WINDOW_DAYS);

    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      cadence: row.cadence,
      target_per_day: row.target_per_day,
      days_of_week: row.days_of_week,
      reminder_time: row.reminder_time,
      due_today: isDueOn(schedule, date),
      count_today: counts.get(date) ?? 0,
      done_today: isDoneOn(schedule, counts, date),
      current_streak: streaks.current,
      longest_streak: streaks.longest,
      rate_30d: completionRate(schedule, counts, shiftYmd(date, -(RATE_WINDOW_DAYS - 1)), date),
      history: recentDays(date, HISTORY_DAYS).map((day) => ({
        date: day,
        due: isDueOn(schedule, day),
        done: isDoneOn(schedule, counts, day),
        count: counts.get(day) ?? 0,
      })),
    };
  });
}

export async function createHabit(userId: string, input: HabitInput): Promise<HabitWithProgress[]> {
  const order = await queryOne<{ next: string }>(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM habits WHERE user_id = $1',
    [userId]
  );

  await query(
    `INSERT INTO habits (user_id, name, icon, cadence, target_per_day, days_of_week, reminder_time, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      input.name.trim(),
      input.icon ?? '✅',
      input.cadence ?? 'daily',
      input.targetPerDay ?? 1,
      input.cadence === 'weekly' ? (input.daysOfWeek ?? []) : null,
      input.reminderTime ?? null,
      Number(order?.next ?? 1),
    ]
  );

  return listHabits(userId, new Date().toISOString().slice(0, 10));
}

export async function updateHabit(userId: string, habitId: string, input: HabitInput): Promise<void> {
  const existing = await queryOne<{ id: string }>('SELECT id FROM habits WHERE id = $1 AND user_id = $2', [
    habitId,
    userId,
  ]);
  if (!existing) throw AppError.notFound('Habit not found');

  const cadence = input.cadence ?? 'daily';
  await query(
    `UPDATE habits
     SET name = $3, icon = $4, cadence = $5, target_per_day = $6, days_of_week = $7, reminder_time = $8
     WHERE id = $1 AND user_id = $2`,
    [
      habitId,
      userId,
      input.name.trim(),
      input.icon ?? '✅',
      cadence,
      input.targetPerDay ?? 1,
      cadence === 'weekly' ? (input.daysOfWeek ?? []) : null,
      input.reminderTime ?? null,
    ]
  );
}

/**
 * Archives rather than deletes, so a habit you drop does not take its own
 * history — and the streaks you earned — with it.
 */
export async function archiveHabit(userId: string, habitId: string): Promise<void> {
  const result = await query('UPDATE habits SET archived_at = now() WHERE id = $1 AND user_id = $2 RETURNING id', [
    habitId,
    userId,
  ]);
  if (result.length === 0) throw AppError.notFound('Habit not found');
}

/**
 * Sets the count for a date directly. The client sends the value it wants
 * rather than an increment, so a double-tap on a flaky connection cannot log
 * the habit twice.
 */
export async function setEntry(
  userId: string,
  habitId: string,
  date: string,
  count: number
): Promise<HabitWithProgress[]> {
  const habit = await queryOne<HabitRow>(
    `SELECT id, name, icon, cadence, target_per_day, days_of_week, reminder_time, sort_order, created_at
     FROM habits WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
    [habitId, userId]
  );
  if (!habit) throw AppError.notFound('Habit not found');

  const capped = Math.max(0, Math.min(count, habit.target_per_day * 10));

  if (capped === 0) {
    await query('DELETE FROM habit_entries WHERE habit_id = $1 AND user_id = $2 AND log_date = $3', [
      habitId,
      userId,
      date,
    ]);
  } else {
    await query(
      `INSERT INTO habit_entries (habit_id, user_id, log_date, count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (habit_id, log_date) DO UPDATE SET count = EXCLUDED.count, updated_at = now()`,
      [habitId, userId, date, capped]
    );
  }

  // Only announce the moment the habit is actually completed, so the timeline
  // shows "kept my habit" rather than every tap of a 3-times-a-day counter.
  if (capped >= habit.target_per_day) {
    await query(
      `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
       VALUES ($1, 'habit_completed', $2, $3)`,
      [userId, `Completed habit: ${habit.name}`, JSON.stringify({ habitId, date, count: capped })]
    );
  }

  return listHabits(userId, date);
}

export interface HabitsSummary {
  due: number;
  done: number;
  /** 0-100; null when nothing is scheduled for the day. */
  percent: number | null;
  best_streak: number;
}

/** The one-line version the dashboard and the health score both read. */
export async function getHabitsSummary(userId: string, date: string): Promise<HabitsSummary> {
  const habits = await listHabits(userId, date);
  const dueToday = habits.filter((h) => h.due_today);
  const doneToday = dueToday.filter((h) => h.done_today);

  return {
    due: dueToday.length,
    done: doneToday.length,
    percent: dueToday.length === 0 ? null : Math.round((doneToday.length / dueToday.length) * 100),
    best_streak: habits.reduce((max, h) => Math.max(max, h.current_streak), 0),
  };
}

/** Starter set offered on an empty habits page, so day one is not a blank slate. */
export const SUGGESTED_HABITS: HabitInput[] = [
  { name: 'Log every meal', icon: '🍽️', cadence: 'daily', targetPerDay: 3 },
  { name: 'Drink 8 glasses of water', icon: '💧', cadence: 'daily', targetPerDay: 8 },
  { name: '10,000 steps', icon: '👟', cadence: 'daily', targetPerDay: 1 },
  { name: 'Sleep by 11pm', icon: '🌙', cadence: 'daily', targetPerDay: 1 },
  { name: 'Strength training', icon: '🏋️', cadence: 'weekly', targetPerDay: 1, daysOfWeek: [1, 3, 5] },
  { name: 'No sugar after dinner', icon: '🍬', cadence: 'daily', targetPerDay: 1 },
  { name: '10 minutes of stretching', icon: '🧘', cadence: 'daily', targetPerDay: 1 },
  { name: 'Weigh in', icon: '⚖️', cadence: 'weekly', targetPerDay: 1, daysOfWeek: [1] },
];
