import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@api/client';
import { useAppStore } from '@store/app.store';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';

/**
 * The three questions that turn a food diary into a plan.
 *
 * Without them every target is a flat 2,000 kcal, which is nobody's number and
 * moves nobody's weight. The wizard asks once, computes the plan on the server
 * — the same code that will run every day, so the preview cannot drift from
 * the real thing — and shows the result before committing to it.
 *
 * It is skippable throughout. Someone who just wants to look around should not
 * have to fill in a form about their body first.
 */

type Goal = 'lose' | 'maintain' | 'gain';

interface Plan {
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  maintenanceCalories: number;
  goal: Goal;
  requestedRateKgPerWeek: number;
  actualRateKgPerWeek: number;
  floored: boolean;
  personalised: boolean;
  projection: { weeks: number; date: string } | null;
}

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary — desk job, little exercise' },
  { value: 'light', label: 'Light — light exercise 1-3 days a week' },
  { value: 'moderate', label: 'Moderate — exercise 3-5 days a week' },
  { value: 'active', label: 'Active — hard exercise 6-7 days a week' },
  { value: 'very_active', label: 'Very active — physical job or twice a day' },
];

const GOALS: Array<{ value: Goal; icon: string; label: string; blurb: string }> = [
  { value: 'lose', icon: '📉', label: 'Lose weight', blurb: 'Eat below what you burn' },
  { value: 'maintain', icon: '⚖️', label: 'Maintain', blurb: 'Hold steady where you are' },
  { value: 'gain', icon: '📈', label: 'Gain weight', blurb: 'Eat above what you burn' },
];

const PACES = [0.25, 0.5, 0.75, 1];

/** Existing values win over the defaults — this runs for accounts that predate
 *  the wizard too, and showing them blank fields would read as lost data. */
const str = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

export function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const fetchUser = useAppStore((state) => state.fetchUser);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sex, setSex] = useState(user?.sex ?? 'female');
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth?.slice(0, 10) ?? '');
  const [heightCm, setHeightCm] = useState(str(user?.height_cm));
  const [weightKg, setWeightKg] = useState(str(user?.weight_kg));
  const [activityLevel, setActivityLevel] = useState(user?.activity_level ?? 'moderate');

  const [goal, setGoal] = useState<Goal>((user?.goal as Goal) ?? 'lose');
  const [goalWeightKg, setGoalWeightKg] = useState(str(user?.goal_weight_kg));
  const [rate, setRate] = useState(user?.rate_kg_per_week ? Number(user.rate_kg_per_week) : 0.5);

  const [plan, setPlan] = useState<Plan | null>(null);

  const aboutYouComplete = Boolean(dateOfBirth && heightCm && weightKg);
  const goalComplete = goal === 'maintain' || Boolean(goalWeightKg);

  /** Saves the profile and reads back the plan the server computed from it. */
  async function saveAndPreview() {
    setSaving(true);
    setError('');

    const res = await api.updateMe({
      sex,
      dateOfBirth: new Date(dateOfBirth).toISOString(),
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      activityLevel,
      goal,
      ...(goal === 'maintain' ? {} : { goalWeightKg: Number(goalWeightKg), rateKgPerWeek: rate }),
    });

    if (!res.success) {
      setSaving(false);
      setError(res.error?.message ?? 'Could not save your details. Please check them and try again.');
      return;
    }

    const planRes = await api.getTargetPlan();
    setSaving(false);
    if (planRes.success) {
      setPlan(planRes.data as Plan);
      setStep(3);
    } else {
      setError('Saved your details, but could not work out your targets. You can see them on the Nutrition page.');
    }
  }

  /** Marks onboarding done so it is never offered again, then gets out of the way. */
  async function finish() {
    setSaving(true);
    await api.updateMe({ onboarded: true });
    await fetchUser();
    setSaving(false);
    navigate('/', { replace: true });
  }

  const goalDirectionOk =
    goal === 'maintain' ||
    !goalWeightKg ||
    !weightKg ||
    (goal === 'lose' ? Number(goalWeightKg) < Number(weightKg) : Number(goalWeightKg) > Number(weightKg));

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-primary-600">Health OS</h1>
          <button onClick={finish} className="text-sm text-gray-500 hover:text-gray-700" disabled={saving}>
            Skip for now
          </button>
        </div>

        <div className="flex gap-2 mb-6" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-primary-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>
        )}

        {step === 1 && (
          <div className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold">A little about you</h2>
              <p className="text-sm text-gray-500">
                Your calorie target is worked out from these. Nothing here is shared with anyone.
              </p>
            </div>

            <Select label="Sex" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
            <p className="text-xs text-gray-400 -mt-2">
              Used only for the metabolic-rate formula, which differs by about 166 kcal a day.
            </p>

            <Input
              label="Date of birth"
              type="date"
              value={dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Height (cm)"
                type="number"
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
              <Input
                label="Weight (kg)"
                type="number"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>

            <Select label="How active are you?" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>

            <Button className="w-full" onClick={() => setStep(2)} disabled={!aboutYouComplete}>
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold">What are you here to do?</h2>
              <p className="text-sm text-gray-500">This is what decides whether your target sits above or below what you burn.</p>
            </div>

            <div className="grid gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-smooth ${
                    goal === g.value
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{g.icon}</span>
                  <span>
                    <span className="block font-medium text-gray-900">{g.label}</span>
                    <span className="block text-xs text-gray-500">{g.blurb}</span>
                  </span>
                </button>
              ))}
            </div>

            {goal !== 'maintain' && (
              <>
                <Input
                  label="Goal weight (kg)"
                  type="number"
                  inputMode="decimal"
                  value={goalWeightKg}
                  onChange={(e) => setGoalWeightKg(e.target.value)}
                  error={goalDirectionOk ? undefined : `To ${goal} weight, your goal should be ${goal === 'lose' ? 'below' : 'above'} ${weightKg} kg.`}
                />

                <div>
                  <p className="label">How fast?</p>
                  <div className="grid grid-cols-4 gap-2">
                    {PACES.filter((p) => goal === 'lose' || p <= 0.5).map((p) => (
                      <button
                        key={p}
                        onClick={() => setRate(p)}
                        className={`py-2 rounded-lg border text-sm font-medium transition-smooth ${
                          rate === p
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {p} kg
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Per week. Losing faster than a kilo a week costs muscle as well as fat, and gaining faster than
                    half a kilo is mostly fat — so those are the limits here.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={saveAndPreview}
                loading={saving}
                disabled={!goalComplete || !goalDirectionOk}
              >
                See my plan
              </Button>
            </div>
          </div>
        )}

        {step === 3 && plan && (
          <div className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Here's your plan</h2>
              <p className="text-sm text-gray-500">
                {plan.goal === 'maintain'
                  ? 'This is roughly what you burn in a day.'
                  : `You burn about ${plan.maintenanceCalories.toLocaleString()} kcal a day, so this target sits ${
                      plan.goal === 'lose' ? 'below' : 'above'
                    } that by ${Math.abs(plan.targets.calories - plan.maintenanceCalories).toLocaleString()}.`}
              </p>
            </div>

            <div className="text-center py-4 bg-primary-50 rounded-lg">
              <p className="text-5xl font-bold text-primary-600">{plan.targets.calories.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">calories a day</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold text-gray-900">{plan.targets.protein_g}g</p>
                <p className="text-xs text-gray-500">protein</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{plan.targets.carbs_g}g</p>
                <p className="text-xs text-gray-500">carbs</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{plan.targets.fat_g}g</p>
                <p className="text-xs text-gray-500">fat</p>
              </div>
            </div>

            {plan.projection && (
              <p className="text-sm text-gray-600 text-center">
                At {plan.actualRateKgPerWeek} kg a week you'd reach {goalWeightKg} kg in about{' '}
                <strong>{plan.projection.weeks} weeks</strong>, around{' '}
                {new Date(plan.projection.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
              </p>
            )}

            {plan.floored && (
              <p className="text-sm text-warning-700 bg-warning-50 rounded-lg p-3">
                Going any lower than this would take you under a safe daily intake, so your target stopped here. That
                works out at about {plan.actualRateKgPerWeek} kg a week rather than the{' '}
                {plan.requestedRateKgPerWeek} kg you picked. Moving more is the way to widen the gap from here.
              </p>
            )}

            <p className="text-xs text-gray-400">
              These are estimates from standard formulas, not medical advice. You can change any of it later on the
              Profile page, and your target updates whenever you log a new weight.
            </p>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button className="flex-1" onClick={finish} loading={saving}>
                Start tracking
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
