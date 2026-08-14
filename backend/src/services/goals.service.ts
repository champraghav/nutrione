import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';

export interface Goal {
  id: string;
  type: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  target_date: string | null;
  status: 'active' | 'completed' | 'abandoned';
  created_at: string;
}

export interface CreateGoalInput {
  type: string;
  targetValue: number;
  currentValue?: number;
  unit?: string;
  targetDate?: string;
}

export async function listGoals(userId: string, status?: string): Promise<Goal[]> {
  if (status) {
    return query<Goal>('SELECT * FROM goals WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC', [
      userId,
      status,
    ]);
  }
  return query<Goal>('SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
}

export async function createGoal(userId: string, input: CreateGoalInput): Promise<Goal> {
  const goal = await queryOne<Goal>(
    `INSERT INTO goals (user_id, type, target_value, current_value, unit, target_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      input.type,
      input.targetValue,
      input.currentValue ?? 0,
      input.unit ?? null,
      input.targetDate ?? null,
    ]
  );

  await query(
    `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
     VALUES ($1, 'goal_created', $2, $3)`,
    [userId, `Set a new goal: ${input.type}`, JSON.stringify({ goalId: goal!.id })]
  );

  return goal!;
}

export async function updateGoal(
  userId: string,
  id: string,
  input: { currentValue?: number; targetValue?: number; status?: string }
): Promise<Goal> {
  const existing = await queryOne<Goal>('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!existing) throw AppError.notFound('Goal not found');

  const updated = await queryOne<Goal>(
    `UPDATE goals SET
       current_value = COALESCE($3, current_value),
       target_value = COALESCE($4, target_value),
       status = COALESCE($5, status)
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, input.currentValue ?? null, input.targetValue ?? null, input.status ?? null]
  );

  // Auto-complete once the target is reached, so the goal-progress score and
  // the list both reflect reality without the user having to tick it off.
  if (
    updated &&
    updated.status === 'active' &&
    updated.target_value &&
    Number(updated.current_value) >= Number(updated.target_value)
  ) {
    return (await queryOne<Goal>(
      `UPDATE goals SET status = 'completed' WHERE id = $1 RETURNING *`,
      [id]
    ))!;
  }

  return updated!;
}

export async function deleteGoal(userId: string, id: string): Promise<void> {
  const existing = await queryOne('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!existing) throw AppError.notFound('Goal not found');
  await query('DELETE FROM goals WHERE id = $1', [id]);
}
