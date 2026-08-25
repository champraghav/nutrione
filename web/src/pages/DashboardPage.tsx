import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@api/client';
import { useAppStore } from '@store/app.store';
import { getHealthScoreStatus } from '@utils/formatters';
import { Badge } from '@components/Badge';
import { HabitsCard } from '@components/HabitsCard';
import { StepsCard } from '@components/StepsCard';
import { todayLocal } from '@utils/dates';

interface ScoreBreakdown {
  overall_score: number;
  sleep_score: number;
  activity_score: number;
  nutrition_score: number;
  recovery_score: number;
  hydration_score: number;
  wellbeing_score: number;
  vitals_score: number;
  goal_progress_score: number;
  trend: 'up' | 'down' | 'flat';
}

const DIMENSIONS: Array<{ key: keyof ScoreBreakdown; label: string }> = [
  { key: 'sleep_score', label: 'Sleep' },
  { key: 'activity_score', label: 'Activity' },
  { key: 'nutrition_score', label: 'Nutrition' },
  { key: 'recovery_score', label: 'Recovery' },
  { key: 'hydration_score', label: 'Hydration' },
  { key: 'wellbeing_score', label: 'Wellbeing' },
  { key: 'vitals_score', label: 'Vitals' },
  { key: 'goal_progress_score', label: 'Goals' },
];

const STATUS_VARIANT = {
  excellent: 'success',
  good: 'primary',
  fair: 'warning',
  poor: 'danger',
} as const;

const QUICK_LINKS = [
  { to: '/nutrition', label: 'Log a meal', icon: '🍽️' },
  { to: '/fitness', label: 'Log a workout', icon: '💪' },
  { to: '/sleep', label: 'Log sleep', icon: '🌙' },
  { to: '/coach', label: 'Ask the coach', icon: '💬' },
];

export function DashboardPage() {
  const user = useAppStore((state) => state.user);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHealthScore().then((res) => {
      if (res.success) setScore(res.data as ScoreBreakdown);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.first_name ? `Welcome back, ${user.first_name}` : 'Welcome back'}
        </h1>
        <p className="text-gray-500 text-sm">Here's how today is shaping up.</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Today's Health Score</h2>
          {score && (
            <Badge variant={STATUS_VARIANT[getHealthScoreStatus(score.overall_score)]}>
              {getHealthScoreStatus(score.overall_score)}
            </Badge>
          )}
        </div>

        {loading && <p className="text-gray-500">Loading…</p>}

        {!loading && score && (
          <div>
            <div className="flex items-baseline gap-3 mb-6">
              <p className="text-5xl font-bold text-primary-600">{score.overall_score}</p>
              <p className="text-sm text-gray-500">
                trend {score.trend === 'up' ? '↑ up' : score.trend === 'down' ? '↓ down' : '→ flat'}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {DIMENSIONS.map((dim) => (
                <div key={dim.key}>
                  <p className="text-xs text-gray-500">{dim.label}</p>
                  <p className="text-lg font-semibold text-gray-900">{score[dim.key]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !score && <p className="text-gray-500">No score yet. Log some data to see your score.</p>}
      </div>

      <StepsCard date={todayLocal()} />

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
