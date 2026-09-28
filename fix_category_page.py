import re

with open("src/app/categories/[id]/page.tsx", "r") as f:
    content = f.read()

import_target = """import CategoryMenu from './CategoryMenu';"""
import_replacement = """import CategoryMenu from './CategoryMenu';
import { SortableSubcategoryList, SortableHabitList } from './SortableLists';"""
content = content.replace(import_target, import_replacement)

sub_target = """            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
              {category.children.map(sub => (
                <Link 
                  key={sub.id} 
                  href={`/categories/${sub.id}`}
                  className="p-4 sm:p-5 transition-colors hover:bg-stone-50 flex justify-between items-center group"
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
                  <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-emerald-600 transition-colors" />
                </Link>
              ))}
            </div>"""
sub_replacement = """            <SortableSubcategoryList items={category.children} />"""
content = content.replace(sub_target, sub_replacement)

habit_target = """            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
              {category.habits.map(habit => {
                let habitTargetCount = 3;
                try {
                  habitTargetCount = JSON.parse(habit.schema).targetCount || 3;
                } catch (e) {}
                  
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
                          <ActivityCalendar 
                            dates={habit.logs.map((l: any) => l.createdAt)} 
                            weeks={3} 
                            frequency={habit.frequency} 
                            targetCount={habitTargetCount} 
                            bedtime={user.bedtime} 
                            weekStartsOn={user.weekStartsOn} 
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-stone-300 group-hover/row:text-emerald-600 transition-colors">
                        <QuillIconWavy className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>"""
habit_replacement = """            <SortableHabitList items={category.habits} user={user} />"""
content = content.replace(habit_target, habit_replacement)

with open("src/app/categories/[id]/page.tsx", "w") as f:
    f.write(content)

