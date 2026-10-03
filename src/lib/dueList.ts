import { isHabitComplete, NO_CADENCE, parseCadence, type Cadence } from './cadence';
import type { HabitListItem } from './types';

// A category as the Due page needs it: its cadence, and its habits with their recent entries
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

// A category with a cadence on the Due page: every habit counting toward it (a top-level
// category's subcategories' habits included), to log from
export interface DueCategory {
  id: string;
  name: string;
  icon: string | null;
  // The parent's name, for a subcategory
  parentName?: string;
  cadence: Cadence;
  habits: HabitListItem[];
}

export interface DueList {
  dueHabits: HabitListItem[];
  doneHabits: HabitListItem[];
  dueCategories: DueCategory[];
  doneCategories: DueCategory[];
}

// What the Due page shows: every habit and category with a cadence, split into those still to do
// and those done for now, in the order of the user's category tree (uncategorized habits last).
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

  const list: DueList = { dueHabits: [], doneHabits: [], dueCategories: [], doneCategories: [] };

  const addHabit = (habit: HabitListItem) => {
    const cadence = parseCadence(habit.cadence);
    if (cadence.type === 'none') return;
    (isHabitComplete(cadence, entryDates(habit), user, now) ? list.doneHabits : list.dueHabits).push(habit);
  };

  const addCategory = (category: CategoryWithHabits, habits: HabitListItem[], parentName?: string) => {
    const cadence = parseCadence(category.cadence, NO_CADENCE);
    if (cadence.type === 'none') return;
    const due: DueCategory = { id: category.id, name: category.name, icon: category.icon, parentName, cadence, habits };
    (isHabitComplete(cadence, habits.flatMap(entryDates), user, now) ? list.doneCategories : list.dueCategories).push(due);
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
