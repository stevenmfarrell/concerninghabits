import { NO_CADENCE, parseCadence, type Cadence, type CadenceUser } from './cadence';
import { summarizeCalendar, type CalendarSummary } from './calendarDays';
import { ROW_CALENDAR_WEEKS } from './calendarRange';
import { skippedDaysOf, type PickerSection } from './dueList';
import type { HabitListItem } from './types';
import { isSharedHabit } from './userColors';

// The calendars in a list's rows (the Agenda, Habits and category pages), worked out on the server.
// The page loads each habit's entries as far back as its health needs, but its row only shows four
// weeks, so the row gets those days already shaded (see summarizeCalendar) instead of the entries.

// `habit` as its row has it: its calendar in place of its entries and skips. A shared habit's days
// say who logged them, to color by person.
export function toRowHabit(habit: HabitListItem, user: CadenceUser): HabitListItem {
  const { logs = [], skips, ...rest } = habit;
  const shared = isSharedHabit(habit.userId, habit.memberCount ?? 1, logs);
  return {
    ...rest,
    calendar: summarizeCalendar({
      dates: logs.map(log => log.createdAt),
      loggedBy: shared ? logs.map(log => log.userId) : undefined,
      cadence: parseCadence(habit.cadence),
      user,
      skippedDays: skippedDaysOf({ skips }),
      since: habit.createdAt,
      weeks: ROW_CALENDAR_WEEKS,
      wholeMonths: false,
    }),
  };
}

// Each habit as its row has it (see toRowHabit), worked out once per habit, since a page can show
// one in a list and in a category's picker
export function rowHabits(user: CadenceUser) {
  const rows = new Map<string, HabitListItem>();
  return (habit: HabitListItem) => {
    if (!rows.has(habit.id)) rows.set(habit.id, toRowHabit(habit, user));
    return rows.get(habit.id)!;
  };
}

// A category's picker (see pickerSections) with its habits as their rows have them
export function rowSections(sections: PickerSection[], rowOf: (habit: HabitListItem) => HabitListItem): PickerSection[] {
  return sections.map(section => ({ ...section, habits: section.habits.map(rowOf) }));
}

// A category's row calendar, from all of `habits`' entries: shaded by its own `cadence`, with its
// skips, or with none, by how many of its habits were logged each day
export function categoryRowCalendar(habits: HabitListItem[], cadence: Cadence, user: CadenceUser, skippedDays?: string[], now = new Date()): CalendarSummary {
  return summarizeCalendar({
    dates: habits.flatMap(habit => (habit.logs ?? []).map(log => log.createdAt)),
    cadence: cadence.type === 'none' ? NO_CADENCE : cadence,
    density: cadence.type === 'none' ? habits.length : undefined,
    user,
    skippedDays: cadence.type === 'none' ? undefined : skippedDays,
    weeks: ROW_CALENDAR_WEEKS,
    wholeMonths: false,
    now,
  });
}
