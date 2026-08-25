import Joi from 'joi';
import { shiftDate } from '../utils/dates';

/**
 * A date something can be *logged* against.
 *
 * Diary entries are records of what happened, so a date years in the future is
 * junk that shows up as a phantom point on every history chart. The web client
 * already refuses to pick one; this is the same rule on the server.
 *
 * The allowance is one day past the UTC date rather than the UTC date itself,
 * because the furthest-ahead timezone is +14: someone in Kiritimati logging
 * their genuine today is a day ahead of the server, and rejecting that would
 * break the app for them to catch data nobody is entering.
 */
export function maxLogDate(now: Date = new Date()): string {
  return shiftDate(now.toISOString().slice(0, 10), 1);
}

/** `Joi.string()` for a YYYY-MM-DD (or ISO) date that may not be in the future. */
export const loggableDate = () =>
  Joi.string()
    .min(10)
    .custom((value: string, helpers) => {
      if (value.slice(0, 10) > maxLogDate()) {
        return helpers.error('any.invalid', { message: 'date is in the future' });
      }
      return value;
    }, 'not in the future')
    .messages({ 'any.invalid': '"date" cannot be in the future' });
