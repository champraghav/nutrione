import React from 'react';

export interface Budget {
  target: number;
  eaten: number;
  burned: number;
  remaining: number;
  over: boolean;
}

/**
 * The one number people open the app for: how much can I still eat today.
 *
 * Shown as the familiar target - eaten + exercise sum so the arithmetic is
 * visible rather than magic, and going over is stated plainly instead of
 * being hidden behind a bar that just stops at 100%.
 */
export function CalorieBudget({ budget, isToday }: { budget: Budget; isToday: boolean }) {
  const pct = budget.target > 0 ? Math.min(100, Math.round((budget.eaten / (budget.target + budget.burned)) * 100)) : 0;

  return (
    <div className="card">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {budget.over ? 'Over budget' : isToday ? 'Left to eat today' : 'Left that day'}
          </p>
          <p className={`text-4xl font-bold ${budget.over ? 'text-danger-600' : 'text-primary-600'}`}>
            {Math.abs(budget.remaining).toLocaleString()}
            <span className="text-base font-medium text-gray-400"> kcal</span>
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="text-center">
            <p className="font-semibold text-gray-900">{budget.target.toLocaleString()}</p>
            <p className="text-xs text-gray-400">target</p>
          </div>
          <span className="text-gray-300">−</span>
          <div className="text-center">
            <p className="font-semibold text-gray-900">{budget.eaten.toLocaleString()}</p>
            <p className="text-xs text-gray-400">eaten</p>
          </div>
          <span className="text-gray-300">+</span>
          <div className="text-center">
            <p className="font-semibold text-gray-900">{budget.burned.toLocaleString()}</p>
            <p className="text-xs text-gray-400">exercise</p>
          </div>
        </div>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-4">
        <div
          className={`h-full transition-all ${budget.over ? 'bg-danger-500' : 'bg-primary-500'}`}
          style={{ width: `${budget.over ? 100 : pct}%` }}
        />
      </div>

      {budget.burned > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          Exercise includes your logged workouts and an estimate from your steps, so it is approximate.
        </p>
      )}
    </div>
  );
}
