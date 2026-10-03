import { getCategoriesWithHierarchy, getDefaultUser, getLatestLogDates, getPeople, getUncategorizedHabits } from './actions/db';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Icon from '../components/Icon';
import { SortableHabitList } from './categories/[id]/SortableLists';
import SmartEntry from './SmartEntry';
import EmptyState from '@/components/EmptyState';
import CategoryRow from '@/components/CategoryRow';
import { LinkButton } from '@/components/ui/Button';
import { buildDueList, type DueCategory } from '@/lib/dueList';
import { parseBedtimeOffsetMinutes, toCivilDate } from '@/lib/timezone';
import type { HabitListItem, SessionUser } from '@/lib/types';

// When something upcoming is due again
const dueLabel = (dueInDays: number) => (dueInDays === 1 ? 'Due tomorrow' : `Due in ${dueInDays} days`);

// Categories with a cadence that are due or upcoming, as rows linking to their pages (where their
// habits are, to log one), each with a calendar of its recent entries like a habit's
function CategoryList({ categories, user }: { categories: { category: DueCategory; note?: string }[]; user: SessionUser }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
      {categories.map(({ category, note }) => (
        <CategoryRow
          key={category.id}
          href={`/categories/${category.id}`}
          name={category.parentName ? `${category.parentName} › ${category.name}` : category.name}
          icon={category.icon || 'Folder'}
          subtitle={note}
          dates={category.habits.flatMap(h => (h.logs ?? []).map(l => l.createdAt))}
          habitCount={category.habits.length}
          cadence={category.cadence}
          bedtime={user.bedtime}
          weekStartsOn={user.weekStartsOn}
          timeZone={user.timeZone}
        />
      ))}
    </div>
  );
}

// What's done for now, as small chips. They have no Log button, which is
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

function SectionHeading({ children }: { children: string }) {
  return <h2 className="text-xl font-semibold text-stone-800 border-b border-stone-200 pb-2">{children}</h2>;
}

// Agenda: every habit and category with a cadence, in three sections: due now (on or past when
// it's due), upcoming (done, but an every-N-days one due again soon; still loggable, since doing it
// early restarts its count), and done, as chips. Habits and categories without a cadence aren't
// here; they're on the Habits page.
export default async function AgendaPage() {
  const user = await getDefaultUser();
  const [categories, uncategorized, latestLogDates, people] = await Promise.all([
    getCategoriesWithHierarchy(),
    getUncategorizedHabits(5),
    getLatestLogDates(),
    getPeople(),
  ]);

  const { dueHabits, upcomingHabits, doneHabits, dueCategories, upcomingCategories, doneCategories } = buildDueList(categories, uncategorized, latestLogDates, user);
  const anyDue = dueHabits.length > 0 || dueCategories.length > 0;
  const anyUpcoming = upcomingHabits.length > 0 || upcomingCategories.length > 0;
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
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">Agenda</h1>
          </div>
          <SmartEntry />
        </div>

        {!anyHabits ? (
          <EmptyState title="No habits here yet">
            Tap the quill above and tell it something you did, or a habit you&apos;d like to start.
          </EmptyState>
        ) : !anyDue && !anyUpcoming && !anyDone ? (
          <EmptyState title="Nothing on the agenda" action={<LinkButton href="/habits" variant="outline">Go to Habits</LinkButton>}>
            Nothing has a cadence yet. Give a habit or category one on its page, and it shows up here whenever it&apos;s due.
          </EmptyState>
        ) : (
          <div className="space-y-8">
            <section className="space-y-4">
              <SectionHeading>Due Now</SectionHeading>
              {dueHabits.length > 0 && (
                <SortableHabitList items={dueHabits} user={user} people={people} dndContextId="due-habits" />
              )}
              {dueCategories.length > 0 && (
                <CategoryList categories={dueCategories.map(category => ({ category }))} user={user} />
              )}
              {!anyDue && <p className="text-stone-500">Nothing due right now.</p>}
            </section>

            {anyUpcoming && (
              <section className="space-y-4">
                <SectionHeading>Upcoming</SectionHeading>
                {upcomingHabits.length > 0 && (
                  <SortableHabitList
                    items={upcomingHabits.map(u => u.item)}
                    notes={Object.fromEntries(upcomingHabits.map(u => [u.item.id, dueLabel(u.dueInDays)]))}
                    user={user}
                    people={people}
                    dndContextId="upcoming-habits"
                  />
                )}
                {upcomingCategories.length > 0 && (
                  <CategoryList categories={upcomingCategories.map(({ item, dueInDays }) => ({ category: item, note: dueLabel(dueInDays) }))} user={user} />
                )}
              </section>
            )}

            {anyDone && (
              <section className="space-y-4">
                <SectionHeading>Done</SectionHeading>
                <DoneChips habits={doneHabits} categories={doneCategories} />
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
