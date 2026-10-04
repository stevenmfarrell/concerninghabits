import { cadenceProgress, cadenceStatus, NO_CADENCE, parseCadence, type Cadence } from './cadence';
import type { HabitListItem } from './types';

// A category as the Agenda page needs it: its cadence, and its habits with their recent entries
interface CategoryWithHabits {
  id: string;
  name: string;
  icon: string | null;
  cadence: string;
  habits: HabitListItem[];
}

export interface CategoryTree extends CategoryWithHabits {
  children: CategoryWithHabits[];
}

// A category with a cadence on the Agenda page, with every habit counting toward it (a top-level
// category's subcategories' habits included), for its calendar
export interface DueCategory {
  id: string;
  name: string;
  icon: string | null;
  // The parent's name, for a subcategory
  parentName?: string;
  cadence: Cadence;
  habits: HabitListItem[];
}

// Something done for now that's due again soon, in `dueInDays` days
export type Upcoming<T> = { item: T; dueInDays: number };

export interface DueList {
  dueHabits: HabitListItem[];
  upcomingHabits: Upcoming<HabitListItem>[];
  doneHabits: HabitListItem[];
  dueCategories: DueCategory[];
  upcomingCategories: Upcoming<DueCategory>[];
  doneCategories: DueCategory[];
  // How far along each due habit that takes more than one entry is, by habit id, e.g. 3 of 4 today
  progress: Record<string, { done: number; needed: number }>;
}

// What the Agenda page shows: every habit and category with a cadence, split into those due, those
// done but due again soon (upcoming), and those done for now (see cadenceStatus), in the order of
// the user's category tree (uncategorized habits last).
// Done-ness counts everyone's entries, so a shared habit is done when anyone does it.
//
// A habit's `logs` only reach back a few weeks; `latestLogDates` (when each habit was last logged)
// fills in for an every-N-days cadence whose last entry is older than that.
export function buildDueList(
  categories: CategoryTree[],
  uncategorized: HabitListItem[],
  latestLogDates: Record<string, Date>,
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now = new Date(),
): DueList {
  const entryDates = (habit: HabitListItem) => {
    const dates = (habit.logs ?? []).map(l => new Date(l.createdAt));
    const latest = latestLogDates[habit.id];
    if (latest && !dates.some(d => d.getTime() === new Date(latest).getTime())) dates.push(new Date(latest));
    return dates;
  };

  const list: DueList = { dueHabits: [], upcomingHabits: [], doneHabits: [], dueCategories: [], upcomingCategories: [], doneCategories: [], progress: {} };

  const addHabit = (habit: HabitListItem) => {
    const cadence = parseCadence(habit.cadence);
    if (cadence.type === 'none') return;
    const dates = entryDates(habit);
    const status = cadenceStatus(cadence, dates, user, now);
    if (status.state === 'due') {
      list.dueHabits.push(habit);
      const progress = cadenceProgress(cadence, dates, user, now);
      if (progress) list.progress[habit.id] = progress;
    }
    else if (status.state === 'upcoming') list.upcomingHabits.push({ item: habit, dueInDays: status.dueInDays });
    else list.doneHabits.push(habit);
  };

  const addCategory = (category: CategoryWithHabits, habits: HabitListItem[], parentName?: string) => {
    const cadence = parseCadence(category.cadence, NO_CADENCE);
    if (cadence.type === 'none') return;
    const item: DueCategory = { id: category.id, name: category.name, icon: category.icon, parentName, cadence, habits };
    const status = cadenceStatus(cadence, habits.flatMap(entryDates), user, now);
    if (status.state === 'due') list.dueCategories.push(item);
    else if (status.state === 'upcoming') list.upcomingCategories.push({ item, dueInDays: status.dueInDays });
    else list.doneCategories.push(item);
  };

  for (const category of categories) {
    addCategory(category, [...category.habits, ...category.children.flatMap(child => child.habits)]);
    category.habits.forEach(addHabit);
    for (const child of category.children) {
      addCategory(child, child.habits, category.name);
      child.habits.forEach(addHabit);
    }
  }
  uncategorized.forEach(addHabit);

  return list;
}
