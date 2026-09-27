import re

files = [
    "src/app/page.tsx",
    "src/app/categories/[id]/page.tsx"
]

for file_path in files:
    with open(file_path, "r") as f:
        content = f.read()

    # First section replacement
    first_target = """                            <div className="shrink-0 flex items-center gap-2 sm:gap-3 text-stone-300 group-hover:text-emerald-600 transition-colors">
                              <QuillIconWavy className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
                              <ChevronRight className="w-5 h-5" />
                            </div>
                          </Link>"""
                          
    first_replacement = """                            <div className="shrink-0 text-stone-300 group-hover:text-emerald-600 transition-colors">
                              <QuillIconWavy className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
                            </div>
                          </Link>"""

    content = content.replace(first_target, first_replacement)

    # Second section replacement
    second_target = """                            <Link
                              href={`/history/${habit.id}`}
                              className="flex items-center justify-center h-full px-4 sm:px-5 hover:bg-stone-200/50 transition-colors group gap-2 sm:gap-3"
                              title="History preview"
                            >
                              <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                                <ActivityCalendar dates={habit.logs.map((l: any) => l.createdAt)} weeks={3} frequency={habit.frequency} targetCount={targetCount} bedtime={user.bedtime} weekStartsOn={user.weekStartsOn} />
                              </div>
                              <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-emerald-600 transition-colors shrink-0" />
                            </Link>"""

    second_replacement = """                            <Link
                              href={`/history/${habit.id}`}
                              className="flex items-center justify-center h-full px-4 sm:px-6 hover:bg-stone-200/50 transition-colors group"
                              title="History preview"
                            >
                              <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                                <ActivityCalendar dates={habit.logs.map((l: any) => l.createdAt)} weeks={3} frequency={habit.frequency} targetCount={targetCount} bedtime={user.bedtime} weekStartsOn={user.weekStartsOn} />
                              </div>
                            </Link>"""

    # For categories/[id]/page.tsx
    second_target_cat = """                      <Link
                        href={`/history/${habit.id}`}
                        className="flex items-center justify-center h-full px-4 sm:px-5 hover:bg-stone-200/50 transition-colors group gap-2 sm:gap-3"
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
                        <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-emerald-600 transition-colors shrink-0" />
                      </Link>"""

    second_replacement_cat = """                      <Link
                        href={`/history/${habit.id}`}
                        className="flex items-center justify-center h-full px-4 sm:px-6 hover:bg-stone-200/50 transition-colors group"
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
                      </Link>"""
    
    content = content.replace(second_target, second_replacement)
    content = content.replace(second_target_cat, second_replacement_cat)

    with open(file_path, "w") as f:
        f.write(content)

