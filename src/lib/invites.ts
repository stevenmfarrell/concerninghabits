import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma';
import { connect } from './connections';
import { END_OF_LIST_ORDER } from './constants';

// Invite links: how people connect (see connections.ts). Someone makes a link, sends it however they
// like, and whoever opens it and accepts is connected with them. One made from a habit's share dialog
// also adds them to that habit. Each works once, for a week. Server-only.

export const INVITE_DAYS = 7;
// Unaccepted invites one person can have at once, plenty for inviting a household or a few friends
export const MAX_PENDING_INVITES = 20;

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

// A new invite from `inviterId`, returned with its token this once: only the hash is kept. 32 random
// bytes, so as with an API key, a plain hash is enough (see apiKeys.ts). Their used and expired
// invites are cleared out first, since nothing shows them.
export async function createInvite(inviterId: string, habitId: string | null = null) {
  const now = new Date();
  await prisma.invite.deleteMany({ where: { inviterId, OR: [{ acceptedAt: { not: null } }, { expiresAt: { lte: now } }] } });
  if (await prisma.invite.count({ where: { inviterId } }) >= MAX_PENDING_INVITES) {
    throw new Error(`You have ${MAX_PENDING_INVITES} invites waiting to be accepted. Cancel some under Settings → People first.`);
  }
  const token = randomBytes(32).toString('base64url');
  const invite = await prisma.invite.create({
    data: { hash: hashInviteToken(token), inviterId, habitId, expiresAt: new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000) },
  });
  return { token, invite };
}

// The invite a link's token is for, with who sent it and the habit it adds you to, or null for a
// token that doesn't match one (mistyped, or canceled)
export async function findInvite(token: string) {
  return prisma.invite.findUnique({
    where: { hash: hashInviteToken(token) },
    include: {
      inviter: { select: { id: true, name: true } },
      habit: { select: { id: true, name: true, userId: true } },
    },
  });
}

export type FoundInvite = NonNullable<Awaited<ReturnType<typeof findInvite>>>;

// Whether an invite can still be accepted
export function inviteStatus(invite: Pick<FoundInvite, 'acceptedAt' | 'expiresAt'>, now = new Date()) {
  if (invite.acceptedAt) return 'accepted' as const;
  if (invite.expiresAt <= now) return 'expired' as const;
  return 'pending' as const;
}

// The habit an invite adds whoever accepts it to, if it still has one the inviter owns (they may
// have deleted it, or it may have changed hands)
export function invitedHabit(invite: Pick<FoundInvite, 'habit' | 'inviterId'>) {
  return invite.habit && invite.habit.userId === invite.inviterId ? invite.habit : null;
}

// Accepts an invite as `userId`: connects them with whoever sent it and adds them to its habit, if
// it has one. Using it up is a conditional update, so two people opening the same link at once
// can't both accept it.
export async function acceptInvite(token: string, userId: string) {
  const invite = await findInvite(token);
  if (!invite) throw new Error('This invite link doesn\'t work. It may have been canceled.');
  if (invite.inviterId === userId) throw new Error('This is your own invite. Send it to the person you want to connect with.');
  const now = new Date();
  const status = inviteStatus(invite, now);
  if (status === 'accepted') throw new Error('This invite has already been used.');
  if (status === 'expired') throw new Error('This invite has expired.');

  const used = await prisma.invite.updateMany({
    where: { id: invite.id, acceptedAt: null, expiresAt: { gt: now } },
    data: { acceptedAt: now, acceptedById: userId },
  });
  if (used.count === 0) throw new Error('This invite has already been used.');

  await connect(userId, invite.inviterId);
  const habit = invitedHabit(invite);
  if (habit) {
    await prisma.habitMember.upsert({
      where: { habitId_userId: { habitId: habit.id, userId } },
      create: { habitId: habit.id, userId, order: END_OF_LIST_ORDER },
      update: {},
    });
  }
  return { inviter: invite.inviter, habit };
}
