// Who can see whose name and share habits with whom. On the hosted version, strangers share one
// server, so that's only people who've connected (see the Connection model), made when one accepts
// the other's invite. A self-hosted server is one household, so everyone on it counts as connected
// to everyone, and no connections are stored. Server-only.

import { prisma } from './prisma';
import { isCloud } from './deployment';

// A pair as it's stored: the smaller id first, so each pair has one row
function pair(userId: string, otherId: string) {
  return userId < otherId ? { userAId: userId, userBId: otherId } : { userAId: otherId, userBId: userId };
}

// The people `userId` is connected to, in account creation order
export async function connectedIds(userId: string): Promise<string[]> {
  if (!isCloud()) {
    const others = await prisma.user.findMany({ where: { id: { not: userId } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    return others.map(u => u.id);
  }
  const rows = await prisma.connection.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return rows.map(row => (row.userAId === userId ? row.userBId : row.userAId));
}

// Connects two people, if they aren't already (e.g. accepting an invite)
export async function connect(userId: string, otherId: string) {
  if (userId === otherId) throw new Error('You can\'t connect with yourself');
  const key = pair(userId, otherId);
  await prisma.connection.upsert({ where: { userAId_userBId: key }, create: key, update: {} });
}

// Disconnects two people on the hosted version. Each also comes off the habits the other shared
// with them; the entries they logged on those habits stay, as when someone leaves a habit.
export async function disconnect(userId: string, otherId: string) {
  if (!isCloud()) throw new Error('Everyone on a self-hosted server is connected');
  await prisma.$transaction([
    prisma.connection.deleteMany({ where: pair(userId, otherId) }),
    prisma.habitMember.deleteMany({
      where: {
        OR: [
          { userId: otherId, habit: { userId } },
          { userId, habit: { userId: otherId } },
        ],
      },
    }),
  ]);
}
