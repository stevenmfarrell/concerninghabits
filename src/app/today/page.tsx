import { getCategoriesWithHierarchy, getDayEntries, getDefaultUser, getUncategorizedHabits } from '../actions/db';
import { civilDayKey, parseBedtimeOffsetMinutes, parseCivilDayKey, toCivilDate } from '@/lib/timezone';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import TodayClient, { type DayGroup, type DayHabit } from './TodayClient';

const toDayHabit = ({ id, name, schema, frequency }: DayHabit): DayHabit => ({ id, name, schema, frequency });

function shiftDay(day: Date, days: number) {
  const shifted = new Date(day);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

// Today's page is plain /today, so it stays a stable link (e.g. from the bottom nav)
function dayHref(day: Date, today: Date) {
  return civilDayKey(day) === civilDayKey(today) ? '/today' : `/today?day=${civilDayKey(day)}`;
}

// "Log the day": every habit as a chip, by category, to check off what was done on a day. Today by
// default (by the user's bedtime), or an earlier day from `?day=YYYY-MM-DD`.
export default async function LogTheDayPage(props: { searchParams: Promise<{ day?: string }> }) {
  const { day: dayParam } = await props.searchParams;
  const user = await getDefaultUser();

  const today = toCivilDate(new Date(), user.timeZone, parseBedtimeOffsetMinutes(user.bedtime));
  const requested = parseCivilDayKey(dayParam);
  // Days ahead of today can't be logged, so anything else shows today
  const day = requested && requested <= today ? requested : today;
  const dayKey = civilDayKey(day);
  const isToday = dayKey === civilDayKey(today);

  const [categories, uncategorized, entries] = await Promise.all([
    getCategoriesWithHierarchy(),
    getUncategorizedHabits(),
    getDayEntries(dayKey),
  ]);

  // Each category with its own habits first, then each subcategory's; empty ones are left out
  const groups: DayGroup[] = categories
    .map(category => ({
      id: category.id,
      name: category.name,
      icon: category.icon || 'Folder',
      sections: [
        { id: category.id, name: null, habits: category.habits.map(toDayHabit) },
        ...category.children.map(child => ({ id: child.id, name: child.name, habits: child.habits.map(toDayHabit) })),
      ].filter(section => section.habits.length > 0),
    }))
    .filter(group => group.sections.length > 0);
  if (uncategorized.length > 0) {
    groups.push({
      id: UNCATEGORIZED_ID,
      name: 'Uncategorized',
      icon: UNCATEGORIZED_ICON,
      sections: [{ id: UNCATEGORIZED_ID, name: null, habits: uncategorized.map(toDayHabit) }],
    });
  }

  const daysAgo = Math.round((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
  const dayLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : day.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      {/* Keyed by day so switching days starts from that day's entries, not the previous day's */}
      <TodayClient
        key={dayKey}
        dayKey={dayKey}
        isToday={isToday}
        dayLabel={dayLabel}
        dateLabel={day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
        prevDayHref={dayHref(shiftDay(day, -1), today)}
        nextDayHref={isToday ? null : dayHref(shiftDay(day, 1), today)}
        timeZone={user.timeZone}
        groups={groups}
        initialEntries={entries}
      />
    </main>
  );
}
