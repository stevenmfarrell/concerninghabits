import { getCategory, getDefaultUser, getPeople } from '../../actions/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Icon from '../../../components/Icon';
import ActivityCalendar from '../../../components/ActivityCalendar';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PANE_SURFACE, PaneHeading, PanePage, PaneSection } from '@/components/Pane';
import { LinkButton } from '@/components/ui/Button';
import { ChevronRight, } from 'lucide-react';
import CategoryMenu from './CategoryMenu';
import CategoryCadence from './CategoryCadence';
import EmptyState from '@/components/EmptyState';
import { NO_CADENCE, parseCadence } from '@/lib/cadence';
import { UNCATEGORIZED_ID } from '@/lib/constants';
import { SortableCategoryItemList } from './SortableLists';

export default async function CategoryLogPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ reorder?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const isReordering = searchParams.reorder === 'true';
  const user = await getDefaultUser();
  // Only the 5-week "Recent History" card is shown on this page
  const [category, people] = await Promise.all([getCategory(params.id, 5), getPeople()]);

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
              <Icon name={category.icon || 'Folder'} className="w-5 h-5 sm:w-6 sm:h-6 text-stone-500 shrink-0" />
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
        <div className={`${PANE_INSET} py-4 flex justify-center`}>
          <CategoryCadence categoryId={category.id} cadence={cadence} />
        </div>
      )}

      {items.length > 0 ? (
        <PaneSection title="Habits">
          <SortableCategoryItemList items={items} user={user} people={people} isReordering={isReordering} />
        </PaneSection>
      ) : (
        <EmptyState title="No habits in this category yet" action={<LinkButton href={category.id === UNCATEGORIZED_ID ? '/create' : `/create?category=${category.id}`} variant="outline">New Habit</LinkButton>}>
          Add one here, or move an existing habit into this category from its page.
        </EmptyState>
      )}

      <section>
        <PaneHeading
          action={
            <Link
              href={`/categories/${category.id}/history`}
              className="flex items-center text-sm font-medium text-stone-400 hover:text-blue-600 transition-colors"
            >
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          }
        >
          Recent History
        </PaneHeading>
        <Link
          href={`/categories/${category.id}/history`}
          className={`${PANE_SURFACE} ${PANE_INSET} py-4 flex justify-center w-full overflow-hidden opacity-80 hover:opacity-100 transition-opacity`}
          aria-label="Category history"
        >
          <ActivityCalendar
            dates={dates}
            size="md"
            weeks={5}
            {...(cadence.type === 'none' ? { density: habitCount } : { cadence })}
            bedtime={user.bedtime}
            weekStartsOn={user.weekStartsOn}
            timeZone={user.timeZone}
            color="blue"
          />
        </Link>
      </section>
    </PanePage>
  );
}
