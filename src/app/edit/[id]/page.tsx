import { getHabit, getPeople } from '../../actions/db';
import EditClient from './EditClient';
import SharedHabitSettings from './SharedHabitSettings';
import { notFound } from 'next/navigation';

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getHabit(id);

  if (!habit) {
    notFound();
  }

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      {habit.isOwner ? (
        <EditClient habit={habit} />
      ) : (
        <SharedHabitSettings habit={habit} owner={(await getPeople())[habit.userId]} />
      )}
    </main>
  );
}
