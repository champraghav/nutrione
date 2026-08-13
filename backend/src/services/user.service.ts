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
}

export async function getMe(userId: string): Promise<UserProfile> {
  const user = await queryOne<UserProfile>(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.created_at,
            p.date_of_birth, p.sex, p.height_cm, p.weight_kg, p.activity_level, p.timezone
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
}

export async function updateMe(userId: string, input: UpdateUserInput): Promise<UserProfile> {
  if (input.firstName !== undefined || input.lastName !== undefined) {
    await query(
      `UPDATE users SET first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), updated_at = now()
       WHERE id = $1`,
      [userId, input.firstName ?? null, input.lastName ?? null]
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
    ]
  );

  return getMe(userId);
}

export async function deleteMe(userId: string): Promise<void> {
  await query('UPDATE users SET active = false, updated_at = now() WHERE id = $1', [userId]);
}
