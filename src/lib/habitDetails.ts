import { prisma } from './prisma';

// A habit as its own page shows it, for a given user, so the web app and the API describe a habit
// the same way. Its entries are read separately (see habitLogsOf). Server-only.

// A habit the user can see (their own or one shared with them), with their own placement of it and
// who has it. Null if they have no access.
export async function habitDetailOf(userId: string, habitId: string) {
  const membership = await prisma.habitMember.findUnique({
    where: { habitId_userId: { habitId, userId } },
    include: { habit: { include: { members: { select: { userId: true }, orderBy: { createdAt: 'asc' } }, skips: { select: { day: true } } } } }
  });
  if (!membership) return null;
  const { habit: { members, skips, ...habit }, categoryId, aiContext } = membership;
  return {
    ...habit,
    categoryId,
    aiContext,
    isOwner: habit.userId === userId,
    memberIds: members.map(m => m.userId),
    skippedDays: skips.map(s => s.day),
  };
}
