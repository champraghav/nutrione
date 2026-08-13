import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { Badge } from '@components/Badge';
import { formatDate } from '@utils/formatters';

interface SleepSession {
  id: string;
  sleep_date: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  quality: number | null;
}

interface Analysis {
  session: SleepSession;
  label: 'excellent' | 'good' | 'fair' | 'poor';
  recommendation: string;
}

const STATUS_VARIANT = {
  excellent: 'success',
  good: 'primary',
  fair: 'warning',
  poor: 'danger',
} as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function SleepPage() {
  const [logs, setLogs] = useState<SleepSession[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState('4');
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    const res = await api.getSleepLogs(30);
    if (res.success) setLogs(res.data as SleepSession[]);
  };

  useEffect(() => {
    refresh();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await api.logSleep(today(), bedtime, wakeTime, Number(quality));
    setSubmitting(false);
    refresh();
  };

  const viewAnalysis = async (date: string) => {
    const res = await api.getSleepAnalysis(date.slice(0, 10));
    if (res.success) setAnalysis(res.data as Analysis);
  };

  const onDelete = async (id: string) => {
    await api.deleteSleep(id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sleep</h1>
        <p className="text-gray-500 text-sm">Log tonight's sleep and review trends.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Log sleep for today</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Input label="Bedtime" type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
          <Input label="Wake time" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
          <Select label="Quality" value={quality} onChange={(e) => setQuality(e.target.value)}>
            <option value="5">5 · Excellent</option>
            <option value="4">4 · Good</option>
            <option value="3">3 · Okay</option>
            <option value="2">2 · Poor</option>
            <option value="1">1 · Very poor</option>
          </Select>
          <Button type="submit" loading={submitting} className="sm:col-span-3">
            Save
          </Button>
        </form>
      </div>

      {analysis && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Analysis · {formatDate(analysis.session.sleep_date)}</h2>
            <Badge variant={STATUS_VARIANT[analysis.label]}>{analysis.label}</Badge>
          </div>
          <p className="text-sm text-gray-600">{analysis.recommendation}</p>
          <p className="text-xs text-gray-400 mt-2">{formatHours(analysis.session.duration_minutes)} of sleep</p>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent sleep logs</h2>
        {logs.length === 0 && <p className="text-gray-500 text-sm">No sleep logged yet.</p>}
        <ul className="divide-y divide-gray-100">
          {logs.map((log) => (
            <li key={log.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{formatDate(log.sleep_date)}</p>
                <p className="text-xs text-gray-500">
                  {formatHours(log.duration_minutes)} · quality {log.quality ?? '—'}/5
                </p>
              </div>
              <div className="flex gap-3">
                <button className="text-primary-600 text-sm hover:underline" onClick={() => viewAnalysis(log.sleep_date)}>
                  Analyze
                </button>
                <button className="text-danger-600 text-sm hover:underline" onClick={() => onDelete(log.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
