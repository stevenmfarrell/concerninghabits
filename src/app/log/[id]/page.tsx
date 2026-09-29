import { getHabit, getHabitLogs, getDefaultUser, getPeople } from '../../actions/db';
import LogClient from './LogClient';
import { notFound } from 'next/navigation';

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getHabit(id);
  const user = await getDefaultUser();
  
  if (!habit) {
    notFound();
  }

  const [logs, people] = await Promise.all([getHabitLogs(id), getPeople()]);
  const habitWithLogs = { ...habit, logs };

  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <LogClient habit={habitWithLogs} user={user} people={people} />
    </main>
  );
}
