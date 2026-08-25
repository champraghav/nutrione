import { query, queryOne } from '../config/database';
import { AppError } from '../utils/AppError';

export interface CoachMessage {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  sender_name: string;
  /** True when the message was sent by whoever is reading the thread. */
  mine: boolean;
}

interface LinkRow {
  id: string;
  coach_user_id: string;
  client_user_id: string | null;
  client_name: string;
  status: string;
}

/**
 * Either side of a live coaching link may read and post. Resolved from the
 * link rather than from a user pair, so ending the relationship closes the
 * conversation at the same moment it closes the data.
 */
async function requireThreadAccess(userId: string, coachClientId: string): Promise<LinkRow> {
  const link = await queryOne<LinkRow>(
    `SELECT id, coach_user_id, client_user_id, client_name, status
     FROM coach_clients
     WHERE id = $1 AND status = 'active' AND (coach_user_id = $2 OR client_user_id = $2)`,
    [coachClientId, userId]
  );
  if (!link) throw AppError.notFound('Conversation not found');
  return link;
}

export async function listMessages(userId: string, coachClientId: string): Promise<CoachMessage[]> {
  await requireThreadAccess(userId, coachClientId);

  const rows = await query<Omit<CoachMessage, 'mine'>>(
    `SELECT m.id, m.sender_user_id, m.body, m.created_at, m.read_at,
            NULLIF(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '') AS sender_name
     FROM coach_messages m
     JOIN users u ON u.id = m.sender_user_id
     WHERE m.coach_client_id = $1
     ORDER BY m.created_at ASC`,
    [coachClientId]
  );

  // Reading the thread marks the other side's messages as read. Doing it here
  // rather than in a separate call means the unread badge cannot get stuck on
  // a conversation the user has plainly already seen.
  await query(
    `UPDATE coach_messages SET read_at = now()
     WHERE coach_client_id = $1 AND sender_user_id <> $2 AND read_at IS NULL`,
    [coachClientId, userId]
  );

  return rows.map((r) => ({ ...r, mine: r.sender_user_id === userId }));
}

export async function sendMessage(userId: string, coachClientId: string, body: string): Promise<CoachMessage[]> {
  const link = await requireThreadAccess(userId, coachClientId);
  const text = body.trim();
  if (!text) throw AppError.badRequest('Message cannot be empty.', 'EMPTY_MESSAGE');

  await query('INSERT INTO coach_messages (coach_client_id, sender_user_id, body) VALUES ($1, $2, $3)', [
    coachClientId,
    userId,
    text,
  ]);

  // Tell the recipient, on their own timeline, that something is waiting.
  const recipient = userId === link.coach_user_id ? link.client_user_id : link.coach_user_id;
  if (recipient) {
    await query(
      `INSERT INTO health_timeline_events (user_id, event_type, title, metadata)
       VALUES ($1, 'coach_message', $2, $3)`,
      [
        recipient,
        userId === link.coach_user_id ? 'Your coach sent you a message' : `${link.client_name} sent you a message`,
        JSON.stringify({ coachClientId }),
      ]
    );
  }

  return listMessages(userId, coachClientId);
}

/** Unread counts per conversation, for badges on the roster and My Plan. */
export async function unreadCounts(userId: string): Promise<Record<string, number>> {
  const rows = await query<{ coach_client_id: string; unread: string }>(
    `SELECT m.coach_client_id, count(*)::text AS unread
     FROM coach_messages m
     JOIN coach_clients cc ON cc.id = m.coach_client_id
     WHERE cc.status = 'active'
       AND (cc.coach_user_id = $1 OR cc.client_user_id = $1)
       AND m.sender_user_id <> $1
       AND m.read_at IS NULL
     GROUP BY m.coach_client_id`,
    [userId]
  );

  const out: Record<string, number> = {};
  for (const r of rows) out[r.coach_client_id] = Number(r.unread);
  return out;
}
