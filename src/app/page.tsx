import { getHabits, getDefaultUser } from './actions/db';
import Link from 'next/link';
import { Plus, ListTodo, ChevronRight } from 'lucide-react';
import Icon from '../components/Icon';
import ActivityCalendar from '../components/ActivityCalendar';
import QuillIconWavy from '../components/QuillIconWavy';

export default async function Dashboard() {
  const user = await getDefaultUser();
  const habits = await getHabits();

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <p className="text-stone-500 font-semibold text-sm uppercase tracking-wider mb-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              My Habits
            </h1>
          </div>
          {habits.length > 0 && (
            <Link
              href="/create"
              className="inline-flex items-center justify-center p-2 sm:px-4 sm:py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              title="Add Habit"
            >
              <Plus className="w-6 h-6 sm:w-5 sm:h-5 sm:mr-2" strokeWidth={2.5} />
              <span className="hidden sm:inline">Add Habit</span>
            </Link>
          )}
        </div>

        {habits.length === 0 ? (
          <div className="py-24 px-8 sm:px-12 text-center flex flex-col items-center justify-center">
            <img src="/hobbit-hole.svg" alt="Hobbit Hole" className="w-80 max-w-full h-auto opacity-10 mb-8" />
            <h2 className="text-2xl font-semibold text-stone-700 mb-2">No habits here yet</h2>
            <p className="text-base text-stone-500 max-w-sm mb-8">Create your first habit to begin!</p>
            <Link
              href="/create"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Habit
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.values(
              habits.reduce((acc, habit) => {
                const catId = habit.category?.id || 'uncategorized';
                if (!acc[catId]) {
                  acc[catId] = {
                    name: habit.category?.name || 'Other',
                    icon: habit.category?.icon || 'List',
                    habits: []
                  };
                }
                acc[catId].habits.push(habit);
                return acc;
              }, {} as Record<string, { name: string, icon: string, habits: typeof habits }>)
            )
              .sort((a, b) => {
                if (a.name === 'Other') return 1;
                if (b.name === 'Other') return -1;
                return a.name.localeCompare(b.name);
              })
              .map((group) => (
                <div key={group.name} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                    <Icon name={group.icon} className="w-6 h-6 text-stone-500" />
                    <h2 className="text-2xl font-semibold text-stone-800">{group.name}</h2>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
                    {group.habits.map((habit) => {
                      let targetCount = 3;
                      try {
                        targetCount = JSON.parse(habit.schema).targetCount || 3;
                      } catch (e) { }

                      return (
                        <Link
                          key={habit.id}
                          href={`/log/${habit.id}`}
                          className="flex items-stretch transition-colors hover:bg-stone-50 group/row"
                        >
                          <div className="flex-1 flex items-center py-4 px-4 sm:px-6 gap-3 sm:gap-6 min-w-0">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base sm:text-lg font-semibold text-stone-800 group-hover/row:text-emerald-600 transition-colors truncate">
                                {habit.name}
                              </h3>
                            </div>
                            <div className="shrink-0 flex flex-col justify-center">
                              <div className="opacity-80 group-hover/row:opacity-100 transition-opacity">
                                <ActivityCalendar dates={habit.logs.map((l: any) => l.createdAt)} weeks={3} frequency={habit.frequency} targetCount={targetCount} bedtime={user.bedtime} weekStartsOn={user.weekStartsOn} />
                              </div>
                            </div>
                            <div className="shrink-0 text-stone-300 group-hover/row:text-emerald-600 transition-colors">
                              <QuillIconWavy className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}
