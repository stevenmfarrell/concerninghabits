import { cadenceProgress, cadenceStatus, daysUntilDue, DEFAULT_CADENCE, NO_CADENCE, parseCadence, type Cadence, type ProgressPeriod } from './cadence';
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

// What a row shows: how far along it is toward done, in the ring that logs it (see LogRing), and
// for one that counts down, how far off it's due, beside its calendar (see RowStatus). On the Agenda
// that's only rows not yet done (see buildDueList); the Habits pages show every row (see listRowStatus).
export interface RowStatus {
  // Entries counting toward done for now, of how many it takes, e.g. 2 of 3 this week, or 0 or 1 of 1
  // for one done with a single entry. 0 of 0 for one that's never done (a category with no cadence),
  // whose ring stays empty.
  done: number;
  needed: number;
  // The period they're counted over, for one that takes several entries a day, week, or month
  period: ProgressPeriod | null;
  // For one that counts down (every N days) and has been done before, days until it's due:
  // positive before then, 0 on the day, negative once overdue
  dueInDays: number | null;
}

// A category with a cadence on the Agenda page, with every habit counting toward it (a top-level
// category's subcategories' habits included), for its calendar
export interface DueCategory {
  id: string;
  name: string;
  icon: string | null;
  cadence: Cadence;
  habits: HabitListItem[];
  // When it's due or upcoming, what its row shows
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

// Every entry that counts for a habit: its recent `logs`, and its latest one from `latestLogDates`
// when that's older than they reach (see buildDueList)
export function entryDates(habit: HabitListItem, latestLogDates: Record<string, Date>) {
  const dates = (habit.logs ?? []).map(l => new Date(l.createdAt));
  const latest = latestLogDates[habit.id];
  if (latest && !dates.some(d => d.getTime() === new Date(latest).getTime())) dates.push(new Date(latest));
  return dates;
}

// A row's status on the Habits pages, which list everything, done or not: done once its cadence is
// met for now (an every-N-days one until it's due again), or for a habit with no cadence (`habit`),
// once it has an entry today. A category with no cadence is never done.
export function listRowStatus(
  cadence: Cadence,
  dates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  { habit }: { habit: boolean },
  now = new Date(),
): RowStatus {
  if (cadence.type === 'none') {
    if (!habit) return { done: 0, needed: 0, period: null, dueInDays: null };
    return listRowStatus(DEFAULT_CADENCE, dates, user, { habit }, now);
  }
  const progress = cadenceProgress(cadence, dates, user, now);
  return {
    ...(progress ?? { done: cadenceStatus(cadence, dates, user, now).state === 'due' ? 0 : 1, needed: 1, period: null }),
    dueInDays: daysUntilDue(cadence, dates, user, now),
  };
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
  const datesOf = (habit: HabitListItem) => entryDates(habit, latestLogDates);

  const list: DueList = { dueHabits: [], upcomingHabits: [], doneHabits: [], dueCategories: [], upcomingCategories: [], doneCategories: [], statuses: {} };

  const rowStatus = (cadence: Cadence, dates: Date[]): RowStatus => ({
    ...(cadenceProgress(cadence, dates, user, now) ?? { done: 0, needed: 1, period: null }),
    dueInDays: daysUntilDue(cadence, dates, user, now),
  });

  const addHabit = (habit: HabitListItem) => {
    const cadence = parseCadence(habit.cadence);
    if (cadence.type === 'none') return;
    const dates = datesOf(habit);
    const status = cadenceStatus(cadence, dates, user, now);
    if (status.state === 'done') {
      list.doneHabits.push(habit);
      return;
    }
    if (status.state === 'due') list.dueHabits.push(habit);
    else list.upcomingHabits.push({ item: habit, dueInDays: status.dueInDays });
    list.statuses[habit.id] = rowStatus(cadence, dates);
  };

  // `children` is a top-level category's subcategories, whose habits count toward it too
  const addCategory = (category: CategoryWithHabits, children: CategoryWithHabits[] = []) => {
    const cadence = parseCadence(category.cadence, NO_CADENCE);
    if (cadence.type === 'none') return;
    const habits = [...category.habits, ...children.flatMap(child => child.habits)];
    const sections = pickerSections(category.habits, children);
    const item: DueCategory = { id: category.id, name: category.name, icon: category.icon, cadence, habits, sections };
    const dates = habits.flatMap(datesOf);
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
