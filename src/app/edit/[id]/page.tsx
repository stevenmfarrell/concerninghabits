import { getHabit, getPeople } from '../../actions/db';
import EditClient from './EditClient';
import PageHeader from '@/components/PageHeader';
import { notFound } from 'next/navigation';

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [habit, people] = await Promise.all([getHabit(id), getPeople()]);

  if (!habit) {
    notFound();
  }

  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col">
      <PageHeader
        title={<span className="truncate">{habit.isOwner ? `Edit ${habit.name}` : habit.name}</span>}
        backHref={`/log/${habit.id}`}
      />
      <EditClient habit={habit} owner={people[habit.userId]} />
    </main>
  );
}
