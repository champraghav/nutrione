import crypto from 'crypto';
import { queryOne, query } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokens(user: Pick<User, 'id' | 'email'>): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email });

  const decoded = verifyRefreshToken(refreshToken) as { exp?: number };
  const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, hashToken(refreshToken), expiresAt]
  );

  return { accessToken, refreshToken };
}

/** A name left blank is absent, not an empty string sitting in the column. */
function blankToNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function signup(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<{ user: Omit<User, 'password_hash'>; tokens: AuthTokens }> {
  const existing = await queryOne<User>('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing) {
    throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(password);
  const user = await queryOne<User>(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, first_name, last_name, active, created_at`,
    [email.toLowerCase(), passwordHash, blankToNull(firstName), blankToNull(lastName)]
  );

  await query(`INSERT INTO profiles (user_id) VALUES ($1)`, [user!.id]);

  const tokens = await issueTokens(user!);
  return { user: user!, tokens };
}

export async function signin(
  email: string,
  password: string
): Promise<{ user: Omit<User, 'password_hash'>; tokens: AuthTokens }> {
  const user = await queryOne<User>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!user || !user.active) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const tokens = await issueTokens(user);
  const { password_hash, ...safeUser } = user;
  return { user: safeUser, tokens };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await queryOne<{ id: string; revoked: boolean; expires_at: string }>(
    'SELECT id, revoked, expires_at FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash]
  );

  if (!stored || stored.revoked || new Date(stored.expires_at) < new Date()) {
    throw AppError.unauthorized('Refresh token is no longer valid', 'INVALID_REFRESH_TOKEN');
  }

  await query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [stored.id]);

  return issueTokens({ id: payload.sub, email: payload.email });
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]);
}
