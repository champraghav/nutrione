export interface ClientRow {
  coach_client_id: string;
  client_name: string;
  status: 'pending' | 'active' | 'ended';
  last_logged_date: string | null;
  calories_today: number | null;
  protein_today: number | null;
  latest_weight_kg: number | null;
  active_plans: number;
}

export interface PlanItem {
  id: string;
  day_number: number;
  meal_type: string | null;
  food_id: string | null;
  custom_name: string | null;
  quantity: number | null;
  unit: string | null;
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  duration_minutes: number | null;
  notes: string | null;
  food_name: string | null;
  exercise_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  serving_size: number | null;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  kind: 'diet' | 'training';
  cycle_days: number;
  created_at: string;
}

export interface DayPlan {
  date: string;
  assignmentId: string;
  planId: string;
  planName: string;
  kind: 'diet' | 'training';
  dayNumber: number;
  cycleDays: number;
  items: PlanItem[];
}

export interface AdherenceLine {
  planned: { id: string; name: string; meal_type: string | null; quantity: number | null; unit: string | null };
  status: 'followed' | 'partial' | 'missed';
  loggedId: string | null;
  loggedQuantity: number | null;
  checkedOff: boolean;
  manualOnly: boolean;
}

export interface Adherence {
  lines: AdherenceLine[];
  extras: Array<{ id: string; name: string; quantity: number; unit: string | null }>;
  followed: number;
  partial: number;
  missed: number;
  percent: number | null;
}

export interface Assignment {
  id: string;
  plan_id: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
  plan_name: string;
  plan_kind: string;
  cycle_days: number;
}

export interface ClientDetail {
  client: {
    id: string;
    name: string;
    email: string | null;
    status: string;
    notes: string | null;
    accepted_at: string | null;
  };
  date: string;
  assignments: Assignment[];
  dayPlans: DayPlan[];
  adherence: { date: string; planName: string | null; adherence: Adherence | null };
  trend: { days: Array<{ date: string; percent: number | null }>; average: number | null };
  habits: { due: number; done: number; percent: number | null; best_streak: number };
  weights: Array<{ date: string; value: string }>;
  nutrition: Array<{ date: string; total_calories: string; total_protein_g: string }>;
}

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** Calories for one plan line, scaled from the food's serving size. */
export function itemCalories(item: PlanItem): number {
  if (!item.calories || !item.quantity) return 0;
  const serving = Number(item.serving_size) || 1;
  return (Number(item.calories) * Number(item.quantity)) / serving;
}

export function dayTotals(items: PlanItem[]): { calories: number; protein: number } {
  let calories = 0;
  let protein = 0;
  for (const i of items) {
    if (!i.quantity) continue;
    const serving = Number(i.serving_size) || 1;
    const ratio = Number(i.quantity) / serving;
    calories += Number(i.calories ?? 0) * ratio;
    protein += Number(i.protein_g ?? 0) * ratio;
  }
  return { calories: Math.round(calories), protein: Math.round(protein * 10) / 10 };
}
