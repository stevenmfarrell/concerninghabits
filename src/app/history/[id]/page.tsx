import { getHabit, getHabitLogs, deleteHabitLog } from '../../actions/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, Settings2, Plus } from 'lucide-react';
import DeleteButton from './DeleteButton';
import ActivityCalendar from '../../../components/ActivityCalendar';

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getHabit(id);
  
  if (!habit) {
    notFound();
  }

  const logs = await getHabitLogs(id);

  return (
    <main className="min-h-screen p-8 bg-slate-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-900">{habit.name}</h1>
                <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-md uppercase tracking-widest">{habit.frequency}</span>
              </div>
              {habit.description && <p className="text-slate-600 mt-2">{habit.description}</p>}
              <div className="text-sm font-medium text-slate-500 mt-3">
                {logs.length} total entries
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link 
                href={`/edit/${habit.id}`}
                className="px-4 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Settings2 className="w-5 h-5" /> Edit
              </Link>
              <Link 
                href={`/log/${habit.id}`}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-5 h-5" /> Log Entry
              </Link>
            </div>
          </div>
        </div>

        {/* Activity Graphic */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center overflow-x-auto">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 w-full text-left">Activity Overview</h2>
          <ActivityCalendar dates={logs.map(l => l.createdAt)} weeks={52} frequency={habit.frequency} size="md" />
        </div>

        {/* Log Entries Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 font-semibold text-slate-700">Date & Time</th>
                <th className="p-4 font-semibold text-slate-700">Details</th>
                <th className="p-4 font-semibold text-slate-700 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500">
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
                    <tr key={log.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 group">
                      <td className="p-4 text-slate-800 whitespace-nowrap align-top">
                        {new Date(log.createdAt).toLocaleString(undefined, { 
                          dateStyle: 'medium', 
                          timeStyle: 'short' 
                        })}
                      </td>
                      <td className="p-4 text-slate-600">
                        {hasDetails ? (
                          <div className="space-y-1">
                            {Object.entries(payload).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium text-slate-700 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>{' '}
                                {String(value)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-sm">Completed</span>
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
