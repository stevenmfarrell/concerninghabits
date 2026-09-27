import { getCategoriesWithHierarchy, getDefaultUser } from '../actions/db';
import Link from 'next/link';
import Icon from '../../components/Icon';
import ActivityCalendar from '../../components/ActivityCalendar';
import { ChevronRight, FolderTree } from 'lucide-react';

export default async function CategoriesHub() {
  const user = await getDefaultUser();
  const categories = await getCategoriesWithHierarchy();

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            Categories
          </h1>
          <p className="text-stone-500 mt-2">Heatmaps across all areas of your life</p>
        </div>

        {categories.length === 0 ? (
          <div className="py-24 px-8 text-center flex flex-col items-center justify-center">
            <FolderTree className="w-16 h-16 text-stone-300 mb-4" />
            <h2 className="text-2xl font-semibold text-stone-700 mb-2">No categories yet</h2>
            <p className="text-base text-stone-500 max-w-sm mb-8">Manage categories in your settings to organize your habits.</p>
            <Link
              href="/settings/categories"
              className="inline-flex items-center justify-center px-6 py-3 border border-stone-200 text-base font-medium rounded-xl shadow-sm text-stone-700 bg-white hover:bg-stone-50 transition-colors"
            >
              Manage Categories
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((cat) => {
              const allLogs = [
                ...cat.habits.flatMap(h => h.logs),
                ...cat.children.flatMap(c => c.habits.flatMap(h => h.logs))
              ];
              const dates = allLogs.map(l => l.createdAt);
              const habitCount = cat.habits.length + cat.children.reduce((acc, c) => acc + c.habits.length, 0);
              const targetCount = habitCount > 0 ? habitCount : 1;

              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-2xl shadow-sm border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all flex flex-col sm:flex-row items-stretch overflow-hidden"
                >
                  <Link href={`/categories/${cat.id}`} className="flex-1 flex flex-col justify-center py-4 px-5 group hover:bg-emerald-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                        <Icon name={cat.icon || 'Folder'} className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors truncate">
                          {cat.name}
                        </h3>
                        <p className="text-sm text-stone-500">
                          {habitCount} {habitCount === 1 ? 'habit' : 'habits'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </Link>

                  <div className="border-t sm:border-t-0 sm:border-l border-stone-100 py-3 px-5 flex flex-col justify-center bg-stone-50/50 shrink-0">
                    <div className="opacity-80 transition-opacity mx-auto">
                      <ActivityCalendar 
                        dates={dates} 
                        weeks={3} 
                        frequency="multiple" 
                        targetCount={targetCount} 
                        bedtime={user.bedtime} 
                        weekStartsOn={user.weekStartsOn} 
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
