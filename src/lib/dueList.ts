import { DEFAULT_CADENCE, evaluate, NO_CADENCE, parseCadence, skipLabels, type Cadence, type CadenceSnapshot, type CadenceUser, type LimitStatus, type ProgressPeriod } from './cadence';
import type { HabitListItem } from './types';
import { consistency as consistencyOf, type Consistency } from './consistency';

// A category as the Agenda page needs it: its cadence, and its habits with their recent entries
interface CategoryWithHabits {
  id: string;
  name: string;
  icon: string | null;
  cadence: string;
  // Its place among its parent's direct habits and subcategories, which share one order sequence
  order?: number | null;
  habits: HabitListItem[];
  // The days it was skipped, as civil day keys (see CategorySkip)
  skips?: { day: string }[];
}

export interface CategoryTree extends CategoryWithHabits {
  children: CategoryWithHabits[];
}

// What a row shows: how far along it is toward done, in the ring that logs it (see LogRing), and
// for one that counts down or is due by the end of its week or month, how far off it's due, beside its calendar (see RowStatus). On the Agenda
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
  // positive before then, 0 on the day, negative once overdue. For a weekly or monthly one not done
  // yet, days left after today in its week or month. (See CadenceSnapshot.)
  dueInDays: number | null;
  // For an Agenda habit that can be skipped now, what that's called, e.g. "Skip today" and
  // "Skipped today", or "Postpone 2 days", for swiping it away (see skipLabels)
  skip?: { skip: string; skipped: string; postpones: boolean };
  // On the Habits pages, how consistently it's been kept up lately (see consistency); null for one
  // with no cadence. Not on the Agenda, which is for what to do today.
  consistency?: Consistency | null;
  // For a limit, how much of it this period has used (`done` and `needed` are the same, for the
  // ring), and whether a skip excuses the period (see LimitStatus)
  limit?: { used: number; max: number; excused: boolean };
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
  // The days it was skipped, as civil day keys, for its calendar
  skippedDays: string[];
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

// The days a habit or category was skipped, as civil day keys
export const skippedDaysOf = (item: { skips?: { day: string }[] }): string[] => (item.skips ?? []).map(s => s.day);

// A limit's row: how much of it is used, in its ring as well
function limitRowStatus({ used, max, period, excused }: LimitStatus): RowStatus {
  return { done: used, needed: max, period, dueInDays: null, limit: { used, max, excused } };
}

// A row's status on the Habits pages, which list everything, done or not: done once its cadence is
// met for now (an every-N-days one until it's due again), or for a habit with no cadence (`habit`),
// once it has an entry today. A category with no cadence is never done. `skippedDays`, a habit's or
// a category's own, count toward its cadence (see evaluate); with no cadence, there's nothing to skip.
// With when it was created (`createdAt`), it says how consistently it's been kept up too, from
// `dates` reaching back CONSISTENCY_HISTORY_WEEKS.

export function listRowStatus(
  cadence: Cadence,
  dates: Date[],
  user: CadenceUser,
  { habit, skippedDays = [], createdAt }: { habit: boolean; skippedDays?: string[]; createdAt?: Date },
  now = new Date(),
): RowStatus {
  const consistency = createdAt ? { consistency: consistencyOf(cadence, dates, user, { createdAt, skippedDays }, now) } : {};
  const snapshot = evaluate(cadence, dates, user, now, skippedDays);
  if (snapshot.kind === 'limit') return { ...limitRowStatus(snapshot.limit), ...consistency };
  if (snapshot.kind === 'none') {
    if (!habit) return { done: 0, needed: 0, period: null, dueInDays: null, ...consistency };
    return { ...listRowStatus(DEFAULT_CADENCE, dates, user, { habit }, now), ...consistency };
  }
  const { status } = snapshot;
  // Upcoming only because a skip or vacation put it off isn't done, as on the Agenda
  const done = status.state === 'done' || (status.state === 'upcoming' && !snapshot.postponed);
  return {
    ...(snapshot.progress ?? { done: done ? 1 : 0, needed: 1, period: null }),
    dueInDays: snapshot.dueInDays,
    ...consistency,
  };
}

// Something not due yet that will be in `dueInDays` days: done, but due again soon, or a weekly or
// monthly one with days left to do it in (see onAgenda)
export type Upcoming<T> = { item: T; dueInDays: number };

export interface DueList {
  dueHabits: HabitListItem[];
  upcomingHabits: Upcoming<HabitListItem>[];
  // Recently Logged: habits logged lately (any, with a cadence or not) that aren't due or upcoming,
  // and categories done for now, or skipped (see buildDueList)
  recentHabits: HabitListItem[];
  dueCategories: DueCategory[];
  upcomingCategories: Upcoming<DueCategory>[];
  recentCategories: DueCategory[];
  // Limits (see LimitStatus), which are never due: always listed, with how much of each is used
  limitHabits: HabitListItem[];
  limitCategories: DueCategory[];
  // What each due, upcoming, or limit habit's row shows beside its calendar, by habit id
  statuses: Record<string, RowStatus>;
  // The recent habits and categories that are only there because they were skipped, for their chips
  // to say so
  skippedHabitIds: string[];
  skippedCategoryIds: string[];
  // Whether anything due at the start of today has since been done, so an empty Due Now was earned
  // rather than just having nothing in it. Skipping something doesn't earn it.
  clearedToday: boolean;
  // Whether any habit or category has a cadence (a limit's included). Without one, nothing ever comes
  // due, which an empty Due Now says, since a new habit's cadence is easy to leave unset.
  anyCadence: boolean;
}

// The most Recently Logged chips the Agenda shows
export const MAX_RECENT = 8;

// What the Agenda page shows: every habit and category with a cadence, split into those due,
// those not due yet but soon (upcoming), limits (always listed, never due), and what was recently
// logged: habits that aren't due or
// upcoming (those done for now, and those with no cadence, which are never due), and categories done
// for now. All in the order of the user's category tree (uncategorized habits last). Only the
// MAX_RECENT logged most recently are recent, by their latest entry, or for one done because it was
// skipped, as if just now, since that was today; one never logged isn't.
// Done-ness counts everyone's entries, so a shared habit is done when anyone does it.
//
// A habit's `logs` only reach back a few weeks; `latestLogDates` (when each habit was last logged)
// fills in for an every-N-days cadence whose last entry is older than that.
export function buildDueList(
  categories: CategoryTree[],
  uncategorized: HabitListItem[],
  latestLogDates: Record<string, Date>,
  user: CadenceUser,
  now = new Date(),
): DueList {
  const datesOf = (habit: HabitListItem) => entryDates(habit, latestLogDates);

  const list: DueList = { dueHabits: [], upcomingHabits: [], recentHabits: [], dueCategories: [], upcomingCategories: [], recentCategories: [], limitHabits: [], limitCategories: [], statuses: {}, skippedHabitIds: [], skippedCategoryIds: [], clearedToday: false, anyCadence: false };

  // A due or upcoming row's status, with what a skip's called if it can be skipped now (for
  // swiping it away)
  const rowStatus = (cadence: Cadence, snapshot: CadenceSnapshot): RowStatus => ({
    ...(snapshot.progress ?? { done: 0, needed: 1, period: null }),
    dueInDays: snapshot.dueInDays,
    ...(snapshot.skip?.skippedDay === null ? { skip: skipLabels(cadence)! } : {}),
  });

  // Where a habit or category goes on the Agenda, and whether it's done only because it was skipped
  // (a skip of its own). One left off for the viewer's vacation (see onVacation) goes nowhere. Doing
  // something due at the start of today earns the cleared reward; skipping it doesn't.
  const place = (snapshot: CadenceSnapshot) => {
    const skipped = !!snapshot.skip?.skippedDay;
    if (snapshot.agenda.state !== 'due' && !skipped && !snapshot.onVacation && snapshot.dueAtStartOfDay) list.clearedToday = true;
    return { status: snapshot.agenda, skipped };
  };

  // When each recent habit or category was last logged, by id, to keep only the latest
  const doneAt = new Map<string, number>();
  const lastDone = (dates: Date[], skipped: boolean) => (skipped ? Infinity : Math.max(-Infinity, ...dates.map(d => d.getTime())));

  const addHabit = (habit: HabitListItem) => {
    const cadence = parseCadence(habit.cadence);
    const dates = datesOf(habit);
    const snapshot = evaluate(cadence, dates, user, now, skippedDaysOf(habit));
    if (snapshot.kind !== 'none') list.anyCadence = true;
    if (snapshot.kind === 'limit') {
      list.limitHabits.push(habit);
      list.statuses[habit.id] = limitRowStatus(snapshot.limit);
      return;
    }
    if (snapshot.kind === 'none') {
      if (dates.length > 0) {
        list.recentHabits.push(habit);
        doneAt.set(habit.id, lastDone(dates, false));
      }
      return;
    }
    if (snapshot.onVacation) return;
    const { status, skipped } = place(snapshot);
    if (status.state === 'done') {
      list.recentHabits.push(habit);
      doneAt.set(habit.id, lastDone(dates, skipped));
      if (skipped) list.skippedHabitIds.push(habit.id);
      return;
    }
    if (status.state === 'due') list.dueHabits.push(habit);
    else list.upcomingHabits.push({ item: habit, dueInDays: status.dueInDays });
    list.statuses[habit.id] = rowStatus(cadence, snapshot);
  };

  // `children` is a top-level category's subcategories, whose habits count toward it too
  const addCategory = (category: CategoryWithHabits, children: CategoryWithHabits[] = []) => {
    const cadence = parseCadence(category.cadence, NO_CADENCE);
    if (cadence.type === 'none') return;
    list.anyCadence = true;
    const habits = [...category.habits, ...children.flatMap(child => child.habits)];
    const sections = pickerSections(category.habits, children);
    const item: DueCategory = { id: category.id, name: category.name, icon: category.icon, cadence, habits, sections, skippedDays: skippedDaysOf(category) };
    const dates = habits.flatMap(datesOf);
    const snapshot = evaluate(cadence, dates, user, now, item.skippedDays);
    if (snapshot.kind === 'limit') {
      list.limitCategories.push({ ...item, status: limitRowStatus(snapshot.limit) });
      return;
    }
    if (snapshot.onVacation) return;
    const { status, skipped } = place(snapshot);
    if (status.state === 'due') list.dueCategories.push({ ...item, status: rowStatus(cadence, snapshot) });
    else if (status.state === 'upcoming') list.upcomingCategories.push({ item: { ...item, status: rowStatus(cadence, snapshot) }, dueInDays: status.dueInDays });
    else {
      list.recentCategories.push(item);
      doneAt.set(category.id, lastDone(dates, skipped));
      if (skipped) list.skippedCategoryIds.push(category.id);
    }
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

  // The latest logged, kept in the tree's order (ties go to the one first in it)
  if (doneAt.size > MAX_RECENT) {
    const order = [...doneAt.keys()];
    const kept = new Set(order.map((id, i) => ({ id, i, at: doneAt.get(id)! })).sort((a, b) => b.at - a.at || a.i - b.i).slice(0, MAX_RECENT).map(d => d.id));
    list.recentHabits = list.recentHabits.filter(h => kept.has(h.id));
    list.recentCategories = list.recentCategories.filter(c => kept.has(c.id));
    list.skippedHabitIds = list.skippedHabitIds.filter(id => kept.has(id));
    list.skippedCategoryIds = list.skippedCategoryIds.filter(id => kept.has(id));
  }

  return list;
}
