import { getHabit } from '../../actions/db';
import LogClient from './LogClient';
import { notFound } from 'next/navigation';

export default async function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getHabit(id);
  
  if (!habit) {
    notFound();
  }

  return (
    <main className="min-h-screen p-8 bg-stone-50 font-sans">
      <LogClient habit={habit} />
    </main>
  );
}
