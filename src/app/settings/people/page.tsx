import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';
import PersonLabel from '@/components/PersonLabel';
import { getConnectedIds, getPeople } from '@/app/actions/user';
import { isCloud } from '@/lib/deployment';
import RemoveConnectionButton from './RemoveConnectionButton';

// The people the current user is connected to on the hosted version (see connections.ts): who they
// can share habits with and see the names of, with a way to remove someone. A self-hosted server
// has no such list, since everyone on it is connected.
export default async function PeoplePage() {
  if (!isCloud()) notFound();
  const [people, connected] = await Promise.all([getPeople(), getConnectedIds()]);
  const connections = connected.map(id => people[id]).filter(Boolean);

  return (
    <PanePage width="3xl" header={<PageHeader title="People" backHref="/settings" />}>
      <PaneSection
        title="Connected"
        empty={connections.length === 0 && 'You aren\'t connected with anyone yet. Once someone accepts your invite, you can share habits with each other.'}
      >
        {connections.map(person => (
          <div key={person.id} className={`${PANE_INSET} py-3 flex items-center justify-between gap-3`}>
            <PersonLabel person={person} size="sm" />
            <RemoveConnectionButton userId={person.id} userName={person.name} />
          </div>
        ))}
      </PaneSection>
      {connections.length > 0 && (
        <p className={`${PANE_INSET} py-3 text-sm text-ink-muted`}>
          You can share habits with the people you&apos;re connected to, and see their names on habits you share.
        </p>
      )}
    </PanePage>
  );
}
