import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { calculateHydrationTarget } from './nutrition.calc';

export interface HydrationEntry {
  id: string;
  log_date: string;
  amount_ml: number;
  logged_at: string;
}

export interface HydrationDay {
  date: string;
  total_ml: number;
  target_ml: number;
  remaining_ml: number;
  entries: HydrationEntry[];
}

/**
 * Baseline 2 litres, scaled up with body weight (~35 ml/kg) and bumped for
 * higher activity levels. Falls back to a flat 2500 ml when the profile is
 * empty, so the target is sensible from day one.
 */
export async function getHydrationTarget(userId: string): Promise<number> {
  const profile = await queryOne<{ weight_kg: string | null; activity_level: string | null }>(
    'SELECT weight_kg, activity_level FROM profiles WHERE user_id = $1',
    [userId]
  );
  return calculateHydrationTarget(
    profile?.weight_kg ? Number(profile.weight_kg) : null,
    profile?.activity_level ?? null
  );
}

async function recalcTotal(userId: string, logDate: string): Promise<number> {
  const row = await queryOne<{ total: string }>(
    'SELECT COALESCE(SUM(amount_ml), 0) AS total FROM hydration_entries WHERE user_id = $1 AND log_date = $2',
    [userId, logDate]
  );
  const total = Number(row?.total ?? 0);

  await query(
    `INSERT INTO hydration_logs (user_id, log_date, total_ml)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, log_date) DO UPDATE SET total_ml = EXCLUDED.total_ml`,
    [userId, logDate, total]
  );

  return total;
}

export async function addWater(userId: string, logDate: string, amountMl: number): Promise<HydrationDay> {
  await query('INSERT INTO hydration_entries (user_id, log_date, amount_ml) VALUES ($1, $2, $3)', [
    userId,
    logDate,
    amountMl,
  ]);

  await query(
    `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
     VALUES ($1, 'hydration_logged', $2, $3)`,
    [userId, `Drank ${amountMl} ml of water`, JSON.stringify({ amountMl })]
  );

  await recalcTotal(userId, logDate);
  return getHydrationForDate(userId, logDate);
}

export async function removeEntry(userId: string, entryId: string): Promise<void> {
  const entry = await queryOne<{ log_date: string }>(
    'SELECT log_date FROM hydration_entries WHERE id = $1 AND user_id = $2',
    [entryId, userId]
  );
  if (!entry) throw AppError.notFound('Hydration entry not found');

  await query('DELETE FROM hydration_entries WHERE id = $1 AND user_id = $2', [entryId, userId]);
  await recalcTotal(userId, entry.log_date);
}

export async function getHydrationForDate(userId: string, logDate: string): Promise<HydrationDay> {
  const [entries, log, target] = await Promise.all([
    query<HydrationEntry>(
      'SELECT id, log_date, amount_ml, logged_at FROM hydration_entries WHERE user_id = $1 AND log_date = $2 ORDER BY logged_at DESC',
      [userId, logDate]
    ),
    queryOne<{ total_ml: number }>('SELECT total_ml FROM hydration_logs WHERE user_id = $1 AND log_date = $2', [
      userId,
      logDate,
    ]),
    getHydrationTarget(userId),
  ]);

  const total = Number(log?.total_ml ?? 0);
  return {
    date: logDate,
    total_ml: total,
    target_ml: target,
    remaining_ml: Math.max(0, target - total),
    entries,
  };
}

export async function getHydrationHistory(userId: string, days = 14) {
  return query(
    `SELECT log_date, total_ml FROM hydration_logs
     WHERE user_id = $1 AND log_date >= (CURRENT_DATE - $2::int)
     ORDER BY log_date DESC`,
    [userId, days]
  );
}
