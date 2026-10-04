import { getCategories, getHabit, getPeople } from '../../actions/db';
import EditClient from './EditClient';
import PageHeader from '@/components/PageHeader';
import { PanePage } from '@/components/Pane';
import { notFound } from 'next/navigation';

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [habit, people, categories] = await Promise.all([getHabit(id), getPeople(), getCategories()]);

  if (!habit) {
    notFound();
  }

  return (
    <PanePage
      width="3xl"
      header={
        <PageHeader
          title={<span className="truncate">{habit.isOwner ? `Edit ${habit.name}` : habit.name}</span>}
          backHref={`/log/${habit.id}`}
        />
      }
    >
      <EditClient habit={habit} owner={people[habit.userId]} categories={categories} />
    </PanePage>
  );
}
