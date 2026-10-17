'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { acceptInvite, createInvite } from '@/lib/invites';
import { revalidateLists } from './internal';
import { getOwnedHabit } from '@/lib/access';
import { getDefaultUser } from './user';

// A new invite link's token, for the current user to send someone (see src/lib/invites.ts). With a
// habit of theirs, whoever accepts also joins it. The page builds the link from it, at its own
// address.
export async function createInviteLink(habitId?: string) {
  const user = await getDefaultUser();
  if (habitId !== undefined) await getOwnedHabit(user.id, z.string().parse(habitId));
  const { token } = await createInvite(user.id, habitId ?? null);
  revalidatePath('/settings/people');
  return token;
}

// The current user's invites still waiting to be accepted, newest first, for Settings → People
export async function getPendingInvites() {
  const user = await getDefaultUser();
  return prisma.invite.findMany({
    where: { inviterId: user.id, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, expiresAt: true, habit: { select: { name: true } } },
  });
}

// Cancels one of the current user's invites, so its link stops working
export async function cancelInvite(inviteId: string) {
  const user = await getDefaultUser();
  await prisma.invite.deleteMany({ where: { id: z.string().parse(inviteId), inviterId: user.id } });
  revalidatePath('/settings/people');
}

// Accepts an invite as the current user (the invite page's Accept button), returning where to go
// next (the habit it added them to, or Settings → People) and what to say about it
export async function acceptInviteLink(token: string) {
  const user = await getDefaultUser();
  const { inviter, habit } = await acceptInvite(z.string().parse(token), user.id);
  revalidatePath('/settings/people');
  if (habit) revalidateLists();
  return habit
    ? { to: `/log/${habit.id}`, message: `You joined ${habit.name}` }
    : { to: '/settings/people', message: `You're connected with ${inviter.name}` };
}
