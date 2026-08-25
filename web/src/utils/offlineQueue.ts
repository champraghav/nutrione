/**
 * Writes that never reached the server, kept until they can.
 *
 * A food diary is used exactly where the signal is worst — a basement
 * restaurant, a gym, a train. Losing what you typed there is the difference
 * between a diary someone keeps and one they give up on.
 *
 * Only requests that provably never arrived are queued: a network failure with
 * no response at all. Anything the server answered — including a rejection — is
 * left alone, because retrying it would either be pointless or wrong.
 */

export interface QueuedWrite {
  /** Also sent as the idempotency token, so a replay cannot double-log. */
  id: string;
  url: string;
  body: Record<string, unknown>;
  /** What the user did, for the "waiting to sync" line. */
  label: string;
  queuedAt: number;
}

const STORAGE_KEY = 'health_os_offline_queue';

/**
 * Ceiling on the backlog. Someone offline for a week should not fill their
 * browser's storage; past this the oldest entries are dropped, because the
 * newest are the ones they still remember making.
 */
export const QUEUE_LIMIT = 200;

/** Pure: append, keeping only the most recent QUEUE_LIMIT entries. */
export function appendToQueue(existing: QueuedWrite[], write: QueuedWrite, limit = QUEUE_LIMIT): QueuedWrite[] {
  return [...existing, write].slice(-limit);
}

/** Pure: drop one entry by id, used once it has been accepted. */
export function removeFromQueue(existing: QueuedWrite[], id: string): QueuedWrite[] {
  return existing.filter((w) => w.id !== id);
}

/**
 * Pure: whether a failed request is worth keeping.
 *
 * `status` is undefined when the request never got a reply. A 4xx means the
 * server considered it and said no, so replaying it would fail identically; a
 * 5xx is the server's problem and retrying a write blindly risks doubling it
 * on an endpoint without a token.
 */
export function isRetryable(status: number | undefined): boolean {
  return status === undefined;
}

function read(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedWrite[]) : [];
  } catch {
    // Corrupt or unavailable storage must not take the app down; the cost is
    // losing a queue that was already unreadable.
    return [];
  }
}

function write(queue: QueuedWrite[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Quota exceeded or storage blocked. Nothing useful to do — the request is
    // lost either way, and throwing here would break the caller's flow too.
  }
}

export function loadQueue(): QueuedWrite[] {
  return read();
}

export function queueWrite(write_: Omit<QueuedWrite, 'queuedAt'>): void {
  write(appendToQueue(read(), { ...write_, queuedAt: Date.now() }));
}

export function dropWrite(id: string): void {
  write(removeFromQueue(read(), id));
}

export function clearQueue(): void {
  write([]);
}

/** A token that is unique per queued write and stable across replays. */
export function newToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
