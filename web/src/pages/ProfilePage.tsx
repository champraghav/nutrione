import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { ErrorNote, errorMessage } from '@components/ErrorNote';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { calculateBMI } from '@utils/formatters';

interface Profile {
  email: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: string | number | null;
  weight_kg: string | number | null;
  activity_level: string | null;
  goal: string | null;
  goal_weight_kg: string | number | null;
  rate_kg_per_week: string | number | null;
}

interface Plan {
  targets: { calories: number; protein_g: number };
  maintenanceCalories: number;
  goal: 'lose' | 'maintain' | 'gain';
  actualRateKgPerWeek: number;
  floored: boolean;
  projection: { weeks: number; date: string } | null;
}

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOALS = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
];
const PACES = [0.25, 0.5, 0.75, 1];

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [goal, setGoal] = useState('maintain');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [rate, setRate] = useState(0.5);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getMe().then((res) => {
      if (res.success) {
        const p = res.data as Profile;
        setProfile(p);
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        setHeightCm(p.height_cm ? String(p.height_cm) : '');
        setWeightKg(p.weight_kg ? String(p.weight_kg) : '');
        setActivityLevel(p.activity_level ?? 'moderate');
        setGoal(p.goal ?? 'maintain');
        setGoalWeightKg(p.goal_weight_kg ? String(p.goal_weight_kg) : '');
        if (p.rate_kg_per_week) setRate(Number(p.rate_kg_per_week));
      }
    });
    refreshPlan();
  }, []);

  async function refreshPlan() {
    const res = await api.getTargetPlan();
    if (res.success) setPlan(res.data as Plan);
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await api.updateMe({
      firstName,
      lastName,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      activityLevel,
      goal,
      ...(goal === 'maintain' || !goalWeightKg
        ? {}
        : { goalWeightKg: Number(goalWeightKg), rateKgPerWeek: rate }),
    });
    setSaving(false);
    if (!res.success) {
      setError(errorMessage(res, 'Could not save your profile.'));
      return;
    }
    if (res.success) {
      setError(null);
      setProfile(res.data as Profile);
      setSaved(true);
      // The targets are derived from what was just saved, so re-read them
      // rather than leaving a stale plan on screen next to the new inputs.
      refreshPlan();
    }
  };

  const bmi = heightCm && weightKg ? calculateBMI(Number(weightKg), Number(heightCm)) : null;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 text-sm">{profile?.email}</p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        <ErrorNote message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Height (cm)" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          <Input label="Weight (kg)" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </div>
        <Select label="Activity level" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
          {ACTIVITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level.replace('_', ' ')}
            </option>
          ))}
        </Select>

        {bmi && <p className="text-sm text-gray-500">Estimated BMI: {bmi}</p>}

        <hr className="border-gray-100" />

        <Select label="Goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
          {GOALS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>

        {goal !== 'maintain' && (
          <>
            <Input
              label="Goal weight (kg)"
              type="number"
              value={goalWeightKg}
              onChange={(e) => setGoalWeightKg(e.target.value)}
            />
            <div>
              <p className="label">Pace (kg per week)</p>
              <div className="grid grid-cols-4 gap-2">
                {PACES.filter((p) => goal === 'lose' || p <= 0.5).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setRate(p)}
                    className={`py-2 rounded-lg border text-sm font-medium transition-smooth ${
                      rate === p
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
          {saved && <span className="text-success-600 text-sm">Saved</span>}
        </div>
      </form>

      {plan && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-1">Your daily target</h2>
          <p className="text-sm text-gray-500 mb-4">
            {plan.goal === 'maintain'
              ? 'Roughly what you burn in a day.'
              : `You burn about ${plan.maintenanceCalories.toLocaleString()} kcal a day, and this sits ${
                  plan.goal === 'lose' ? 'below' : 'above'
                } that by ${Math.abs(plan.targets.calories - plan.maintenanceCalories).toLocaleString()}.`}
          </p>

          <div className="flex items-baseline gap-6">
            <p>
              <span className="text-3xl font-bold text-primary-600">
                {plan.targets.calories.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500"> kcal</span>
            </p>
            <p>
              <span className="text-xl font-semibold text-gray-900">{plan.targets.protein_g}g</span>
              <span className="text-sm text-gray-500"> protein</span>
            </p>
          </div>

          {plan.projection && (
            <p className="text-sm text-gray-600 mt-3">
              About {plan.projection.weeks} weeks to your goal weight at {plan.actualRateKgPerWeek} kg a week.
            </p>
          )}

          {plan.floored && (
            <p className="text-sm text-warning-700 bg-warning-50 rounded-lg p-3 mt-3">
              This is the lowest intake this plan will prescribe, so the pace works out at about{' '}
              {plan.actualRateKgPerWeek} kg a week rather than the {rate} kg selected. Moving more is the way to
              widen the gap from here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
