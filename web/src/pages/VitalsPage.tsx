import React, { useEffect, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@api/client';
import { ErrorNote, errorMessage } from '@components/ErrorNote';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { formatDate, calculateBMI } from '@utils/formatters';
import { GoalsCard } from '@components/GoalsCard';

interface Metric {
  id: string;
  metric_type: string;
  value: string | number;
  unit: string | null;
  recorded_at: string;
}

/**
 * The metric types the health score actually reads, plus weight which drives
 * calorie and hydration targets. Keeping this list aligned with
 * health-score.service.ts matters: logging a type it doesn't recognise
 * wouldn't move the score.
 */
const METRIC_TYPES = [
  { value: 'weight', label: 'Weight', unit: 'kg', min: 20, max: 400, hint: 'Also updates your targets' },
  { value: 'mood', label: 'Mood (1-10)', unit: '/10', min: 1, max: 10, hint: 'Drives your wellbeing score' },
  { value: 'heart_rate', label: 'Resting heart rate', unit: 'bpm', min: 30, max: 220, hint: 'Drives your vitals score' },
  {
    value: 'blood_pressure_systolic',
    label: 'Blood pressure (systolic)',
    unit: 'mmHg',
    min: 60,
    max: 250,
    hint: 'Drives your vitals score',
  },
  { value: 'steps', label: 'Steps', unit: 'steps', min: 0, max: 100000, hint: '' },
] as const;

function n(v: string | number | null | undefined): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export function VitalsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [type, setType] = useState<string>('weight');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ height_cm: string | number | null } | null>(null);

  const selected = METRIC_TYPES.find((m) => m.value === type)!;

  const load = async () => {
    const [metricsRes, profileRes] = await Promise.all([api.getHealthMetrics(undefined, 60), api.getMe()]);
    if (metricsRes.success) setMetrics(metricsRes.data as Metric[]);
    if (profileRes.success) setProfile(profileRes.data as { height_cm: string | number | null });
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setSaving(true);
    setSaved(false);
    const res = await api.logHealthMetric(type, Number(value), selected.unit);

    // Weight feeds the calorie/hydration targets, so keep the profile in step
    // rather than leaving the two silently disagreeing.
    if (res.success && type === 'weight') {
      await api.updateMe({ weightKg: Number(value) });
    }

    setSaving(false);
    if (!res.success) {
      setError(errorMessage(res, 'Could not log that reading.'));
      return;
    }
    if (res.success) {
      setError(null);
      setSaved(true);
      setValue('');
      load();
    }
  };

  const weightSeries = metrics
    .filter((m) => m.metric_type === 'weight')
    .slice()
    .reverse()
    .map((m) => ({ date: formatDate(m.recorded_at, 'MMM d'), weight: n(m.value) }));

  const latestWeight = metrics.find((m) => m.metric_type === 'weight');
  const bmi =
    latestWeight && profile?.height_cm ? calculateBMI(n(latestWeight.value), n(profile.height_cm)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vitals</h1>
        <p className="text-gray-500 text-sm">
          Log weight, mood, and vitals — these feed the wellbeing and vitals parts of your health score.
        </p>
      </div>

      <GoalsCard />

      <form onSubmit={onSubmit} className="card space-y-4">
        <h2 className="text-lg font-semibold">Log a reading</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="What"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setValue('');
              setSaved(false);
            }}
          >
            {METRIC_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Input
            label={`Value (${selected.unit})`}
            type="number"
            step="any"
            min={selected.min}
            max={selected.max}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        {selected.hint && <p className="text-xs text-gray-400">{selected.hint}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
            Save
          </Button>
          {saved && <span className="text-success-600 text-sm">Saved</span>}
        </div>
      </form>

      {(latestWeight || bmi) && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Weight</h2>
          <div className="flex gap-8 mb-4">
            {latestWeight && (
              <div>
                <p className="text-xs text-gray-500">Latest</p>
                <p className="text-2xl font-bold text-primary-600">{n(latestWeight.value)} kg</p>
              </div>
            )}
            {bmi && (
              <div>
                <p className="text-xs text-gray-500">BMI</p>
                <p className="text-2xl font-bold text-gray-800">{bmi}</p>
              </div>
            )}
          </div>
          {weightSeries.length > 1 && (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={weightSeries}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} width={40} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {weightSeries.length === 1 && (
            <p className="text-sm text-gray-500">Log another weight reading to see a trend.</p>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent readings</h2>
        {metrics.length === 0 && <p className="text-gray-500 text-sm">Nothing logged yet.</p>}
        <ul className="divide-y divide-gray-100">
          {metrics.slice(0, 25).map((m) => {
            const meta = METRIC_TYPES.find((t) => t.value === m.metric_type);
            return (
              <li key={m.id} className="py-2 flex justify-between text-sm">
                <span className="text-gray-700">{meta?.label ?? m.metric_type}</span>
                <span className="text-gray-500">
                  {n(m.value)} {m.unit ?? ''} · {formatDate(m.recorded_at, 'MMM d')}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
