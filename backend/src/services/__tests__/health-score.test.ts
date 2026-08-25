import { describe, it, expect } from 'vitest';
import {
  combineScore,
  closenessToTarget,
  nextBestDimension,
  clamp,
  WEIGHTS,
  Dimension,
  DimensionName,
} from '../health-score.calc';

const NONE: Dimension = { score: 0, hasData: false };
const DEFERRED: Dimension = { score: 0, hasData: false, deferred: true };
const scored = (score: number): Dimension => ({ score, hasData: true });

/** All eight dimensions absent, so a test can fill in only what it cares about. */
function dims(overrides: Partial<Record<DimensionName, Dimension>> = {}): Record<DimensionName, Dimension> {
  return {
    sleep: NONE,
    activity: NONE,
    nutrition: NONE,
    recovery: NONE,
    hydration: NONE,
    wellbeing: NONE,
    vitals: NONE,
    goalProgress: NONE,
    ...overrides,
  };
}

describe('combineScore', () => {
  it('has no score at all for a day with nothing logged', () => {
    const result = combineScore(dims());
    expect(result.overall).toBeNull();
    expect(result.coverage).toBe(0);
    expect(result.scored).toEqual([]);
  });

  it('scores a single logged dimension on its own merits, not diluted by the rest', () => {
    // The old behaviour averaged a 90 against seven absent dimensions and
    // reported 18. One good night's sleep is a 90.
    const result = combineScore(dims({ sleep: scored(90) }));
    expect(result.overall).toBe(90);
    expect(result.coverage).toBe(WEIGHTS.sleep);
  });

  it('renormalises across the dimensions that do have data', () => {
    // sleep 0.2 at 80, nutrition 0.15 at 60
    // (80*0.2 + 60*0.15) / 0.35 = 25 / 0.35 = 71.43
    const result = combineScore(dims({ sleep: scored(80), nutrition: scored(60) }));
    expect(result.overall).toBe(71.4);
    expect(result.coverage).toBe(0.35);
  });

  it('reaches a coverage of 1 only when every dimension is present', () => {
    const all = Object.fromEntries(
      (Object.keys(WEIGHTS) as DimensionName[]).map((n) => [n, scored(70)])
    ) as Record<DimensionName, Dimension>;
    const result = combineScore(all);
    expect(result.coverage).toBe(1);
    expect(result.overall).toBe(70);
    expect(result.missing).toEqual([]);
  });

  it('still reports a genuinely bad logged day as bad', () => {
    // The point is not to flatter anyone: a logged zero is a zero. Only the
    // *absence* of data is excluded.
    const result = combineScore(dims({ hydration: scored(0), sleep: scored(20) }));
    expect(result.overall).toBeLessThan(20);
  });

  it('lists what is missing so the UI can say what to log', () => {
    const result = combineScore(dims({ sleep: scored(80) }));
    expect(result.missing).toContain('nutrition');
    expect(result.missing).not.toContain('sleep');
  });

  it('separates "not logged" from "day is not over yet"', () => {
    // Food logged but still under target at 2pm is deferred, not absent —
    // there is nothing the user should be nudged to do about it.
    const result = combineScore(dims({ sleep: scored(80), nutrition: DEFERRED }));
    expect(result.deferred).toEqual(['nutrition']);
    expect(result.missing).not.toContain('nutrition');
    expect(result.overall).toBe(80);
  });

  it('keeps a deferred dimension out of the average, like an absent one', () => {
    const withDeferred = combineScore(dims({ sleep: scored(80), nutrition: DEFERRED }));
    const withNothing = combineScore(dims({ sleep: scored(80) }));
    expect(withDeferred.overall).toBe(withNothing.overall);
    expect(withDeferred.coverage).toBe(withNothing.coverage);
  });
});

describe('closenessToTarget', () => {
  it('is 100 when the actual lands on the target', () => {
    expect(closenessToTarget(1800, 1800)).toBe(100);
  });

  it('penalises over and under by the same proportion equally', () => {
    expect(closenessToTarget(1000, 2000)).toBe(closenessToTarget(3000, 2000));
    expect(closenessToTarget(1000, 2000)).toBe(50);
  });

  it('floors at zero rather than going negative on a wild day', () => {
    expect(closenessToTarget(9000, 2000)).toBe(0);
  });

  it('gives a personalised target its due — 1500 eaten against 1500 is perfect', () => {
    // Against the old hardcoded 2000 this scored 75, punishing someone for
    // following the plan the app itself set.
    expect(closenessToTarget(1500, 1500)).toBe(100);
  });
});

describe('nextBestDimension', () => {
  it('picks the heaviest missing dimension', () => {
    expect(nextBestDimension(['nutrition', 'sleep'])).toBe('sleep'); // 0.15 vs 0.2
  });

  it('never asks for recovery, which is derived rather than logged', () => {
    expect(nextBestDimension(['recovery'])).toBeNull();
    expect(nextBestDimension(['recovery', 'hydration'])).toBe('hydration');
  });

  it('has nothing to suggest on a fully logged day', () => {
    expect(nextBestDimension([])).toBeNull();
  });

  it('is only ever given the genuinely missing, never the deferred', () => {
    // combineScore keeps deferred dimensions out of `missing`, so a nudge to
    // "log your food" cannot reach someone who already has.
    const result = combineScore(dims({ nutrition: DEFERRED }));
    expect(nextBestDimension(result.missing)).not.toBe('nutrition');
  });
});

describe('clamp', () => {
  it('holds a score inside 0-100', () => {
    expect(clamp(-20)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(55)).toBe(55);
  });
});
