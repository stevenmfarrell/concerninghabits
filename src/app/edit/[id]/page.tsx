import { getHabit } from '../../actions/db';
import EditClient from './EditClient';
import { notFound } from 'next/navigation';

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const habit = await getHabit(id);
  
  if (!habit) {
    notFound();
  }

  return (
    <main className="min-h-screen p-8 bg-stone-50 font-sans">
      <EditClient habit={habit} />
    </main>
  );
}
