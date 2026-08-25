import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';
import { computeSleepDuration } from './nutrition.calc';

export interface SleepSession {
  id: string;
  user_id: string;
  sleep_date: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  quality: number | null;
  notes: string | null;
}

export interface LogSleepInput {
  date: string;
  bedtime: string; // HH:mm or ISO
  wakeTime: string;
  quality?: number;
  notes?: string;
}

function toTimestamp(date: string, time: string): Date {
  if (time.includes('T')) return new Date(time);
  const dateOnly = date.slice(0, 10);
  return new Date(`${dateOnly}T${time}:00`);
}

const computeDuration = computeSleepDuration;

export async function logSleep(userId: string, input: LogSleepInput): Promise<SleepSession> {
  const bedtime = toTimestamp(input.date, input.bedtime);
  const wakeTime = toTimestamp(input.date, input.wakeTime);
  const durationMinutes = computeDuration(bedtime, wakeTime);
  if (durationMinutes === null) {
    throw AppError.badRequest(
      'That works out at more than 16 hours in bed. Check the two times — they may be the wrong way round.',
      'IMPLAUSIBLE_SLEEP'
    );
  }

  const session = await queryOne<SleepSession>(
    `INSERT INTO sleep_sessions (user_id, sleep_date, bedtime, wake_time, duration_minutes, quality, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, sleep_date) DO UPDATE SET
       bedtime = EXCLUDED.bedtime, wake_time = EXCLUDED.wake_time,
       duration_minutes = EXCLUDED.duration_minutes, quality = EXCLUDED.quality, notes = EXCLUDED.notes
     RETURNING *`,
    [userId, input.date, bedtime.toISOString(), wakeTime.toISOString(), durationMinutes, input.quality ?? null, input.notes ?? null]
  );

  await query(
    `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
     VALUES ($1, 'sleep_logged', $2, $3)`,
    [userId, `Logged ${(durationMinutes / 60).toFixed(1)}h of sleep`, JSON.stringify({ sleepId: session!.id })]
  );

  return session!;
}

export async function getSleepLogs(userId: string, days = 30): Promise<SleepSession[]> {
  return query<SleepSession>(
    `SELECT * FROM sleep_sessions
     WHERE user_id = $1 AND sleep_date >= (CURRENT_DATE - $2::int)
     ORDER BY sleep_date DESC`,
    [userId, days]
  );
}

export async function getSleepByDate(userId: string, date: string): Promise<SleepSession> {
  const session = await queryOne<SleepSession>(
    'SELECT * FROM sleep_sessions WHERE user_id = $1 AND sleep_date = $2',
    [userId, date]
  );
  if (!session) throw AppError.notFound('No sleep log found for this date');
  return session;
}

export async function updateSleep(userId: string, id: string, input: Partial<LogSleepInput>): Promise<SleepSession> {
  const existing = await queryOne<SleepSession>('SELECT * FROM sleep_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!existing) throw AppError.notFound('Sleep log not found');

  const bedtime = input.bedtime ? toTimestamp(existing.sleep_date, input.bedtime) : new Date(existing.bedtime);
  const wakeTime = input.wakeTime ? toTimestamp(existing.sleep_date, input.wakeTime) : new Date(existing.wake_time);
  const durationMinutes = computeDuration(bedtime, wakeTime);
  if (durationMinutes === null) {
    throw AppError.badRequest(
      'That works out at more than 16 hours in bed. Check the two times — they may be the wrong way round.',
      'IMPLAUSIBLE_SLEEP'
    );
  }

  const updated = await queryOne<SleepSession>(
    `UPDATE sleep_sessions SET bedtime = $2, wake_time = $3, duration_minutes = $4,
       quality = COALESCE($5, quality), notes = COALESCE($6, notes)
     WHERE id = $1 RETURNING *`,
    [id, bedtime.toISOString(), wakeTime.toISOString(), durationMinutes, input.quality ?? null, input.notes ?? null]
  );
  return updated!;
}

export async function deleteSleep(userId: string, id: string): Promise<void> {
  const existing = await queryOne('SELECT id FROM sleep_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!existing) throw AppError.notFound('Sleep log not found');
  await query('DELETE FROM sleep_sessions WHERE id = $1', [id]);
}

export type SleepQualityLabel = 'excellent' | 'good' | 'fair' | 'poor';

export function analyzeSleep(session: SleepSession): { label: SleepQualityLabel; recommendation: string } {
  const hours = session.duration_minutes / 60;
  const quality = session.quality ?? 3;

  let label: SleepQualityLabel;
  if (hours >= 7 && hours <= 9 && quality >= 4) label = 'excellent';
  else if (hours >= 6.5 && quality >= 3) label = 'good';
  else if (hours >= 5.5) label = 'fair';
  else label = 'poor';

  const recommendations: Record<SleepQualityLabel, string> = {
    excellent: 'Great sleep! Keep up your current routine.',
    good: 'Solid sleep. Try to keep a consistent bedtime for even better recovery.',
    fair: 'Consider going to bed 30-60 minutes earlier and limiting screens before bed.',
    poor: 'Your sleep duration or quality is low. Aim for 7-9 hours and a consistent wind-down routine.',
  };

  return { label, recommendation: recommendations[label] };
}

export async function getAnalysis(userId: string, date: string) {
  const session = await getSleepByDate(userId, date);
  return { session, ...analyzeSleep(session) };
}

export async function getTrend(userId: string, period: 'week' | 'month') {
  const days = period === 'week' ? 7 : 30;
  const sessions = await getSleepLogs(userId, days);
  const avgDuration =
    sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.duration_minutes, 0) / sessions.length : 0;
  const avgQuality =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.quality ?? 0), 0) / sessions.filter((s) => s.quality != null).length || 0
      : 0;

  return {
    period,
    sessions,
    averageDurationMinutes: Math.round(avgDuration),
    averageQuality: Math.round(avgQuality * 10) / 10,
  };
}
