import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { friendlyDateLabel, todayLocal } from '@utils/dates';

interface Suggestion {
  foodId: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  delivers: number;
  closesGapPct: number;
}

interface Gap {
  nutrient: string;
  label: string;
  shortBy: number;
  unit: string;
  suggestions: Suggestion[];
}

export function NutrientGapsCard({
  date,
  refreshKey,
  onLogged,
}: {
  date: string;
  refreshKey: number;
  onLogged: () => void;
}) {
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [logging, setLogging] = useState<string | null>(null);

  useEffect(() => {
    api.getNutrientGaps(date).then((res) => {
      if (res.success) setGaps(res.data as Gap[]);
    });
  }, [date, refreshKey]);

  const logSuggestion = async (s: Suggestion) => {
    setLogging(s.foodId);
    await api.addMealItem(s.foodId, s.quantity, s.unit, date, 'snack');
    setLogging(null);
    onLogged();
  };

  if (!gaps) return null;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">
        {date === todayLocal() ? "What you're missing today" : `What was missing · ${friendlyDateLabel(date)}`}
      </h2>

      {gaps.length === 0 && (
        <p className="text-sm text-success-600">
          On track for protein and fiber — nothing major missing. 🎉
        </p>
      )}

      {gaps.length > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-4">
            Tap a suggestion to log it straight into today's food.
          </p>
          <div className="space-y-5">
            {gaps.map((gap) => (
              <div key={gap.nutrient}>
                <p className="text-sm font-medium text-gray-800 mb-2">
                  {gap.label} — short by{' '}
                  <span className="text-warning-600">
                    {gap.shortBy}
                    {gap.unit}
                  </span>
                </p>
                <ul className="space-y-2">
                  {gap.suggestions.map((s) => (
                    <li
                      key={s.foodId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm">
                          {s.quantity}
                          {s.unit} {s.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          +{s.delivers}
                          {gap.unit} · covers {s.closesGapPct}% of the gap · {s.calories} kcal
                        </p>
                      </div>
                      <button
                        className="btn-secondary text-xs shrink-0 disabled:opacity-50"
                        disabled={logging === s.foodId}
                        onClick={() => logSuggestion(s)}
                      >
                        {logging === s.foodId ? 'Adding…' : 'Add'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
