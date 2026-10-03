import { getCategoriesWithHierarchy, getDefaultUser, getLatestLogDates, getPeople, getUncategorizedHabits } from './actions/db';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Icon from '../components/Icon';
import { SortableHabitList } from './categories/[id]/SortableLists';
import SmartEntry from './SmartEntry';
import { describeCadence } from '@/lib/cadence';
import { buildDueList, type DueCategory } from '@/lib/dueList';
import { parseBedtimeOffsetMinutes, toCivilDate } from '@/lib/timezone';
import type { HabitListItem } from '@/lib/types';

// A category with a cadence that's due: its name and cadence, linking to its page, with its habits
// below to log from (any of them counts)
function DueCategoryCard({ category, user, people }: { category: DueCategory } & Pick<Parameters<typeof SortableHabitList>[0], 'user' | 'people'>) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
      <Link href={`/categories/${category.id}`} className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-blue-50/50 hover:bg-blue-50 border-b border-stone-100 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <Icon name={category.icon || 'Folder'} className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-stone-800 truncate">
            {category.parentName && <span className="text-stone-500 font-medium">{category.parentName} › </span>}
            {category.name}
          </h3>
          <p className="text-xs text-stone-500">{describeCadence(category.cadence)}: any of these counts</p>
        </div>
      </Link>
      {category.habits.length > 0 ? (
        <SortableHabitList items={category.habits} user={user} people={people} dndContextId={`due-category-${category.id}`} isNested />
      ) : (
        <p className="px-4 sm:px-6 py-3 text-sm text-stone-500">No habits in this category yet.</p>
      )}
    </section>
  );
}

// What's done for now, as small chips under what's still due. They have no Log button, which is
// what keeps something done from being logged twice by accident; each links to its page, where it
// can still be logged. Links styled as chips, not buttons, so they don't use LinkButton.
function DoneChips({ habits, categories }: { habits: HabitListItem[]; categories: DueCategory[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Done">
      {categories.map(category => (
        <li key={category.id}>
          <Link
            href={`/categories/${category.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
          >
            <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
            <Icon name={category.icon || 'Folder'} className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[14rem]">{category.name}</span>
          </Link>
        </li>
      ))}
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

// Due: every habit and category with a cadence that isn't done for now, to log from, and what's
// done as chips. Habits and categories without a cadence aren't here; they're on the Habits page.
export default async function DuePage() {
  const user = await getDefaultUser();
  const [categories, uncategorized, latestLogDates, people] = await Promise.all([
    getCategoriesWithHierarchy(),
    getUncategorizedHabits(5),
    getLatestLogDates(),
    getPeople(),
  ]);

  const { dueHabits, doneHabits, dueCategories, doneCategories } = buildDueList(categories, uncategorized, latestLogDates, user);
  const anyDue = dueHabits.length > 0 || dueCategories.length > 0;
  const anyDone = doneHabits.length > 0 || doneCategories.length > 0;
  const anyHabits = uncategorized.length > 0 || categories.some(c => c.habits.length > 0 || c.children.some(child => child.habits.length > 0));

  // Today in the viewer's time zone, following the same bedtime rule as the calendars
  const today = toCivilDate(new Date(), user.timeZone, parseBedtimeOffsetMinutes(user.bedtime));

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-stone-500 font-semibold text-sm uppercase tracking-wider mb-1">
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">Due</h1>
          </div>
          <SmartEntry />
        </div>

        {!anyHabits ? (
          <div className="py-24 px-8 sm:px-12 text-center flex flex-col items-center justify-center">
            <img src="/hobbit-hole.svg" alt="Hobbit Hole" className="w-80 max-w-full h-auto opacity-10 mb-8" />
            <h2 className="text-2xl font-semibold text-stone-700 mb-2">No habits here yet</h2>
            <p className="text-base text-stone-500 max-w-sm">
              Tap the quill above and tell it something you did, or a habit you&apos;d like to start.
            </p>
          </div>
        ) : !anyDue && !anyDone ? (
          <p className="text-stone-500 text-center py-16 max-w-md mx-auto">
            Nothing has a cadence yet. Give a habit or category one on its page (in <Link href="/habits" className="text-emerald-700 underline">Habits</Link>), and it shows up here whenever it&apos;s due.
          </p>
        ) : (
          <div className="space-y-6">
            {dueHabits.length > 0 && (
              <SortableHabitList items={dueHabits} user={user} people={people} dndContextId="due-habits" />
            )}
            {dueCategories.map(category => (
              <DueCategoryCard key={category.id} category={category} user={user} people={people} />
            ))}
            {!anyDue && <p className="text-stone-500">All done for now.</p>}
            {anyDone && <DoneChips habits={doneHabits} categories={doneCategories} />}
          </div>
        )}
      </div>
    </main>
  );
}
