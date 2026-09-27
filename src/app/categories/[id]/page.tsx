import { getCategory, getDefaultUser } from '../../actions/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Icon from '../../../components/Icon';
import ActivityCalendar from '../../../components/ActivityCalendar';
import BackButton from '../../history/[id]/BackButton';
import { ChevronRight, } from 'lucide-react';
import QuillIconWavy from '../../../components/QuillIconWavy';
import CategoryMenu from './CategoryMenu';

export default async function CategoryLogPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
        <CategoryMenu />
      </div>

      <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        
        {/* Component Lists Front and Center */}
        {isTopLevel && category.children && category.children.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-stone-900 px-2">Subcategories</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {category.children.map(sub => (
                <Link 
                  key={sub.id} 
                  href={`/categories/${sub.id}`}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all flex justify-between items-center group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                      <Icon name={sub.icon || 'Folder'} className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors">{sub.name}</h3>
                      <p className="text-sm text-stone-500">{sub.habits.length} habits</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-emerald-600 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {category.habits && category.habits.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-stone-900 px-2">Habits in {category.name}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {category.habits.map(habit => {
                let habitTargetCount = 3;
                try {
                  habitTargetCount = JSON.parse(habit.schema).targetCount || 3;
                } catch (e) {}
                  
                return (
                  <div
                    key={habit.id}
                    className="bg-white rounded-2xl shadow-sm border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all flex items-stretch overflow-hidden"
                  >
                    <Link href={`/log/${habit.id}`} className="flex-1 flex items-center justify-between py-3 px-4 sm:px-5 group gap-2 sm:gap-4 min-w-0 hover:bg-emerald-50/50 transition-colors">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-base sm:text-lg font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors truncate">
                          {habit.name}
                        </h3>
                      </div>
                      <div className="shrink-0 text-emerald-600">
                        <QuillIconWavy className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
                      </div>
                    </Link>

                    <div className="border-l border-stone-100 flex flex-col justify-center bg-stone-50/50 shrink-0">
                      <Link
                        href={`/history/${habit.id}`}
                        className="flex items-center justify-center h-full px-4 sm:px-5 hover:bg-stone-100 transition-colors group"
                        title="History preview"
                      >
                        <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                          <ActivityCalendar 
                            dates={habit.logs.map((l: any) => l.createdAt)} 
                            weeks={3} 
                            frequency={habit.frequency} 
                            targetCount={habitTargetCount} 
                            bedtime={user.bedtime} 
                            weekStartsOn={user.weekStartsOn} 
                          />
                        </div>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
