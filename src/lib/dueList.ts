import { cadencePeriod, cadenceProgress, cadenceStatus, daysUntilDue, NO_CADENCE, parseCadence, type Cadence, type CadenceProgress, type ProgressPeriod } from './cadence';
import type { HabitListItem } from './types';

// A category as the Agenda page needs it: its cadence, and its habits with their recent entries
interface CategoryWithHabits {
  id: string;
  name: string;
  icon: string | null;
  cadence: string;
  // Its place among its parent's direct habits and subcategories, which share one order sequence
  order?: number | null;
  habits: HabitListItem[];
}

export interface CategoryTree extends CategoryWithHabits {
  children: CategoryWithHabits[];
}

// What a due or upcoming row shows beside its calendar (see RowStatus): how far along it is toward
// done, for a cadence that takes several entries (e.g. 2 of 3 this week); the period, for one done
// with a single entry a day, week, or month (e.g. "weekly"); or how many days until it's due, for
// one that counts down (every N days) and has been done before: positive before then, 0 on the
// day, negative once overdue
export type RowStatus =
  | ({ kind: 'progress' } & CadenceProgress)
  | { kind: 'period'; period: ProgressPeriod }
  | { kind: 'dueIn'; days: number };

// A category with a cadence on the Agenda page, with every habit counting toward it (a top-level
// category's subcategories' habits included), for its calendar
export interface DueCategory {
  id: string;
  name: string;
  icon: string | null;
  cadence: Cadence;
  habits: HabitListItem[];
  // When it's due or upcoming, what its row shows beside its calendar
  status?: RowStatus;
  // The same habits laid out to pick one to log from (see pickerSections)
  sections: PickerSection[];
}

// A run of a category's own habits (`subcategory` null), or one subcategory's habits under its name
export interface PickerSection {
  subcategory: { id: string; name: string; icon: string | null } | null;
  habits: HabitListItem[];
}

// A category's habits as its page orders them, for picking one: its own habits and its subcategories
// share one order sequence (habits first on ties), so its own habits can come before, between or
// after the subcategories. Consecutive own habits make one section; a subcategory with no habits
// makes none.
export function pickerSections(habits: HabitListItem[], children: CategoryWithHabits[]): PickerSection[] {
  const items = [
    ...habits.map(habit => ({ order: habit.order ?? 0, habit, child: null })),
    ...children.map(child => ({ order: child.order ?? 0, habit: null, child })),
  ].sort((a, b) => a.order - b.order);

  const sections: PickerSection[] = [];
  for (const { habit, child } of items) {
    if (habit) {
      const last = sections[sections.length - 1];
      if (last && !last.subcategory) last.habits.push(habit);
      else sections.push({ subcategory: null, habits: [habit] });
    } else if (child && child.habits.length > 0) {
      sections.push({ subcategory: { id: child.id, name: child.name, icon: child.icon }, habits: child.habits });
    }
  }
  return sections;
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
  // What each due or upcoming habit's row shows beside its calendar, by habit id
  statuses: Record<string, RowStatus>;
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

  const list: DueList = { dueHabits: [], upcomingHabits: [], doneHabits: [], dueCategories: [], upcomingCategories: [], doneCategories: [], statuses: {} };

  const rowStatus = (cadence: Cadence, dates: Date[]): RowStatus | undefined => {
    const progress = cadenceProgress(cadence, dates, user, now);
    if (progress) return { kind: 'progress', ...progress };
    const period = cadencePeriod(cadence);
    if (period) return { kind: 'period', period };
    const days = daysUntilDue(cadence, dates, user, now);
    return days === null ? undefined : { kind: 'dueIn', days };
  };

  const addHabit = (habit: HabitListItem) => {
    const cadence = parseCadence(habit.cadence);
    if (cadence.type === 'none') return;
    const dates = entryDates(habit);
    const status = cadenceStatus(cadence, dates, user, now);
    if (status.state === 'done') {
      list.doneHabits.push(habit);
      return;
    }
    if (status.state === 'due') list.dueHabits.push(habit);
    else list.upcomingHabits.push({ item: habit, dueInDays: status.dueInDays });
    const shown = rowStatus(cadence, dates);
    if (shown) list.statuses[habit.id] = shown;
  };

  // `children` is a top-level category's subcategories, whose habits count toward it too
  const addCategory = (category: CategoryWithHabits, children: CategoryWithHabits[] = []) => {
    const cadence = parseCadence(category.cadence, NO_CADENCE);
    if (cadence.type === 'none') return;
    const habits = [...category.habits, ...children.flatMap(child => child.habits)];
    const sections = pickerSections(category.habits, children);
    const item: DueCategory = { id: category.id, name: category.name, icon: category.icon, cadence, habits, sections };
    const dates = habits.flatMap(entryDates);
    const status = cadenceStatus(cadence, dates, user, now);
    if (status.state === 'due') list.dueCategories.push({ ...item, status: rowStatus(cadence, dates) });
    else if (status.state === 'upcoming') list.upcomingCategories.push({ item: { ...item, status: rowStatus(cadence, dates) }, dueInDays: status.dueInDays });
    else list.doneCategories.push(item);
  };

  for (const category of categories) {
    addCategory(category, category.children);
    category.habits.forEach(addHabit);
    for (const child of category.children) {
      addCategory(child);
      child.habits.forEach(addHabit);
    }
  }
  uncategorized.forEach(addHabit);

  return list;
}
