import React, { useEffect, useState } from 'react';
import { onQueueChanged, syncQueue } from '@api/client';
import { loadQueue } from '@utils/offlineQueue';

/**
 * Says whether the app can reach the server, and what is still waiting.
 *
 * Silence is the wrong answer to being offline. Without this, food logged on a
 * train is written to a queue the user cannot see, does not appear in today's
 * log, and looks exactly like data that was lost — which is the point at which
 * people stop trusting a diary and stop keeping it.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(() => loadQueue().length);
  const [justSynced, setJustSynced] = useState(0);

  useEffect(() => {
    const refresh = () => setPending(loadQueue().length);

    const goOnline = async () => {
      setOnline(true);
      const { sent } = await syncQueue();
      refresh();
      if (sent > 0) {
        setJustSynced(sent);
        setTimeout(() => setJustSynced(0), 4000);
      }
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const unsubscribe = onQueueChanged(refresh);

    // Anything left from a previous visit goes out as soon as we load.
    if (navigator.onLine && loadQueue().length > 0) void goOnline();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribe();
    };
  }, []);

  if (justSynced > 0) {
    return (
      <div role="status" className="bg-success-50 text-success-700 text-sm text-center py-2 px-4">
        Synced {justSynced} {justSynced === 1 ? 'entry' : 'entries'} logged offline.
      </div>
    );
  }

  if (!online) {
    return (
      <div role="status" className="bg-warning-50 text-warning-800 text-sm text-center py-2 px-4">
        Offline — you can keep logging.
        {pending > 0 && ` ${pending} ${pending === 1 ? 'entry' : 'entries'} will sync when you reconnect.`}
      </div>
    );
  }

  if (pending > 0) {
    return (
      <div role="status" className="bg-warning-50 text-warning-800 text-sm text-center py-2 px-4">
        {pending} {pending === 1 ? 'entry' : 'entries'} waiting to sync.{' '}
        <button onClick={() => void syncQueue()} className="underline font-medium">
          Try now
        </button>
      </div>
    );
  }

  return null;
}
