import { getCategoriesWithHierarchy, getDefaultUser, getFavoriteHabits, getPeople, getUncategorizedHabits } from './actions/db';
import Link from 'next/link';
import { Check, ChevronRight, Star, Settings2 } from 'lucide-react';
import Icon from '../components/Icon';
import ActivityCalendar from '../components/ActivityCalendar';
import { SortableHabitList } from './categories/[id]/SortableLists';
import SmartEntry from './SmartEntry';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { parseBedtimeOffsetMinutes, toCivilDate } from '@/lib/timezone';
import { isHabitComplete } from '@/lib/habitCompletion';
import type { HabitListItem } from '@/lib/types';

type CategoryRowProps = {
  href: string;
  name: string;
  icon: string;
  dates: Date[];
  habitCount: number;
  bedtime: string;
  weekStartsOn: string;
  timeZone: string;
};

function CategoryRow({ href, name, icon, dates, habitCount, bedtime, weekStartsOn, timeZone }: CategoryRowProps) {
  return (
    <Link
      href={href}
      className="flex items-stretch transition-colors bg-blue-50/50 hover:bg-blue-50 group/row"
    >
      <div className="flex-1 flex items-center py-4 px-4 sm:px-6 gap-3 sm:gap-6 min-w-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 transition-colors shrink-0">
            <Icon name={icon} className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-stone-800 group-hover/row:text-blue-700 transition-colors truncate">
              {name}
            </h3>
            <p className="text-sm text-stone-500">
              {habitCount} {habitCount === 1 ? 'habit' : 'habits'}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col justify-center">
          <div className="opacity-80 group-hover/row:opacity-100 transition-opacity">
            <ActivityCalendar
              dates={dates}
              weeks={3}
              frequency="multiple"
              targetCount={habitCount > 0 ? habitCount : 1}
              bedtime={bedtime}
              weekStartsOn={weekStartsOn}
              timeZone={timeZone}
              color="blue"
              emptyColor="bg-stone-200/70"
              futureColor="bg-transparent border border-stone-200"
            />
          </div>
        </div>
        <div className="shrink-0 text-stone-300 group-hover/row:text-blue-600 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </Link>
  );
}

// Favorites whose current period is already done, as small chips under the ones still to do. They
// have no Log button, which is what keeps a done habit from being logged twice by accident; each
// links to its habit's page, where it can still be logged. A link styled as a chip, not a button,
// so it doesn't use LinkButton.
function CompletedChips({ habits }: { habits: HabitListItem[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Done">
      {habits.map(habit => (
        <li key={habit.id}>
          <Link
            href={`/log/${habit.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-sm font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
            <span className="truncate max-w-[14rem]">{habit.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function Dashboard() {
  const user = await getDefaultUser();
  const [categories, favorites, uncategorized, people] = await Promise.all([
    getCategoriesWithHierarchy(),
    getFavoriteHabits(),
    getUncategorizedHabits(),
    getPeople(),
  ]);

  const categoryRows = categories
    .map(cat => {
      const habits = [...cat.habits, ...cat.children.flatMap(c => c.habits)];
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon || 'Folder',
        habitCount: habits.length,
        dates: habits.flatMap(h => h.logs.map(l => l.createdAt)),
      };
    })
    .filter(cat => cat.habitCount > 0);

  // Today in the viewer's time zone, following the same bedtime rule as the calendars
  const today = toCivilDate(new Date(), user.timeZone, parseBedtimeOffsetMinutes(user.bedtime));

  const totalHabits = categoryRows.reduce((acc, c) => acc + c.habitCount, 0) + uncategorized.length;

  // Favorites still to do this period come first, as rows to log from; done ones drop to chips.
  // Only the viewer's own entries count: on a shared habit, someone else logging it doesn't mean
  // the viewer has.
  const isDone = (habit: HabitListItem) =>
    isHabitComplete(habit, (habit.logs ?? []).filter(l => l.userId === user.id).map(l => l.createdAt), user);
  const favoritesToDo = favorites.filter(habit => !isDone(habit));
  const favoritesDone = favorites.filter(isDone);

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <p className="text-stone-500 font-semibold text-sm uppercase tracking-wider mb-1">
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              My Habits
            </h1>
          </div>
          <SmartEntry />
        </div>

        {totalHabits === 0 ? (
          <div className="py-24 px-8 sm:px-12 text-center flex flex-col items-center justify-center">
            <img src="/hobbit-hole.svg" alt="Hobbit Hole" className="w-80 max-w-full h-auto opacity-10 mb-8" />
            <h2 className="text-2xl font-semibold text-stone-700 mb-2">No habits here yet</h2>
            <p className="text-base text-stone-500 max-w-sm">
              Tap the quill above and tell it something you did, or a habit you&apos;d like to start.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {favorites.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                  <Star className="w-6 h-6 text-stone-500" />
                  <h2 className="text-2xl font-semibold text-stone-800">Favorites</h2>
                </div>
                {favoritesToDo.length > 0 ? (
                  <SortableHabitList items={favoritesToDo} user={user} people={people} dndContextId="favorites-dnd-context" />
                ) : (
                  <p className="text-stone-500">All done for now.</p>
                )}
                {favoritesDone.length > 0 && <CompletedChips habits={favoritesDone} />}
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <h2 className="text-2xl font-semibold text-stone-800">Categories</h2>
                <Link
                  href="/settings/categories"
                  className="p-2 -mr-2 text-stone-400 hover:text-emerald-600 hover:bg-stone-100 rounded-full transition-colors"
                  title="Manage Categories"
                  aria-label="Manage Categories"
                >
                  <Settings2 className="w-5 h-5" />
                </Link>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
                {categoryRows.map(cat => (
                  <CategoryRow
                    key={cat.id}
                    href={`/categories/${cat.id}`}
                    name={cat.name}
                    icon={cat.icon}
                    dates={cat.dates}
                    habitCount={cat.habitCount}
                    bedtime={user.bedtime}
                    weekStartsOn={user.weekStartsOn}
                    timeZone={user.timeZone}
                  />
                ))}
                {uncategorized.length > 0 && (
                  <CategoryRow
                    href={`/categories/${UNCATEGORIZED_ID}`}
                    name="Uncategorized"
                    icon={UNCATEGORIZED_ICON}
                    dates={uncategorized.flatMap(h => h.logs.map(l => l.createdAt))}
                    habitCount={uncategorized.length}
                    bedtime={user.bedtime}
                    weekStartsOn={user.weekStartsOn}
                    timeZone={user.timeZone}
                  />
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
