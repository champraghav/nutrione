import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { Badge } from '@components/Badge';
import { capitalize } from '@utils/formatters';

interface Food {
  id: string;
  name: string;
  name_hi: string | null;
  region: string;
  serving_size: string | number;
  serving_unit: string;
  calories: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
}

interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
  equipment: string;
}

const REGIONS = ['all', 'indian', 'generic'];
const CATEGORIES = ['all', 'strength', 'cardio', 'flexibility', 'sports'];

function n(value: string | number | undefined): number {
  return value === undefined ? 0 : Number(value);
}

function FoodsTab() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(async () => {
      const res = await api.searchFoods(query, 200);
      if (res.success) setFoods(res.data as Food[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const filtered = region === 'all' ? foods : foods.filter((f) => f.region === region);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="sm:col-span-2">
          <Input placeholder="Search foods…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r === 'all' ? 'All regions' : capitalize(r)}
            </option>
          ))}
        </Select>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {!loading && filtered.length === 0 && <p className="text-gray-500 text-sm">No foods match.</p>}

      <ul className="divide-y divide-gray-100">
        {filtered.map((food) => (
          <li key={food.id} className="py-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">
                {food.name} {food.name_hi && <span className="text-gray-400 font-normal">· {food.name_hi}</span>}
              </p>
              <p className="text-xs text-gray-500">
                Per {n(food.serving_size)}
                {food.serving_unit}: {n(food.calories).toFixed(0)} kcal · {n(food.protein_g).toFixed(0)}g protein ·{' '}
                {n(food.carbs_g).toFixed(0)}g carbs · {n(food.fat_g).toFixed(0)}g fat
              </p>
            </div>
            <Badge variant={food.region === 'indian' ? 'warning' : 'gray'}>{food.region}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExercisesTab() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getExercises(category === 'all' ? undefined : category, 200).then((res) => {
      if (res.success) setExercises(res.data as Exercise[]);
      setLoading(false);
    });
  }, [category]);

  return (
    <div>
      <div className="mb-4 max-w-xs">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : capitalize(c)}
            </option>
          ))}
        </Select>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {!loading && exercises.length === 0 && <p className="text-gray-500 text-sm">No exercises match.</p>}

      <ul className="divide-y divide-gray-100">
        {exercises.map((ex) => (
          <li key={ex.id} className="py-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{ex.name}</p>
              <p className="text-xs text-gray-500">
                {capitalize(ex.muscle_group.replace('_', ' '))} · {capitalize(ex.equipment)}
              </p>
            </div>
            <Badge variant="primary">{ex.category}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LibraryPage() {
  const [tab, setTab] = useState<'foods' | 'exercises'>('foods');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Library</h1>
        <p className="text-gray-500 text-sm">Browse the food and exercise databases.</p>
      </div>

      <div className="card">
        <div className="flex gap-1 mb-4 border-b border-gray-100 -mt-2 pt-2">
          {(['foods', 'exercises'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-smooth ${
                tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'foods' ? 'Foods' : 'Exercises'}
            </button>
          ))}
        </div>

        {tab === 'foods' ? <FoodsTab /> : <ExercisesTab />}
      </div>
    </div>
  );
}
