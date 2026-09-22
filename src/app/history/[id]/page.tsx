import { getHabit, getHabitLogs, deleteHabitLog } from '../../actions/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import DeleteButton from './DeleteButton';

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getHabit(id);
  
  if (!habit) {
    notFound();
  }

  const logs = await getHabitLogs(id);

  // Generate last 30 days for the activity grid
  const today = new Date();
  const last30Days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  });

  // Map dates to log counts
  const logDates = new Set(
    logs.map((log) => new Date(log.createdAt).toISOString().split('T')[0])
  );

  return (
    <main className="min-h-screen p-8 bg-slate-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{habit.name} - History</h1>
              {habit.description && <p className="text-slate-600 mt-2">{habit.description}</p>}
            </div>
            <div className="text-sm font-medium text-slate-500">
              {logs.length} total entries
            </div>
          </div>
        </div>

        {/* 30-Day Activity Graphic */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Last 30 Days</h2>
          <div className="flex flex-wrap gap-2">
            {last30Days.map((dateStr) => {
              const hasLog = logDates.has(dateStr);
              return (
                <div
                  key={dateStr}
                  title={dateStr}
                  className={`w-6 h-6 rounded-sm border ${
                    hasLog ? 'bg-green-500 border-green-600' : 'bg-slate-100 border-slate-200'
                  }`}
                />
              );
            })}
          </div>
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
