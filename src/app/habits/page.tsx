import { getCategoriesWithHierarchy, getDefaultUser, getUncategorizedHabits } from '../actions/db';
import Link from 'next/link';
import { ChevronRight, Plus, Settings2 } from 'lucide-react';
import Icon from '@/components/Icon';
import ActivityCalendar from '@/components/ActivityCalendar';
import { LinkButton } from '@/components/ui/Button';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { describeCadence, NO_CADENCE, parseCadence, type Cadence } from '@/lib/cadence';

type CategoryRowProps = {
  href: string;
  name: string;
  icon: string;
  dates: Date[];
  habitCount: number;
  // The category's own cadence, or none
  cadence: Cadence;
  bedtime: string;
  weekStartsOn: string;
  timeZone: string;
};

// A category in the list: its name, how many habits it has, its cadence if it has one, and a
// calendar of its recent entries (shaded by its cadence, or by how many of its habits were logged)
function CategoryRow({ href, name, icon, dates, habitCount, cadence, bedtime, weekStartsOn, timeZone }: CategoryRowProps) {
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
              {cadence.type !== 'none' && ` · ${describeCadence(cadence)}`}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col justify-center">
          <div className="opacity-80 group-hover/row:opacity-100 transition-opacity">
            <ActivityCalendar
              dates={dates}
              weeks={3}
              {...(cadence.type === 'none' ? { density: habitCount } : { cadence })}
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

// Habits: every category (and uncategorized habits) to browse, with recent activity. What's due
// lives on the Due page; this is where everything else is found.
export default async function HabitsPage() {
  const user = await getDefaultUser();
  // Only the 3-week calendars read entries here
  const [categories, uncategorized] = await Promise.all([getCategoriesWithHierarchy(), getUncategorizedHabits(5)]);

  const categoryRows = categories
    .map(cat => {
      const habits = [...cat.habits, ...cat.children.flatMap(c => c.habits)];
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon || 'Folder',
        cadence: parseCadence(cat.cadence, NO_CADENCE),
        habitCount: habits.length,
        dates: habits.flatMap(h => h.logs.map(l => l.createdAt)),
      };
    })
    .filter(cat => cat.habitCount > 0);

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">Habits</h1>
          <LinkButton href="/create" size="sm">
            <Plus className="w-4 h-4" />
            New Habit
          </LinkButton>
        </div>

        {categoryRows.length === 0 && uncategorized.length === 0 ? (
          <p className="text-stone-500 text-center py-16">No habits yet. Add one with New Habit, or tell the quill on the Due page something you did.</p>
        ) : (
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
                  cadence={cat.cadence}
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
                  cadence={NO_CADENCE}
                  bedtime={user.bedtime}
                  weekStartsOn={user.weekStartsOn}
                  timeZone={user.timeZone}
                />
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
