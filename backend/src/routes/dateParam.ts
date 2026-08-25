import { isValidDateString } from '../utils/dates';
import { todayForUser } from '../services/time.service';

/**
 * The calendar date a request is about.
 *
 * Prefers the date the client sent, because only the client knows what day it
 * is where the user is standing. Falls back to the timezone on their profile,
 * and only then to UTC.
 *
 * Anything malformed is treated as absent rather than passed through to
 * Postgres, which would answer a typo with a 500.
 */
export async function dateParam(value: unknown, userId: string): Promise<string> {
  const trimmed = typeof value === 'string' ? value.slice(0, 10) : undefined;
  if (isValidDateString(trimmed)) return trimmed;
  return todayForUser(userId);
}
