import { getCategoriesWithHierarchy } from '@/app/actions/categories';
import { getLatestLogDates, getUncategorizedHabits } from '@/app/actions/habits';
import { getDefaultUser, getPeople } from '@/app/actions/user';
import Link from 'next/link';
import { Check, SkipForward } from 'lucide-react';
import Icon from '../components/Icon';
import { SortableHabitList } from './categories/[id]/SortableLists';
import SmartEntry from './SmartEntry';
import { getVacation } from './actions/vacation';
import VacationChip from '@/components/VacationChip';
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
import { civilDateFor } from '@/lib/timezone';
import type { HabitListItem, SessionUser } from '@/lib/types';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';

// Categories with a cadence that are due or upcoming, as rows linking to their pages, each with a
// calendar of its recent entries like a habit's. Tapping its ring, or pressing and holding the row,
// picks a habit in it to log. Each has its cadence under its name, as habit rows here do. One that
// `leavesWhenDone` zooms away once logging makes it done (not a limit's, which is never done).
function CategoryList({ categories, user, leavesWhenDone = true }: { categories: DueCategory[]; user: SessionUser; leavesWhenDone?: boolean }) {
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
          skippedDays: category.skippedDays,
          vacations: user.vacations,
          status: category.status,
          alignWithHabitRows: true,
          bedtime: user.bedtime,
          weekStartsOn: user.weekStartsOn,
          timeZone: user.timeZone,
        };
        // A category with no habits has nothing to log, so its ring can't be tapped
        return category.habits.length > 0
          ? <CategoryHoldToLog key={category.id} category={category} row={row} leavesWhenDone={leavesWhenDone} />
          : <CategoryRow key={category.id} {...row} leading={category.status && <LogRing status={category.status} label="No habits to log" color="blue" disabled />} />;
      })}
    </div>
  );
}

// What was recently logged (see buildDueList), as small chips: white, with the check (and border) in the habit's emerald or
// the category's blue, so they don't look like the rows above. They can't be held to log, which
// is what keeps something done from being logged twice by accident; each links to its page, where it
// can still be logged. A habit or category that's done because it was skipped has the skip icon in
// place of the check. Links styled as chips, not buttons, so they don't use LinkButton.
function RecentChips({ habits, categories, skippedIds }: { habits: HabitListItem[]; categories: DueCategory[]; skippedIds: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Recently Logged">
      {categories.map(category => (
        <li key={category.id}>
          <Link
            href={`/categories/${category.id}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border ${skippedIds.includes(category.id) ? 'border-line' : 'border-category-line'} text-sm font-medium text-ink-secondary hover:bg-surface-subtle transition-colors`}
          >
            {skippedIds.includes(category.id)
              ? <SkipForward className="w-3.5 h-3.5 shrink-0 text-ink-muted" strokeWidth={2.5} aria-label="Skipped" />
              : <Check className="w-3.5 h-3.5 shrink-0 text-category-ink" strokeWidth={3} />}
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

// Due Now while no habit or category has a cadence, so nothing ever comes due: how to give one one
function NoCadenceYet() {
  return (
    <>
      Nothing has a cadence yet, so nothing comes due. To have a habit show up here when it&apos;s due, open it from{' '}
      <Link href="/habits" className="font-medium text-accent-ink hover:text-accent-ink-strong underline underline-offset-2">Habits</Link>
      {' '}and tap &ldquo;No set cadence&rdquo; to say how often you mean to do it.
    </>
  );
}

// Agenda: every habit and category with a cadence, in three sections: due now (on or past when
// it's due; a weekly or monthly one only on its last day), upcoming (an every-N-days
// one done but due again soon, still loggable since doing it early restarts its count, or a weekly
// or monthly one not yet done with days to spare), limits (never due, so always listed, with how much
// of each is left), and recently logged, as chips: habits logged
// lately that aren't in the other two (including ones without a cadence), and categories done for
// now. Due Now emptied today by doing everything in it shows the hobbit hole (see DueNowCleared).
export default async function AgendaPage() {
  const user = await getDefaultUser();
  const [categories, uncategorized, latestLogDates, people, vacation] = await Promise.all([
    getCategoriesWithHierarchy(),
    getUncategorizedHabits(5),
    getLatestLogDates(),
    getPeople(),
    getVacation(),
  ]);

  const { dueHabits, upcomingHabits, recentHabits, dueCategories, upcomingCategories, recentCategories, limitHabits, limitCategories, statuses, skippedHabitIds, skippedCategoryIds, clearedToday, anyCadence } = buildDueList(categories, uncategorized, latestLogDates, user);
  const anyDue = dueHabits.length > 0 || dueCategories.length > 0;
  const anyUpcoming = upcomingHabits.length > 0 || upcomingCategories.length > 0;
  const anyRecent = recentHabits.length > 0 || recentCategories.length > 0;
  const anyLimits = limitHabits.length > 0 || limitCategories.length > 0;
  const onVacation = !!vacation?.active;
  const anyHabits = uncategorized.length > 0 || categories.some(c => c.habits.length > 0 || c.children.some(child => child.habits.length > 0));

  // Today in the viewer's time zone, following the same bedtime rule as the calendars
  const today = civilDateFor(new Date(), user);

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
      {/* While they're away, so they know why nothing's due, and can end it */}
      {onVacation && (
        <div className={`${PANE_INSET} pt-4 flex justify-center`}>
          <VacationChip vacation={vacation} />
        </div>
      )}
      {!anyHabits ? (
        <EmptyState title="No habits here yet" action={<LinkButton href="/tutorial" variant="outline">Take the Tour</LinkButton>}>
          Tap the quill at the top and tell it something you did, or a habit you&apos;d like to start.
        </EmptyState>
      ) : !anyDue && !anyUpcoming && !anyLimits && !anyRecent && !onVacation ? (
        <EmptyState title="Nothing on the agenda" action={<LinkButton href="/habits" variant="outline">Go to Habits</LinkButton>}>
          Nothing has a cadence yet. Give a habit or category one on its page, and it shows up here whenever it&apos;s due.
        </EmptyState>
      ) : (
        <>
          {/* Eased, so rows dropped by a refresh, or swapped for the reward, don't jolt what's below */}
          <SmoothHeight>
            {/* Emptied today by doing what was due, it's a reward; otherwise there was just nothing
                due, or, with no cadence anywhere, nothing that ever comes due, which is worth saying
                while a new habit's cadence is easy to have left unset */}
            <PaneSection title="Due Now" empty={!anyDue && (clearedToday ? <DueNowCleared /> : !anyCadence ? <NoCadenceYet /> : onVacation ? 'You’re on vacation. Nothing’s due.' : 'Nothing due right now.')}>
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

          {/* Never due, so always here, with how much of each is left (see LogRing): a tap logs one */}
          {anyLimits && (
            <PaneSection title="Limits">
              {limitHabits.length > 0 && (
                <SortableHabitList items={limitHabits} statuses={statuses} user={user} people={people} dndContextId="limit-habits" bare holdToLog showCadence />
              )}
              {limitCategories.length > 0 && (
                <CategoryList categories={limitCategories} user={user} leavesWhenDone={false} />
              )}
            </PaneSection>
          )}

          {anyRecent && (
            <section>
              <PaneHeading>Recently Logged</PaneHeading>
              {/* On the stone rather than white, since they aren't a list */}
              <div className={`${PANE_INSET} py-3`}>
                <RecentChips habits={recentHabits} categories={recentCategories} skippedIds={[...skippedHabitIds, ...skippedCategoryIds]} />
              </div>
            </section>
          )}
        </>
      )}
    </PanePage>
  );
}
