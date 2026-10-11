import { getCategories } from '@/app/actions/categories';
import { getHabitLogs } from '@/app/actions/entries';
import { getHabit } from '@/app/actions/habits';
import { getDefaultUser, getPeople } from '@/app/actions/user';
import { getHabitReminder } from '../../actions/reminders';
import EditClient from './EditClient';
import PageHeader from '@/components/PageHeader';
import { PanePage } from '@/components/Pane';
import { notFound } from 'next/navigation';

const PREVIEW_WEEKS = 13;

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, habit, people, categories, logs, reminder] = await Promise.all([
    getDefaultUser(),
    getHabit(id),
    getPeople(),
    getCategories(),
    // The last few months of entries, to preview calculated fields with. Rejects without access,
    // when getHabit returns null and the page 404s below.
    getHabitLogs(id, PREVIEW_WEEKS).catch(() => []),
    getHabitReminder(id),
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
        reminder={reminder}
        bedtime={user.bedtime}
        weekStartsOn={user.weekStartsOn}
      />
    </PanePage>
  );
}
