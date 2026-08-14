import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { DatePicker } from '@components/DatePicker';
import { HabitRow } from '@components/HabitRow';
import { todayLocal } from '@utils/dates';
import { Habit, HabitSuggestion, WEEKDAY_LABELS } from '../types/habits';

const ICON_CHOICES = ['✅', '💧', '👟', '🌙', '🏋️', '🍽️', '🧘', '📖', '🚭', '🍬', '☀️', '💊'];

interface FormState {
  id: string | null;
  name: string;
  icon: string;
  cadence: 'daily' | 'weekly';
  targetPerDay: number;
  daysOfWeek: number[];
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  icon: '✅',
  cadence: 'daily',
  targetPerDay: 1,
  daysOfWeek: [1, 3, 5],
};

export function HabitsPage() {
  const [date, setDate] = useState(todayLocal());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async (forDate: string) => {
    const res = await api.getHabits(forDate);
    if (res.success) setHabits(res.data as Habit[]);
    setLoading(false);
  };

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    api.getHabitSuggestions().then((res) => {
      if (res.success) setSuggestions(res.data as HabitSuggestion[]);
    });
  }, []);

  // The check endpoint returns the whole refreshed list, so one round trip
  // updates the streaks too — no second fetch, no flash of stale numbers.
  const applyList = (data: unknown) => setHabits(data as Habit[]);

  const save = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      icon: form.icon,
      cadence: form.cadence,
      targetPerDay: form.targetPerDay,
      daysOfWeek: form.cadence === 'weekly' ? form.daysOfWeek : null,
    };

    const res = form.id ? await api.updateHabit(form.id, payload) : await api.createHabit(payload);
    setSaving(false);

    if (res.success) {
      applyList(res.data);
      setForm(null);
      if (date !== todayLocal()) load(date);
    } else {
      setError(res.error?.message ?? 'Could not save the habit');
    }
  };

  const addSuggestion = async (s: HabitSuggestion) => {
    const res = await api.createHabit({
      name: s.name,
      icon: s.icon,
      cadence: s.cadence,
      targetPerDay: s.targetPerDay,
      daysOfWeek: s.daysOfWeek ?? null,
    });
    if (res.success) applyList(res.data);
  };

  const remove = async (habit: Habit) => {
    if (!window.confirm(`Stop tracking "${habit.name}"? Your history is kept.`)) return;
    const res = await api.archiveHabit(habit.id);
    if (res.success) setHabits((prev) => prev.filter((h) => h.id !== habit.id));
  };

  const edit = (habit: Habit) => {
    setForm({
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      cadence: habit.cadence,
      targetPerDay: habit.target_per_day,
      daysOfWeek: habit.days_of_week ?? [1, 3, 5],
    });
  };

  const dueToday = habits.filter((h) => h.due_today);
  const doneToday = dueToday.filter((h) => h.done_today).length;
  const notDue = habits.filter((h) => !h.due_today);
  const takenNames = new Set(habits.map((h) => h.name.toLowerCase()));
  const openSuggestions = suggestions.filter((s) => !takenNames.has(s.name.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Habits</h1>
          <p className="text-gray-500 text-sm">The small things, kept up day after day.</p>
        </div>
        <DatePicker date={date} onChange={setDate} />
      </div>

      {dueToday.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              {doneToday} of {dueToday.length} done
            </p>
            <p className="text-sm text-gray-500">
              {Math.round((doneToday / dueToday.length) * 100)}%
            </p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all"
              style={{ width: `${(doneToday / dueToday.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : habits.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-4xl mb-2">🔥</p>
          <p className="font-medium text-gray-800">No habits yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Pick a couple below, or write your own. Two or three is plenty to start.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dueToday.map((habit) => (
            <HabitRow key={habit.id} habit={habit} date={date} onChanged={applyList} onEdit={edit} onDelete={remove} />
          ))}

          {notDue.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wide text-gray-400 pt-2">Not scheduled today</p>
              {notDue.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  date={date}
                  onChanged={applyList}
                  onEdit={edit}
                  onDelete={remove}
                />
              ))}
            </>
          )}
        </div>
      )}

      {form ? (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">{form.id ? 'Edit habit' : 'New habit'}</h2>

          <Input
            label="What do you want to do?"
            value={form.name}
            placeholder="e.g. Walk after dinner"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div>
            <p className="label">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              {ICON_CHOICES.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  aria-label={`Icon ${icon}`}
                  aria-pressed={form.icon === icon}
                  onClick={() => setForm({ ...form, icon })}
                  className={`w-9 h-9 rounded-md text-lg ${
                    form.icon === icon ? 'bg-primary-100 ring-2 ring-primary-400' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="How often"
              value={form.cadence}
              onChange={(e) => setForm({ ...form, cadence: e.target.value as 'daily' | 'weekly' })}
            >
              <option value="daily">Every day</option>
              <option value="weekly">Certain days of the week</option>
            </Select>

            <Input
              label="Times per day"
              type="number"
              min={1}
              max={50}
              value={form.targetPerDay}
              onChange={(e) => setForm({ ...form, targetPerDay: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>

          {form.cadence === 'weekly' && (
            <div>
              <p className="label">Which days</p>
              <div className="flex gap-1.5">
                {WEEKDAY_LABELS.map((label, index) => {
                  const on = form.daysOfWeek.includes(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-pressed={on}
                      aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]}
                      onClick={() =>
                        setForm({
                          ...form,
                          daysOfWeek: on
                            ? form.daysOfWeek.filter((d) => d !== index)
                            : [...form.daysOfWeek, index].sort((a, b) => a - b),
                        })
                      }
                      className={`w-9 h-9 rounded-full text-sm font-medium ${
                        on ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-danger-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add habit'}
            </Button>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setForm(EMPTY_FORM)}>+ New habit</Button>
      )}

      {openSuggestions.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Common ones</h2>
          <p className="text-sm text-gray-500 mb-3">Tap to start tracking straight away.</p>
          <div className="flex flex-wrap gap-2">
            {openSuggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => addSuggestion(s)}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:border-primary-300 hover:bg-primary-50 transition-smooth"
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
