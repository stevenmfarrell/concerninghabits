import { getCategories, getHabit, getHabitLogs, getHabitLogPresence, deleteHabitLog, getDefaultUser, getPeople } from '../../actions/db';
import PersonLabel from '@/components/PersonLabel';
import HorizonToggle from '@/components/HorizonToggle';
import { isSharedHabit } from '@/lib/userColors';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import LogClient from './LogClient';
import DeleteButton from './DeleteButton';
import InteractiveCalendar from './InteractiveCalendar';
import HabitChart from './HabitChart';
import ExportCsvButton from './ExportCsvButton';
import { formatLogValue } from '../../../lib/format';
import { parseBedtimeOffsetMinutes, toCivilDate } from '../../../lib/timezone';
import { parseCadence } from '@/lib/cadence';
import type { HabitSchema } from '@/lib/types';

// A habit's page: the Log Habit button (see LogClient), then its history: an activity calendar over
// the chosen horizon, a chart of its numeric fields, and its entries, a page at a time.
export default async function HabitPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ horizon?: string, page?: string, highlight?: string, t?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { id } = params;

  const [user, habit, logs, presence, allPeople, categories] = await Promise.all([
    getDefaultUser(),
    getHabit(id),
    // These reject if the viewer can't see the habit, in which case getHabit returns null and the
    // page 404s below.
    getHabitLogs(id).catch(() => null),
    getHabitLogPresence(id).catch(() => null),
    getPeople(),
    getCategories(),
  ]);

  if (!habit || !logs || !presence) {
    notFound();
  }

  // A habit that's shared (or was: a removed member's entries stay) is color coded by who logged
  // each entry. `people` is only set in that case, which is what switches the coloring on. The
  // entries may predate `logs`, which only reaches back as far as the longest horizon.
  const people = isSharedHabit(habit.userId, habit.memberIds.length, logs) || presence.hasLogsFromOthers ? allPeople : undefined;

  const cookieStore = await cookies();
  const savedHorizon = cookieStore.get(`horizon_${id}`)?.value;
  const savedChartField = cookieStore.get(`chartField_${id}`)?.value;
  
  const horizon = searchParams?.horizon || savedHorizon || '26';
  const weeks = parseInt(horizon, 10);
  
  // To get 2 columns for 26 weeks, we need to wrap at 4 months, because 26 weeks spans ~7 calendar months.
  // To get 1 column for 13 weeks, we wrap at 4 months (spans ~4 calendar months).
  // Use 7 and 5 to guarantee exactly 2 columns (mobile) and 3 columns (desktop) 
  // even when the 52-week window bleeds into a 13th calendar month.
  const mobileMonthsPerColumn = weeks === 52 ? 7 : 4;
  const desktopMonthsPerColumn = weeks === 52 ? 5 : 4;

  // Filter logs based on chosen horizon cutoff date. Days are calendar days in the viewer's time zone,
  // with the same bedtime rule as the calendar (see ActivityCalendar).
  const bedtimeOffsetMinutes = parseBedtimeOffsetMinutes(user.bedtime);
  const today = toCivilDate(new Date(), user.timeZone, bedtimeOffsetMinutes);
  const cutoffDate = new Date(today);
  if (weeks >= 52) {
    cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - 11);
    cutoffDate.setUTCDate(1);
  } else if (weeks > 7) {
    cutoffDate.setUTCDate(today.getUTCDate() - weeks * 7 + 1);
    cutoffDate.setUTCDate(1);
  } else {
    cutoffDate.setUTCDate(today.getUTCDate() - weeks * 7 + 1);
  }

  const filteredLogs = logs.filter(l => toCivilDate(l.createdAt, user.timeZone, bedtimeOffsetMinutes) >= cutoffDate);

  // The legend lists current members plus anyone else who logged in this period, in account order
  const legendIds = new Set([...habit.memberIds, ...filteredLogs.map(l => l.userId)]);
  const legend = people ? Object.values(people).filter(p => legendIds.has(p.id)) : [];

  // Pagination
  const pageParam = searchParams?.page || '1';
  const page = parseInt(pageParam, 10) || 1;
  const pageSize = 5;
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);
  
  // Extract numeric fields for plotting
  let numericFields: string[] = [];
  const defaultChartTypes: Record<string, 'line' | 'bar'> = {};
  
  let schemaObj: HabitSchema = { type: 'object', properties: {} };
  try {
    schemaObj = JSON.parse(habit.schema || '{}');
    const properties = (schemaObj.properties || {}) as Record<string, { type?: string }>;
    numericFields = Object.keys(properties).filter(
      key => properties[key].type === 'number' || properties[key].type === 'integer'
    );
    numericFields.forEach(field => {
      const savedType = cookieStore.get(`chartType_${habit.id}_${field}`)?.value;
      defaultChartTypes[field] = (savedType === 'bar') ? 'bar' : 'line';
    });
  } catch {
    // Ignore JSON parse errors
  }
  const schemaProperties = schemaObj.properties as Record<string, { 'x-widget'?: string; 'x-unit'?: string }> | undefined;

  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <LogClient habit={habit} user={user} people={allPeople} categories={categories}>
        {!presence.hasLogs ? (
          <div className="py-24 px-8 sm:px-12 text-center flex flex-col items-center justify-center">
            <img src="/hobbit-hole.svg" alt="Hobbit Hole" className="w-80 max-w-full h-auto opacity-10 mb-8" />
            <h2 className="text-2xl font-semibold text-stone-700 mb-2">No logs here yet</h2>
            <p className="text-base text-stone-500 max-w-sm">Time to step out your front door and start an adventure. Log your first entry!</p>
          </div>
        ) : (
          <>
            {/* Activity Graphic */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col items-start overflow-x-auto">
              <div className="flex items-center justify-between gap-2 w-full mb-4">
                <h2 className="text-lg font-semibold text-stone-800">Activity Overview</h2>
                <HorizonToggle habitId={habit.id} currentWeeks={weeks} />
              </div>
          <InteractiveCalendar
            logs={filteredLogs.map(l => ({ id: l.id, createdAt: l.createdAt, userId: l.userId }))}
            people={people}
            weeks={weeks} 
            cadence={parseCadence(habit.cadence)}
            mobileMonthsPerColumn={mobileMonthsPerColumn} 
            desktopMonthsPerColumn={desktopMonthsPerColumn} 
            bedtime={user.bedtime} 
            weekStartsOn={user.weekStartsOn} 
            timeZone={user.timeZone}
            pageSize={pageSize}
            habitId={habit.id}
          />
          {legend.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
              {legend.map(person => <PersonLabel key={person.id} person={person} />)}
            </div>
          )}
        </div>
        {numericFields.length > 0 && (
          <HabitChart 
            logs={filteredLogs.map(l => ({ id: l.id, createdAt: l.createdAt, payload: l.payload, userId: l.userId }))}
            people={people}
            numericFields={numericFields}
            pageSize={pageSize}
            habitId={habit.id}
            defaultSelectedField={savedChartField && numericFields.includes(savedChartField) ? savedChartField : numericFields[0]}
            defaultChartTypes={defaultChartTypes}
            schemaObj={schemaObj}
            timeZone={user.timeZone}
          />
        )}

        {/* Log Entries Table */}
        <div id="logs-table" className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden scroll-mt-24">
          <div className="flex items-center justify-between p-4 border-b border-stone-100">
            <h2 className="text-lg font-semibold text-stone-800">Log Entries</h2>
            <ExportCsvButton habitId={habit.id} />
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="p-4 font-semibold text-stone-700">Date & Time</th>
                <th className="p-4 font-semibold text-stone-700">Details</th>
                <th className="p-4 font-semibold text-stone-700 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-stone-500">
                    No logs found in this period.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const payload = JSON.parse(log.payload);
                  const hasDetails = Object.keys(payload).length > 0;
                  const isHighlighted = searchParams?.highlight === log.id;
                  
                  // Server action bind to delete this specific log
                  const deleteAction = deleteHabitLog.bind(null, log.id, habit.id);
                  
                  return (
                    <tr 
                      id={`log-${log.id}`}
                      key={isHighlighted ? `${log.id}-${searchParams?.t || '1'}` : log.id} 
                      className={`border-b border-stone-50 last:border-0 group transition-colors ${
                        isHighlighted ? 'animate-highlight-fade' : 'hover:bg-stone-50/50'
                      }`}
                    >
                      <td className="p-4 text-stone-800 whitespace-nowrap align-top w-px">
                        <div className="inline-flex flex-col">
                          <span className="font-medium">
                            {new Date(log.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: user.timeZone })}
                          </span>
                          <span className="text-sm text-stone-500 text-right">
                            {new Date(log.createdAt).toLocaleTimeString('en-US', { timeStyle: 'short', timeZone: user.timeZone })}
                          </span>
                          {people && <PersonLabel person={people[log.userId]} className="mt-1.5 justify-end" />}
                        </div>
                      </td>
                      <td className="p-4 text-stone-600">
                        {hasDetails ? (
                          <div className="space-y-1">
                            {Object.entries(payload).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium text-stone-700 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>{' '}
                                {formatLogValue(value, schemaProperties?.[key])}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400 italic text-sm">Completed</span>
                        )}
                      </td>
                      <td className="p-4 align-top text-right">
                        {log.canDelete && <DeleteButton action={deleteAction} />}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/50">
              <span className="text-sm text-stone-500 font-medium">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredLogs.length)} of {filteredLogs.length}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/log/${habit.id}?horizon=${weeks}&page=${page > 1 ? page - 1 : 1}`}
                  scroll={false} replace
                  className={`px-3 py-1 text-sm font-semibold rounded-lg border transition-colors ${page === 1 ? 'border-stone-200 text-stone-400 pointer-events-none' : 'border-stone-300 text-stone-700 hover:bg-stone-100'}`}
                >
                  Previous
                </Link>
                <Link
                  href={`/log/${habit.id}?horizon=${weeks}&page=${page < totalPages ? page + 1 : totalPages}`}
                  scroll={false} replace
                  className={`px-3 py-1 text-sm font-semibold rounded-lg border transition-colors ${page === totalPages ? 'border-stone-200 text-stone-400 pointer-events-none' : 'border-stone-300 text-stone-700 hover:bg-stone-100'}`}
                >
                  Next
                </Link>
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </LogClient>
    </main>
  );
}
