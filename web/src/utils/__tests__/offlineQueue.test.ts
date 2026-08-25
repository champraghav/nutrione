import { describe, it, expect } from 'vitest';
import {
  appendToQueue,
  removeFromQueue,
  isRetryable,
  QUEUE_LIMIT,
  QueuedWrite,
} from '../offlineQueue';

const write = (id: string, queuedAt = 0): QueuedWrite => ({
  id,
  url: '/nutrition/meals',
  body: { clientToken: id },
  label: 'Meal',
  queuedAt,
});

describe('appendToQueue', () => {
  it('keeps entries in the order they were made', () => {
    const q = appendToQueue(appendToQueue([], write('a')), write('b'));
    expect(q.map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('drops the oldest once the backlog is full', () => {
    // Someone offline for a week must not fill their browser's storage, and
    // the newest entries are the ones they still remember making.
    let q: QueuedWrite[] = [];
    for (let i = 0; i < QUEUE_LIMIT + 5; i += 1) q = appendToQueue(q, write(`w${i}`));
    expect(q).toHaveLength(QUEUE_LIMIT);
    expect(q[0].id).toBe('w5');
    expect(q[q.length - 1].id).toBe(`w${QUEUE_LIMIT + 4}`);
  });

  it('does not mutate the queue it was given', () => {
    const original = [write('a')];
    appendToQueue(original, write('b'));
    expect(original).toHaveLength(1);
  });
});

describe('removeFromQueue', () => {
  it('drops only the entry that was accepted', () => {
    const q = [write('a'), write('b'), write('c')];
    expect(removeFromQueue(q, 'b').map((w) => w.id)).toEqual(['a', 'c']);
  });

  it('is harmless for an id that is already gone', () => {
    const q = [write('a')];
    expect(removeFromQueue(q, 'zzz')).toHaveLength(1);
  });
});

describe('isRetryable', () => {
  it('keeps a request that never got a reply', () => {
    // The only case we can be sure the server never saw it.
    expect(isRetryable(undefined)).toBe(true);
  });

  it('discards one the server considered and refused', () => {
    // Replaying these would fail identically, for ever.
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(404)).toBe(false);
  });

  it('discards a server error rather than blindly re-sending a write', () => {
    // A 500 means it reached the server, which may well have applied it.
    expect(isRetryable(500)).toBe(false);
    expect(isRetryable(502)).toBe(false);
  });

  it('does not treat a success as something to retry', () => {
    expect(isRetryable(200)).toBe(false);
    expect(isRetryable(201)).toBe(false);
  });
});
