import React, { useEffect, useState } from 'react';
import { api } from '@api/client';

export interface WeeklyReport {
  from: string;
  to: string;
  dietAdherence: number | null;
  trainingAdherence: number | null;
  daysLogged: number;
  daysInWeek: number;
  avgCalories: number | null;
  avgProtein: number | null;
  workouts: number;
  workoutMinutes: number;
  avgSteps: number | null;
  habitsPercent: number | null;
  weightChangeKg: number | null;
  bestStreak: number;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * The week in one glance. A dash means no data rather than zero — telling
 * someone they averaged 0 kcal because they logged three days would be worse
 * than saying nothing.
 */
export function WeeklyReportCard({
  coachClientId,
  date,
  refreshKey,
}: {
  coachClientId?: string;
  date: string;
  refreshKey?: number;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(null);

  useEffect(() => {
    const load = coachClientId ? api.getClientReport(coachClientId, date) : api.getMyReport(date);
    load.then((res) => {
      if (res.success) setReport(res.data as WeeklyReport);
    });
  }, [coachClientId, date, refreshKey]);

  if (!report) return null;

  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
  const weight =
    report.weightChangeKg === null
      ? '—'
      : `${report.weightChangeKg > 0 ? '+' : ''}${report.weightChangeKg} kg`;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
        <h2 className="text-lg font-semibold">This week</h2>
        <span className="text-xs text-gray-400">
          {report.from} to {report.to}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Plan followed" value={pct(report.dietAdherence)} hint="diet" />
        <Stat label="Training" value={pct(report.trainingAdherence)} hint={`${report.workouts} session${report.workouts === 1 ? '' : 's'}`} />
        <Stat
          label="Days logged"
          value={`${report.daysLogged}/${report.daysInWeek}`}
          hint={report.avgCalories !== null ? `avg ${report.avgCalories} kcal` : undefined}
        />
        <Stat label="Weight change" value={weight} />
        <Stat label="Avg protein" value={report.avgProtein !== null ? `${report.avgProtein} g` : '—'} />
        <Stat label="Avg steps" value={report.avgSteps !== null ? report.avgSteps.toLocaleString() : '—'} />
        <Stat label="Habits today" value={pct(report.habitsPercent)} hint={report.bestStreak > 0 ? `best streak ${report.bestStreak}` : undefined} />
        <Stat label="Training time" value={report.workoutMinutes > 0 ? `${report.workoutMinutes} min` : '—'} />
      </div>

      {report.daysLogged < 3 && (
        <p className="text-xs text-gray-400 mt-3">
          Only {report.daysLogged} day{report.daysLogged === 1 ? '' : 's'} logged this week, so these averages are thin.
        </p>
      )}
    </div>
  );
}
