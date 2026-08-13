import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { capitalize } from '@utils/formatters';

interface Food {
  id: string;
  name: string;
  name_hi: string | null;
  serving_size: string | number;
  serving_unit: string;
  calories: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
}

interface MealItem {
  id: string;
  food_name: string;
  meal_type: string;
  quantity: string | number;
  unit: string;
  calories: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
}

interface Summary {
  total_calories: string | number;
  total_protein_g: string | number;
  total_carbs_g: string | number;
  total_fat_g: string | number;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function n(value: string | number | undefined): number {
  return value === undefined ? 0 : Number(value);
}

export function NutritionPage() {
  const [date] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<MealItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState('lunch');
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    const [summaryRes, logRes] = await Promise.all([api.getNutritionSummary(date), api.getNutritionLog(date)]);
    if (summaryRes.success) setSummary(summaryRes.data as Summary);
    if (logRes.success) setItems(logRes.data as MealItem[]);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      const res = await api.searchFoods(query, 10);
      if (res.success) setResults(res.data as Food[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood) return;
    setAdding(true);
    await api.addMealItem(selectedFood.id, Number(quantity), selectedFood.serving_unit, date, mealType);
    setAdding(false);
    setSelectedFood(null);
    setQuery('');
    setResults([]);
    refresh();
  };

  const onRemove = async (id: string) => {
    await api.removeMealItem(id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nutrition</h1>
        <p className="text-gray-500 text-sm">{date}</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Today's totals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Calories</p>
            <p className="text-xl font-semibold">{n(summary?.total_calories).toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Protein</p>
            <p className="text-xl font-semibold">{n(summary?.total_protein_g).toFixed(0)}g</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Carbs</p>
            <p className="text-xl font-semibold">{n(summary?.total_carbs_g).toFixed(0)}g</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fat</p>
            <p className="text-xl font-semibold">{n(summary?.total_fat_g).toFixed(0)}g</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Log a food</h2>
        <Input
          placeholder="Search foods… (e.g. chicken, dal, roti)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedFood(null);
          }}
        />

        {searching && <p className="text-sm text-gray-400 mt-2">Searching…</p>}

        {!selectedFood && results.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {results.map((food) => (
              <li
                key={food.id}
                className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                onClick={() => {
                  setSelectedFood(food);
                  setQuantity(String(n(food.serving_size) || 100));
                  setResults([]);
                }}
              >
                <div>
                  <p className="text-sm font-medium">{food.name}</p>
                  {food.name_hi && <p className="text-xs text-gray-400">{food.name_hi}</p>}
                </div>
                <p className="text-xs text-gray-500">
                  {n(food.calories).toFixed(0)} kcal / {n(food.serving_size)}
                  {food.serving_unit}
                </p>
              </li>
            ))}
          </ul>
        )}

        {selectedFood && (
          <form onSubmit={onAdd} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium">{selectedFood.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Quantity (${selectedFood.serving_unit})`}
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              <Select label="Meal" value={mealType} onChange={(e) => setMealType(e.target.value)}>
                {MEAL_TYPES.map((mt) => (
                  <option key={mt} value={mt}>
                    {capitalize(mt)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={adding}>
                Add to log
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSelectedFood(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Today's log</h2>
        {items.length === 0 && <p className="text-gray-500 text-sm">Nothing logged yet today.</p>}
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{item.food_name}</p>
                <p className="text-xs text-gray-500">
                  {capitalize(item.meal_type)} · {n(item.quantity)}
                  {item.unit} · {n(item.calories).toFixed(0)} kcal
                </p>
              </div>
              <button className="text-danger-600 text-sm hover:underline" onClick={() => onRemove(item.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
