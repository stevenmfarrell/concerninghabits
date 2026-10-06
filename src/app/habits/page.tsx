import { getCategoriesWithHierarchy, getDefaultUser, getUncategorizedHabits } from '../actions/db';
import { Plus, FolderTree } from 'lucide-react';
import CategoryRow, { type CategoryRowProps } from '@/components/CategoryRow';
import CategoryHoldToLog from '@/components/logging/CategoryHoldToLog';
import { POINTER_ONLY } from '@/components/logging/pointerOnly';
import { LinkButton } from '@/components/ui/Button';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { PanePage, PaneSection } from '@/components/Pane';
import { IconLinkButton } from '@/components/ui/IconButton';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { describeCadence, NO_CADENCE, parseCadence } from '@/lib/cadence';
import { pickerSections, type PickerSection } from '@/lib/dueList';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';

// A category's row, held to pick one of its habits to log. One with no habits has nothing to log, so
// it's a plain row, with room for the button the others have with a mouse, to line its calendar up.
function HoldableCategoryRow({ row, sections }: { row: CategoryRowProps; sections: PickerSection[] }) {
  if (sections.length === 0) {
    return <CategoryRow {...row} action={<span className={`${POINTER_ONLY} w-16`} aria-hidden="true" />} />;
  }
  return <CategoryHoldToLog category={{ name: row.name, icon: row.icon, sections }} row={row} />;
}

// Habits: every category (and uncategorized habits) to browse, with recent activity. What's due
// lives on the Agenda page; this is where everything else is found. Pressing and holding a category
// picks a habit in it to log, as on the Agenda (see CategoryHoldToLog).
export default async function HabitsPage() {
  const user = await getDefaultUser();
  // Only the 4-week calendars read entries here
  const [categories, uncategorized] = await Promise.all([getCategoriesWithHierarchy(), getUncategorizedHabits(5)]);

  const categoryRows = categories
    .map(cat => {
      const habits = [...cat.habits, ...cat.children.flatMap(c => c.habits)];
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon || DEFAULT_CATEGORY_ICON,
        cadence: parseCadence(cat.cadence, NO_CADENCE),
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
            sections={cat.sections}
            row={{
              href: `/categories/${cat.id}`,
              name: cat.name,
              icon: cat.icon,
              dates: cat.dates,
              habitCount: cat.habitCount,
              subtitle: `${cat.habitCount} ${cat.habitCount === 1 ? 'habit' : 'habits'}${cat.cadence.type !== 'none' ? ` · ${describeCadence(cat.cadence)}` : ''}`,
              cadence: cat.cadence,
              bedtime: user.bedtime,
              weekStartsOn: user.weekStartsOn,
              timeZone: user.timeZone,
            }}
          />
        ))}
        {uncategorized.length > 0 && (
          <HoldableCategoryRow
            sections={[{ subcategory: null, habits: uncategorized }]}
            row={{
              href: `/categories/${UNCATEGORIZED_ID}`,
              name: 'Uncategorized',
              icon: UNCATEGORIZED_ICON,
              dates: uncategorized.flatMap(h => h.logs.map(l => l.createdAt)),
              habitCount: uncategorized.length,
              subtitle: `${uncategorized.length} ${uncategorized.length === 1 ? 'habit' : 'habits'}`,
              cadence: NO_CADENCE,
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
