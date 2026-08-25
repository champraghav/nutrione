import crypto from 'crypto';
import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';

export interface CoachClient {
  id: string;
  coach_user_id: string;
  client_user_id: string | null;
  client_name: string;
  client_email: string | null;
  invite_code: string;
  status: 'pending' | 'active' | 'ended';
  notes: string | null;
  created_at: string;
  accepted_at: string | null;
}

/**
 * Invite codes are shown to a human and typed back in, so they avoid
 * characters that get confused when read off a screen or a WhatsApp message
 * (0/O, 1/I/L). Random, not sequential — a guessable code would hand someone
 * else's coach access to a stranger.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * Confirms this coach may read this client's health data, and returns the
 * link. Every coach-facing read of client data goes through here — the
 * guarantee is that a coach can only ever see someone who has actively
 * accepted their invite, and only while that link is live.
 */
export async function requireClientAccess(coachUserId: string, coachClientId: string): Promise<CoachClient> {
  const link = await queryOne<CoachClient>(
    `SELECT * FROM coach_clients
     WHERE id = $1 AND coach_user_id = $2 AND status = 'active' AND client_user_id IS NOT NULL`,
    [coachClientId, coachUserId]
  );
  if (!link) throw AppError.notFound('Client not found');
  return link;
}

export async function listClients(coachUserId: string): Promise<CoachClient[]> {
  return query<CoachClient>(
    `SELECT * FROM coach_clients
     WHERE coach_user_id = $1 AND status <> 'ended'
     ORDER BY status ASC, client_name ASC`,
    [coachUserId]
  );
}

export async function addClient(
  coachUserId: string,
  input: { name: string; email?: string | null; notes?: string | null }
): Promise<CoachClient> {
  const created = await queryOne<CoachClient>(
    `INSERT INTO coach_clients (coach_user_id, client_name, client_email, invite_code, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [coachUserId, input.name.trim(), input.email?.trim() || null, generateInviteCode(), input.notes ?? null]
  );
  return created!;
}

export async function updateClientNotes(
  coachUserId: string,
  coachClientId: string,
  notes: string
): Promise<void> {
  const rows = await query(
    `UPDATE coach_clients SET notes = $3
     WHERE id = $1 AND coach_user_id = $2 AND status <> 'ended'
     RETURNING id`,
    [coachClientId, coachUserId, notes]
  );
  if (rows.length === 0) throw AppError.notFound('Client not found');
}

/** Ends the relationship. Access stops immediately; history is kept. */
export async function endClient(coachUserId: string, coachClientId: string): Promise<void> {
  const rows = await query(
    `UPDATE coach_clients SET status = 'ended', ended_at = now()
     WHERE id = $1 AND coach_user_id = $2 AND status <> 'ended'
     RETURNING id`,
    [coachClientId, coachUserId]
  );
  if (rows.length === 0) throw AppError.notFound('Client not found');

  await query('UPDATE plan_assignments SET active = false WHERE coach_client_id = $1', [coachClientId]);
}

/**
 * The client side of the handshake. Sharing health data with a coach is the
 * client's decision, taken from their own account — a coach entering an email
 * address grants them nothing until this runs.
 */
export async function acceptInvite(clientUserId: string, inviteCode: string): Promise<CoachClient> {
  const code = inviteCode.trim().toUpperCase();
  const link = await queryOne<CoachClient>(
    `SELECT * FROM coach_clients WHERE upper(invite_code) = $1`,
    [code]
  );
  if (!link) throw AppError.badRequest('That invite code was not recognised.', 'INVALID_INVITE');
  if (link.status === 'ended') throw AppError.badRequest('That invite is no longer valid.', 'INVITE_ENDED');
  if (link.coach_user_id === clientUserId) {
    throw AppError.badRequest('You cannot add yourself as your own client.', 'SELF_INVITE');
  }
  if (link.client_user_id && link.client_user_id !== clientUserId) {
    throw AppError.badRequest('That invite has already been used.', 'INVITE_USED');
  }
  if (link.client_user_id === clientUserId && link.status === 'active') return link;

  const accepted = await queryOne<CoachClient>(
    `UPDATE coach_clients
     SET client_user_id = $2, status = 'active', accepted_at = now()
     WHERE id = $1
     RETURNING *`,
    [link.id, clientUserId]
  );

  await query(
    `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
     VALUES ($1, 'coach_linked', $2, $3)`,
    [clientUserId, 'Connected with a coach', JSON.stringify({ coachClientId: link.id })]
  );

  return accepted!;
}

export interface CoachSummary {
  coach_client_id: string;
  coach_name: string;
  coach_email: string;
  accepted_at: string | null;
}

/** The coaches a client has accepted — shown so they always know who can see their data. */
export async function listMyCoaches(clientUserId: string): Promise<CoachSummary[]> {
  return query<CoachSummary>(
    `SELECT cc.id AS coach_client_id,
            trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) AS coach_name,
            u.email AS coach_email,
            cc.accepted_at
     FROM coach_clients cc
     JOIN users u ON u.id = cc.coach_user_id
     WHERE cc.client_user_id = $1 AND cc.status = 'active'
     ORDER BY cc.accepted_at DESC`,
    [clientUserId]
  );
}

/** The client can revoke at any time, from their side, without asking the coach. */
export async function leaveCoach(clientUserId: string, coachClientId: string): Promise<void> {
  const rows = await query(
    `UPDATE coach_clients SET status = 'ended', ended_at = now()
     WHERE id = $1 AND client_user_id = $2 AND status = 'active'
     RETURNING id`,
    [coachClientId, clientUserId]
  );
  if (rows.length === 0) throw AppError.notFound('Coach link not found');

  await query('UPDATE plan_assignments SET active = false WHERE coach_client_id = $1', [coachClientId]);
}

export interface ClientVitalSigns {
  coach_client_id: string;
  client_name: string;
  status: string;
  last_logged_date: string | null;
  calories_today: number | null;
  protein_today: number | null;
  latest_weight_kg: number | null;
  active_plans: number;
}

/**
 * The roster overview. One query per metric across all clients rather than a
 * per-client fan-out, so a coach with fifty clients still loads in one round
 * trip each.
 */
export async function clientOverview(coachUserId: string, date: string): Promise<ClientVitalSigns[]> {
  return query<ClientVitalSigns>(
    `SELECT cc.id AS coach_client_id,
            cc.client_name,
            cc.status,
            (SELECT max(log_date)::text FROM nutrition_logs nl WHERE nl.user_id = cc.client_user_id) AS last_logged_date,
            (SELECT total_calories FROM nutrition_logs nl
              WHERE nl.user_id = cc.client_user_id AND nl.log_date = $2) AS calories_today,
            (SELECT total_protein_g FROM nutrition_logs nl
              WHERE nl.user_id = cc.client_user_id AND nl.log_date = $2) AS protein_today,
            (SELECT hm.value FROM health_metrics hm
              WHERE hm.user_id = cc.client_user_id AND hm.metric_type = 'weight'
              ORDER BY hm.recorded_at DESC LIMIT 1) AS latest_weight_kg,
            (SELECT count(*)::int FROM plan_assignments pa
              WHERE pa.coach_client_id = cc.id AND pa.active) AS active_plans
     FROM coach_clients cc
     WHERE cc.coach_user_id = $1 AND cc.status <> 'ended'
     ORDER BY cc.status ASC, cc.client_name ASC`,
    [coachUserId, date]
  );
}
