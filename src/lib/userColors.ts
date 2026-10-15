// Colors that tell people apart on a shared habit's history. They're relative to the viewer: you
// are always green (the app's usual "done" color), and everyone else gets the other colors in
// account creation order, so each person keeps the same color across every habit you look at.
const VIEWER_COLOR = '#10b981'; // emerald-500
const OTHER_COLORS = [
  '#0ea5e9', // sky-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#8b5cf6', // violet-500
  '#f97316', // orange-500
  '#0891b2', // cyan-600
  '#d946ef', // fuchsia-500
] as const;

// What someone who logged an entry is called to a viewer who can't see their name (see
// visibleUsers): they've left the habit, and the viewer isn't connected with them
export const FORMER_MEMBER = 'Former member';

export interface Person {
  id: string;
  name: string;
  color: string;
}

// Whether a habit's calendars are colored by person: it's shared now, or it still has entries from
// someone other than the owner (who has since been unshared or removed it).
export function isSharedHabit(ownerId: string, memberCount: number, logs: { userId: string }[]) {
  return memberCount > 1 || logs.some(log => log.userId !== ownerId);
}

// `users` must be in account creation order, so adding a user never changes anyone else's color.
export function assignUserColors(users: { id: string; name: string }[], viewerId: string): Record<string, Person> {
  let othersSeen = 0;
  return Object.fromEntries(
    users.map(user => {
      const color = user.id === viewerId ? VIEWER_COLOR : OTHER_COLORS[othersSeen++ % OTHER_COLORS.length];
      return [user.id, { id: user.id, name: user.name, color }];
    })
  );
}
