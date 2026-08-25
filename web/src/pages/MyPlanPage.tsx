import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { DatePicker } from '@components/DatePicker';
import { todayLocal } from '@utils/dates';
import { Adherence, DayPlan, MEAL_TYPES, PlanItem } from '../types/coaching';

interface MyPlanData {
  date: string;
  plans: DayPlan[];
  adherence: { planName: string | null; adherence: Adherence | null };
}

interface CoachRow {
  coach_client_id: string;
  coach_name: string;
  coach_email: string;
}

const STATUS_STYLE: Record<string, string> = {
  followed: 'bg-primary-500 border-primary-500 text-white',
  partial: 'bg-warning-100 border-warning-400 text-warning-700',
  missed: 'bg-white border-gray-300 text-transparent',
};

export function MyPlanPage() {
  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState<MyPlanData | null>(null);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCoaches = async () => {
    const res = await api.getMyCoaches();
    if (res.success) setCoaches(res.data as CoachRow[]);
  };

  useEffect(() => {
    setLoading(true);
    api.getMyPlan(date).then((res) => {
      if (res.success) setData(res.data as MyPlanData);
      setLoading(false);
    });
  }, [date]);

  useEffect(() => {
    loadCoaches();
  }, []);

  const join = async () => {
    if (!code.trim()) return;
    setJoining(true);
    setError('');
    const res = await api.acceptInvite(code.trim());
    setJoining(false);
    if (res.success) {
      setCode('');
      await loadCoaches();
      const refreshed = await api.getMyPlan(date);
      if (refreshed.success) setData(refreshed.data as MyPlanData);
    } else {
      setError(res.error?.message ?? 'Could not use that code.');
    }
  };

  const leave = async (row: CoachRow) => {
    if (!window.confirm(`Stop sharing your data with ${row.coach_name || row.coach_email}?`)) return;
    const res = await api.leaveCoach(row.coach_client_id);
    if (res.success) {
      await loadCoaches();
      const refreshed = await api.getMyPlan(date);
      if (refreshed.success) setData(refreshed.data as MyPlanData);
    }
  };

  const toggle = async (item: PlanItem, done: boolean) => {
    const res = await api.checkPlanItem(item.id, date, done);
    if (res.success) setData(res.data as MyPlanData);
  };

  const adherence = data?.adherence.adherence ?? null;
  const lineFor = (itemId: string) => adherence?.lines.find((l) => l.planned.id === itemId) ?? null;

  const dietPlans = data?.plans.filter((p) => p.kind === 'diet') ?? [];
  const trainingPlans = data?.plans.filter((p) => p.kind === 'training') ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Plan</h1>
          <p className="text-gray-500 text-sm">What your coach has set for you.</p>
        </div>
        <DatePicker date={date} onChange={setDate} />
      </div>

      {adherence && adherence.percent !== null && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              {adherence.followed} of {adherence.lines.length} followed
            </p>
            <p className="text-sm font-semibold text-gray-800">{adherence.percent}%</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 transition-all" style={{ width: `${adherence.percent}%` }} />
          </div>
          {adherence.partial > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {adherence.partial} item{adherence.partial === 1 ? '' : 's'} eaten in a different amount than planned.
            </p>
          )}
        </div>
      )}

      {loading && <p className="text-gray-500">Loading…</p>}

      {!loading && dietPlans.length === 0 && trainingPlans.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium text-gray-800">No plan for this day</p>
          <p className="text-sm text-gray-500">
            {coaches.length === 0
              ? 'Enter your coach’s invite code below to get started.'
              : 'Your coach has not scheduled anything for this date.'}
          </p>
        </div>
      )}

      {dietPlans.map((plan) => (
        <div key={plan.assignmentId} className="card">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold text-gray-900">{plan.planName}</h2>
            <span className="text-xs text-gray-400">
              Day {plan.dayNumber} of {plan.cycleDays}
            </span>
          </div>

          {MEAL_TYPES.map((meal) => {
            const items = plan.items.filter((i) => i.meal_type === meal);
            if (items.length === 0) return null;
            return (
              <div key={meal} className="mb-4 last:mb-0">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1.5">{meal}</p>
                <ul className="space-y-1.5">
                  {items.map((item) => {
                    const line = lineFor(item.id);
                    const status = line?.status ?? 'missed';
                    const done = status === 'followed';
                    return (
                      <li key={item.id} className="flex items-start gap-3">
                        <button
                          onClick={() => toggle(item, !done)}
                          aria-label={`${done ? 'Un-tick' : 'Tick'} ${item.food_name ?? item.custom_name}`}
                          aria-pressed={done}
                          className={`shrink-0 mt-0.5 w-5 h-5 rounded border flex items-center justify-center text-xs ${STATUS_STYLE[status]}`}
                        >
                          {status === 'partial' ? '~' : '✓'}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {item.food_name ?? item.custom_name}
                            {item.quantity ? (
                              <span className="text-gray-400">
                                {' '}
                                · {Number(item.quantity)} {item.unit}
                              </span>
                            ) : null}
                          </p>
                          {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                          {line?.status === 'partial' && line.loggedQuantity !== null && (
                            <p className="text-xs text-warning-600">
                              You logged {Number(line.loggedQuantity)} {item.unit}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ))}

      {trainingPlans.map((plan) => (
        <div key={plan.assignmentId} className="card">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold text-gray-900">{plan.planName}</h2>
            <span className="text-xs text-gray-400">
              Day {plan.dayNumber} of {plan.cycleDays}
            </span>
          </div>
          <ul className="space-y-2">
            {plan.items.map((item) => (
              <li key={item.id} className="text-sm text-gray-800">
                {item.exercise_name ?? item.custom_name}
                <span className="text-gray-400">
                  {item.sets && item.reps ? ` · ${item.sets} × ${item.reps}` : ''}
                  {item.duration_minutes ? ` · ${item.duration_minutes} min` : ''}
                </span>
                {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {adherence && adherence.extras.length > 0 && (
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Also eaten today</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {adherence.extras.map((e) => (
              <li key={e.id}>
                {e.name} <span className="text-gray-400">· {Number(e.quantity)} {e.unit}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            These were not on the plan. They do not count against your score, but your coach can see them.
          </p>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">Your coaches</h2>
        {coaches.length === 0 ? (
          <p className="text-sm text-gray-500">
            No one can see your data. Enter an invite code to share it with a coach.
          </p>
        ) : (
          <ul className="space-y-2">
            {coaches.map((c) => (
              <li key={c.coach_client_id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.coach_name || c.coach_email}</p>
                  <p className="text-xs text-gray-400 truncate">Can see your logs, plans and progress</p>
                </div>
                <button className="text-xs text-danger-600 hover:underline shrink-0" onClick={() => leave(c)}>
                  Stop sharing
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div className="flex-1 min-w-[12rem]">
            <Input
              label="Invite code"
              value={code}
              placeholder="ABCD-1234"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>
          <Button onClick={join} disabled={joining || !code.trim()}>
            {joining ? 'Joining…' : 'Connect'}
          </Button>
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </div>
  );
}
