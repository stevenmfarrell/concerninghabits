import { getCategoriesWithHierarchy, getDefaultUser, getLatestLogDates, getPeople, getUncategorizedHabits } from './actions/db';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Icon from '../components/Icon';
import { SortableHabitList } from './categories/[id]/SortableLists';
import SmartEntry from './SmartEntry';
import EmptyState from '@/components/EmptyState';
import CategoryRow from '@/components/CategoryRow';
import { LinkButton } from '@/components/ui/Button';
import PageHeader from '@/components/PageHeader';
import { buildDueList, type DueCategory } from '@/lib/dueList';
import { parseBedtimeOffsetMinutes, toCivilDate } from '@/lib/timezone';
import type { HabitListItem, SessionUser } from '@/lib/types';

// Categories with a cadence that are due or upcoming, as rows linking to their pages (where their
// habits are, to log one), each with a calendar of its recent entries like a habit's
function CategoryList({ categories, user }: { categories: DueCategory[]; user: SessionUser }) {
  return (
    <div className="divide-y divide-stone-100 flex flex-col">
      {categories.map(category => (
        <CategoryRow
          key={category.id}
          href={`/categories/${category.id}`}
          name={category.name}
          icon={category.icon || 'Folder'}
          dates={category.habits.flatMap(h => (h.logs ?? []).map(l => l.createdAt))}
          habitCount={category.habits.length}
          cadence={category.cadence}
          status={category.status}
          alignWithHabitRows
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

// Lined up with the rows' contents, which run the full width of the page
const INSET = 'px-4 sm:px-6';

function SectionHeading({ children }: { children: string }) {
  return <h2 className={`${INSET} pb-2 text-xs font-semibold uppercase tracking-wider text-stone-500`}>{children}</h2>;
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

  const { dueHabits, upcomingHabits, doneHabits, dueCategories, upcomingCategories, doneCategories, statuses } = buildDueList(categories, uncategorized, latestLogDates, user);
  const anyDue = dueHabits.length > 0 || dueCategories.length > 0;
  const anyUpcoming = upcomingHabits.length > 0 || upcomingCategories.length > 0;
  const anyDone = doneHabits.length > 0 || doneCategories.length > 0;
  const anyHabits = uncategorized.length > 0 || categories.some(c => c.habits.length > 0 || c.children.some(child => child.habits.length > 0));

  // Today in the viewer's time zone, following the same bedtime rule as the calendars
  const today = toCivilDate(new Date(), user.timeZone, parseBedtimeOffsetMinutes(user.bedtime));

  return (
    // One full-width white pane rather than cards, so lists run edge to edge with only the lines
    // between rows. It reaches down under the bottom nav's spacer (5rem, see BottomNav), which would
    // otherwise show the body's stone background as a band above the nav.
    <main className="flex-1 pb-24 sm:pb-28 -mb-20 bg-white font-sans">
      <PageHeader
        title="Agenda"
        subtitle={today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
        showBack={false}
        actions={<SmartEntry size="md" />}
      />
      <div className="max-w-4xl mx-auto pt-4 sm:pt-8 space-y-6 sm:space-y-8">
        {!anyHabits ? (
          <EmptyState title="No habits here yet">
            Tap the quill at the top and tell it something you did, or a habit you&apos;d like to start.
          </EmptyState>
        ) : !anyDue && !anyUpcoming && !anyDone ? (
          <EmptyState title="Nothing on the agenda" action={<LinkButton href="/habits" variant="outline">Go to Habits</LinkButton>}>
            Nothing has a cadence yet. Give a habit or category one on its page, and it shows up here whenever it&apos;s due.
          </EmptyState>
        ) : (
          <div className="space-y-8">
            <section>
              <SectionHeading>Due Now</SectionHeading>
              <div className="divide-y divide-stone-100">
                {dueHabits.length > 0 && (
                  <SortableHabitList items={dueHabits} statuses={statuses} user={user} people={people} dndContextId="due-habits" bare />
                )}
                {dueCategories.length > 0 && (
                  <CategoryList categories={dueCategories} user={user} />
                )}
              </div>
              {!anyDue && <p className={`${INSET} text-stone-500`}>Nothing due right now.</p>}
            </section>

            {anyUpcoming && (
              <section>
                <SectionHeading>Upcoming</SectionHeading>
                <div className="divide-y divide-stone-100">
                  {upcomingHabits.length > 0 && (
                    <SortableHabitList
                      items={upcomingHabits.map(u => u.item)}
                      statuses={statuses}
                      user={user}
                      people={people}
                      dndContextId="upcoming-habits"
                      bare
                    />
                  )}
                  {upcomingCategories.length > 0 && (
                    <CategoryList categories={upcomingCategories.map(u => u.item)} user={user} />
                  )}
                </div>
              </section>
            )}

            {anyDone && (
              <section>
                <SectionHeading>Done</SectionHeading>
                <div className={INSET}>
                  <DoneChips habits={doneHabits} categories={doneCategories} />
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
