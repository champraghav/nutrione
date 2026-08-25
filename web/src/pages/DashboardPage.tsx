import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@api/client';
import { useAppStore } from '@store/app.store';
import { getHealthScoreStatus } from '@utils/formatters';
import { Badge } from '@components/Badge';
import { HabitsCard } from '@components/HabitsCard';
import { StepsCard } from '@components/StepsCard';
import { CalorieBudget, Budget } from '@components/CalorieBudget';
import { WeightGoalCard } from '@components/WeightGoalCard';
import { todayLocal } from '@utils/dates';

type DimensionName =
  | 'sleep'
  | 'activity'
  | 'nutrition'
  | 'recovery'
  | 'hydration'
  | 'wellbeing'
  | 'vitals'
  | 'goalProgress';

interface ScoreBreakdown {
  overall_score: number | null;
  sleep_score: number | null;
  activity_score: number | null;
  nutrition_score: number | null;
  recovery_score: number | null;
  hydration_score: number | null;
  wellbeing_score: number | null;
  vitals_score: number | null;
  goal_progress_score: number | null;
  coverage: number;
  missing: DimensionName[];
  deferred: DimensionName[];
  next_best: DimensionName | null;
  trend: 'up' | 'down' | 'flat';
}

const DIMENSIONS: Array<{ key: keyof ScoreBreakdown; name: DimensionName; label: string }> = [
  { key: 'sleep_score', name: 'sleep', label: 'Sleep' },
  { key: 'activity_score', name: 'activity', label: 'Activity' },
  { key: 'nutrition_score', name: 'nutrition', label: 'Nutrition' },
  { key: 'recovery_score', name: 'recovery', label: 'Recovery' },
  { key: 'hydration_score', name: 'hydration', label: 'Hydration' },
  { key: 'wellbeing_score', name: 'wellbeing', label: 'Wellbeing' },
  { key: 'vitals_score', name: 'vitals', label: 'Vitals' },
  { key: 'goal_progress_score', name: 'goalProgress', label: 'Goals' },
];

const STATUS_VARIANT = {
  excellent: 'success',
  good: 'primary',
  fair: 'warning',
  poor: 'danger',
} as const;

/** Where to send someone for each thing the score is still missing. */
const NUDGES: Record<DimensionName, { label: string; to: string }> = {
  sleep: { label: 'Log last night’s sleep', to: '/sleep' },
  activity: { label: 'Log a workout or your steps', to: '/fitness' },
  nutrition: { label: 'Log what you’ve eaten', to: '/nutrition' },
  hydration: { label: 'Log some water', to: '/nutrition' },
  wellbeing: { label: 'Log how you’re feeling', to: '/vitals' },
  vitals: { label: 'Log your vitals', to: '/vitals' },
  recovery: { label: 'Log sleep and activity', to: '/sleep' },
  goalProgress: { label: 'Set a goal', to: '/settings' },
};

const QUICK_LINKS = [
  { to: '/nutrition', label: 'Log a meal', icon: '🍽️' },
  { to: '/fitness', label: 'Log a workout', icon: '💪' },
  { to: '/sleep', label: 'Log sleep', icon: '🌙' },
  { to: '/coach', label: 'Ask the coach', icon: '💬' },
];

export function DashboardPage() {
  const user = useAppStore((state) => state.user);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayLocal();

  useEffect(() => {
    Promise.all([api.getHealthScore(), api.getNutritionSummary(today)]).then(([scoreRes, summaryRes]) => {
      if (scoreRes.success) setScore(scoreRes.data as ScoreBreakdown);
      if (summaryRes.success) setBudget((summaryRes.data as { budget: Budget }).budget);
      setLoading(false);
    });
  }, [today]);

  const nudge = score?.next_best ? NUDGES[score.next_best] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.first_name ? `Welcome back, ${user.first_name}` : 'Welcome back'}
        </h1>
        <p className="text-gray-500 text-sm">Here's how today is shaping up.</p>
      </div>

      {/* The number people open the app for goes first. */}
      {budget && (
        <Link to="/nutrition" className="block hover:opacity-90 transition-smooth">
          <CalorieBudget budget={budget} isToday />
        </Link>
      )}

      <StepsCard date={today} />

      <WeightGoalCard />

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Today's Health Score</h2>
          {score?.overall_score !== null && score !== null && (
            <Badge variant={STATUS_VARIANT[getHealthScoreStatus(score.overall_score)]}>
              {getHealthScoreStatus(score.overall_score)}
            </Badge>
          )}
        </div>

        {loading && <p className="text-gray-500">Loading…</p>}

        {/* Nothing logged is an unscored day, not a bad one — saying "poor" to
            someone who has not used the app yet grades their typing, not their
            health. */}
        {!loading && score && score.overall_score === null && (
          <div>
            <p className="text-gray-600 mb-3">
              No score yet today. It's worked out from what you log, so there's nothing to go on so far.
            </p>
            {nudge && (
              <Link to={nudge.to} className="btn-primary inline-block">
                {nudge.label}
              </Link>
            )}
          </div>
        )}

        {!loading && score && score.overall_score !== null && (
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <p className="text-5xl font-bold text-primary-600">{score.overall_score}</p>
              <p className="text-sm text-gray-500">
                trend {score.trend === 'up' ? '↑ up' : score.trend === 'down' ? '↓ down' : '→ flat'}
              </p>
            </div>

            <p className="text-xs text-gray-400 mb-6">
              Based on {Math.round(score.coverage * 100)}% of what the score looks at.
              {nudge && (
                <>
                  {' '}
                  <Link to={nudge.to} className="text-primary-600 hover:underline">
                    {nudge.label.toLowerCase()}
                  </Link>{' '}
                  to make it mean more.
                </>
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {DIMENSIONS.map((dim) => {
                const value = score[dim.key] as number | null;
                // Logged but still accumulating: say so, rather than showing a
                // blank next to food the user knows they entered.
                const waiting = score.deferred?.includes(dim.name);
                return (
                  <div key={dim.key}>
                    <p className="text-xs text-gray-500">{dim.label}</p>
                    <p className={`text-lg font-semibold ${value === null ? 'text-gray-300' : 'text-gray-900'}`}>
                      {value === null ? '—' : value}
                    </p>
                    {value === null && waiting && <p className="text-xs text-gray-400">still logging</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !score && <p className="text-gray-500">No score yet. Log some data to see your score.</p>}
      </div>

      <HabitsCard />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {QUICK_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="card text-center hover:shadow-md transition-smooth">
            <div className="text-2xl mb-1">{link.icon}</div>
            <div className="text-sm font-medium text-gray-700">{link.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
