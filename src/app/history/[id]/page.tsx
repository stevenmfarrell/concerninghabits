import { getHabit, getHabitLogs, deleteHabitLog } from '../../actions/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, Settings2, Plus } from 'lucide-react';
import DeleteButton from './DeleteButton';
import ActivityCalendar from '../../../components/ActivityCalendar';
import Icon from '../../../components/Icon';

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getHabit(id);
  
  if (!habit) {
    notFound();
  }

  const logs = await getHabitLogs(id);

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
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
                  {logs.length} total entries
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
          <h2 className="text-lg font-semibold text-stone-800 mb-4 w-full text-left">Activity Overview</h2>
          <div className="hidden sm:block">
            <ActivityCalendar dates={logs.map(l => l.createdAt)} weeks={52} frequency={habit.frequency} size="md" monthsPerColumn={4} />
          </div>
          <div className="block sm:hidden">
            <ActivityCalendar dates={logs.map(l => l.createdAt)} weeks={52} frequency={habit.frequency} size="md" monthsPerColumn={6} />
          </div>
        </div>

        {/* Log Entries Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="p-4 font-semibold text-stone-700">Date & Time</th>
                <th className="p-4 font-semibold text-stone-700">Details</th>
                <th className="p-4 font-semibold text-stone-700 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-stone-500">
                    No logs yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const payload = JSON.parse(log.payload);
                  const hasDetails = Object.keys(payload).length > 0;
                  
                  // Server action bind to delete this specific log
                  const deleteAction = deleteHabitLog.bind(null, log.id, habit.id);
                  
                  return (
                    <tr key={log.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 group">
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
                      <td className="p-4 align-top">
                        <DeleteButton action={deleteAction} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
