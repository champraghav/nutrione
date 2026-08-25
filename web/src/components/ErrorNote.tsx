import React from 'react';

/**
 * A failed write, said out loud.
 *
 * Several forms used to check `res.success` and do nothing when it was false —
 * or not check at all — so a rejected save looked exactly like a successful
 * one: the spinner stopped, the form reset, and nothing had been written. The
 * server's own message is shown, because it is the part that says what to fix.
 */
export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="p-3 rounded-lg bg-danger-50 text-danger-700 text-sm">
      {message}
    </p>
  );
}

/** The message to show for a failed call, with a fallback for network errors. */
export function errorMessage(
  res: { success: boolean; error?: { message?: string } },
  fallback = 'Something went wrong. Please try again.'
): string {
  return res.error?.message || fallback;
}
