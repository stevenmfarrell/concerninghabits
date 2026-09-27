import re

with open("src/app/categories/[id]/page.tsx", "r") as f:
    content = f.read()

target = """                <div key={habit.id} className="bg-white rounded-2xl shadow-sm border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all flex items-stretch overflow-hidden">
                  <Link href={`/log/${habit.id}`} className="flex-1 flex items-center justify-between py-4 px-5 group min-w-0 hover:bg-emerald-50/50 transition-colors">
                    <h3 className="font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors truncate pr-4">
                      {habit.name}
                    </h3>
                    <QuillIconWavy className="w-6 h-6 shrink-0 text-emerald-600" strokeWidth={2.5} />
                  </Link>
                  <div className="border-l border-stone-100 flex flex-col justify-center bg-stone-50/50 shrink-0">
                    <Link
                      href={`/history/${habit.id}`}
                      className="flex items-center justify-center h-full px-5 hover:bg-stone-100 transition-colors group"
                      title="History preview"
                    >
                      <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-emerald-600 transition-colors" />
                    </Link>
                  </div>
                </div>"""

replacement = """                {(() => {
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
                })()}"""

content = content.replace(target, replacement)

with open("src/app/categories/[id]/page.tsx", "w") as f:
    f.write(content)
