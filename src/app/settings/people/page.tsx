import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';
import PersonLabel from '@/components/PersonLabel';
import { getConnectedIds, getPeople } from '@/app/actions/user';
import { getPendingInvites } from '@/app/actions/invites';
import { isCloud } from '@/lib/deployment';
import RemoveConnectionButton from './RemoveConnectionButton';
import InviteRow from './InviteRow';
import PendingInvite from './PendingInvite';

// The people the current user is connected to (see connections.ts): who they can share habits with
// and see the names of, with a way to remove someone, and to invite someone new (see invites.ts). On
// a self-hosted server that's everyone on it, unless they've removed someone.
export default async function PeoplePage() {
  const cloud = isCloud();
  const [people, connected, invites] = await Promise.all([getPeople(), getConnectedIds(), getPendingInvites()]);
  // In account creation order, like their colors (see getPeople)
  const connections = Object.values(people).filter(person => connected.includes(person.id));

  return (
    <PanePage width="3xl" header={<PageHeader title="People" backHref="/settings" />}>
      <PaneSection title="Connected">
        {connections.map(person => (
          <div key={person.id} className={`${PANE_INSET} py-3 flex items-center justify-between gap-3`}>
            <PersonLabel person={person} size="sm" />
            <RemoveConnectionButton userId={person.id} userName={person.name} />
          </div>
        ))}
        <InviteRow cloud={cloud} />
      </PaneSection>
      <p className={`${PANE_INSET} py-3 text-sm text-ink-muted`}>
        {connections.length > 0
          ? 'You can share habits with the people you\'re connected to, and see their names on habits you share. '
          : 'You aren\'t connected with anyone yet. '}
        {cloud
          ? 'To connect with someone, send them an invite link.'
          : 'An admin can add family members under Settings, who are connected with everyone. Invite links reconnect people who already have an account here.'}
      </p>
      {invites.length > 0 && (
        <PaneSection title="Invites Waiting">
          {invites.map(invite => <PendingInvite key={invite.id} invite={invite} />)}
        </PaneSection>
      )}
    </PanePage>
  );
}
