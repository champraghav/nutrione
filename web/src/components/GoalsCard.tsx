import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { Badge } from '@components/Badge';

interface Goal {
  id: string;
  type: string;
  target_value: string | number | null;
  current_value: string | number | null;
  unit: string | null;
  status: 'active' | 'completed' | 'abandoned';
}

const GOAL_TYPES = [
  { value: 'weight_loss', label: 'Lose weight', unit: 'kg' },
  { value: 'muscle_gain', label: 'Gain muscle', unit: 'kg' },
  { value: 'daily_steps', label: 'Daily steps', unit: 'steps' },
  { value: 'workouts_per_week', label: 'Workouts per week', unit: 'workouts' },
  { value: 'sleep_hours', label: 'Sleep hours a night', unit: 'hours' },
  { value: 'water_intake', label: 'Daily water', unit: 'ml' },
];

function n(v: string | number | null | undefined): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export function GoalsCard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [type, setType] = useState(GOAL_TYPES[0].value);
  const [target, setTarget] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const res = await api.getGoals();
    if (res.success) setGoals(res.data as Goal[]);
  };

  useEffect(() => {
    load();
  }, []);

  const selected = GOAL_TYPES.find((g) => g.value === type)!;

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    await api.createGoal({ type, targetValue: Number(target), unit: selected.unit });
    setAdding(false);
    setTarget('');
    setShowForm(false);
    load();
  };

  const bumpProgress = async (goal: Goal, delta: number) => {
    const next = Math.max(0, n(goal.current_value) + delta);
    await api.updateGoal(goal.id, { currentValue: next });
    load();
  };

  const remove = async (id: string) => {
    await api.deleteGoal(id);
    load();
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Goals</h2>
        <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New goal'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={onAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end mb-4">
          <Select label="Goal" value={type} onChange={(e) => setType(e.target.value)}>
            {GOAL_TYPES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
          <Input
            label={`Target (${selected.unit})`}
            type="number"
            min="1"
            step="any"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
          <Button type="submit" loading={adding}>
            Add goal
          </Button>
        </form>
      )}

      {goals.length === 0 && (
        <p className="text-sm text-gray-500">
          No goals yet. Goals are 5% of your health score — add one to start tracking progress.
        </p>
      )}

      <ul className="space-y-3">
        {goals.map((goal) => {
          const meta = GOAL_TYPES.find((g) => g.value === goal.type);
          const pct =
            n(goal.target_value) > 0
              ? Math.min(100, Math.round((n(goal.current_value) / n(goal.target_value)) * 100))
              : 0;
          return (
            <li key={goal.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium">{meta?.label ?? goal.type}</span>
                  {goal.status === 'completed' && <Badge variant="success">done</Badge>}
                </div>
                <button className="text-danger-600 text-xs hover:underline shrink-0" onClick={() => remove(goal.id)}>
                  Remove
                </button>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${goal.status === 'completed' ? 'bg-success-500' : 'bg-primary-600'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {n(goal.current_value)} / {n(goal.target_value)} {goal.unit ?? ''} · {pct}%
                </span>
                {goal.status === 'active' && (
                  <div className="flex gap-1">
                    <button
                      className="text-xs px-2 py-0.5 rounded bg-gray-50 hover:bg-gray-100"
                      onClick={() => bumpProgress(goal, -1)}
                    >
                      −1
                    </button>
                    <button
                      className="text-xs px-2 py-0.5 rounded bg-gray-50 hover:bg-gray-100"
                      onClick={() => bumpProgress(goal, 1)}
                    >
                      +1
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
