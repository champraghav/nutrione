import { queryOne } from '../config/database';
import { localDateInZone } from '../utils/dates';

/**
 * What calendar day it currently is for a given user.
 *
 * Only a fallback: the web client knows its own timezone and sends its local
 * date on every request that needs one. This covers the cases where it does
 * not — a bare `curl`, an older client, a scheduled job — and it is still much
 * better than assuming everyone lives on UTC.
 */
export async function todayForUser(userId: string, now: Date = new Date()): Promise<string> {
  const profile = await queryOne<{ timezone: string | null }>(
    'SELECT timezone FROM profiles WHERE user_id = $1',
    [userId]
  );
  return localDateInZone(profile?.timezone || 'UTC', now);
}
