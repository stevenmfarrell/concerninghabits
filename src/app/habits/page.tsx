import { getCategoriesWithHierarchy, getDefaultUser, getLatestLogDates, getUncategorizedHabits } from '../actions/db';
import { Plus, FolderTree } from 'lucide-react';
import CategoryRow, { type CategoryRowProps } from '@/components/CategoryRow';
import CategoryHoldToLog from '@/components/logging/CategoryHoldToLog';
import { HealthMark } from '@/components/HealthPlant';
import { LinkButton } from '@/components/ui/Button';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { PanePage, PaneSection } from '@/components/Pane';
import { IconLinkButton } from '@/components/ui/IconButton';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { NO_CADENCE, parseCadence } from '@/lib/cadence';
import { entryDates, listRowStatus, pickerSections, skippedDaysOf, type PickerSection } from '@/lib/dueList';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';
import { CONSISTENCY_HISTORY_WEEKS } from '@/lib/consistency';

// A category's row, with its health at its start (see HealthMark), that opens a picker of its habits
// to log by holding the row, or with a mouse its button (see CategoryHoldToLog). One with no habits
// has nothing to log.
function HoldableCategoryRow({ id, row, sections }: { id: string; row: CategoryRowProps; sections: PickerSection[] }) {
  if (sections.length === 0) {
    return <CategoryRow {...row} leading={<HealthMark consistency={row.status?.consistency} />} />;
  }
  return <CategoryHoldToLog category={{ id, name: row.name, icon: row.icon, sections }} row={row} health />;
}

// Habits: every category (and uncategorized habits) to browse, with recent activity. What's due
// lives on the Agenda page; this is where everything else is found. Its rows are laid out like the
// Agenda's, but with each one's health at its start where the Agenda has a ring (see HealthMark),
// so the two don't look alike: these are for seeing how things are going, not what to do now.
export default async function HabitsPage() {
  const user = await getDefaultUser();
  // The 4-week calendars and the rings read entries here (5 weeks, so a month's entries count), and a
  // category's consistency further back; the latest entries are for an every-N-days cadence's older ones
  const [categories, uncategorized, latestLogDates] = await Promise.all([getCategoriesWithHierarchy(CONSISTENCY_HISTORY_WEEKS), getUncategorizedHabits(5), getLatestLogDates()]);

  const categoryRows = categories
    .map(cat => {
      const habits = [...cat.habits, ...cat.children.flatMap(c => c.habits)];
      const cadence = parseCadence(cat.cadence, NO_CADENCE);
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon || DEFAULT_CATEGORY_ICON,
        cadence,
        status: listRowStatus(cadence, habits.flatMap(h => entryDates(h, latestLogDates)), user, { habit: false, skippedDays: skippedDaysOf(cat), createdAt: cat.createdAt }),
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
