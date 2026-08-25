import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { Badge } from '@components/Badge';
import { Plan } from '../types/coaching';

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'diet' | 'training'>('diet');
  const [cycleDays, setCycleDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api.getPlans();
    if (res.success) setPlans(res.data as Plan[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    const res = await api.createPlan({ name: name.trim(), kind, cycleDays });
    setSaving(false);
    if (res.success) {
      setName('');
      setCreating(false);
      load();
    } else {
      setError(res.error?.message ?? 'Could not create that plan.');
    }
  };

  const archive = async (plan: Plan) => {
    if (!window.confirm(`Archive "${plan.name}"? Clients on it will stop seeing it.`)) return;
    const res = await api.archivePlan(plan.id);
    if (res.success) load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-gray-500 text-sm">Write once, assign to as many clients as you like.</p>
        </div>
        {!creating && <Button onClick={() => setCreating(true)}>+ New plan</Button>}
      </div>

      {creating && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">New plan</h2>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fat loss — vegetarian, 1600 kcal"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as 'diet' | 'training')}>
              <option value="diet">Diet plan</option>
              <option value="training">Training plan</option>
            </Select>
            <Select label="Repeats every" value={String(cycleDays)} onChange={(e) => setCycleDays(Number(e.target.value))}>
              <option value="1">1 day (same every day)</option>
              <option value="7">7 days (weekly)</option>
              <option value="14">14 days (fortnightly)</option>
            </Select>
          </div>
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={create} disabled={saving || !name.trim()}>
              {saving ? 'Creating…' : 'Create plan'}
            </Button>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium text-gray-800">No plans yet</p>
          <p className="text-sm text-gray-500">Create one, fill in the days, then assign it to a client.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.id} className="card flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/plans/${p.id}`} className="font-medium text-gray-900 hover:text-primary-700 truncate">
                    {p.name}
                  </Link>
                  <Badge variant={p.kind === 'diet' ? 'primary' : 'gray'}>{p.kind}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Repeats every {p.cycle_days} day{p.cycle_days === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/plans/${p.id}`} className="btn-secondary text-xs">
                  Edit
                </Link>
                <button className="text-gray-400 hover:text-danger-600 px-1" onClick={() => archive(p)} aria-label={`Archive ${p.name}`}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
