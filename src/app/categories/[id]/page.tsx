import { getCategory, getDefaultUser, getPeople } from '../../actions/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Icon from '../../../components/Icon';
import ActivityCalendar from '../../../components/ActivityCalendar';
import PageHeader from '@/components/PageHeader';
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
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <PageHeader
        title={
          <>
            <Icon name={category.icon || 'Folder'} className="w-5 h-5 sm:w-6 sm:h-6 text-stone-500 shrink-0" />
            <span className="truncate">{category.name}</span>
          </>
        }
        actions={
          isReordering ? (
            <LinkButton href={`/categories/${category.id}`} variant="secondary" size="sm">
              Done
            </LinkButton>
          ) : (
            <CategoryMenu categoryId={category.id} />
          )
        }
      />

      <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        
        {category.id !== UNCATEGORIZED_ID && (
          <div className="flex justify-center">
            <CategoryCadence categoryId={category.id} cadence={cadence} />
          </div>
        )}

        {/* Component Lists Front and Center */}
        {items.length > 0 ? (
          <SortableCategoryItemList items={items} user={user} people={people} isReordering={isReordering} />
        ) : (
          <EmptyState title="No habits in this category yet" action={<LinkButton href={category.id === UNCATEGORIZED_ID ? '/create' : `/create?category=${category.id}`} variant="outline">New Habit</LinkButton>}>
            Add one here, or move an existing habit into this category from its page.
          </EmptyState>
        )}

        {/* Recent History Card */}
        <Link 
          href={`/categories/${category.id}/history`}
          className="block bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all group mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-800">Recent History</h2>
            <div className="flex items-center text-sm font-medium text-stone-400 group-hover:text-blue-600 transition-colors">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
          <div className="opacity-80 group-hover:opacity-100 transition-opacity flex justify-center w-full overflow-hidden py-2">
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
          </div>
        </Link>
        
      </div>
    </main>
  );
}
