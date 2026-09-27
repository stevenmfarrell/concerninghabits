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
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
            {categories.map((cat) => {
              const allLogs = [
                ...cat.habits.flatMap(h => h.logs),
                ...cat.children.flatMap(c => c.habits.flatMap(h => h.logs))
              ];
              const dates = allLogs.map(l => l.createdAt);
              const habitCount = cat.habits.length + cat.children.reduce((acc, c) => acc + c.habits.length, 0);
              const targetCount = habitCount > 0 ? habitCount : 1;

              return (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.id}`}
                  className="flex items-stretch transition-colors hover:bg-stone-50 group/row"
                >
                  <div className="flex-1 flex items-center py-4 px-4 sm:px-6 gap-3 sm:gap-6 min-w-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover/row:bg-emerald-100 group-hover/row:text-emerald-600 transition-colors shrink-0">
                        <Icon name={cat.icon || 'Folder'} className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-stone-800 group-hover/row:text-emerald-600 transition-colors truncate">
                          {cat.name}
                        </h3>
                        <p className="text-sm text-stone-500">
                          {habitCount} {habitCount === 1 ? 'habit' : 'habits'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="shrink-0 flex flex-col justify-center">
                      <div className="opacity-80 group-hover/row:opacity-100 transition-opacity">
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
                    <div className="shrink-0 text-stone-300 group-hover/row:text-emerald-600 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
