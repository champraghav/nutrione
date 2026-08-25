import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@api/client';
import { todayLocal } from '@utils/dates';
import { Habit } from '../types/habits';

/**
 * Today's habits, tickable straight from the dashboard. The whole point of a
 * habit is the daily tick, so it should not need a page change to do it.
 */
export function HabitsCard() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const date = todayLocal();

  useEffect(() => {
    api.getHabits(date).then((res) => {
      if (res.success) setHabits(res.data as Habit[]);
      else setHabits([]);
    });
  }, [date]);

  const tick = async (habit: Habit) => {
    const done = habit.count_today >= habit.target_per_day;
    const next = done ? 0 : habit.target_per_day > 1 ? habit.count_today + 1 : habit.target_per_day;
    const res = await api.checkHabit(habit.id, date, next);
    // Nothing comes back from a queued tick, and streaks are the server's to
    // work out — so leave the list as it is rather than blanking it.
    if (res.success && !res.queued) setHabits(res.data as Habit[]);
  };

  if (habits === null) return null;

  const due = habits.filter((h) => h.due_today);

  if (due.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Habits</h2>
            <p className="text-sm text-gray-500">
              {habits.length === 0 ? 'Pick a few to build your routine.' : 'Nothing scheduled today.'}
            </p>
          </div>
          <Link to="/habits" className="btn-secondary text-xs">
            {habits.length === 0 ? 'Set up' : 'View all'}
          </Link>
        </div>
      </div>
    );
  }

  const doneCount = due.filter((h) => h.done_today).length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Habits <span className="text-sm font-normal text-gray-500">{doneCount} of {due.length}</span>
        </h2>
        <Link to="/habits" className="text-xs text-primary-600 hover:underline">
          View all
        </Link>
      </div>

      <div className="space-y-1.5">
        {due.slice(0, 6).map((habit) => {
          const done = habit.done_today;
          return (
            <button
              key={habit.id}
              onClick={() => tick(habit)}
              aria-pressed={done}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left transition-smooth"
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                  done ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {done ? '✓' : habit.icon}
              </span>
              <span className={`flex-1 text-sm truncate ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                {habit.name}
              </span>
              {habit.target_per_day > 1 && (
                <span className="text-xs text-gray-400 tabular-nums shrink-0">
                  {habit.count_today}/{habit.target_per_day}
                </span>
              )}
              {habit.current_streak > 0 && (
                <span className="text-xs text-orange-600 shrink-0">🔥 {habit.current_streak}</span>
              )}
            </button>
          );
        })}
      </div>

      {due.length > 6 && (
        <p className="text-xs text-gray-400 mt-2">+{due.length - 6} more on the habits page</p>
      )}
    </div>
  );
}
