import React, { useState } from 'react';
import { api } from '@api/client';
import { Habit, scheduleLabel } from '../types/habits';

/**
 * One habit in the list: tick it off, see the streak, glance at the fortnight.
 *
 * The tick applies optimistically because a habit tick has to feel instant —
 * you tap it walking out of the door. The server's response replaces the
 * optimistic state a moment later, so a failed request self-corrects.
 */
export function HabitRow({
  habit,
  date,
  onChanged,
  onEdit,
  onDelete,
}: {
  habit: Habit;
  date: string;
  onChanged: (habits: unknown) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}) {
  const [pending, setPending] = useState<number | null>(null);
  const count = pending ?? habit.count_today;
  const target = habit.target_per_day;
  const done = count >= target;
  const isCounter = target > 1;

  const send = async (next: number) => {
    setPending(next);
    const res = await api.checkHabit(habit.id, date, next);
    setPending(null);
    if (res.success) onChanged(res.data);
  };

  const toggle = () => send(done ? 0 : isCounter ? count + 1 : target);

  return (
    <div className={`card ${habit.due_today ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          aria-label={done ? `Undo ${habit.name}` : `Mark ${habit.name} done`}
          aria-pressed={done}
          className={`shrink-0 w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-smooth ${
            done
              ? 'bg-primary-500 text-white'
              : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500'
          }`}
        >
          {done ? '✓' : habit.icon}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`font-medium truncate ${done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                {habit.name}
              </p>
              <p className="text-xs text-gray-400">{scheduleLabel(habit)}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {habit.current_streak > 0 && (
                <span
                  className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"
                  title={`Best streak: ${habit.longest_streak}`}
                >
                  🔥 {habit.current_streak}
                </span>
              )}
              <button
                onClick={() => onEdit(habit)}
                className="text-gray-400 hover:text-gray-700 px-1"
                aria-label={`Edit ${habit.name}`}
              >
                ✎
              </button>
              <button
                onClick={() => onDelete(habit)}
                className="text-gray-400 hover:text-danger-600 px-1"
                aria-label={`Stop tracking ${habit.name}`}
              >
                ×
              </button>
            </div>
          </div>

          {isCounter && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => send(Math.max(0, count - 1))}
                disabled={count === 0}
                className="w-7 h-7 rounded-md bg-gray-100 text-gray-600 disabled:opacity-40"
                aria-label={`One fewer ${habit.name}`}
              >
                −
              </button>
              <span className="text-sm text-gray-600 tabular-nums">
                {count} / {target}
              </span>
              <button
                onClick={() => send(count + 1)}
                className="w-7 h-7 rounded-md bg-gray-100 text-gray-600"
                aria-label={`One more ${habit.name}`}
              >
                +
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className="flex gap-[3px] shrink-0" title="Last 14 days">
              {habit.history.map((day) => (
                <span
                  key={day.date}
                  title={`${day.date}${day.due ? (day.done ? ' · done' : ' · missed') : ' · not scheduled'}`}
                  className={`w-2.5 h-2.5 rounded-sm ${
                    !day.due ? 'bg-gray-100' : day.done ? 'bg-primary-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            {habit.rate_30d !== null && (
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{habit.rate_30d}% this month</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
