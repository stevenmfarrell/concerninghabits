import { prisma } from './prisma';

// Who may do what with a habit or category, checked for a given user, so the web app's server
// actions and the API (which acts as whoever an API key belongs to) check access the same way.
// Each throws "Unauthorized" when the user doesn't have it. Server-only.

// The user's membership in a habit (their own, or one shared with them), with the habit.
// Membership is what grants access: viewing, logging, and filing the habit in a category.
export async function getMembership(userId: string, habitId: string) {
  const membership = await prisma.habitMember.findUnique({
    where: { habitId_userId: { habitId, userId } },
    include: { habit: true }
  });
  if (!membership) throw new Error("Unauthorized");
  return membership;
}

// A habit the user owns. Only the owner can change its form, share it, or delete it.
export async function getOwnedHabit(userId: string, habitId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== userId) throw new Error("Unauthorized");
  return habit;
}

export async function getOwnedCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.userId !== userId) throw new Error("Unauthorized");
  return category;
}
