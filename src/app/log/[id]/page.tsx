import { getHabit, getHabitLogs, getDefaultUser, getPeople } from '../../actions/db';
import LogClient from './LogClient';
import { notFound } from 'next/navigation';

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, habit, logs, people] = await Promise.all([
    getDefaultUser(),
    getHabit(id),
    // Only the 5-week "Recent History" card is shown on this page. This rejects if the viewer can't
    // see the habit, in which case getHabit returns null and the page 404s below.
    getHabitLogs(id, 5).catch(() => null),
    getPeople(),
  ]);

  if (!habit || !logs) {
    notFound();
  }
  const habitWithLogs = { ...habit, logs };

  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <LogClient habit={habitWithLogs} user={user} people={people} />
    </main>
  );
}
