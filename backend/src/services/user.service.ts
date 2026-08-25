import { queryOne, query } from '../config/database';
import { AppError } from '../utils/AppError';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  timezone: string;
  goal: string | null;
  goal_weight_kg: number | null;
  rate_kg_per_week: number | null;
  onboarded_at: string | null;
}

export async function getMe(userId: string): Promise<UserProfile> {
  const user = await queryOne<UserProfile>(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.created_at,
            p.date_of_birth, p.sex, p.height_cm, p.weight_kg, p.activity_level, p.timezone,
            p.goal, p.goal_weight_kg, p.rate_kg_per_week, p.onboarded_at
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1 AND u.active = true`,
    [userId]
  );
  if (!user) throw AppError.notFound('User not found');
  return user;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  timezone?: string;
  goal?: string;
  goalWeightKg?: number;
  rateKgPerWeek?: number;
  /** Set by the onboarding wizard on its last step; never unset afterwards. */
  onboarded?: boolean;
}

/**
 * Distinguishes "leave it alone" from "clear it".
 *
 * undefined means the field was not in the request, so COALESCE keeps what is
 * stored. An empty string is a deliberate clear and becomes NULL — a name
 * column holding '' would render as a blank where a name should be.
 */
function nameUpdate(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function updateMe(userId: string, input: UpdateUserInput): Promise<UserProfile> {
  const firstName = nameUpdate(input.firstName);
  const lastName = nameUpdate(input.lastName);

  if (firstName !== undefined || lastName !== undefined) {
    await query(
      `UPDATE users SET
         first_name = CASE WHEN $4 THEN $2 ELSE first_name END,
         last_name  = CASE WHEN $5 THEN $3 ELSE last_name END,
         updated_at = now()
       WHERE id = $1`,
      [userId, firstName ?? null, lastName ?? null, firstName !== undefined, lastName !== undefined]
    );
  }

  await query(
    `UPDATE profiles SET
       date_of_birth = COALESCE($2, date_of_birth),
       sex = COALESCE($3, sex),
       height_cm = COALESCE($4, height_cm),
       weight_kg = COALESCE($5, weight_kg),
       activity_level = COALESCE($6, activity_level),
       timezone = COALESCE($7, timezone),
       goal = COALESCE($8, goal),
       goal_weight_kg = COALESCE($9, goal_weight_kg),
       rate_kg_per_week = COALESCE($10, rate_kg_per_week),
       onboarded_at = CASE WHEN $11 THEN COALESCE(onboarded_at, now()) ELSE onboarded_at END,
       updated_at = now()
     WHERE user_id = $1`,
    [
      userId,
      input.dateOfBirth ?? null,
      input.sex ?? null,
      input.heightCm ?? null,
      input.weightKg ?? null,
      input.activityLevel ?? null,
      input.timezone ?? null,
      input.goal ?? null,
      input.goalWeightKg ?? null,
      input.rateKgPerWeek ?? null,
      input.onboarded === true,
    ]
  );

  return getMe(userId);
}

export async function deleteMe(userId: string): Promise<void> {
  await query('UPDATE users SET active = false, updated_at = now() WHERE id = $1', [userId]);
}
