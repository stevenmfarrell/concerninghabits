import { getCategoriesWithHierarchy, getDefaultUser, getUncategorizedHabits } from '../actions/db';
import Link from 'next/link';
import { Plus, Settings2 } from 'lucide-react';
import CategoryRow from '@/components/CategoryRow';
import { LinkButton } from '@/components/ui/Button';
import EmptyState from '@/components/EmptyState';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { describeCadence, NO_CADENCE, parseCadence } from '@/lib/cadence';

// Habits: every category (and uncategorized habits) to browse, with recent activity. What's due
// lives on the Agenda page; this is where everything else is found.
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
    });

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

        {/* Shown even with no categories yet, for its Manage Categories link */}
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
          {categoryRows.length === 0 && uncategorized.length === 0 ? (
            <EmptyState title="No habits here yet" action={<LinkButton href="/create" variant="outline">New Habit</LinkButton>}>
              Add a habit, or tap the quill on the Agenda page and tell it something you did.
            </EmptyState>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
              {/* Empty categories too, so they can be found and given habits */}
              {categoryRows.map(cat => (
                <CategoryRow
                  key={cat.id}
                  href={`/categories/${cat.id}`}
                  name={cat.name}
                  icon={cat.icon}
                  dates={cat.dates}
                  habitCount={cat.habitCount}
                  subtitle={`${cat.habitCount} ${cat.habitCount === 1 ? 'habit' : 'habits'}${cat.cadence.type !== 'none' ? ` · ${describeCadence(cat.cadence)}` : ''}`}
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
                  subtitle={`${uncategorized.length} ${uncategorized.length === 1 ? 'habit' : 'habits'}`}
                  cadence={NO_CADENCE}
                  bedtime={user.bedtime}
                  weekStartsOn={user.weekStartsOn}
                  timeZone={user.timeZone}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
