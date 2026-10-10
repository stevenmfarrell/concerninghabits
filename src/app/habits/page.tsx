import { getCategoriesWithHierarchy, getDefaultUser, getLatestLogDates, getUncategorizedHabits } from '../actions/db';
import { Plus, FolderTree } from 'lucide-react';
import CategoryRow, { type CategoryRowProps } from '@/components/CategoryRow';
import CategoryHoldToLog from '@/components/logging/CategoryHoldToLog';
import LogRing from '@/components/logging/LogRing';
import { LinkButton } from '@/components/ui/Button';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { PanePage, PaneSection } from '@/components/Pane';
import { IconLinkButton } from '@/components/ui/IconButton';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { NO_CADENCE, parseCadence } from '@/lib/cadence';
import { entryDates, listRowStatus, pickerSections, skippedDaysOf, type PickerSection } from '@/lib/dueList';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';

// A category's row, with a ring that opens a picker of its habits to log, as does holding the row
// (see CategoryHoldToLog). One with no habits has nothing to log, so its ring can't be tapped.
function HoldableCategoryRow({ id, row, sections }: { id: string; row: CategoryRowProps; sections: PickerSection[] }) {
  if (sections.length === 0) {
    return <CategoryRow {...row} leading={row.status && <LogRing status={row.status} label="No habits to log" color="blue" disabled />} />;
  }
  return <CategoryHoldToLog category={{ id, name: row.name, icon: row.icon, sections }} row={row} />;
}

// Habits: every category (and uncategorized habits) to browse, with recent activity. What's due
// lives on the Agenda page; this is where everything else is found. Its rows are laid out like the
// Agenda's, a ring at the start of each to log a habit in it, and its cadence under its name, but
// they stay when they're done, their rings checked (see listRowStatus).
export default async function HabitsPage() {
  const user = await getDefaultUser();
  // The 4-week calendars and the rings read entries here (5 weeks, so a month's entries count); the
  // latest entries are for an every-N-days cadence's older ones
  const [categories, uncategorized, latestLogDates] = await Promise.all([getCategoriesWithHierarchy(), getUncategorizedHabits(5), getLatestLogDates()]);

  const categoryRows = categories
    .map(cat => {
      const habits = [...cat.habits, ...cat.children.flatMap(c => c.habits)];
      const cadence = parseCadence(cat.cadence, NO_CADENCE);
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon || DEFAULT_CATEGORY_ICON,
        cadence,
        status: listRowStatus(cadence, habits.flatMap(h => entryDates(h, latestLogDates)), user, { habit: false, skippedDays: skippedDaysOf(cat) }),
        skippedDays: skippedDaysOf(cat),
        habitCount: habits.length,
        dates: habits.flatMap(h => h.logs.map(l => l.createdAt)),
        sections: pickerSections(cat.habits, cat.children),
      };
    });

  return (
    <PanePage
      header={
        <PageHeader
          title="Habits"
          showBack={false}
          actions={
            <LinkButton href="/create">
              <Plus className="w-5 h-5" />
              New Habit
            </LinkButton>
          }
        />
      }
    >
      {/* Shown even with no categories yet, for its Manage Categories link */}
      <PaneSection
        title="Categories"
        empty={categoryRows.length === 0 && uncategorized.length === 0 && (
          <EmptyState title="No habits here yet" action={<LinkButton href="/create" variant="outline">New Habit</LinkButton>}>
            Add a habit, or tap the quill on the Agenda page and tell it something you did.
          </EmptyState>
        )}
        action={
          <IconLinkButton href="/settings/categories" size="sm" edge="right" title="Manage Categories" aria-label="Manage Categories">
            <FolderTree className="w-5 h-5" />
          </IconLinkButton>
        }
      >
        {/* Empty categories too, so they can be found and given habits */}
        {categoryRows.map(cat => (
          <HoldableCategoryRow
            key={cat.id}
            id={cat.id}
            sections={cat.sections}
            row={{
              href: `/categories/${cat.id}`,
              name: cat.name,
              icon: cat.icon,
              dates: cat.dates,
              habitCount: cat.habitCount,
              showCadence: true,
              cadence: cat.cadence,
              skippedDays: cat.skippedDays,
              status: cat.status,
              bedtime: user.bedtime,
              weekStartsOn: user.weekStartsOn,
              timeZone: user.timeZone,
            }}
          />
        ))}
        {uncategorized.length > 0 && (
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
