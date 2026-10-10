import { getCategoriesWithHierarchy, getDefaultUser, getLatestLogDates, getPeople, getUncategorizedHabits } from './actions/db';
import Link from 'next/link';
import { Check, SkipForward } from 'lucide-react';
import Icon from '../components/Icon';
import { SortableHabitList } from './categories/[id]/SortableLists';
import SmartEntry from './SmartEntry';
import EmptyState from '@/components/EmptyState';
import DueNowCleared from '@/components/DueNowCleared';
import SmoothHeight from '@/components/SmoothHeight';
import CategoryRow from '@/components/CategoryRow';
import CategoryHoldToLog from '@/components/logging/CategoryHoldToLog';
import LogRing from '@/components/logging/LogRing';
import { LinkButton } from '@/components/ui/Button';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PaneHeading, PanePage, PaneSection } from '@/components/Pane';
import { buildDueList, type DueCategory } from '@/lib/dueList';
import { parseBedtimeOffsetMinutes, toCivilDate } from '@/lib/timezone';
import type { HabitListItem, SessionUser } from '@/lib/types';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';

// Categories with a cadence that are due or upcoming, as rows linking to their pages, each with a
// calendar of its recent entries like a habit's. Tapping its ring, or pressing and holding the row,
// picks a habit in it to log. Each has its cadence under its name, as habit rows here do.
function CategoryList({ categories, user }: { categories: DueCategory[]; user: SessionUser }) {
  return (
    <div className="divide-y divide-line-subtle flex flex-col">
      {categories.map(category => {
        const row = {
          href: `/categories/${category.id}`,
          name: category.name,
          icon: category.icon || DEFAULT_CATEGORY_ICON,
          showCadence: true,
          dates: category.habits.flatMap(h => (h.logs ?? []).map(l => l.createdAt)),
          habitCount: category.habits.length,
          cadence: category.cadence,
          status: category.status,
          alignWithHabitRows: true,
          bedtime: user.bedtime,
          weekStartsOn: user.weekStartsOn,
          timeZone: user.timeZone,
        };
        // A category with no habits has nothing to log, so its ring can't be tapped
        return category.habits.length > 0
          ? <CategoryHoldToLog key={category.id} category={category} row={row} leavesWhenDone />
          : <CategoryRow key={category.id} {...row} leading={category.status && <LogRing status={category.status} label="No habits to log" color="blue" disabled />} />;
      })}
    </div>
  );
}

// What's done for now, as small chips: white, with the check (and border) in the habit's emerald or
// the category's blue, so they don't look like the rows above. They can't be held to log, which
// is what keeps something done from being logged twice by accident; each links to its page, where it
// can still be logged. A habit that's done because it was skipped has the skip icon in place of the
// check. Links styled as chips, not buttons, so they don't use LinkButton.
function DoneChips({ habits, categories, skippedIds }: { habits: HabitListItem[]; categories: DueCategory[]; skippedIds: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Done">
      {categories.map(category => (
        <li key={category.id}>
          <Link
            href={`/categories/${category.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-category-line text-sm font-medium text-ink-secondary hover:bg-surface-subtle transition-colors"
          >
            <Check className="w-3.5 h-3.5 shrink-0 text-category-ink" strokeWidth={3} />
            <Icon name={category.icon || DEFAULT_CATEGORY_ICON} className="w-3.5 h-3.5 shrink-0 text-category-ink" />
            <span className="truncate max-w-[14rem]">{category.name}</span>
          </Link>
        </li>
      ))}
      {habits.map(habit => (
        <li key={habit.id}>
          <Link
            href={`/log/${habit.id}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border ${skippedIds.includes(habit.id) ? 'border-line' : 'border-accent-line-strong'} text-sm font-medium text-ink-secondary hover:bg-surface-subtle transition-colors`}
          >
            {skippedIds.includes(habit.id)
              ? <SkipForward className="w-3.5 h-3.5 shrink-0 text-ink-muted" strokeWidth={2.5} aria-label="Skipped" />
              : <Check className="w-3.5 h-3.5 shrink-0 text-accent-ink" strokeWidth={3} />}
            <span className="truncate max-w-[14rem]">{habit.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Agenda: every habit and category with a cadence, in three sections: due now (on or past when
// it's due; a weekly or monthly one only on its last day), upcoming (an every-N-days
// one done but due again soon, still loggable since doing it early restarts its count, or a weekly
// or monthly one not yet done with days to spare), and done, as chips. Due Now emptied today by doing
// everything in it shows the hobbit hole (see DueNowCleared). Habits and categories without a cadence aren't
// here; they're on the Habits page.
export default async function AgendaPage() {
  const user = await getDefaultUser();
  const [categories, uncategorized, latestLogDates, people] = await Promise.all([
    getCategoriesWithHierarchy(),
    getUncategorizedHabits(5),
    getLatestLogDates(),
    getPeople(),
  ]);

  const { dueHabits, upcomingHabits, doneHabits, dueCategories, upcomingCategories, doneCategories, statuses, skippedHabitIds, clearedToday } = buildDueList(categories, uncategorized, latestLogDates, user);
  const anyDue = dueHabits.length > 0 || dueCategories.length > 0;
  const anyUpcoming = upcomingHabits.length > 0 || upcomingCategories.length > 0;
  const anyDone = doneHabits.length > 0 || doneCategories.length > 0;
  const anyHabits = uncategorized.length > 0 || categories.some(c => c.habits.length > 0 || c.children.some(child => child.habits.length > 0));

  // Today in the viewer's time zone, following the same bedtime rule as the calendars
  const today = toCivilDate(new Date(), user.timeZone, parseBedtimeOffsetMinutes(user.bedtime));

  return (
    <PanePage
      header={
        <PageHeader
          title="Agenda"
          subtitle={today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
          showBack={false}
          actions={<SmartEntry size="md" />}
        />
      }
    >
      {!anyHabits ? (
        <EmptyState title="No habits here yet">
          Tap the quill at the top and tell it something you did, or a habit you&apos;d like to start.
        </EmptyState>
      ) : !anyDue && !anyUpcoming && !anyDone ? (
        <EmptyState title="Nothing on the agenda" action={<LinkButton href="/habits" variant="outline">Go to Habits</LinkButton>}>
          Nothing has a cadence yet. Give a habit or category one on its page, and it shows up here whenever it&apos;s due.
        </EmptyState>
      ) : (
        <>
          {/* Eased, so rows dropped by a refresh, or swapped for the reward, don't jolt what's below */}
          <SmoothHeight>
            {/* Emptied today by doing what was due, it's a reward; otherwise there was just nothing due */}
            <PaneSection title="Due Now" empty={!anyDue && (clearedToday ? <DueNowCleared /> : 'Nothing due right now.')}>
              {dueHabits.length > 0 && (
                <SortableHabitList items={dueHabits} statuses={statuses} user={user} people={people} dndContextId="due-habits" bare holdToLog showCadence leavesWhenDone />
              )}
              {dueCategories.length > 0 && (
                <CategoryList categories={dueCategories} user={user} />
              )}
            </PaneSection>
          </SmoothHeight>

          {anyUpcoming && (
            <PaneSection title="Upcoming">
              {upcomingHabits.length > 0 && (
                <SortableHabitList
                  items={upcomingHabits.map(u => u.item)}
                  statuses={statuses}
                  user={user}
                  people={people}
                  dndContextId="upcoming-habits"
                  bare
                  holdToLog
                  showCadence
                  leavesWhenDone
                />
              )}
              {upcomingCategories.length > 0 && (
                <CategoryList categories={upcomingCategories.map(u => u.item)} user={user} />
              )}
            </PaneSection>
          )}

          {anyDone && (
            <section>
              <PaneHeading>Done</PaneHeading>
              {/* On the stone rather than white, since they aren't a list */}
              <div className={`${PANE_INSET} py-3`}>
                <DoneChips habits={doneHabits} categories={doneCategories} skippedIds={skippedHabitIds} />
              </div>
            </section>
          )}
        </>
      )}
    </PanePage>
  );
}
