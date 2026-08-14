export interface HabitHistoryDay {
  date: string;
  due: boolean;
  done: boolean;
  count: number;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  cadence: 'daily' | 'weekly';
  target_per_day: number;
  days_of_week: number[] | null;
  reminder_time: string | null;
  due_today: boolean;
  count_today: number;
  done_today: boolean;
  current_streak: number;
  longest_streak: number;
  rate_30d: number | null;
  history: HabitHistoryDay[];
}

export interface HabitSuggestion {
  name: string;
  icon: string;
  cadence: 'daily' | 'weekly';
  targetPerDay: number;
  daysOfWeek?: number[];
}

export interface HabitsSummary {
  due: number;
  done: number;
  percent: number | null;
  best_streak: number;
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function scheduleLabel(habit: Pick<Habit, 'cadence' | 'days_of_week' | 'target_per_day'>): string {
  const times = habit.target_per_day > 1 ? ` · ${habit.target_per_day}× a day` : '';
  if (habit.cadence === 'daily') return `Every day${times}`;
  const days = habit.days_of_week ?? [];
  if (days.length === 0) return 'No days selected';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${[...days].sort((a, b) => a - b).map((d) => names[d]).join(', ')}${times}`;
}
