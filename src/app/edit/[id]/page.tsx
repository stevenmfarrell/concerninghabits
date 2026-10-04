import { getCategories, getHabit, getHabitLogs, getPeople } from '../../actions/db';
import EditClient from './EditClient';
import PageHeader from '@/components/PageHeader';
import { PanePage } from '@/components/Pane';
import { notFound } from 'next/navigation';

const PREVIEW_WEEKS = 13;

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [habit, people, categories, logs] = await Promise.all([
    getHabit(id),
    getPeople(),
    getCategories(),
    // The last few months of entries, to preview calculated fields with. Rejects without access,
    // when getHabit returns null and the page 404s below.
    getHabitLogs(id, PREVIEW_WEEKS).catch(() => []),
  ]);

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
      <EditClient
        habit={habit}
        owner={people[habit.userId]}
        categories={categories}
        entries={logs.map(l => ({ id: l.id, createdAt: l.createdAt, payload: l.payload, userId: l.userId }))}
      />
    </PanePage>
  );
}
