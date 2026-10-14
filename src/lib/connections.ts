// Who can see whose name and share habits with whom: people who are connected (see the Connection
// model). It works the same on a self-hosted server and the hosted version; only how connections
// are made differs. A self-hosted server is one household, so adding someone connects them to
// everyone on it (see connectToEveryone). On the hosted version, strangers share one server, so
// people connect by accepting each other's invites. Server-only.

import { prisma } from './prisma';

// A pair as it's stored: the smaller id first, so each pair has one row
function pair(userId: string, otherId: string) {
  return userId < otherId ? { userAId: userId, userBId: otherId } : { userAId: otherId, userBId: userId };
}

// The people `userId` is connected to, in no particular order
export async function connectedIds(userId: string): Promise<string[]> {
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

// Connects someone just added to a self-hosted server to everyone else on it, as one household
export async function connectToEveryone(userId: string) {
  const others = await prisma.user.findMany({ where: { id: { not: userId } }, select: { id: true } });
  await prisma.connection.createMany({ data: others.map(other => pair(userId, other.id)) });
}

// Disconnects two people. Each also comes off the habits the other shared with them; the entries
// they logged on those habits stay, as when someone leaves a habit.
export async function disconnect(userId: string, otherId: string) {
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
