import re

with open("src/app/categories/[id]/page.tsx", "r") as f:
    content = f.read()

# Add monthsPerColumn logic
logic_target = """  const horizon = searchParams?.horizon || savedHorizon || '26';
  const weeks = parseInt(horizon, 10);"""

logic_replacement = """  const horizon = searchParams?.horizon || savedHorizon || '26';
  const weeks = parseInt(horizon, 10);
  
  const mobileMonthsPerColumn = weeks === 52 ? 6 : 4;
  const desktopMonthsPerColumn = weeks === 52 ? 4 : 4;"""

content = content.replace(logic_target, logic_replacement)

# Replace ActivityCalendar with the two responsive blocks
cal_target = """          <div className="flex justify-center w-full overflow-x-auto pb-4">
            <ActivityCalendar 
              dates={dates} 
              size="md"
              weeks={weeks} 
              frequency="multiple" 
              targetCount={targetCount} 
              bedtime={user.bedtime} 
              weekStartsOn={user.weekStartsOn} 
            />
          </div>"""

cal_replacement = """          <div className="flex flex-col w-full overflow-x-auto pb-4">
            <div className={`hidden sm:flex w-full ${weeks === 5 ? 'justify-center' : 'justify-center sm:justify-start'}`}>
              <ActivityCalendar dates={dates} weeks={weeks} frequency="multiple" targetCount={targetCount} size="md" monthsPerColumn={desktopMonthsPerColumn} bedtime={user.bedtime} weekStartsOn={user.weekStartsOn} />
            </div>
            <div className={`flex sm:hidden w-full ${weeks === 5 ? 'justify-center' : 'justify-start'}`}>
              <ActivityCalendar dates={dates} weeks={weeks} frequency="multiple" targetCount={targetCount} size="md" monthsPerColumn={mobileMonthsPerColumn} bedtime={user.bedtime} weekStartsOn={user.weekStartsOn} />
            </div>
          </div>"""

content = content.replace(cal_target, cal_replacement)

with open("src/app/categories/[id]/page.tsx", "w") as f:
    f.write(content)

