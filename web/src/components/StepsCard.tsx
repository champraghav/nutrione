import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Input } from '@components/Input';
import { Button } from '@components/Button';

interface StepDay {
  date: string;
  steps: number;
  target: number;
  calories: number;
  percent: number;
}

const QUICK = [2000, 5000, 8000, 10000];

/**
 * Steps for a day. The value is set outright rather than added to, because
 * a phone or band already knows the running total — adding would double-count
 * on every sync.
 */
export function StepsCard({ date, onChange }: { date: string; onChange?: () => void }) {
  const [data, setData] = useState<StepDay | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await api.getSteps(date);
    if (res.success) {
      const d = res.data as StepDay;
      setData(d);
      setValue(String(d.steps));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const save = async (steps: number) => {
    setBusy(true);
    const res = await api.setSteps(date, steps);
    setBusy(false);
    if (!res.success) return;

    // Queued offline: no server data to apply, so show the count that will be
    // sent. Steps replace the day's total rather than adding to it, which
    // makes the local figure exactly what the server will end up with.
    if (res.queued) {
      setData((prev) => (prev ? { ...prev, steps } : prev));
    } else {
      setData(res.data as StepDay);
    }
    setValue(String(steps));
    setEditing(false);
    onChange?.();
  };

  if (!data) return null;
  const hit = data.steps >= data.target;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold">Steps</h2>
          <p className="text-sm text-gray-500">
            {data.steps.toLocaleString()} of {data.target.toLocaleString()}
            {data.calories > 0 && ` · about ${data.calories} kcal`}
          </p>
        </div>
        {hit && <span className="text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">goal hit</span>}
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-primary-500 transition-all" style={{ width: `${data.percent}%` }} />
      </div>

      {editing ? (
        <div className="flex items-end gap-2">
          <div className="w-36">
            <Input
              label="Steps today"
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button onClick={() => save(Number(value) || 0)} disabled={busy}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {QUICK.map((s) => (
            <button
              key={s}
              onClick={() => save(s)}
              disabled={busy}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:border-primary-300 hover:bg-primary-50 transition-smooth disabled:opacity-50"
            >
              {s.toLocaleString()}
            </button>
          ))}
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-500 hover:border-gray-300"
          >
            Enter exact…
          </button>
        </div>
      )}
    </div>
  );
}
