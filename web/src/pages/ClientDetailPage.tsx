import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Select } from '@components/Select';
import { Badge } from '@components/Badge';
import { DatePicker } from '@components/DatePicker';
import { todayLocal } from '@utils/dates';
import { MessageThread } from '@components/MessageThread';
import { WeeklyReportCard } from '@components/WeeklyReportCard';
import { ClientDetail, MEAL_TYPES, Plan } from '../types/coaching';

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  followed: { text: 'followed', className: 'text-primary-700 bg-primary-50' },
  partial: { text: 'wrong amount', className: 'text-warning-700 bg-warning-50' },
  missed: { text: 'missed', className: 'text-gray-500 bg-gray-100' },
};

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState<ClientDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (forDate: string) => {
    const res = await api.getClientDetail(id, forDate);
    if (res.success) {
      const detail = res.data as ClientDetail;
      setData(detail);
      setNotes(detail.client.notes ?? '');
    } else {
      setError(res.error?.message ?? 'Could not load this client.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, date]);

  useEffect(() => {
    api.getPlans().then((res) => {
      if (res.success) setPlans(res.data as Plan[]);
    });
  }, []);

  const saveNotes = async () => {
    const res = await api.updateClientNotes(id, notes);
    if (res.success) {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  };

  const assign = async () => {
    if (!planId) return;
    const res = await api.assignPlan({ planId, coachClientId: id, startDate: date });
    if (res.success) {
      setPlanId('');
      load(date);
    } else {
      setError(res.error?.message ?? 'Could not assign that plan.');
    }
  };

  const endAssignment = async (assignmentId: string) => {
    const res = await api.endAssignment(assignmentId);
    if (res.success) load(date);
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (!data) {
    return (
      <div className="card">
        <p className="text-danger-600">{error || 'Client not found.'}</p>
        <Link to="/clients" className="text-sm text-primary-600 hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const adherence = data.adherence.adherence;
  const trendData = data.trend.days.map((d) => ({ date: d.date.slice(5), percent: d.percent }));
  // A line chart with a single point renders as one lonely dot, which reads as
  // broken rather than as "not enough history yet".
  const scoredDays = trendData.filter((d) => d.percent !== null).length;
  const weightData = [...data.weights].reverse().map((w) => ({ date: w.date.slice(5), kg: Number(w.value) }));
  const unassigned = plans.filter((p) => !data.assignments.some((a) => a.active && a.plan_id === p.id));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/clients" className="text-sm text-gray-400 hover:text-gray-600">
          ← Clients
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.client.name}</h1>
            <p className="text-gray-500 text-sm">{data.client.email}</p>
          </div>
          <DatePicker date={date} onChange={setDate} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500">Adherence today</p>
          <p className="text-2xl font-bold text-gray-900">
            {adherence?.percent !== null && adherence !== null ? `${adherence.percent}%` : '—'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">14-day average</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.trend.average !== null ? `${data.trend.average}%` : '—'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Habits today</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.habits.percent !== null ? `${data.habits.percent}%` : '—'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Latest weight</p>
          <p className="text-2xl font-bold text-gray-900">
            {weightData.length > 0 ? `${weightData[weightData.length - 1].kg} kg` : '—'}
          </p>
        </div>
      </div>

      <WeeklyReportCard coachClientId={id} date={date} />

      {data.dayPlans.some((p) => p.kind === 'training') && data.adherence.training && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-2">Training today</h2>
          <p className="text-sm text-gray-700">
            {data.adherence.training.percent === null
              ? 'No training scheduled.'
              : `${data.adherence.training.percent}% — ${data.adherence.training.workoutMinutes} min logged${
                  data.adherence.training.plannedMinutes ? ` of ${data.adherence.training.plannedMinutes} planned` : ''
                }`}
          </p>
          <ul className="mt-2 space-y-1">
            {data.adherence.training.planned.map((ex) => (
              <li key={ex.id} className="text-sm text-gray-700">
                {ex.name}
                <span className="text-gray-400">
                  {ex.sets && ex.reps ? ` · ${ex.sets} × ${ex.reps}` : ''}
                  {ex.duration_minutes ? ` · ${ex.duration_minutes} min` : ''}
                </span>
                {data.adherence.training?.checkedIds.includes(ex.id) && (
                  <span className="text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full ml-2">done</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MessageThread coachClientId={id} title={`Messages with ${data.client.name}`} />

      {adherence && adherence.lines.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Plan vs actual</h2>
          <p className="text-xs text-gray-400 mb-3">{data.adherence.planName}</p>

          {MEAL_TYPES.map((meal) => {
            const lines = adherence.lines.filter((l) => l.planned.meal_type === meal);
            if (lines.length === 0) return null;
            return (
              <div key={meal} className="mb-3 last:mb-0">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{meal}</p>
                <ul className="space-y-1">
                  {lines.map((l) => (
                    <li key={l.planned.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-800 min-w-0 truncate">
                        {l.planned.name}
                        {l.planned.quantity ? (
                          <span className="text-gray-400"> · {Number(l.planned.quantity)} {l.planned.unit}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 flex items-center gap-2">
                        {l.status === 'partial' && l.loggedQuantity !== null && (
                          <span className="text-xs text-gray-400">
                            ate {Number(l.loggedQuantity)} {l.planned.unit}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_LABEL[l.status].className}`}>
                          {l.checkedOff ? 'ticked off' : STATUS_LABEL[l.status].text}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {adherence.extras.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Eaten off-plan</p>
              <ul className="text-sm text-gray-600 space-y-0.5">
                {adherence.extras.map((e) => (
                  <li key={e.id}>
                    {e.name} <span className="text-gray-400">· {Number(e.quantity)} {e.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {scoredDays === 1 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Adherence, last 14 days</h2>
          <p className="text-sm text-gray-500">
            Only one day on plan so far. The trend appears once there are a couple more.
          </p>
        </div>
      )}

      {scoredDays > 1 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Adherence, last 14 days</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => (v === null ? 'no plan' : `${v}%`)} />
              <Line type="monotone" dataKey="percent" stroke="#2563eb" strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {weightData.length > 1 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Weight</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v} kg`} />
              <Line type="monotone" dataKey="kg" stroke="#059669" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">Plans</h2>
        {data.assignments.length === 0 && <p className="text-sm text-gray-500">No plan assigned yet.</p>}
        <ul className="space-y-2">
          {data.assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">
                  {a.plan_name} <Badge variant={a.plan_kind === 'diet' ? 'primary' : 'gray'}>{a.plan_kind}</Badge>
                </p>
                <p className="text-xs text-gray-400">
                  from {a.start_date.slice(0, 10)}
                  {a.end_date ? ` to ${a.end_date.slice(0, 10)}` : ''}
                  {!a.active && ' · ended'}
                </p>
              </div>
              {a.active && (
                <button className="text-xs text-danger-600 hover:underline shrink-0" onClick={() => endAssignment(a.id)}>
                  End
                </button>
              )}
            </li>
          ))}
        </ul>

        {unassigned.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <div className="flex-1 min-w-[12rem]">
              <Select label="Assign a plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Choose a plan…</option>
                {unassigned.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.kind})
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={assign} disabled={!planId}>
              Assign from {date}
            </Button>
          </div>
        )}
        {plans.length === 0 && (
          <p className="text-sm text-gray-500">
            You have no plans yet. <Link to="/plans" className="text-primary-600 hover:underline">Write one first.</Link>
          </p>
        )}
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold text-gray-900">Private notes</h2>
        <p className="text-xs text-gray-400">Only you can see these. Your client cannot.</p>
        <textarea
          className="input min-h-[6rem]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Injuries, preferences, what you discussed last session…"
          aria-label="Private notes"
        />
        <div className="flex items-center gap-3">
          <Button onClick={saveNotes}>Save notes</Button>
          {notesSaved && <span className="text-sm text-primary-600">Saved</span>}
        </div>
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}
