import { getHabit, getHabitLogs, deleteHabitLog, getDefaultUser } from '../../actions/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Settings2, Plus } from 'lucide-react';
import { cookies } from 'next/headers';
import DeleteButton from './DeleteButton';
import InteractiveCalendar from './InteractiveCalendar';
import Icon from '../../../components/Icon';
import HorizonToggle from './HorizonToggle';
import HabitChart from './HabitChart';

export default async function HistoryPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ horizon?: string, page?: string, highlight?: string, t?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { id } = params;
  
  const user = await getDefaultUser();
  const habit = await getHabit(id);
  
  if (!habit) {
    notFound();
  }

  const logs = await getHabitLogs(id);
  
  const cookieStore = await cookies();
  const savedHorizon = cookieStore.get(`horizon_${id}`)?.value;
  
  const horizon = searchParams?.horizon || savedHorizon || '26';
  const weeks = parseInt(horizon, 10);
  
  // To get 2 columns for 26 weeks, we need to wrap at 4 months, because 26 weeks spans ~7 calendar months.
  // To get 1 column for 13 weeks, we wrap at 4 months (spans ~4 calendar months).
  const mobileMonthsPerColumn = weeks === 52 ? 6 : 4;
  const desktopMonthsPerColumn = weeks === 52 ? 4 : 4;

  // Filter logs based on chosen horizon cutoff date
  const now = new Date();
  const cutoffDate = new Date(now);
  if (weeks >= 52) {
    cutoffDate.setMonth(cutoffDate.getMonth() - 11);
    cutoffDate.setDate(1);
  } else if (weeks > 7) {
    cutoffDate.setDate(now.getDate() - weeks * 7 + 1);
    cutoffDate.setDate(1);
  } else {
    cutoffDate.setDate(now.getDate() - weeks * 7 + 1);
  }
  cutoffDate.setHours(0, 0, 0, 0);

  const filteredLogs = logs.filter(l => new Date(l.createdAt) >= cutoffDate);
  
  // Pagination
  const pageParam = searchParams?.page || '1';
  const page = parseInt(pageParam, 10) || 1;
  const pageSize = 5;
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);
  
  // Extract numeric fields for plotting
  let numericFields: string[] = [];
  try {
    const schemaObj = JSON.parse(habit.schema || '{}');
    const properties = schemaObj.properties || {};
    numericFields = Object.keys(properties).filter(
      key => properties[key].type === 'number' || properties[key].type === 'integer'
    );
  } catch (e) {
    // Ignore JSON parse errors
  }

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6">
            <div className="flex items-start gap-4 min-w-0 w-full sm:w-auto">
              <div className="w-12 h-12 bg-emerald-700 rounded-full flex items-center justify-center shadow-md border-2 border-emerald-800/20 shrink-0">
                <Icon name={habit.category?.icon || 'Trees'} className="w-6 h-6 text-emerald-50" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-800 tracking-tight break-words">{habit.name}</h1>
                  <span className="px-2 py-1 bg-stone-200 text-stone-600 text-[10px] sm:text-xs font-bold rounded-md uppercase tracking-widest shrink-0">{habit.frequency}</span>
                </div>
                {habit.description && <p className="text-stone-600 mt-1">{habit.description}</p>}
                <div className="text-sm font-medium text-stone-500 mt-3">
                  {filteredLogs.length} entries in view
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link 
                href={`/edit/${habit.id}`}
                className="px-4 py-3 bg-white text-stone-700 border border-stone-200 rounded-xl font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none"
              >
                <Settings2 className="w-5 h-5 shrink-0" /> Edit
              </Link>
              <Link 
                href={`/log/${habit.id}`}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none"
              >
                <Plus className="w-5 h-5 shrink-0" /> Log Entry
              </Link>
            </div>
          </div>
        </div>

        {/* Activity Graphic */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col items-start overflow-x-auto">
          <div className="flex w-full items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-800">Activity Overview</h2>
            <HorizonToggle habitId={habit.id} currentWeeks={weeks} />
          </div>
          <InteractiveCalendar 
            logs={filteredLogs.map(l => ({ id: l.id, createdAt: l.createdAt }))} 
            weeks={weeks} 
            frequency={habit.frequency} 
            mobileMonthsPerColumn={mobileMonthsPerColumn} 
            desktopMonthsPerColumn={desktopMonthsPerColumn} 
            bedtime={user.bedtime} 
            weekStartsOn={user.weekStartsOn} 
            pageSize={pageSize}
            habitId={habit.id}
          />
        </div>
        {numericFields.length > 0 && (
          <HabitChart 
            logs={filteredLogs.map(l => ({ id: l.id, createdAt: l.createdAt, payload: l.payload }))}
            numericFields={numericFields}
            pageSize={pageSize}
            habitId={habit.id}
          />
        )}

        {/* Log Entries Table */}
        <div id="logs-table" className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden scroll-mt-24">
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
                    No logs yet.
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
                      key={isHighlighted ? `${log.id}-${searchParams?.t || '1'}` : log.id} 
                      className={`border-b border-stone-50 last:border-0 group transition-colors ${
                        isHighlighted ? 'animate-highlight-fade' : 'hover:bg-stone-50/50'
                      }`}
                    >
                      <td className="p-4 text-stone-800 whitespace-nowrap align-top">
                        {new Date(log.createdAt).toLocaleString(undefined, { 
                          dateStyle: 'medium', 
                          timeStyle: 'short' 
                        })}
                      </td>
                      <td className="p-4 text-stone-600">
                        {hasDetails ? (
                          <div className="space-y-1">
                            {Object.entries(payload).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium text-stone-700 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>{' '}
                                {String(value)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400 italic text-sm">Completed</span>
                        )}
                      </td>
                      <td className="p-4 align-top text-right">
                        <DeleteButton action={deleteAction} />
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
                  href={`/history/${habit.id}?horizon=${weeks}&page=${page > 1 ? page - 1 : 1}`}
                  scroll={false}
                  className={`px-3 py-1 text-sm font-semibold rounded-lg border transition-colors ${page === 1 ? 'border-stone-200 text-stone-400 pointer-events-none' : 'border-stone-300 text-stone-700 hover:bg-stone-100'}`}
                >
                  Previous
                </Link>
                <Link
                  href={`/history/${habit.id}?horizon=${weeks}&page=${page < totalPages ? page + 1 : totalPages}`}
                  scroll={false}
                  className={`px-3 py-1 text-sm font-semibold rounded-lg border transition-colors ${page === totalPages ? 'border-stone-200 text-stone-400 pointer-events-none' : 'border-stone-300 text-stone-700 hover:bg-stone-100'}`}
                >
                  Next
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
