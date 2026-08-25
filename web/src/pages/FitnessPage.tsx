import React, { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { capitalize, formatDate } from '@utils/formatters';
import { todayLocal, toLocalDateString } from '@utils/dates';
import { StepsCard } from '@components/StepsCard';

interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
}

interface Workout {
  id: string;
  workout_date: string;
  duration_minutes: number;
  workout_type: string;
  intensity: string;
  calories_burned: string | number;
}

interface PersonalRecord {
  id: string;
  exercise_name: string;
  record_type: string;
  value: string | number;
  achieved_at: string;
}

interface Summary {
  total_workouts: string | number;
  total_minutes: string | number;
  total_calories: string | number;
}

const WORKOUT_TYPES = ['strength', 'cardio', 'flexibility', 'sports'];
const INTENSITIES = ['light', 'moderate', 'intense'];

function n(value: string | number | undefined): number {
  return value === undefined ? 0 : Number(value);
}

function last7DaysChartData(workouts: Workout[]): Array<{ date: string; minutes: number }> {
  const days: Array<{ key: string; date: string; minutes: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    const key = toLocalDateString(d);
    days.push({ key, date: formatDate(key, 'EEE'), minutes: 0 });
  }
  for (const w of workouts) {
    const key = w.workout_date.slice(0, 10);
    const day = days.find((d) => d.key === key);
    if (day) day.minutes += w.duration_minutes;
  }
  return days;
}

export function FitnessPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);

  const [duration, setDuration] = useState('30');
  const [workoutType, setWorkoutType] = useState('strength');
  const [intensity, setIntensity] = useState('moderate');
  const [creating, setCreating] = useState(false);

  const [exerciseId, setExerciseId] = useState('');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('20');
  const [addingExercise, setAddingExercise] = useState(false);

  const refresh = async () => {
    const [workoutsRes, recordsRes, summaryRes] = await Promise.all([
      api.getWorkouts(30),
      api.getPersonalRecords(),
      api.getFitnessSummary(7),
    ]);
    if (workoutsRes.success) setWorkouts(workoutsRes.data as Workout[]);
    if (recordsRes.success) setRecords(recordsRes.data as PersonalRecord[]);
    if (summaryRes.success) setSummary(summaryRes.data as Summary);
  };

  useEffect(() => {
    refresh();
    api.getExercises(undefined, 100).then((res) => {
      if (res.success) {
        const list = res.data as Exercise[];
        setExercises(list);
        if (list[0]) setExerciseId(list[0].id);
      }
    });
  }, []);

  const onCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await api.createWorkout(todayLocal(), Number(duration), workoutType, intensity);
    setCreating(false);
    if (res.success) {
      setActiveWorkoutId((res.data as Workout).id);
      refresh();
    }
  };

  const onAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkoutId || !exerciseId) return;
    setAddingExercise(true);
    await api.addWorkoutExercise(activeWorkoutId, {
      exerciseId,
      reps: Number(reps),
      weightKg: Number(weight),
    });
    setAddingExercise(false);
    refresh();
  };

  const onDelete = async (id: string) => {
    await api.deleteWorkout(id);
    if (activeWorkoutId === id) setActiveWorkoutId(null);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fitness</h1>
        <p className="text-gray-500 text-sm">Log workouts and track progress.</p>
      </div>

      <StepsCard date={todayLocal()} />

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Log a workout</h2>
        <form onSubmit={onCreateWorkout} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Select label="Type" value={workoutType} onChange={(e) => setWorkoutType(e.target.value)}>
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {capitalize(t)}
              </option>
            ))}
          </Select>
          <Select label="Intensity" value={intensity} onChange={(e) => setIntensity(e.target.value)}>
            {INTENSITIES.map((i) => (
              <option key={i} value={i}>
                {capitalize(i)}
              </option>
            ))}
          </Select>
          <Input
            label="Duration (min)"
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <Button type="submit" loading={creating} className="sm:col-span-3">
            Start workout
          </Button>
        </form>

        {activeWorkoutId && (
          <form onSubmit={onAddExercise} className="mt-6 border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Add an exercise to this workout</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <Select label="Exercise" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </Select>
              <Input label="Reps" type="number" min="0" value={reps} onChange={(e) => setReps(e.target.value)} />
              <Input
                label="Weight (kg)"
                type="number"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" loading={addingExercise}>
              Add exercise
            </Button>
          </form>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">This week</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Workouts</p>
            <p className="text-xl font-semibold">{n(summary?.total_workouts)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Minutes</p>
            <p className="text-xl font-semibold">{n(summary?.total_minutes)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Calories burned</p>
            <p className="text-xl font-semibold">{n(summary?.total_calories).toFixed(0)}</p>
          </div>
        </div>
        {workouts.length > 0 && (
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={last7DaysChartData(workouts)}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="minutes" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent workouts</h2>
        {workouts.length === 0 && <p className="text-gray-500 text-sm">No workouts logged yet.</p>}
        <ul className="divide-y divide-gray-100">
          {workouts.map((w) => (
            <li key={w.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">
                  {capitalize(w.workout_type)} · {formatDate(w.workout_date)}
                </p>
                <p className="text-xs text-gray-500">
                  {w.duration_minutes} min · {capitalize(w.intensity)} · {n(w.calories_burned).toFixed(0)} kcal
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <button className="text-primary-600 text-sm hover:underline" onClick={() => setActiveWorkoutId(w.id)}>
                  Add exercises
                </button>
                <button className="text-danger-600 text-sm hover:underline" onClick={() => onDelete(w.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Personal records</h2>
        {records.length === 0 && <p className="text-gray-500 text-sm">No records yet. Log some weighted sets!</p>}
        <ul className="divide-y divide-gray-100">
          {records.map((r) => (
            <li key={r.id} className="py-2 flex justify-between">
              <span className="text-sm">{r.exercise_name}</span>
              <span className="text-sm text-gray-500">
                {r.record_type === 'max_weight' ? `${n(r.value)} kg` : `${n(r.value)} reps`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
