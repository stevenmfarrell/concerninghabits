import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

target = """                  <ActivityCalendar 
                    dates={subLogs} 
                    weeks={3} 
                    frequency="multiple" 
                    targetCount={subTargetCount} 
                    bedtime={user.bedtime} 
                    weekStartsOn={user.weekStartsOn} 
                  />"""

replacement = """                  <ActivityCalendar 
                    dates={subLogs} 
                    weeks={3} 
                    frequency="multiple" 
                    targetCount={subTargetCount} 
                    bedtime={user.bedtime} 
                    weekStartsOn={user.weekStartsOn}
                    emptyColor="bg-stone-200"
                  />"""

content = content.replace(target, replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)

