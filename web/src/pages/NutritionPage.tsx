import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { BarcodeScanner } from '@components/BarcodeScanner';
import { PlateScanner } from '@components/PlateScanner';
import { HydrationCard } from '@components/HydrationCard';
import { CalorieBudget, Budget } from '@components/CalorieBudget';
import { QuickLogPanel } from '@components/QuickLogPanel';
import { NutrientGapsCard } from '@components/NutrientGapsCard';
import { capitalize, formatDate } from '@utils/formatters';
import { todayLocal, friendlyDateLabel } from '@utils/dates';
import { DatePicker } from '@components/DatePicker';

interface Food {
  id: string;
  name: string;
  name_hi: string | null;
  brand?: string | null;
  serving_size: string | number;
  serving_unit: string;
  calories: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
  fiber_g: string | number | null;
  sugar_g: string | number | null;
  sodium_mg: string | number | null;
  saturated_fat_g: string | number | null;
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

interface NutrientSet {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
}

interface DailyNutrition {
  consumed: NutrientSet;
  targets: NutrientSet;
  remaining: NutrientSet;
  budget: Budget;
}

interface HistoryDay {
  log_date: string;
  total_calories: string | number;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const GOAL_NUTRIENTS: Array<{ key: keyof NutrientSet; label: string; unit: string }> = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
  { key: 'fiber_g', label: 'Fiber', unit: 'g' },
];

const LIMIT_NUTRIENTS: Array<{ key: keyof NutrientSet; label: string; unit: string }> = [
  { key: 'sugar_g', label: 'Sugar', unit: 'g' },
  { key: 'saturated_fat_g', label: 'Saturated fat', unit: 'g' },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
];

function n(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function NutrientBar({
  label,
  unit,
  consumed,
  target,
  isLimit,
}: {
  label: string;
  unit: string;
  consumed: number;
  target: number;
  isLimit: boolean;
}) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const over = consumed > target;
  const barColor = isLimit ? (over ? 'bg-danger-500' : 'bg-success-500') : over ? 'bg-warning-500' : 'bg-primary-600';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={over && isLimit ? 'text-danger-600 font-medium' : 'text-gray-500'}>
          {Math.round(consumed)}
          {unit} / {Math.round(target)}
          {unit}
          {isLimit && over && ' · over limit'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-smooth`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface TargetPlan {
  targets: { calories: number };
  maintenanceCalories: number;
  goal: 'lose' | 'maintain' | 'gain';
  actualRateKgPerWeek: number;
  personalised: boolean;
}

export function NutritionPage() {
  const [date, setDate] = useState(todayLocal());
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [plan, setPlan] = useState<TargetPlan | null>(null);
  const [items, setItems] = useState<MealItem[]>([]);
  const [history, setHistory] = useState<HistoryDay[]>([]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState('lunch');
  const [adding, setAdding] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);
  // Bumped whenever food is logged, so dependent cards refetch.
  const [refreshKey, setRefreshKey] = useState(0);

  const isToday = date === todayLocal();

  const refresh = async () => {
    const [summaryRes, logRes, historyRes, planRes] = await Promise.all([
      api.getNutritionSummary(date),
      api.getNutritionLog(date),
      api.getNutritionHistory(30),
      api.getTargetPlan(),
    ]);
    if (summaryRes.success) setNutrition(summaryRes.data as DailyNutrition);
    if (planRes.success) setPlan(planRes.data as TargetPlan);
    if (logRes.success) setItems(logRes.data as MealItem[]);
    if (historyRes.success) setHistory((historyRes.data as HistoryDay[]).slice().reverse());
    setRefreshKey((k) => k + 1);
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

  const pickFood = (food: Food) => {
    setSelectedFood(food);
    setQuantity(String(n(food.serving_size) || 100));
    setResults([]);
    setQuery('');
    setScannerOpen(false);
  };

  const onBarcodeDetected = async (barcode: string) => {
    setScanning(true);
    setScanError(null);
    const res = await api.getFoodByBarcode(barcode);
    setScanning(false);
    if (res.success) {
      pickFood(res.data as Food);
    } else {
      setScanError(res.error?.message ?? 'Could not look up that barcode.');
    }
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood) return;
    setAdding(true);
    await api.addMealItem(selectedFood.id, Number(quantity), selectedFood.serving_unit, date, mealType);
    setAdding(false);
    setSelectedFood(null);
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
      </div>

      <div className="card py-3">
        <DatePicker date={date} onChange={setDate} />
      </div>

      {nutrition && <CalorieBudget budget={nutrition.budget} isToday={isToday} />}

      <QuickLogPanel date={date} mealType={mealType} onLogged={refresh} refreshKey={refreshKey} />

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{isToday ? "Today's targets" : `Targets · ${friendlyDateLabel(date)}`}</h2>
        {!nutrition && <p className="text-gray-500 text-sm">Loading…</p>}
        {nutrition && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Goals</p>
              <div className="space-y-3">
                {GOAL_NUTRIENTS.map((nut) => (
                  <NutrientBar
                    key={nut.key}
                    label={nut.label}
                    unit={nut.unit}
                    consumed={nutrition.consumed[nut.key]}
                    target={nutrition.targets[nut.key]}
                    isLimit={false}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Limits</p>
              <div className="space-y-3">
                {LIMIT_NUTRIENTS.map((nut) => (
                  <NutrientBar
                    key={nut.key}
                    label={nut.label}
                    unit={nut.unit}
                    consumed={nutrition.consumed[nut.key]}
                    target={nutrition.targets[nut.key]}
                    isLimit
                  />
                ))}
              </div>
            </div>
            {/* Says where the number came from. A calorie target with no
                stated reasoning is just a number to resent. */}
            {plan?.personalised ? (
              <p className="text-xs text-gray-400">
                {plan.goal === 'maintain'
                  ? `Set to roughly what you burn in a day (${plan.maintenanceCalories.toLocaleString()} kcal), from your profile.`
                  : `You burn about ${plan.maintenanceCalories.toLocaleString()} kcal a day, and this sits ${
                      plan.goal === 'lose' ? 'below' : 'above'
                    } that by ${Math.abs(
                      plan.targets.calories - plan.maintenanceCalories
                    ).toLocaleString()} to ${plan.goal} about ${plan.actualRateKgPerWeek} kg a week.`}{' '}
                <Link to="/profile" className="text-primary-600 hover:underline">
                  Change your goal
                </Link>
              </p>
            ) : (
              <p className="text-xs text-gray-400">
                These are a generic 2,000 kcal default — your profile is missing the height, weight or date of birth
                the calculation needs.{' '}
                <Link to="/profile" className="text-primary-600 hover:underline">
                  Fill those in
                </Link>{' '}
                for targets that match your body and your goal.
              </p>
            )}
          </div>
        )}
      </div>

      <NutrientGapsCard date={date} refreshKey={refreshKey} onLogged={refresh} />

      <HydrationCard date={date} />

      <div className="card">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">Log a food</h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setPlateOpen((v) => !v);
                setScannerOpen(false);
              }}
            >
              {plateOpen ? 'Cancel' : '🍽️ Scan plate'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setScannerOpen((v) => !v);
                setPlateOpen(false);
              }}
            >
              {scannerOpen ? 'Cancel' : '📷 Scan barcode'}
            </Button>
          </div>
        </div>

        {plateOpen && (
          <div className="mb-4">
            <PlateScanner
              date={date}
              mealType={mealType}
              onLogged={refresh}
              onClose={() => setPlateOpen(false)}
            />
          </div>
        )}

        {scannerOpen && (
          <div className="mb-4">
            <BarcodeScanner onDetected={onBarcodeDetected} onClose={() => setScannerOpen(false)} />
            {scanning && <p className="text-sm text-gray-500 mt-2">Looking up…</p>}
            {scanError && <p className="text-sm text-danger-600 mt-2">{scanError}</p>}
          </div>
        )}

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
              <li key={food.id}>
                {/* A real button, not a clickable <li>: picking a food is the
                    main thing this app does, and it has to be reachable by
                    keyboard and announced as something you can activate. */}
                <button
                  type="button"
                  onClick={() => pickFood(food)}
                  className="w-full text-left p-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 flex justify-between items-center gap-3"
                >
                  <span>
                    <span className="block text-sm font-medium">{food.name}</span>
                    {food.name_hi && <span className="block text-xs text-gray-400">{food.name_hi}</span>}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {n(food.calories).toFixed(0)} kcal / {n(food.serving_size)}
                    {food.serving_unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedFood && (
          <form onSubmit={onAdd} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-sm font-medium">
                {selectedFood.name}
                {selectedFood.brand ? ` · ${selectedFood.brand}` : ''}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Per {n(selectedFood.serving_size)}
                {selectedFood.serving_unit}: {n(selectedFood.calories).toFixed(0)} kcal ·{' '}
                {n(selectedFood.protein_g).toFixed(1)}g protein · {n(selectedFood.carbs_g).toFixed(1)}g carbs ·{' '}
                {n(selectedFood.fat_g).toFixed(1)}g fat · {n(selectedFood.fiber_g).toFixed(1)}g fiber ·{' '}
                {n(selectedFood.sugar_g).toFixed(1)}g sugar · {n(selectedFood.sodium_mg).toFixed(0)}mg sodium
              </p>
            </div>
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
        <h2 className="text-lg font-semibold mb-4">Last 30 days · calories</h2>
        {history.filter((d) => n(d.total_calories) > 0).length === 0 && (
          <p className="text-gray-500 text-sm">No history yet. Log a few days to see a trend.</p>
        )}
        {history.length > 0 && (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={history.map((d) => ({ date: formatDate(d.log_date, 'MMM d'), calories: n(d.total_calories) }))}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="calories" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{isToday ? "Today's log" : `Log · ${friendlyDateLabel(date)}`}</h2>
        {items.length === 0 && <p className="text-gray-500 text-sm">Nothing logged yet today.</p>}
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{item.food_name}</p>
                <p className="text-xs text-gray-500">
                  {capitalize(item.meal_type)} · {n(item.quantity)}
                  {item.unit} · {n(item.calories).toFixed(0)} kcal · {n(item.protein_g).toFixed(1)}g protein
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
