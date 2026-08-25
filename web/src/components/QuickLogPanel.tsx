import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { friendlyDateLabel } from '@utils/dates';

interface QuickFood {
  id: string;
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  times_logged?: number;
  last_quantity: number;
  last_unit: string;
  last_meal_type: string | null;
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Most days you eat the same things. This turns a repeat into one tap, offers
 * "same as a previous day" wholesale, and lets you record a guessed calorie
 * count when you genuinely do not know what was in the meal.
 *
 * Without something like this a food diary is abandoned within a fortnight,
 * which is the single most common way these apps fail their users.
 */
export function QuickLogPanel({
  date,
  mealType,
  onLogged,
  refreshKey,
}: {
  date: string;
  mealType: string;
  onLogged: () => void;
  refreshKey: number;
}) {
  const [tab, setTab] = useState<'recent' | 'frequent'>('recent');
  const [recent, setRecent] = useState<QuickFood[]>([]);
  const [frequent, setFrequent] = useState<QuickFood[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [quickOpen, setQuickOpen] = useState(false);
  const [qLabel, setQLabel] = useState('');
  const [qCalories, setQCalories] = useState('');
  const [qMeal, setQMeal] = useState(mealType);

  const [copyFrom, setCopyFrom] = useState('');

  const load = () => {
    api.getRecentFoods().then((r) => r.success && setRecent(r.data as QuickFood[]));
    api.getFrequentFoods().then((r) => r.success && setFrequent(r.data as QuickFood[]));
    api.getLoggedDates().then((r) => r.success && setDates((r.data as string[]).filter((d) => d !== date)));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, refreshKey]);

  const logAgain = async (food: QuickFood) => {
    setBusy(food.id);
    setMessage('');
    const res = await api.addMealItem(
      food.id,
      Number(food.last_quantity) || Number(food.serving_size) || 1,
      food.last_unit || food.serving_unit,
      date,
      food.last_meal_type || mealType
    );
    setBusy(null);
    if (res.success) {
      // Say which it was: "Logged" for something the server has, and something
      // honest for a write still sitting in the offline queue.
      setMessage(res.queued ? `${food.name} saved — will sync` : `Logged ${food.name}`);
      onLogged();
      load();
    }
  };

  const doQuickAdd = async () => {
    const calories = Number(qCalories);
    if (!calories || calories <= 0) return;
    setBusy('quick');
    const res = await api.quickAdd({ date, mealType: qMeal, label: qLabel || 'Quick add', calories });
    setBusy(null);
    if (res.success) {
      setQLabel('');
      setQCalories('');
      setQuickOpen(false);
      setMessage(`Added ${calories} kcal`);
      onLogged();
    }
  };

  const doCopy = async () => {
    if (!copyFrom) return;
    setBusy('copy');
    const res = await api.copyDay(copyFrom, date);
    setBusy(null);
    if (res.success) {
      const r = res.data as { copied: number; skipped: number };
      setMessage(
        r.copied > 0
          ? `Copied ${r.copied} item${r.copied === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped} already there` : ''}`
          : 'Everything from that day was already logged here'
      );
      onLogged();
      load();
    }
  };

  const list = tab === 'recent' ? recent : frequent;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Log it again</h2>
        <div className="flex gap-1">
          {(['recent', 'frequent'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                tab === t ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t === 'recent' ? 'Recent' : 'Most often'}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing logged yet. Once you have, your usual foods appear here for one-tap logging.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.slice(0, 12).map((f) => (
            <button
              key={f.id}
              onClick={() => logAgain(f)}
              disabled={busy === f.id}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:border-primary-300 hover:bg-primary-50 transition-smooth disabled:opacity-50"
              title={`${Number(f.last_quantity)} ${f.last_unit}`}
            >
              {f.name}
              <span className="text-gray-400">
                {' '}· {Number(f.last_quantity)} {f.last_unit}
              </span>
              {tab === 'frequent' && f.times_logged ? (
                <span className="text-gray-300"> · {f.times_logged}d</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-gray-100">
        {dates.length > 0 && (
          <>
            <div className="flex-1 min-w-[10rem]">
              <Select label="Copy a whole day" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                <option value="">Choose a day…</option>
                {dates.slice(0, 10).map((d) => (
                  <option key={d} value={d}>
                    {friendlyDateLabel(d)} ({d})
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" onClick={doCopy} disabled={!copyFrom || busy === 'copy'}>
              Copy here
            </Button>
          </>
        )}
        {!quickOpen && (
          <Button variant="secondary" onClick={() => setQuickOpen(true)}>
            Quick add calories
          </Button>
        )}
      </div>

      {quickOpen && (
        <div className="space-y-3 pt-1 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            For when you know roughly the calories but not what was in it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="What was it" value={qLabel} onChange={(e) => setQLabel(e.target.value)} placeholder="Lunch out" />
            <Input
              label="Calories"
              type="number"
              min="0"
              value={qCalories}
              onChange={(e) => setQCalories(e.target.value)}
              placeholder="600"
            />
            <Select label="Meal" value={qMeal} onChange={(e) => setQMeal(e.target.value)}>
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={doQuickAdd} disabled={!Number(qCalories) || busy === 'quick'}>
              Add
            </Button>
            <Button variant="secondary" onClick={() => setQuickOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-primary-600">{message}</p>}
    </div>
  );
}
