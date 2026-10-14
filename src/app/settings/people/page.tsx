import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';
import PersonLabel from '@/components/PersonLabel';
import { getConnectedIds, getPeople } from '@/app/actions/user';
import { isCloud } from '@/lib/deployment';
import RemoveConnectionButton from './RemoveConnectionButton';

// The people the current user is connected to (see connections.ts): who they can share habits with
// and see the names of, with a way to remove someone. On a self-hosted server that's everyone on
// it, unless they've removed someone.
export default async function PeoplePage() {
  const cloud = isCloud();
  const [people, connected] = await Promise.all([getPeople(), getConnectedIds()]);
  // In account creation order, like their colors (see getPeople)
  const connections = Object.values(people).filter(person => connected.includes(person.id));

  return (
    <PanePage width="3xl" header={<PageHeader title="People" backHref="/settings" />}>
      <PaneSection
        title="Connected"
        empty={connections.length === 0 && (cloud
          ? 'You aren\'t connected with anyone yet. Once someone accepts your invite, you can share habits with each other.'
          : 'You aren\'t connected with anyone yet. An admin can add family members under Settings.')}
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
