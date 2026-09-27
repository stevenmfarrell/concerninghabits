import re

with open("src/app/categories/[id]/page.tsx", "r") as f:
    content = f.read()

# Add imports
content = content.replace(
    "import QuillIconWavy from '../../../components/QuillIconWavy';",
    "import QuillIconWavy from '../../../components/QuillIconWavy';\nimport { cookies } from 'next/headers';\nimport HorizonToggle from '../../history/[id]/HorizonToggle';"
)

# Update function signature to accept searchParams
content = content.replace(
    "export default async function CategoryOverview(props: { params: Promise<{ id: string }> }) {",
    "export default async function CategoryOverview(props: { params: Promise<{ id: string }>, searchParams: Promise<{ horizon?: string }> }) {"
)

# Add searchParams, cookies, horizon
target_logic = """  const params = await props.params;
  const user = await getDefaultUser();
  const category = await getCategory(params.id);"""

replacement_logic = """  const params = await props.params;
  const searchParams = await props.searchParams;
  const user = await getDefaultUser();
  const category = await getCategory(params.id);
  
  const cookieStore = await cookies();
  const savedHorizon = cookieStore.get(`horizon_${params.id}`)?.value;
  const horizon = searchParams?.horizon || savedHorizon || '26';
  const weeks = parseInt(horizon, 10);"""

content = content.replace(target_logic, replacement_logic)

# Replace Activity Heatmap section
heatmap_target = """        {/* Aggregated Heatmap */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <h2 className="text-lg font-semibold text-stone-800 mb-6">Activity Heatmap</h2>
          <div className="flex justify-center w-full overflow-x-auto pb-4">
            <ActivityCalendar 
              dates={dates} 
              size="md"
              weeks={52} 
              frequency="multiple" 
              targetCount={targetCount} 
              bedtime={user.bedtime} 
              weekStartsOn={user.weekStartsOn} 
            />
          </div>
          <p className="text-center text-sm text-stone-500 mt-2">
            Target density: {targetCount} {targetCount === 1 ? 'habit' : 'habits'} per day
          </p>
        </div>"""

heatmap_replacement = """        {/* Time Horizon Toolbar */}
        <div className="flex justify-end mb-2">
          <HorizonToggle habitId={category.id} currentWeeks={weeks} basePath="/categories" />
        </div>

        {/* Aggregated Heatmap */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Activity Heatmap</h2>
          <div className="flex justify-center w-full overflow-x-auto pb-4">
            <ActivityCalendar 
              dates={dates} 
              size="md"
              weeks={weeks} 
              frequency="multiple" 
              targetCount={targetCount} 
              bedtime={user.bedtime} 
              weekStartsOn={user.weekStartsOn} 
            />
          </div>
          <p className="text-center text-sm text-stone-500 mt-2">
            Target density: {targetCount} {targetCount === 1 ? 'habit' : 'habits'} per day
          </p>
        </div>"""

content = content.replace(heatmap_target, heatmap_replacement)

with open("src/app/categories/[id]/page.tsx", "w") as f:
    f.write(content)

