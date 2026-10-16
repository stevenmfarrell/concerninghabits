'use client';

import { startTransition, useEffect } from 'react';
import { getOutbox, loadOutbox } from '@/lib/offline/outbox';
import { isReachable, setOnSynced, setOutboxUser, setReachable, syncOutbox, type OutboxUser } from '@/lib/offline/sync';
import { refreshPages } from '@/app/actions/user';

// While a change is waiting, or the server's been unreachable, how often to try again
const RETRY_EVERY_MS = 20 * 1000;

// Keeps the outbox (see src/lib/offline) sent: as the app opens, when the browser says it's back
// online, when the app comes back to the front, and every little while something's waiting. Each
// sync that makes changes renders the page again with them, and clears the pages kept for going
// back to or prefetched (the sync is a route, which doesn't clear them as an action would). Knowing who's signed in (`user`, null on
// the sign-in pages), it only ever sends their changes.
export default function OfflineSync({ user }: { user: OutboxUser | null }) {
  useEffect(() => {
    setOutboxUser(user);
    // After the user's set, so what's loaded is shown as theirs
    void loadOutbox().then(() => syncOutbox());
  }, [user?.id, user?.bedtime]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOnSynced(() => startTransition(() => refreshPages().catch(() => {})));
    return () => setOnSynced(null);
  }, []);

  useEffect(() => {
    const sync = () => void syncOutbox();
    const onOnline = () => {
      setReachable(true);
      sync();
    };
    const onOffline = () => setReachable(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    // Something's waiting, or a request failed for want of a connection: check whether it's back.
    // A sync does when there's something to send; otherwise any answer from the server will do.
    const retry = async () => {
      if (getOutbox().some(op => op.status === 'pending')) return sync();
      if (isReachable()) return;
      try {
        await fetch('/api/sync', { method: 'HEAD', cache: 'no-store' });
        setReachable(true);
      } catch {}
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(retry, RETRY_EVERY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
