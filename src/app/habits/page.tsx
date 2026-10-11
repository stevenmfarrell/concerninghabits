import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { getCategoriesWithHierarchy } from '@/app/actions/categories';
import { getLatestLogDates, getUncategorizedHabits } from '@/app/actions/habits';
import { getDefaultUser, getPeople } from '@/app/actions/user';
import { Plus } from 'lucide-react';
import CategoryRow, { type CategoryRowProps } from '@/components/CategoryRow';
import CategoryHoldToLog from '@/components/logging/CategoryHoldToLog';
import { HealthMark } from '@/components/HealthPlant';
import { LinkButton } from '@/components/ui/Button';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { NO_CADENCE, parseCadence } from '@/lib/cadence';
import { entryDates, listRowStatus, pickerSections, skippedDaysOf, type PickerSection, type RowStatus } from '@/lib/dueList';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';
import { CONSISTENCY_HISTORY_WEEKS } from '@/lib/consistency';
import { HABITS_DIR_COOKIE, HABITS_SORT_COOKIE, HABITS_VIEW_COOKIE, parseHabitsDir, parseHabitsSort, parseHabitsView, sortRows, type SortableRow } from '@/lib/habitsView';
import type { HabitListItem, SessionUser } from '@/lib/types';
import type { Person } from '@/lib/userColors';
import { SortableHabitList } from '../categories/[id]/SortableLists';
import HabitsSortControls, { HabitsViewSwitcher } from './HabitsControls';
import HabitsMenu from './HabitsMenu';

// A category's row, with its health at its start (see HealthMark), that opens a picker of its habits
// to log by holding the row, or with a mouse its button (see CategoryHoldToLog). One with no habits
// has nothing to log.
function HoldableCategoryRow({ id, row, sections }: { id: string; row: CategoryRowProps; sections: PickerSection[] }) {
  if (sections.length === 0) {
    return <CategoryRow {...row} leading={<HealthMark consistency={row.status?.consistency} />} />;
  }
  return <CategoryHoldToLog category={{ id, name: row.name, icon: row.icon, sections }} row={row} health />;
}

// A category (or subcategory) as a row to sort: everything its row shows, and its picker's habits
interface CategoryListRow extends SortableRow {
  kind: 'category';
  id: string;
  row: CategoryRowProps;
  sections: PickerSection[];
}

interface HabitListRow extends SortableRow {
  kind: 'habit';
  habit: HabitListItem;
}

// The All Habits list: runs of habits as habit lists, with the categories that have a cadence
// between them as category rows, lined up with the habits' (no chevron, as on the Agenda)
function MixedList({ rows, statuses, user, people }: { rows: (HabitListRow | CategoryListRow)[]; statuses: Record<string, RowStatus>; user: SessionUser; people: Record<string, Person> }) {
  const parts: ReactNode[] = [];
  let run: HabitListItem[] = [];
  const endRun = () => {
    if (run.length === 0) return;
    parts.push(<SortableHabitList key={run[0].id} items={run} statuses={statuses} health user={user} people={people} dndContextId={`all-habits-${run[0].id}`} bare holdToLog showCadence />);
    run = [];
  };
  for (const row of rows) {
    if (row.kind === 'habit') {
      run.push(row.habit);
    } else {
      endRun();
      parts.push(<HoldableCategoryRow key={row.id} id={row.id} sections={row.sections} row={{ ...row.row, alignWithHabitRows: true }} />);
    }
  }
  endRun();
  return parts;
}

// Habits: every category (and uncategorized habits) to browse, with recent activity, or every habit
// in one list along with the categories that have a cadence (`view`), in the user's own order or
// sorted by health, when last done, or name, either way (`sort`, `dir`). The choice is in the URL
// while it's being made, and remembered in cookies for next time (see HabitsControls), with the
// view switched above the list and the sort in its heading. What's due
// lives on the Agenda page; this is where everything else is found. Its rows are laid out like the
// Agenda's, but with each one's health at its start where the Agenda has a ring (see HealthMark), so
// the two don't look alike: these are for seeing how things are going, not what to do now.
export default async function HabitsPage(props: { searchParams: Promise<{ view?: string; sort?: string; dir?: string }> }) {
  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const view = parseHabitsView(searchParams.view ?? cookieStore.get(HABITS_VIEW_COOKIE)?.value);
  const sort = parseHabitsSort(searchParams.sort ?? cookieStore.get(HABITS_SORT_COOKIE)?.value);
  const dir = parseHabitsDir(searchParams.dir ?? cookieStore.get(HABITS_DIR_COOKIE)?.value, sort);

  const user = await getDefaultUser();
  // The 4-week calendars and the rings read entries here (5 weeks, so a month's entries count), and
  // consistency further back; the latest entries are for an every-N-days cadence's older ones, and
  // for when each was last done
  const [categories, uncategorized, latestLogDates, people] = await Promise.all([
    getCategoriesWithHierarchy(CONSISTENCY_HISTORY_WEEKS),
    getUncategorizedHabits(CONSISTENCY_HISTORY_WEEKS),
    getLatestLogDates(),
    getPeople(),
  ]);
  const lastDone = (habits: HabitListItem[]) => {
    const times = habits.flatMap(h => (latestLogDates[h.id] ? [new Date(latestLogDates[h.id]).getTime()] : []));
    return times.length > 0 ? new Date(Math.max(...times)) : null;
  };

  // A category's row: `habits` are every habit counting toward it (a top-level one's subcategories'
  // included), and `children` its subcategories, for its picker
  const categoryRow = (
    cat: { id: string; name: string; icon: string | null; cadence?: string; createdAt: Date; skips?: { day: string }[]; habits: HabitListItem[] },
    habits: HabitListItem[],
    children: Parameters<typeof pickerSections>[1],
    index: number,
  ): CategoryListRow => {
    const cadence = parseCadence(cat.cadence ?? '', NO_CADENCE);
    const status = listRowStatus(cadence, habits.flatMap(h => entryDates(h, latestLogDates)), user, { habit: false, skippedDays: skippedDaysOf(cat), createdAt: cat.createdAt });
    return {
      kind: 'category',
      id: cat.id,
      index,
      name: cat.name,
      lastDone: lastDone(habits),
      consistency: status.consistency,
      sections: pickerSections(cat.habits, children),
      row: {
        href: `/categories/${cat.id}`,
        name: cat.name,
        icon: cat.icon || DEFAULT_CATEGORY_ICON,
        dates: habits.flatMap(h => (h.logs ?? []).map(l => l.createdAt)),
        habitCount: habits.length,
        showCadence: true,
        cadence,
        skippedDays: skippedDaysOf(cat),
        vacations: user.vacations,
        status,
        bedtime: user.bedtime,
        weekStartsOn: user.weekStartsOn,
        timeZone: user.timeZone,
      },
    };
  };

  const categoryRows = sortRows(categories.map((cat, index) => categoryRow(cat, [...cat.habits, ...cat.children.flatMap(c => c.habits)], cat.children, index)), sort, dir);

  // Every habit, and every category with a cadence, in the user's own order: by category, each one
  // first if it has a cadence, then its habits and subcategories in the order they're on its page (a
  // subcategory first if it has a cadence, then its habits), then uncategorized habits
  const hasCadence = (cat: { cadence?: string }) => parseCadence(cat.cadence ?? '', NO_CADENCE).type !== 'none';
  const habitStatuses: Record<string, RowStatus> = {};
  const unsorted: (HabitListRow | CategoryListRow)[] = [];
  const addHabit = (habit: HabitListItem) => {
    const status = listRowStatus(parseCadence(habit.cadence), entryDates(habit, latestLogDates), user, { habit: true, skippedDays: skippedDaysOf(habit), createdAt: habit.createdAt });
    habitStatuses[habit.id] = status;
    const lastDoneAt = latestLogDates[habit.id];
    unsorted.push({ kind: 'habit', habit, index: unsorted.length, name: habit.name, lastDone: lastDoneAt ? new Date(lastDoneAt) : null, consistency: status.consistency });
  };
  for (const cat of categories) {
    if (hasCadence(cat)) unsorted.push(categoryRow(cat, [...cat.habits, ...cat.children.flatMap(c => c.habits)], cat.children, unsorted.length));
    const items = [
      ...cat.habits.map(h => ({ order: h.order ?? 0, habit: h, sub: null })),
      ...cat.children.map(c => ({ order: c.order, habit: null, sub: c })),
    ].sort((a, b) => a.order - b.order);
    for (const item of items) {
      if (item.habit) {
        addHabit(item.habit);
      } else if (item.sub) {
        if (hasCadence(item.sub)) unsorted.push(categoryRow(item.sub, item.sub.habits, [], unsorted.length));
        item.sub.habits.forEach(addHabit);
      }
    }
  }
  uncategorized.forEach(addHabit);
  const allRows = sortRows(unsorted, sort, dir);

  const empty = categoryRows.length === 0 && uncategorized.length === 0;

  return (
    <PanePage
      header={
        <PageHeader
          title="Habits"
          showBack={false}
          actions={
            <div className="flex items-center gap-2">
              <LinkButton href="/create">
                <Plus className="w-5 h-5" />
                New Habit
              </LinkButton>
              <HabitsMenu />
            </div>
          }
        />
      }
    >
      {!empty && (
        <div className={`${PANE_INSET} pt-4`}>
          <HabitsViewSwitcher view={view} sort={sort} dir={dir} />
        </div>
      )}
      <PaneSection
        title={view === 'habits' ? 'All Habits' : 'Categories'}
        empty={(empty || (view === 'habits' && allRows.length === 0)) && (
          <EmptyState title="No habits here yet" action={<LinkButton href="/create" variant="outline">New Habit</LinkButton>}>
            Add a habit, or tap the quill on the Agenda page and tell it something you did.
          </EmptyState>
        )}
        action={!empty && <HabitsSortControls view={view} sort={sort} dir={dir} />}
      >
        {view === 'habits' && <MixedList rows={allRows} statuses={habitStatuses} user={user} people={people} />}
        {/* Empty categories too, so they can be found and given habits */}
        {view === 'categories' && categoryRows.map(cat => (
          <HoldableCategoryRow key={cat.id} id={cat.id} sections={cat.sections} row={cat.row} />
        ))}
        {/* Last whatever the order, since it has no health of its own and isn't one the user made */}
        {view === 'categories' && uncategorized.length > 0 && (
          <HoldableCategoryRow
            id={UNCATEGORIZED_ID}
            sections={[{ subcategory: null, habits: uncategorized }]}
            row={{
              href: `/categories/${UNCATEGORIZED_ID}`,
              name: 'Uncategorized',
              icon: UNCATEGORIZED_ICON,
              dates: uncategorized.flatMap(h => h.logs.map(l => l.createdAt)),
              habitCount: uncategorized.length,
              showCadence: true,
              cadence: NO_CADENCE,
              // No cadence, so never done
              status: listRowStatus(NO_CADENCE, [], user, { habit: false }),
              bedtime: user.bedtime,
              weekStartsOn: user.weekStartsOn,
              timeZone: user.timeZone,
            }}
          />
        )}
      </PaneSection>
    </PanePage>
  );
}
