/**
 * Plan scheduling and adherence maths.
 *
 * Kept free of the database because "did my client follow the plan?" is the
 * number a coach acts on, and it is easy to get quietly wrong — around the
 * cycle boundary, around portion tolerance, and around days the plan does not
 * cover at all.
 *
 * Dates are 'YYYY-MM-DD' local date strings throughout, matching the rest of
 * the app.
 */

export function daysBetween(from: string, to: string): number {
  const parse = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

/**
 * Which day of a repeating plan cycle a date falls on, 1-based.
 *
 * Anchored to the assignment's start date rather than to the week, so "day 1"
 * is whatever weekday the coach started the client on, and a 7-day plan keeps
 * landing on the same weekdays from then on. Returns null before the plan
 * starts, so an assignment created today cannot retroactively judge last week.
 */
export function cycleDayFor(startDate: string, date: string, cycleDays: number): number | null {
  if (date < startDate) return null;
  const span = Math.max(1, Math.floor(cycleDays));
  const offset = daysBetween(startDate, date);
  return (offset % span) + 1;
}

export interface AssignmentWindow {
  start_date: string;
  end_date: string | null;
  active: boolean;
}

/** Whether an assignment covers a given date. */
export function coversDate(assignment: AssignmentWindow, date: string): boolean {
  if (!assignment.active) return false;
  if (date < assignment.start_date) return false;
  if (assignment.end_date && date > assignment.end_date) return false;
  return true;
}

export interface PlannedFood {
  id: string;
  meal_type: string | null;
  food_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface LoggedFood {
  id: string;
  meal_type: string | null;
  food_id: string;
  name: string;
  quantity: number;
  unit: string | null;
}

export type ItemStatus = 'followed' | 'partial' | 'missed';

export interface AdherenceLine {
  planned: PlannedFood;
  status: ItemStatus;
  /** The logged entry we counted against this plan line, if any. */
  loggedId: string | null;
  loggedQuantity: number | null;
  /** True when the client ticked this line off by hand rather than logging a food. */
  checkedOff: boolean;
  /**
   * True when this line can only ever be satisfied by ticking it — free text
   * with no food behind it. The UI shows those with a checkbox.
   */
  manualOnly: boolean;
}

export interface DietAdherence {
  lines: AdherenceLine[];
  /** Logged foods that were not on the plan at all. */
  extras: LoggedFood[];
  followed: number;
  partial: number;
  missed: number;
  /** 0-100, or null when the plan has nothing scheduled for the day. */
  percent: number | null;
}

/**
 * Portion tolerance. Eyeballed home portions are never exact, and flagging a
 * client for eating 105 g of rice instead of 100 g would make the number
 * useless. Outside this band the item counts as partial, not as a miss —
 * they ate the right food, just not the right amount.
 */
export const PORTION_TOLERANCE = 0.25;

function quantityStatus(plannedQty: number | null, loggedQty: number): ItemStatus {
  if (plannedQty === null || plannedQty <= 0) return 'followed';
  const ratio = loggedQty / plannedQty;
  return Math.abs(ratio - 1) <= PORTION_TOLERANCE ? 'followed' : 'partial';
}

/**
 * Matches what the client actually logged against what the plan asked for.
 *
 * Matching is by food, preferring the same meal slot: eating your planned
 * dinner at lunch still means you ate it, and a coach cares far more about
 * that than about the clock. Each logged entry is consumed at most once, so
 * one bowl of rice cannot satisfy two planned rice lines.
 */
export function dietAdherence(
  planned: PlannedFood[],
  logged: LoggedFood[],
  checkedItemIds: ReadonlySet<string> = new Set()
): DietAdherence {
  const available = [...logged];
  const usedIds = new Set<string>();
  const lines: AdherenceLine[] = [];

  for (const line of planned) {
    const manualOnly = !line.food_id;

    // A hand tick settles the line outright. It is the only way a free-text
    // item can ever be satisfied, and for a food-backed item it covers the
    // case where the client ate it but logged it under a different name.
    if (checkedItemIds.has(line.id)) {
      lines.push({
        planned: line,
        status: 'followed',
        loggedId: null,
        loggedQuantity: null,
        checkedOff: true,
        manualOnly,
      });
      continue;
    }

    // Same food and same meal slot is the best match; same food in a
    // different slot is the fallback.
    let index = available.findIndex(
      (l) => !usedIds.has(l.id) && l.food_id && l.food_id === line.food_id && l.meal_type === line.meal_type
    );
    if (index === -1) {
      index = available.findIndex((l) => !usedIds.has(l.id) && l.food_id && l.food_id === line.food_id);
    }

    if (index === -1) {
      lines.push({
        planned: line,
        status: 'missed',
        loggedId: null,
        loggedQuantity: null,
        checkedOff: false,
        manualOnly,
      });
      continue;
    }

    const hit = available[index];
    usedIds.add(hit.id);
    lines.push({
      planned: line,
      status: quantityStatus(line.quantity, hit.quantity),
      loggedId: hit.id,
      loggedQuantity: hit.quantity,
      checkedOff: false,
      manualOnly,
    });
  }

  const extras = logged.filter((l) => !usedIds.has(l.id));
  const followed = lines.filter((l) => l.status === 'followed').length;
  const partial = lines.filter((l) => l.status === 'partial').length;
  const missed = lines.filter((l) => l.status === 'missed').length;

  // A partially-followed item is worth half: the right food, the wrong amount.
  const percent = lines.length === 0 ? null : Math.round(((followed + partial * 0.5) / lines.length) * 100);

  return { lines, extras, followed, partial, missed, percent };
}

/**
 * Averages daily adherence over a range, ignoring days the plan did not
 * cover. Averaging those in as zeros would punish a client for days their
 * coach never scheduled.
 */
export function averageAdherence(daily: Array<number | null>): number | null {
  const scored = daily.filter((d): d is number => d !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}
