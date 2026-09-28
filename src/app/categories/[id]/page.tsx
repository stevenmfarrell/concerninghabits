import { getCategory, getDefaultUser } from '../../actions/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Icon from '../../../components/Icon';
import ActivityCalendar from '../../../components/ActivityCalendar';
import BackButton from '../../history/[id]/BackButton';
import { ChevronRight, } from 'lucide-react';
import QuillIconWavy from '../../../components/QuillIconWavy';
import CategoryMenu from './CategoryMenu';
import { SortableCategoryItemList } from './SortableLists';

export default async function CategoryLogPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ reorder?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const isReordering = searchParams.reorder === 'true';
  const user = await getDefaultUser();
  const category = await getCategory(params.id);

  if (!category) return notFound();

  // Aggregate logs
  const allLogs = [
    ...category.habits.flatMap(h => h.logs),
    ...(category.children ? category.children.flatMap(c => c.habits.flatMap(h => h.logs)) : [])
  ];
  const dates = allLogs.map(l => l.createdAt);
  const habitCount = category.habits.length + (category.children ? category.children.reduce((acc, c) => acc + c.habits.length, 0) : 0);
  const targetCount = habitCount > 0 ? habitCount : 1;

  const isTopLevel = category.parentId === null;

  // Direct habits and subcategories share one order sequence. On ties, habits come first.
  const items = [
    ...category.habits.map(h => ({ type: 'habit' as const, id: h.id, order: h.order ?? 0, data: h })),
    ...(isTopLevel ? category.children : []).map(c => ({ type: 'subcategory' as const, id: c.id, order: c.order, data: c })),
  ].sort((a, b) => a.order - b.order);

  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3 sm:px-8 sm:py-4 flex items-center justify-between shadow-sm">
        <div className="relative z-10">
          <BackButton />
        </div>
        <h1 className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-bold text-stone-900 pointer-events-none px-14">
          <div className="flex items-center gap-2">
            <Icon name={category.icon || 'Folder'} className="w-5 h-5 sm:w-6 sm:h-6 text-stone-500 shrink-0" />
            <span className="truncate">{category.name}</span>
          </div>
        </h1>
        {isReordering ? (
          <div className="relative z-10 shrink-0">
            <Link href={`/categories/${category.id}`} className="px-4 py-1.5 bg-stone-900 text-white font-semibold rounded-lg text-sm hover:bg-stone-800 transition-colors">
              Done
            </Link>
          </div>
        ) : (
          <CategoryMenu categoryId={category.id} />
        )}
      </div>

      <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        
        {/* Component Lists Front and Center */}
        {items.length > 0 && (
          <SortableCategoryItemList items={items} user={user} isReordering={isReordering} />
        )}

        {/* Recent History Card */}
        <Link 
          href={`/categories/${category.id}/history`}
          className="block bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all group mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-800">Recent History</h2>
            <div className="flex items-center text-sm font-medium text-stone-400 group-hover:text-emerald-600 transition-colors">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
          <div className="opacity-80 group-hover:opacity-100 transition-opacity flex justify-center w-full overflow-hidden py-2">
            <ActivityCalendar 
              dates={dates} 
              size="md"
              weeks={5} 
              frequency="multiple" 
              targetCount={targetCount} 
              bedtime={user.bedtime} 
              weekStartsOn={user.weekStartsOn} 
            />
          </div>
        </Link>
        
      </div>
    </main>
  );
}
