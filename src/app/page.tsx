import { getDefaultUser, getPeople } from '@/app/actions/user';
import Link from 'next/link';
import { SortableHabitList } from './categories/[id]/SortableLists';
import { getVacation } from './actions/vacation';
import VacationChip from '@/components/VacationChip';
import EmptyState from '@/components/EmptyState';
import { AnytimeChips, DueLaterChips } from '@/components/AgendaChips';
import DueNowCleared from '@/components/DueNowCleared';
import SmoothHeight from '@/components/SmoothHeight';
import CategoryRow from '@/components/CategoryRow';
import CategoryHoldToLog from '@/components/logging/CategoryHoldToLog';
import LogRing from '@/components/logging/LogRing';
import { LinkButton } from '@/components/ui/Button';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PaneHeading, PanePage, PaneSection } from '@/components/Pane';
import type { DueCategory } from '@/lib/dueList';
import { dueListOf } from '@/lib/agenda';
import { civilDateFor } from '@/lib/timezone';
import type { HabitListItem, SessionUser } from '@/lib/types';
import { categoryRowCalendar, rowHabits, rowSections } from '@/lib/rowCalendar';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';

// Categories with a cadence that are due or upcoming, as rows linking to their pages, each with a
// calendar of its recent entries like a habit's. Tapping its ring, or pressing and holding the row,
// picks a habit in it to log. Each has its cadence under its name, as habit rows here do. One that
// `leavesWhenDone` zooms away once logging makes it done (not a limit's, which is never done).
function CategoryList({ categories, user, rowOf, leavesWhenDone = true }: { categories: DueCategory[]; user: SessionUser; rowOf: (habit: HabitListItem) => HabitListItem; leavesWhenDone?: boolean }) {
  return (
    <div className="divide-y divide-line-subtle flex flex-col">
      {categories.map(category => {
        const row = {
          href: `/categories/${category.id}`,
          name: category.name,
          icon: category.icon || DEFAULT_CATEGORY_ICON,
          showCadence: true,
          calendar: categoryRowCalendar(category.habits, category.cadence, user, category.skippedDays),
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
          ? <CategoryHoldToLog key={category.id} category={{ id: category.id, name: category.name, icon: category.icon, sections: rowSections(category.sections, rowOf) }} row={row} leavesWhenDone={leavesWhenDone} />
          : <CategoryRow key={category.id} {...row} leading={category.status && <LogRing status={category.status} label="No habits to log" color="blue" disabled />} />;
      })}
    </div>
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

// Agenda: every habit, and every category with a cadence, so nothing drops out of sight. As rows:
// due now (on or past when it's due; a weekly or monthly one only on its last day), upcoming (an
// every-N-days one done but due again soon, still loggable since doing it early restarts its count,
// or a weekly or monthly one not yet done with days to spare), and limits (never due, so always
// listed, with how much of each is left). As chips (see AgendaChips): anytime (habits with no
// cadence, never due, the latest logged first) and due later (done for now). Due Now emptied today
// by doing everything in it shows the hobbit hole (see DueNowCleared).
export default async function AgendaPage() {
  const user = await getDefaultUser();
  const [{ categories, uncategorized, dueHabits, upcomingHabits, laterHabits, anytimeHabits, loggedTodayIds, dueCategories, upcomingCategories, laterCategories, limitHabits, limitCategories, statuses, skippedHabitIds, skippedCategoryIds, clearedToday, anyCadence }, people, vacation] = await Promise.all([
    dueListOf(user),
    getPeople(),
    getVacation(),
  ]);
  const anyDue = dueHabits.length > 0 || dueCategories.length > 0;
  const anyUpcoming = upcomingHabits.length > 0 || upcomingCategories.length > 0;
  const anyLater = laterHabits.length > 0 || laterCategories.length > 0;
  const anyLimits = limitHabits.length > 0 || limitCategories.length > 0;
  const onVacation = !!vacation?.active;
  const anyHabits = uncategorized.length > 0 || categories.some(c => c.habits.length > 0 || c.children.some(child => child.habits.length > 0));

  // Each habit as its row has it, with its calendar in place of its entries (see toRowHabit)
  const rowOf = rowHabits(user);
  // A chip's habit, with only what logging it needs
  const chipOf = ({ id, name, schema, aiContext }: HabitListItem) => ({ id, name, schema, aiContext });

  // Today in the viewer's time zone, following the same bedtime rule as the calendars
  const today = civilDateFor(new Date(), user);

  return (
    <PanePage
      header={
        <PageHeader
          title="Agenda"
          subtitle={today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
          showBack={false}
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
          Tap the quill in the middle of the bar below and tell it something you did, or a habit you&apos;d like to start.
        </EmptyState>
      ) : !anyDue && !anyUpcoming && !anyLimits && !anyLater && anytimeHabits.length === 0 && !onVacation ? (
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
                <SortableHabitList items={dueHabits.map(rowOf)} statuses={statuses} user={user} people={people} dndContextId="due-habits" bare holdToLog showCadence leavesWhenDone />
              )}
              {dueCategories.length > 0 && (
                <CategoryList categories={dueCategories} user={user} rowOf={rowOf} />
              )}
            </PaneSection>
          </SmoothHeight>

          {anyUpcoming && (
            <PaneSection title="Upcoming">
              {upcomingHabits.length > 0 && (
                <SortableHabitList
                  items={upcomingHabits.map(u => rowOf(u.item))}
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
                <CategoryList categories={upcomingCategories.map(u => u.item)} user={user} rowOf={rowOf} />
              )}
            </PaneSection>
          )}

          {/* Never due, so always here, so they don't drop out of sight */}
          {anytimeHabits.length > 0 && (
            <section>
              <PaneHeading>Anytime</PaneHeading>
              {/* On the stone rather than white, since they aren't a list */}
              <div className={`${PANE_INSET} py-3`}>
                <AnytimeChips habits={anytimeHabits.map(chipOf)} loggedTodayIds={loggedTodayIds} />
              </div>
            </section>
          )}

          {/* Never due, so always here, with how much of each is left (see LogRing): a tap logs one */}
          {anyLimits && (
            <PaneSection title="Limits">
              {limitHabits.length > 0 && (
                <SortableHabitList items={limitHabits.map(rowOf)} statuses={statuses} user={user} people={people} dndContextId="limit-habits" bare holdToLog showCadence />
              )}
              {limitCategories.length > 0 && (
                <CategoryList categories={limitCategories} user={user} rowOf={rowOf} leavesWhenDone={false} />
              )}
            </PaneSection>
          )}

          {anyLater && (
            <section>
              <PaneHeading>Due Later</PaneHeading>
              <div className={`${PANE_INSET} py-3`}>
                <DueLaterChips
                  habits={laterHabits.map(chipOf)}
                  categories={laterCategories.map(c => ({ id: c.id, name: c.name, icon: c.icon, sections: rowSections(c.sections, rowOf) }))}
                  skippedIds={[...skippedHabitIds, ...skippedCategoryIds]}
                />
              </div>
            </section>
          )}
        </>
      )}
    </PanePage>
  );
}
