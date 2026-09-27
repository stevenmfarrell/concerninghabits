import { getHabit, getHabitLogs, getDefaultUser } from '../../actions/db';
import LogClient from './LogClient';
import { notFound } from 'next/navigation';

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getHabit(id);
  const user = await getDefaultUser();
  
  if (!habit) {
    notFound();
  }

  const logs = await getHabitLogs(id);
  const habitWithLogs = { ...habit, logs };

  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <LogClient habit={habitWithLogs} user={user} />
    </main>
  );
}
