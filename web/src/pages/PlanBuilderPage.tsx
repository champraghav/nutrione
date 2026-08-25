import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { dayTotals, MEAL_TYPES, Plan, PlanItem } from '../types/coaching';

interface Food {
  id: string;
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
}

interface Exercise {
  id: string;
  name: string;
  category: string;
}

export function PlanBuilderPage() {
  const { id = '' } = useParams();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [day, setDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Diet item form
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [picked, setPicked] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('');
  const [mealType, setMealType] = useState<string>('breakfast');
  const [customName, setCustomName] = useState('');
  const [notes, setNotes] = useState('');

  // Training item form
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');

  const load = async () => {
    const res = await api.getPlan(id);
    if (res.success) {
      const d = res.data as { plan: Plan; items: PlanItem[] };
      setPlan(d.plan);
      setItems(d.items);
    } else {
      setError(res.error?.message ?? 'Could not load that plan.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (plan?.kind !== 'training' || exercises.length > 0) return;
    api.getExercises(undefined, 100).then((res) => {
      if (res.success) setExercises(res.data as Exercise[]);
    });
  }, [plan, exercises.length]);

  // Debounced food search, so typing does not fire a request per keystroke.
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await api.searchFoods(search, 8);
      if (res.success) setResults(res.data as Food[]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const dayItems = useMemo(() => items.filter((i) => i.day_number === day), [items, day]);
  const totals = useMemo(() => dayTotals(dayItems), [dayItems]);

  const pick = (food: Food) => {
    setPicked(food);
    setSearch(food.name);
    setResults([]);
    // Default to the food's own serving, so "1 dosa" not "100 dosas".
    setQuantity(String(Number(food.serving_size)));
  };

  const addDietItem = async () => {
    if (!picked && !customName.trim()) return;
    setError('');
    const res = await api.addPlanItem(id, {
      dayNumber: day,
      mealType,
      foodId: picked?.id ?? null,
      customName: picked ? null : customName.trim(),
      quantity: quantity ? Number(quantity) : null,
      unit: picked?.serving_unit ?? 'g',
      notes: notes.trim() || null,
    });
    if (res.success) {
      setItems(res.data as PlanItem[]);
      setPicked(null);
      setSearch('');
      setQuantity('');
      setCustomName('');
      setNotes('');
    } else {
      setError(res.error?.message ?? 'Could not add that item.');
    }
  };

  const addTrainingItem = async () => {
    if (!exerciseId && !customName.trim()) return;
    setError('');
    const res = await api.addPlanItem(id, {
      dayNumber: day,
      exerciseId: exerciseId || null,
      customName: exerciseId ? null : customName.trim(),
      sets: sets ? Number(sets) : null,
      reps: reps ? Number(reps) : null,
      notes: notes.trim() || null,
    });
    if (res.success) {
      setItems(res.data as PlanItem[]);
      setExerciseId('');
      setCustomName('');
      setNotes('');
    } else {
      setError(res.error?.message ?? 'Could not add that item.');
    }
  };

  const remove = async (itemId: string) => {
    const res = await api.deletePlanItem(id, itemId);
    if (res.success) setItems(res.data as PlanItem[]);
  };

  const copyFrom = async (fromDay: number) => {
    if (!window.confirm(`Replace day ${day} with a copy of day ${fromDay}?`)) return;
    const res = await api.copyPlanDay(id, fromDay, day);
    if (res.success) setItems(res.data as PlanItem[]);
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (!plan) {
    return (
      <div className="card">
        <p className="text-danger-600">{error || 'Plan not found.'}</p>
        <Link to="/plans" className="text-sm text-primary-600 hover:underline">Back to plans</Link>
      </div>
    );
  }

  const days = Array.from({ length: plan.cycle_days }, (_, i) => i + 1);
  const otherDaysWithItems = days.filter((d) => d !== day && items.some((i) => i.day_number === d));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/plans" className="text-sm text-gray-400 hover:text-gray-600">← Plans</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{plan.name}</h1>
        <p className="text-gray-500 text-sm">
          {plan.kind === 'diet' ? 'Diet plan' : 'Training plan'} · repeats every {plan.cycle_days} day
          {plan.cycle_days === 1 ? '' : 's'}
        </p>
      </div>

      {plan.cycle_days > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {days.map((d) => {
            const count = items.filter((i) => i.day_number === d).length;
            return (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                  d === day ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Day {d}
                {count > 0 && <span className={d === day ? ' text-primary-100' : ' text-gray-400'}> · {count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {plan.kind === 'diet' && dayItems.length > 0 && (
        <div className="card">
          <p className="text-sm text-gray-700">
            Day {day} totals: <span className="font-semibold">{totals.calories} kcal</span> · {totals.protein} g protein
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Free-text items have no nutrition data, so they are not counted here.
          </p>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold text-gray-900">Day {day}</h2>
          {otherDaysWithItems.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-400">Copy from</span>
              {otherDaysWithItems.map((d) => (
                <button
                  key={d}
                  onClick={() => copyFrom(d)}
                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:border-primary-300 hover:bg-primary-50"
                >
                  day {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {dayItems.length === 0 && <p className="text-sm text-gray-500">Nothing on this day yet.</p>}

        {plan.kind === 'diet'
          ? MEAL_TYPES.map((meal) => {
              const mealItems = dayItems.filter((i) => i.meal_type === meal);
              if (mealItems.length === 0) return null;
              return (
                <div key={meal}>
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{meal}</p>
                  <ul className="space-y-1">
                    {mealItems.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-800 min-w-0">
                          {i.food_name ?? i.custom_name}
                          {i.quantity ? (
                            <span className="text-gray-400"> · {Number(i.quantity)} {i.unit}</span>
                          ) : null}
                          {!i.food_id && <span className="text-xs text-gray-400"> (free text)</span>}
                          {i.notes && <span className="block text-xs text-gray-400">{i.notes}</span>}
                        </span>
                        <button
                          className="text-gray-400 hover:text-danger-600 px-1 shrink-0"
                          onClick={() => remove(i.id)}
                          aria-label={`Remove ${i.food_name ?? i.custom_name}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          : dayItems.length > 0 && (
              <ul className="space-y-1">
                {dayItems.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-800 min-w-0">
                      {i.exercise_name ?? i.custom_name}
                      <span className="text-gray-400">
                        {i.sets && i.reps ? ` · ${i.sets} × ${i.reps}` : ''}
                      </span>
                      {i.notes && <span className="block text-xs text-gray-400">{i.notes}</span>}
                    </span>
                    <button
                      className="text-gray-400 hover:text-danger-600 px-1 shrink-0"
                      onClick={() => remove(i.id)}
                      aria-label={`Remove ${i.exercise_name ?? i.custom_name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">Add to day {day}</h2>

        {plan.kind === 'diet' ? (
          <>
            <Select label="Meal" value={mealType} onChange={(e) => setMealType(e.target.value)}>
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>

            <div className="relative">
              <Input
                label="Food"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPicked(null);
                }}
                placeholder="Search foods…"
              />
              {results.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
                  {results.map((f) => (
                    <li key={f.id}>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => pick(f)}
                      >
                        {f.name}
                        <span className="text-gray-400">
                          {' '}· {Number(f.calories)} kcal / {Number(f.serving_size)} {f.serving_unit}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!picked && (
              <Input
                label="…or write it in yourself"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Handful of roasted chana"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <Input label="Unit" value={picked?.serving_unit ?? 'g'} disabled />
            </div>

            <Input label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button onClick={addDietItem} disabled={!picked && !customName.trim()}>
              Add item
            </Button>
          </>
        ) : (
          <>
            <Select label="Exercise" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              <option value="">Choose an exercise…</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>

            {!exerciseId && (
              <Input
                label="…or write it in yourself"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="30 min brisk walk"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input label="Sets" type="number" min="1" value={sets} onChange={(e) => setSets(e.target.value)} />
              <Input label="Reps" type="number" min="1" value={reps} onChange={(e) => setReps(e.target.value)} />
            </div>

            <Input label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button onClick={addTrainingItem} disabled={!exerciseId && !customName.trim()}>
              Add exercise
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
