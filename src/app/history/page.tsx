import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCategoriesWithHierarchy, getDayEntries, getDefaultUser, getUncategorizedHabits } from '../actions/db';
import Icon from '@/components/Icon';
import EmptyState from '@/components/EmptyState';
import { IconLinkButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/Button';
import { fieldTitle, parseHabitSchema, type HabitFormProperties } from '@/components/widgets/habitForm';
import { civilDayKey, parseBedtimeOffsetMinutes, parseCivilDayKey, toCivilDate } from '@/lib/timezone';
import { formatLogValue } from '@/lib/format';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';

type DayEntry = Awaited<ReturnType<typeof getDayEntries>>[number];
type DayHabit = { id: string; name: string; schema: string };

function shiftDay(day: Date, days: number) {
  const shifted = new Date(day);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

// Today's page is plain /history, so it stays a stable link (e.g. from the bottom nav)
function dayHref(day: Date, today: Date) {
  return civilDayKey(day) === civilDayKey(today) ? '/history' : `/history?day=${civilDayKey(day)}`;
}

// An entry's values as a line, e.g. "Distance 3 miles · Time 25:00", or null when it has none
function summarize(payload: Record<string, unknown>, properties: HabitFormProperties | undefined) {
  const parts = Object.entries(payload)
    .filter(([, val]) => val !== undefined && val !== null && val !== '')
    .map(([key, val]) => `${fieldTitle(key, properties)} ${formatLogValue(val, properties?.[key])}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// The habits a day's entries were for, by category: each category's own habits, then each
// subcategory's, leaving out any with nothing logged that day
function groupByCategory(
  categories: Awaited<ReturnType<typeof getCategoriesWithHierarchy>>,
  uncategorized: Awaited<ReturnType<typeof getUncategorizedHabits>>,
  entriesByHabit: Map<string, DayEntry[]>,
) {
  const done = (habits: DayHabit[]) => habits.filter(h => entriesByHabit.has(h.id));
  const groups = categories.map(category => ({
    id: category.id,
    name: category.name,
    icon: category.icon || 'Folder',
    sections: [
      { id: category.id, name: null as string | null, habits: done(category.habits) },
      ...category.children.map(child => ({ id: child.id, name: child.name as string | null, habits: done(child.habits) })),
    ].filter(section => section.habits.length > 0),
  }));
  groups.push({
    id: UNCATEGORIZED_ID,
    name: 'Uncategorized',
    icon: UNCATEGORIZED_ICON,
    sections: [{ id: UNCATEGORIZED_ID, name: null, habits: done(uncategorized) }].filter(section => section.habits.length > 0),
  });
  return groups.filter(group => group.sections.length > 0);
}

// History: what the user did on a day, by category, with each entry's time and values. Today by
// default (by the user's bedtime), or an earlier day from `?day=YYYY-MM-DD`. Read only; each habit
// links to its page, which is where entries are logged and removed.
export default async function HistoryPage(props: { searchParams: Promise<{ day?: string }> }) {
  const { day: dayParam } = await props.searchParams;
  const user = await getDefaultUser();

  const today = toCivilDate(new Date(), user.timeZone, parseBedtimeOffsetMinutes(user.bedtime));
  const requested = parseCivilDayKey(dayParam);
  // Days ahead of today have nothing to show, so anything else shows today
  const day = requested && requested <= today ? requested : today;
  const dayKey = civilDayKey(day);
  const isToday = dayKey === civilDayKey(today);

  const [categories, uncategorized, entries] = await Promise.all([
    getCategoriesWithHierarchy(),
    getUncategorizedHabits(),
    getDayEntries(dayKey),
  ]);

  const entriesByHabit = new Map<string, DayEntry[]>();
  for (const entry of entries) entriesByHabit.set(entry.habitId, [...(entriesByHabit.get(entry.habitId) ?? []), entry]);
  const groups = groupByCategory(categories, uncategorized, entriesByHabit);
  const anyHabits = uncategorized.length > 0 || categories.some(c => c.habits.length > 0 || c.children.some(child => child.habits.length > 0));
  const habitCount = groups.reduce((acc, g) => acc + g.sections.reduce((n, s) => n + s.habits.length, 0), 0);

  const daysAgo = Math.round((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
  const dayLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : day.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const dateLabel = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-stone-500 font-semibold text-sm uppercase tracking-wider mb-1">{dateLabel}</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">{dayLabel}</h1>
            <p className="text-sm text-stone-500 mt-1">
              {habitCount} {habitCount === 1 ? 'habit' : 'habits'} done
              {entries.length > habitCount && ` · ${entries.length} entries`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <IconLinkButton href={dayHref(shiftDay(day, -1), today)} title="Previous day" aria-label="Previous day">
              <ChevronLeft className="w-6 h-6" />
            </IconLinkButton>
            {isToday ? (
              <span className="p-2 -mr-2 text-stone-200" aria-hidden="true">
                <ChevronRight className="w-6 h-6" />
              </span>
            ) : (
              <IconLinkButton href={dayHref(shiftDay(day, 1), today)} title="Next day" aria-label="Next day" edge="right">
                <ChevronRight className="w-6 h-6" />
              </IconLinkButton>
            )}
          </div>
        </div>

        {!anyHabits ? (
          <EmptyState title="No habits here yet" action={<LinkButton href="/create" variant="outline">New Habit</LinkButton>}>
            Once you have habits, what you log each day shows up here.
          </EmptyState>
        ) : groups.length === 0 ? (
          <EmptyState title={isToday ? 'Nothing logged yet today' : 'Nothing logged on this day'}>
            {isToday ? 'Log a habit from the Agenda or Habits page and it shows up here.' : 'Use the arrows above to look at another day.'}
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <section key={group.id} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                <div className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-blue-50/50 border-b border-stone-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Icon name={group.icon} className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-semibold text-stone-800">{group.name}</h2>
                </div>
                {group.sections.map(section => (
                  <div key={section.id}>
                    {section.name && (
                      <p className="px-4 sm:px-6 pt-3 text-xs font-semibold uppercase tracking-wider text-stone-500">{section.name}</p>
                    )}
                    <ul className="divide-y divide-stone-100">
                      {section.habits.map(habit => (
                        <HabitDay key={habit.id} habit={habit} entries={entriesByHabit.get(habit.id)!} timeZone={user.timeZone} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// One habit's entries on the day, oldest first, each with its time and any values. Links to the
// habit's page.
function HabitDay({ habit, entries, timeZone }: { habit: DayHabit; entries: DayEntry[]; timeZone: string }) {
  const properties = parseHabitSchema(habit.schema).properties as HabitFormProperties | undefined;

  return (
    <li>
      <Link href={`/log/${habit.id}`} className="flex items-start gap-3 px-4 sm:px-6 py-3 hover:bg-stone-50 transition-colors group/row">
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-semibold text-stone-800 group-hover/row:text-emerald-600 transition-colors truncate">
            {habit.name}
            {entries.length > 1 && <span className="ml-2 text-sm font-medium text-stone-400">×{entries.length}</span>}
          </h3>
          {entries.map(entry => {
            const values = summarize(entry.payload, properties);
            return (
              <p key={entry.id} className="text-sm text-stone-500">
                <span className="tabular-nums">
                  {new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })}
                </span>
                {values && <span className="text-stone-700"> · {values}</span>}
              </p>
            );
          })}
        </div>
        <ChevronRight className="w-5 h-5 mt-0.5 text-stone-300 group-hover/row:text-emerald-600 transition-colors shrink-0" />
      </Link>
    </li>
  );
}
