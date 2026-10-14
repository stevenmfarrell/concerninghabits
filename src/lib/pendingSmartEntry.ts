// Hands something the user said or typed on the dashboard (see SmartEntry) that a new habit was
// drafted from to the saved habit's log page, which fills in and submits it as the first entry.

const KEY = 'pendingSmartEntry';
// Long enough for the navigation to the log page (including a cold dev compile); short enough that
// an entry left behind by a navigation that never reached the log page (e.g. a stale bundle in a
// long-lived tab) can't be logged by surprise the next time the user opens that habit.
const MAX_AGE_MS = 60_000;

// `loggedAt` is when it says it was done, when that's earlier (e.g. "yesterday", see whenDone)
export function setPendingSmartEntry(habitId: string, transcript: string, loggedAt?: Date) {
  sessionStorage.setItem(KEY, JSON.stringify({ habitId, transcript, createdAt: Date.now(), ...(loggedAt ? { loggedAt: loggedAt.toISOString() } : {}) }));
}

// The pending input for this habit, if there's a fresh one. Always clears it, so Strict Mode's
// second effect run, a refresh, or back-navigation doesn't process it again.
export function takePendingSmartEntry(habitId: string): { transcript: string; loggedAt?: Date } | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);

  try {
    const pending = JSON.parse(raw);
    const fresh = typeof pending.createdAt === 'number' && Date.now() - pending.createdAt < MAX_AGE_MS;
    if (!fresh || pending.habitId !== habitId || typeof pending.transcript !== 'string') return null;
    const loggedAt = typeof pending.loggedAt === 'string' ? new Date(pending.loggedAt) : null;
    return { transcript: pending.transcript, ...(loggedAt && !Number.isNaN(loggedAt.getTime()) ? { loggedAt } : {}) };
  } catch {
    return null;
  }
}
