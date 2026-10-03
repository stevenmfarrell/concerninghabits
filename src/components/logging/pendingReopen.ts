// An undone entry waiting to be put back in its habit's entry sheet, to correct and log again.
// Undo can't reach the sheet that logged the entry directly: logging can move the habit elsewhere
// on the page (a done habit on the Due page drops to a chip), which unmounts that Log button and
// its sheet. So undo leaves the values here, and whichever Log button is showing that habit when
// they arrive, or next appears for it, takes them and reopens its sheet (see useHabitLogger).

type PendingReopen = { habitId: string; data: Record<string, unknown>; createdAt: number };

// Long enough for the page to re-render with the restored habit; short enough that values left
// behind (e.g. the user navigated away) don't pop a sheet open by surprise on some later page
const MAX_AGE_MS = 10_000;

let pending: PendingReopen | null = null;
const listeners = new Set<() => void>();

export function requestReopen(habitId: string, data: Record<string, unknown>) {
  pending = { habitId, data, createdAt: Date.now() };
  listeners.forEach(listener => listener());
}

// The values waiting for this habit, if there are fresh ones. Taking them clears them, so only one
// Log button reopens.
export function takeReopen(habitId: string): Record<string, unknown> | null {
  if (!pending || pending.habitId !== habitId) return null;
  const { data, createdAt } = pending;
  pending = null;
  return Date.now() - createdAt < MAX_AGE_MS ? data : null;
}

export function subscribeReopen(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
