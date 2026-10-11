import { getOutbox, removeOps, updateOp, type QueuedOp } from './outbox';
import { MAX_OPS_PER_SYNC, type Op, type OpResult } from './ops';

// Sending the outbox (see outbox.ts) to /api/sync, as the signed-in user, and keeping track of
// whether the server can be reached. Browser-only.

// Who's signed in, as far as the outbox needs to know: whose changes to send, and their bedtime, for
// the day a skip made offline falls on (set by OfflineSync)
export interface OutboxUser {
  id: string;
  bedtime: string;
}

let user: OutboxUser | null = null;
export const setOutboxUser = (next: OutboxUser | null) => {
  user = next;
};
export const getOutboxUser = () => user;

// Whether the server can be reached, as far as anyone's found out: false from when a request fails
// for want of a connection (or the browser says it's offline) until one gets through
let reachable = typeof navigator === 'undefined' ? true : navigator.onLine;
const reachabilityListeners = new Set<() => void>();
export function setReachable(next: boolean) {
  if (next === reachable) return;
  reachable = next;
  reachabilityListeners.forEach(listener => listener());
}
export const isReachable = () => reachable;
export function subscribeReachable(listener: () => void) {
  reachabilityListeners.add(listener);
  return () => reachabilityListeners.delete(listener);
}

// Whether an error from calling the server (a server action or a fetch) was the connection failing,
// rather than the server turning the request down. Browsers word it differently: "Failed to fetch"
// (Chrome), "Load failed" (Safari), "NetworkError when attempting to fetch resource" (Firefox).
export function isNetworkError(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error);
  return error instanceof TypeError || /failed to fetch|load failed|networkerror|network request failed|connection/i.test(message);
}

// Called after a sync made changes, so the page can be rendered again with them (see OfflineSync)
let onSynced: (() => void) | null = null;
export const setOnSynced = (callback: (() => void) | null) => {
  onSynced = callback;
};

// What the outbox keeps about a change besides the change itself, none of which is sent
const OUTBOX_FIELDS = new Set(['queuedAt', 'label', 'status', 'error', 'failedHabitId', 'failedValues']);

// What's sent of a queued change: just the change
function toOp(queued: QueuedOp): Op {
  return Object.fromEntries(Object.entries(queued).filter(([key]) => !OUTBOX_FIELDS.has(key))) as Op;
}

let running: Promise<void> | null = null;
// Whether another sync was asked for while one was running, e.g. for a change made or retried
// meanwhile that the running one had already passed over
let again = false;

// Sends the signed-in user's waiting changes, a batch at a time, oldest first, until none are left
// or the server can't be reached. Only one sync runs at a time in a page, and one asked for while
// another runs goes again once it's done; another tab's at the same time is harmless, since each
// change can be applied more than once (see ops.ts).
export function syncOutbox(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  // Set before any of it runs, and cleared after, in a later tick: with nothing to send, the work
  // finishes without waiting on anything
  running = (async () => {
    let madeChanges = false;
    do {
      again = false;
      if (await sendWaiting()) madeChanges = true;
    } while (again);
    if (madeChanges) onSynced?.();
  })().finally(() => {
    running = null;
  });
  return running;
}

// One pass of syncOutbox: whether it made any changes
async function sendWaiting() {
  let madeChanges = false;
  for (;;) {
    const current = user;
    if (!current) break;
    const batch = getOutbox().filter(op => op.status === 'pending' && op.userId === current.id).slice(0, MAX_OPS_PER_SYNC);
    if (batch.length === 0) break;

    let response: Response;
    try {
      response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops: batch.map(toOp) }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } catch {
      setReachable(false);
      break;
    }
    setReachable(true);
    // Signed out, or something wrong with the server: try again later
    if (!response.ok) break;

    const { results } = (await response.json()) as { results: OpResult[] };
    const done = results.filter(r => r.status === 'done').map(r => r.opId);
    await removeOps(done);
    for (const result of results) {
      if (result.status === 'failed') {
        await updateOp(result.opId, { status: 'failed', error: result.error, failedHabitId: result.habitId, failedValues: result.values });
      }
    }
    if (done.length > 0) madeChanges = true;
    // Nothing in this batch could be settled (all kept to retry): stop, rather than send it again
    if (results.every(r => r.status === 'retry')) break;
  }
  return madeChanges;
}
