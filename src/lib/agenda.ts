import { buildDueList } from './dueList';
import type { CadenceUser } from './cadence';
import { categoriesWithHierarchyOf, latestLogDatesOf, uncategorizedHabitsOf } from './habitLists';

// What's due for a user, as the Agenda shows it, so the web app and the API agree on it. Server-only.

// How many weeks of entries the Agenda's rows load, for their 4-week calendars
const AGENDA_WEEKS = 5;

// The user's categories and uncategorized habits, with what's due, upcoming, limited and recently
// logged among them (see buildDueList). `user` needs their vacations, on whose days everything of
// theirs counts as skipped.
export async function dueListOf(user: CadenceUser & { id: string }, now = new Date()) {
  const [categories, uncategorized, latestLogDates] = await Promise.all([
    categoriesWithHierarchyOf(user.id, AGENDA_WEEKS),
    uncategorizedHabitsOf(user.id, AGENDA_WEEKS),
    latestLogDatesOf(user.id),
  ]);
  return { categories, uncategorized, ...buildDueList(categories, uncategorized, latestLogDates, user, now) };
}
