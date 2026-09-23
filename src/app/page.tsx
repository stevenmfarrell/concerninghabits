import { getHabits, getDefaultUser } from './actions/db';
import Link from 'next/link';
import { Plus, ListTodo, SquarePen } from 'lucide-react';
import Icon from '../components/Icon';
import ActivityCalendar from '../components/ActivityCalendar';

export default async function Dashboard() {
  const user = await getDefaultUser();
  const habits = await getHabits();

  return (
    <main className="min-h-screen p-8 bg-stone-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-700 rounded-full flex items-center justify-center shadow-md border-2 border-emerald-800/20">
              <Icon name="Trees" className="w-8 h-8 text-emerald-50" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-stone-800 tracking-tight">Concerning Habits</h1>
              <p className="text-stone-500 font-medium mt-1 text-sm">
                The <span className="text-stone-700 font-semibold">{user.family.name}</span> Shire &bull; Logged in as <span className="text-stone-700 font-semibold">{user.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/settings/categories"
              className="px-4 py-3 bg-white text-stone-700 border border-stone-200 rounded-xl font-medium hover:bg-stone-50 transition-colors flex items-center gap-2"
              title="Settings"
            >
              <Icon name="Settings" className="w-5 h-5" />
            </Link>
            <Link 
              href="/create"
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Habit
            </Link>
          </div>
        </div>

        {habits.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-stone-100 text-center space-y-4">
            <ListTodo className="w-16 h-16 text-stone-300 mx-auto" />
            <h2 className="text-2xl font-semibold text-stone-700">No habits yet</h2>
            <p className="text-stone-500">Create your first habit to start tracking!</p>
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {group.habits.map((habit) => (
                    <div 
                      key={habit.id} 
                      className="bg-white rounded-2xl shadow-sm border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all flex items-stretch"
                    >
                      <Link href={`/history/${habit.id}`} className="flex-1 flex items-center justify-between py-3 px-5 group gap-4 min-w-0">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors truncate">
                            {habit.name}
                          </h3>
                        </div>
                        
                        <div className="shrink-0">
                          <ActivityCalendar dates={habit.logs.map((l: any) => l.createdAt)} weeks={5} frequency={habit.frequency} />
                        </div>
                      </Link>
                      
                      <div className="border-l border-stone-100 flex flex-col justify-center bg-stone-50/50 rounded-r-2xl shrink-0">
                        <Link 
                          href={`/log/${habit.id}`}
                          className="text-emerald-600 font-medium flex items-center justify-center h-full px-6 hover:bg-emerald-100/50 transition-colors rounded-r-2xl"
                          title="Log entry"
                        >
                          <SquarePen className="w-6 h-6" strokeWidth={2} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
