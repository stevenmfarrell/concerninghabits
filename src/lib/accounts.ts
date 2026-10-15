import { prisma } from './prisma';
import { isServerAdmin } from './deployment';

// Deleting an account, by the person themselves (Settings → Delete Account) or by a self-hosted
// server's admin (Family Users). Server-only.

// Why `user` can't delete their own account, or null when they can. A self-hosted server's admin is
// the only one who can add or remove accounts, so they can't leave the others without one; alone on
// the server, deleting it starts it over at first-time setup.
export async function selfDeletionProblem(user: { id: string; isAdmin: boolean }) {
  if (!isServerAdmin(user)) return null;
  const others = await prisma.user.count({ where: { id: { not: user.id } } });
  return others > 0 ? 'You\'re this server\'s admin, so remove the other accounts under Family Users before deleting yours.' : null;
}

// Deletes `userId`'s account and everything in it: their entries (including on habits others shared
// with them), their habits along with everyone's entries on those, their categories, and through the
// schema's cascades, their sessions, sign-in identities, connections, memberships, invites, API keys,
// push subscriptions, reminders and vacations. Their AI usage count goes too.
export async function deleteAccount(userId: string) {
  // TODO(#22): cancel their subscription first, once billing exists
  await prisma.$transaction([
    prisma.habitLog.deleteMany({ where: { OR: [{ userId }, { habit: { userId } }] } }),
    prisma.habit.deleteMany({ where: { userId } }),
    prisma.category.deleteMany({ where: { userId } }),
    prisma.rateLimit.deleteMany({ where: { identifier: `ai:${userId}` } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
