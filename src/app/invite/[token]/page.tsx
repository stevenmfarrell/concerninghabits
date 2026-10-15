import PageHeader from '@/components/PageHeader';
import { PanePage } from '@/components/Pane';
import EmptyState from '@/components/EmptyState';
import { LinkButton } from '@/components/ui/Button';
import { getConnectedIds, getDefaultUser } from '@/app/actions/user';
import { findInvite, invitedHabit, inviteStatus } from '@/lib/invites';
import AcceptInvite from './AcceptInvite';

// Where an invite link leads (see src/lib/invites.ts): who sent it, and a button to accept it. Opening
// the link doesn't accept it, so a link preview or a visit by someone else can't use it up. Signing in
// comes first, which on the hosted version also makes the account of someone who's new.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, user] = await Promise.all([params, getDefaultUser()]);
  const [invite, connectedIds] = await Promise.all([findInvite(token), getConnectedIds()]);

  return (
    <PanePage width="md" header={<PageHeader title="Invite" backHref="/" />}>
      <InviteBody token={token} invite={invite} userId={user.id} connected={!!invite && connectedIds.includes(invite.inviterId)} />
    </PanePage>
  );
}

function InviteBody({ token, invite, userId, connected }: {
  token: string;
  invite: Awaited<ReturnType<typeof findInvite>>;
  userId: string;
  connected: boolean;
}) {
  const home = <LinkButton href="/" variant="outline">Go to Agenda</LinkButton>;
  if (!invite) {
    return <EmptyState title="This invite doesn't work" action={home}>It may have been canceled, or the link may be incomplete. Ask whoever sent it for a new one.</EmptyState>;
  }

  const inviter = invite.inviter.name;
  const habit = invitedHabit(invite);
  const people = <LinkButton href="/settings/people" variant="outline">See People</LinkButton>;
  if (invite.inviterId === userId) {
    return <EmptyState title="This is your invite" action={people}>Send the link to the person you want to connect with. It works once, for a week.</EmptyState>;
  }

  const status = inviteStatus(invite);
  if (status === 'accepted') {
    return invite.acceptedById === userId
      ? <EmptyState title={`You're connected with ${inviter}`} action={habit ? <LinkButton href={`/log/${habit.id}`} variant="outline">Open {habit.name}</LinkButton> : people}>You accepted this invite, so you can share habits with each other.</EmptyState>
      : <EmptyState title="This invite has been used" action={home}>Each invite link works once. Ask {inviter} for a new one.</EmptyState>;
  }
  if (status === 'expired') {
    return <EmptyState title="This invite has expired" action={home}>Invite links work for a week. Ask {inviter} for a new one.</EmptyState>;
  }

  // Already connected, so there's nothing to accept unless it adds them to a habit
  if (connected && !habit) {
    return <EmptyState title={`You're already connected with ${inviter}`} action={people}>You can share habits with each other already.</EmptyState>;
  }
  return (
    <EmptyState title={`${inviter} invited you`} action={<AcceptInvite token={token} />}>
      {connected
        ? <>Accept to join their habit <span className="font-medium text-ink-secondary">{habit!.name}</span>.</>
        : <>Accept to connect with {inviter}, so you can share habits with each other.{habit && <> You&apos;ll also join their habit <span className="font-medium text-ink-secondary">{habit.name}</span>.</>}</>}
    </EmptyState>
  );
}
