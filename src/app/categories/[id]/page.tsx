import { getCategory, getDefaultUser, getLatestLogDates, getPeople } from '../../actions/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { cookies } from 'next/headers';
import Icon from '../../../components/Icon';
import ActivityCalendar from '../../../components/ActivityCalendar';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PANE_SURFACE, PaneHeading, PanePage, PaneSection } from '@/components/Pane';
import { LinkButton } from '@/components/ui/Button';
import HorizonToggle from '@/components/HorizonToggle';
import CategoryMenu from './CategoryMenu';
import CategoryCadence from './CategoryCadence';
import EmptyState from '@/components/EmptyState';
import { NO_CADENCE, parseCadence, postpones, skipState } from '@/lib/cadence';
import SkipButton from '@/components/SkipButton';
import HealthHeader from '@/components/HealthPlant';
import { consistency, CONSISTENCY_HISTORY_WEEKS } from '@/lib/consistency';
import { UNCATEGORIZED_ID } from '@/lib/constants';
import { SortableCategoryItemList } from './SortableLists';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';
import { entryDates, listRowStatus, skippedDaysOf, type RowStatus } from '@/lib/dueList';
import type { HabitListItem } from '@/lib/types';

// A category's page: its cadence, its habits and subcategories, and an activity calendar of all
// their entries over the chosen horizon, like a habit's page. Its rows are laid out like the
// Agenda's, but with each one's health at its start where the Agenda has a ring (see HealthMark).
export default async function CategoryLogPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ reorder?: string, horizon?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const isReordering = searchParams.reorder === 'true';
  const user = await getDefaultUser();

  const cookieStore = await cookies();
  const weeks = parseInt(searchParams.horizon || cookieStore.get(`horizon_${params.id}`)?.value || '26', 10);
  // Use 7 and 5 to guarantee exactly 2 columns (mobile) and 3 columns (desktop)
  // even when the 52-week window bleeds into a 13th calendar month.
  const mobileMonthsPerColumn = weeks === 52 ? 7 : 4;
  const desktopMonthsPerColumn = weeks === 52 ? 5 : 4;

  // Enough entries, whatever the calendar shows, for each row's consistency (and so a month's entries
  // all count toward the rings); the latest entries are for an every-N-days cadence's older ones
  const [category, people, latestLogDates] = await Promise.all([getCategory(params.id, Math.max(weeks, CONSISTENCY_HISTORY_WEEKS)), getPeople(), getLatestLogDates()]);

  if (!category) return notFound();

  // Aggregate logs
  const allLogs = [
    ...category.habits.flatMap(h => h.logs),
    ...(category.children ? category.children.flatMap(c => c.habits.flatMap(h => h.logs)) : [])
  ];
  const dates = allLogs.map(l => l.createdAt);
  const habitCount = category.habits.length + (category.children ? category.children.reduce((acc, c) => acc + c.habits.length, 0) : 0);

  const isTopLevel = category.parentId === null;
  const cadence = parseCadence(category.cadence, NO_CADENCE);
  const skippedDays = skippedDaysOf(category);
  // Shaded by the category's cadence when it has one, with its skips, otherwise by how many of its
  // habits were logged
  const calendarShading = cadence.type === 'none' ? { density: Math.max(habitCount, 1) } : { cadence, skippedDays };
  // Skipping it (its own cadence), or undoing that, under its cadence while it's due, as a habit's
  // page has (see SkipButton)
  const categoryDates = [...category.habits, ...(isTopLevel ? category.children.flatMap(c => c.habits) : [])].flatMap(h => entryDates(h, latestLogDates));
  const skip = category.id === UNCATEGORIZED_ID ? null : skipState(cadence, categoryDates, user, new Date(), skippedDays);
  const categoryConsistency = 'createdAt' in category ? consistency(cadence, categoryDates, user, { createdAt: category.createdAt, skippedDays }) : null;
  const calendarProps = { dates, weeks, ...calendarShading, size: 'md' as const, bedtime: user.bedtime, weekStartsOn: user.weekStartsOn, timeZone: user.timeZone, color: 'blue' as const };

  // Every row's ring, by id: each habit's, and each subcategory's from its habits' entries
  const statuses: Record<string, RowStatus> = {};
  const addHabitStatus = (habit: HabitListItem) => {
    statuses[habit.id] = listRowStatus(parseCadence(habit.cadence), entryDates(habit, latestLogDates), user, { habit: true, skippedDays: skippedDaysOf(habit), createdAt: habit.createdAt });
  };
  category.habits.forEach(addHabitStatus);
  for (const child of isTopLevel ? category.children : []) {
    child.habits.forEach(addHabitStatus);
    statuses[child.id] = listRowStatus(parseCadence(child.cadence, NO_CADENCE), child.habits.flatMap(h => entryDates(h, latestLogDates)), user, { habit: false, skippedDays: skippedDaysOf(child), createdAt: child.createdAt });
  }

  // Where New Habit goes: the new habit starts in this category, or in none for Uncategorized
  const newHabitHref = category.id === UNCATEGORIZED_ID ? '/create' : `/create?category=${category.id}`;

  // Direct habits and subcategories share one order sequence. On ties, habits come first.
  const items = [
    ...category.habits.map(h => ({ type: 'habit' as const, id: h.id, order: h.order ?? 0, data: h })),
    ...(isTopLevel ? category.children : []).map(c => ({ type: 'subcategory' as const, id: c.id, order: c.order, data: c })),
  ].sort((a, b) => a.order - b.order);

  return (
    <PanePage
      header={
        <PageHeader
          title={
            <>
              <Icon name={category.icon || DEFAULT_CATEGORY_ICON} className="w-5 h-5 sm:w-6 sm:h-6 text-ink-muted shrink-0" />
              <span className="truncate">{category.name}</span>
            </>
          }
          actions={
            isReordering ? (
              <LinkButton href={`/categories/${category.id}`} variant="secondary">
                Done
              </LinkButton>
            ) : (
              <CategoryMenu categoryId={category.id} />
            )
          }
          titleInsetClassName={isReordering ? 'px-24' : undefined}
        />
      }
    >
      {category.id !== UNCATEGORIZED_ID && (
        // Its health, with its cadence and skipping it beside it, as a habit's page has its own
        <div className={`${PANE_INSET} py-4`}>
          <HealthHeader
            consistency={categoryConsistency}
            noun="Category"
            bottom={
              <>
                <CategoryCadence categoryId={category.id} cadence={cadence} weekStartsOn={user.weekStartsOn} />
                {skip && <SkipButton target={{ kind: 'category', id: category.id, name: category.name }} skip={skip} postpones={postpones(cadence)} />}
              </>
            }
          />
        </div>
      )}

      {items.length > 0 ? (
        <PaneSection title="Habits">
          <SortableCategoryItemList items={items} statuses={statuses} user={user} people={people} isReordering={isReordering} />
          {/* The list's last row, as adding to a list is elsewhere; not while reordering, since it isn't one of them */}
          {!isReordering && (
            <Link href={newHabitHref} className="flex items-center gap-2 pane-inset py-3 text-sm font-medium text-accent-ink-strong hover:bg-surface-subtle transition-colors">
              <Plus className="w-4 h-4" />
              New Habit
            </Link>
          )}
        </PaneSection>
      ) : (
        <EmptyState title="No habits in this category yet" action={<LinkButton href={newHabitHref} variant="outline">New Habit</LinkButton>}>
          Add one here, or move an existing habit into this category from its page.
        </EmptyState>
      )}

      <section>
        <PaneHeading action={<HorizonToggle habitId={category.id} currentWeeks={weeks} />}>Activity</PaneHeading>
        {/* Centered, but from the start when wider than the page, so its overflow scrolls rather than being cut off */}
        <div className={`${PANE_SURFACE} ${PANE_INSET} py-4 overflow-x-auto`}>
          <div className="hidden sm:flex w-full justify-center-safe">
            <ActivityCalendar {...calendarProps} monthsPerColumn={desktopMonthsPerColumn} />
          </div>
          <div className="flex sm:hidden w-full justify-center-safe">
            <ActivityCalendar {...calendarProps} monthsPerColumn={mobileMonthsPerColumn} />
          </div>
        </div>
      </section>
    </PanePage>
  );
}
