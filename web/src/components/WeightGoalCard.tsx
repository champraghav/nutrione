import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@api/client';
import { formatDate } from '@utils/formatters';

interface Plan {
  goal: 'lose' | 'maintain' | 'gain';
  actualRateKgPerWeek: number;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  projection: { weeks: number; date: string } | null;
}

interface Metric {
  metric_type: string;
  value: string | number;
  recorded_at: string;
}

/**
 * Weight against the goal, which is the loop the whole app exists to close:
 * weigh in, see the line move, keep going.
 *
 * Deliberately quiet about single readings. Weight swings a kilo or more with
 * hydration and time of day, so the headline is the change since the first
 * reading rather than since yesterday, and one data point draws no trend at
 * all rather than a line implying a direction it cannot know.
 */
export function WeightGoalCard() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [weights, setWeights] = useState<Array<{ date: string; kg: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTargetPlan(), api.getHealthMetrics('weight', 180)]).then(([planRes, metricRes]) => {
      if (planRes.success) setPlan(planRes.data as Plan);
      if (metricRes.success) {
        const series = (metricRes.data as Metric[])
          .map((m) => ({ date: m.recorded_at, kg: Number(m.value) }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((m) => ({ date: formatDate(m.date, 'MMM d'), kg: m.kg }));
        setWeights(series);
      }
      setLoading(false);
    });
  }, []);

  if (loading || !plan) return null;

  const goalWeight = plan.goalWeightKg;
  const current = weights.length > 0 ? weights[weights.length - 1].kg : plan.currentWeightKg;

  // Nothing to chase and nothing logged: the card would be an empty frame.
  if (!goalWeight && weights.length === 0) return null;

  const start = weights.length > 0 ? weights[0].kg : null;
  const changed = start !== null && current !== null ? Math.round((current - start) * 10) / 10 : null;
  const toGo = goalWeight && current !== null ? Math.round(Math.abs(current - goalWeight) * 10) / 10 : null;
  const reached = toGo !== null && toGo < 0.5;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold">
            {plan.goal === 'maintain' ? 'Weight' : goalWeight ? `On the way to ${goalWeight} kg` : 'Weight'}
          </h2>
          {current !== null && (
            <p className="text-sm text-gray-500">
              {current} kg now
              {changed !== null && changed !== 0 && (
                <span className={changed < 0 ? 'text-success-600' : 'text-gray-600'}>
                  {' · '}
                  {changed > 0 ? '+' : ''}
                  {changed} kg since you started
                </span>
              )}
            </p>
          )}
        </div>
        <Link to="/vitals" className="btn-secondary text-sm whitespace-nowrap">
          Weigh in
        </Link>
      </div>

      {reached ? (
        <p className="text-success-700 bg-success-50 rounded-lg p-3 text-sm">
          You're at your goal weight. Switching your goal to <em>maintain</em> on the Profile page will move your
          calorie target back up to what you burn.
        </p>
      ) : (
        toGo !== null && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-4">
            <p>
              <span className="text-3xl font-bold text-primary-600">{toGo}</span>
              <span className="text-sm text-gray-500"> kg to go</span>
            </p>
            {plan.projection && (
              <p className="text-sm text-gray-500">
                about {plan.projection.weeks} weeks at {plan.actualRateKgPerWeek} kg a week
              </p>
            )}
          </div>
        )
      )}

      {weights.length > 1 ? (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weights} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip formatter={(v: number) => [`${v} kg`, 'Weight']} />
              {goalWeight && (
                <ReferenceLine
                  y={goalWeight}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  label={{ value: 'goal', fontSize: 11, fill: '#16a34a', position: 'insideBottomRight' }}
                />
              )}
              <Area type="monotone" dataKey="kg" stroke="#3b82f6" strokeWidth={2} fill="url(#weightFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          {weights.length === 1
            ? 'One reading so far. Weigh in again in a few days and the trend appears here.'
            : 'No weigh-ins logged yet. Weight moves around by a kilo through the day, so a weekly reading at the same time tells you more than a daily one.'}
        </p>
      )}
    </div>
  );
}
