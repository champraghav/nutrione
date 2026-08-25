/**
 * Pure scoring maths for the daily health score, kept free of database access
 * so the weighting rules can be tested directly.
 *
 * The governing idea: **a score only covers what it can see.** A day with no
 * data is unscored, not badly scored. Averaging a zero in for every dimension
 * the user has not filled in yet greets a new account with "poor" and tells
 * them nothing about their health — only about their typing.
 */

export interface Dimension {
  score: number;
  /** False when nothing was logged for it, which excludes it from the average. */
  hasData: boolean;
  /**
   * Logged, but not yet judgeable — a daily total still being accumulated. Also
   * excluded from the average, but distinct from absent: there is nothing for
   * the user to do about it except let the day finish.
   */
  deferred?: boolean;
}

export type DimensionName =
  | 'sleep'
  | 'activity'
  | 'nutrition'
  | 'recovery'
  | 'hydration'
  | 'wellbeing'
  | 'vitals'
  | 'goalProgress';

export const WEIGHTS: Record<DimensionName, number> = {
  sleep: 0.2,
  activity: 0.2,
  nutrition: 0.15,
  recovery: 0.1,
  hydration: 0.1,
  wellbeing: 0.1,
  vitals: 0.1,
  goalProgress: 0.05,
};

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export interface CombinedScore {
  /** null when nothing at all was logged — there is no score to show yet. */
  overall: number | null;
  /** Share of the total weight that had data behind it, 0-1. */
  coverage: number;
  scored: DimensionName[];
  /** Unscored because nothing was logged — these are worth nudging about. */
  missing: DimensionName[];
  /** Unscored because the day is not over yet — nothing to nudge about. */
  deferred: DimensionName[];
}

/**
 * Weighted average over the dimensions that have data, renormalised by their
 * own weight so a partially-filled day is scored on its merits rather than
 * being dragged toward zero by the parts that are simply absent.
 */
export function combineScore(dimensions: Record<DimensionName, Dimension>): CombinedScore {
  const names = Object.keys(WEIGHTS) as DimensionName[];
  const scored = names.filter((n) => dimensions[n].hasData);
  const deferred = names.filter((n) => !dimensions[n].hasData && dimensions[n].deferred === true);
  const missing = names.filter((n) => !dimensions[n].hasData && dimensions[n].deferred !== true);

  const totalWeight = scored.reduce((sum, n) => sum + WEIGHTS[n], 0);
  if (totalWeight === 0) {
    return { overall: null, coverage: 0, scored, missing, deferred };
  }

  const weighted = scored.reduce((sum, n) => sum + dimensions[n].score * WEIGHTS[n], 0);
  return {
    overall: Math.round((weighted / totalWeight) * 10) / 10,
    coverage: Math.round(totalWeight * 100) / 100,
    scored,
    missing,
    deferred,
  };
}

/**
 * How close an actual is to a target, as 0-100. Being under and being over by
 * the same proportion score the same: a 1,000 kcal day against a 2,000 kcal
 * target is as far off the plan as a 3,000 kcal one.
 */
export function closenessToTarget(actual: number, target: number): number {
  if (target <= 0) return 0;
  return clamp(100 - (Math.abs(target - actual) / target) * 100);
}

/**
 * Which dimension to nudge about first: the heaviest one with nothing in it.
 * Recovery is derived from sleep and activity rather than logged on its own,
 * so it is never something to ask the user for.
 */
export function nextBestDimension(missing: DimensionName[]): DimensionName | null {
  const askable = missing.filter((n) => n !== 'recovery' && n !== 'goalProgress');
  if (askable.length === 0) return null;
  return askable.reduce((best, n) => (WEIGHTS[n] > WEIGHTS[best] ? n : best));
}
