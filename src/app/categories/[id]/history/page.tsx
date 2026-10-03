import { getCategory, getDefaultUser } from '../../../actions/db';
import { notFound } from 'next/navigation';
import ActivityCalendar from '../../../../components/ActivityCalendar';
import PageHeader from '@/components/PageHeader';
import { IconLinkButton } from '@/components/ui/IconButton';
import QuillIconWavy from '../../../../components/QuillIconWavy';
import { cookies } from 'next/headers';
import HorizonToggle from '../../../history/[id]/HorizonToggle';

export default async function CategoryOverview(props: { params: Promise<{ id: string }>, searchParams: Promise<{ horizon?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const user = await getDefaultUser();

  const cookieStore = await cookies();
  const savedHorizon = cookieStore.get(`horizon_${params.id}`)?.value;
  const horizon = searchParams?.horizon || savedHorizon || '26';
  const weeks = parseInt(horizon, 10);

  const category = await getCategory(params.id, weeks);

  // Use 7 and 5 to guarantee exactly 2 columns (mobile) and 3 columns (desktop)
  // even when the 52-week window bleeds into a 13th calendar month.
  const mobileMonthsPerColumn = weeks === 52 ? 7 : 4;
  const desktopMonthsPerColumn = weeks === 52 ? 5 : 4;

  if (!category) return notFound();

  // Aggregate logs
  const allLogs = [
    ...category.habits.flatMap(h => h.logs),
    ...(category.children ? category.children.flatMap(c => c.habits.flatMap(h => h.logs)) : [])
  ];
  const dates = allLogs.map(l => l.createdAt);
  const habitCount = category.habits.length + (category.children ? category.children.reduce((acc, c) => acc + c.habits.length, 0) : 0);
  const targetCount = habitCount > 0 ? habitCount : 1;

  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <PageHeader
        title={<span className="truncate">{category.name} History</span>}
        actions={
          <IconLinkButton href={`/categories/${category.id}`} variant="accent" edge="right" title="Category Overview">
            <QuillIconWavy className="w-6 h-6" strokeWidth={2.5} />
          </IconLinkButton>
        }
      />

      <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        
        {/* Time Horizon Toolbar */}
        <div className="flex justify-end mb-2">
          <HorizonToggle habitId={category.id} currentWeeks={weeks} />
        </div>

        {/* Aggregated Heatmap */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Activity Heatmap</h2>
          <div className="flex flex-col w-full overflow-x-auto pb-4">
            <div className={`hidden sm:flex w-full ${weeks === 5 ? 'justify-center' : 'justify-center sm:justify-start'}`}>
              <ActivityCalendar dates={dates} weeks={weeks} frequency="multiple" targetCount={targetCount} size="md" monthsPerColumn={desktopMonthsPerColumn} bedtime={user.bedtime} weekStartsOn={user.weekStartsOn} timeZone={user.timeZone} color="blue" />
            </div>
            <div className={`flex sm:hidden w-full ${weeks === 5 ? 'justify-center' : 'justify-start'}`}>
              <ActivityCalendar dates={dates} weeks={weeks} frequency="multiple" targetCount={targetCount} size="md" monthsPerColumn={mobileMonthsPerColumn} bedtime={user.bedtime} weekStartsOn={user.weekStartsOn} timeZone={user.timeZone} color="blue" />
            </div>
          </div>
          <p className="text-center text-sm text-stone-500 mt-2">
            Target density: {targetCount} {targetCount === 1 ? 'habit' : 'habits'} per day
          </p>
        </div>

      </div>
    </main>
  );
}