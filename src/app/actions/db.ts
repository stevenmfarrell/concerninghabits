'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function getDefaultUser() {
  const session = await verifySession();
  
  if (!session?.userId) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { categories: true }
  });

  if (!user) {
    redirect('/api/logout');
  }

  return user;
}

export async function getCategories() {
  const user = await getDefaultUser();
  return prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' }
  });
}

export async function createCategory(name: string, icon?: string) {
  const user = await getDefaultUser();
  const category = await prisma.category.create({
    data: { name, icon, userId: user.id }
  });
  revalidatePath('/');
  return category;
}

export async function updateCategory(id: string, name: string, icon: string) {
  const category = await prisma.category.update({
    where: { id },
    data: { name, icon }
  });
  revalidatePath('/');
  return category;
}

export async function deleteCategory(id: string) {
  // First nullify any habits using this category
  await prisma.habit.updateMany({
    where: { categoryId: id },
    data: { categoryId: null }
  });
  
  await prisma.category.delete({
    where: { id }
  });
  revalidatePath('/');
}

export async function saveHabit(name: string, description: string, schema: any, categoryId?: string, frequency: string = 'daily') {
  const user = await getDefaultUser();
  
  const habit = await prisma.habit.create({
    data: {
      name,
      description,
      schema: JSON.stringify(schema),
      categoryId,
      frequency,
      userId: user.id,
    }
  });
  
  revalidatePath('/');
  return habit;
}

export async function getHabits() {
  const user = await getDefaultUser();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 40); // Go back enough for 5 weeks
  pastDate.setDate(1); // Snap to the 1st of that month to ensure we capture early-month logs for monthly habits
  pastDate.setDate(pastDate.getDate() - pastDate.getDay()); // Snap to the Sunday before the 1st to capture logs for partial weeks
  
  return prisma.habit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { 
      category: true,
      logs: {
        where: {
          createdAt: { gte: pastDate }
        },
        select: {
          createdAt: true
        }
      }
    }
  });
}

export async function getHabit(id: string) {
  return prisma.habit.findUnique({
    where: { id },
    include: { category: true }
  });
}

export async function logHabitEvent(habitId: string, payload: any, createdAt?: Date) {
  const user = await getDefaultUser();
  
  const log = await prisma.habitLog.create({
    data: {
      habitId,
      userId: user.id,
      payload: JSON.stringify(payload),
      ...(createdAt ? { createdAt } : {})
    }
  });
  
  revalidatePath(`/log/${habitId}`);
  revalidatePath(`/history/${habitId}`);
  revalidatePath('/');
  return log;
}

export async function deleteHabitLog(logId: string, habitId: string) {
  await prisma.habitLog.delete({
    where: { id: logId }
  });
  revalidatePath(`/history/${habitId}`);
  revalidatePath('/');
}

export async function getHabitLogs(habitId: string) {
  return prisma.habitLog.findMany({
    where: { habitId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function updateHabit(id: string, name: string, description: string, schema: any, categoryId?: string, frequency: string = 'daily') {
  const habit = await prisma.habit.update({
    where: { id },
    data: {
      name,
      description,
      schema: JSON.stringify(schema),
      categoryId,
      frequency,
    }
  });
  
  revalidatePath('/');
  revalidatePath(`/log/${id}`);
  revalidatePath(`/history/${id}`);
  return habit;
}

export async function updateUserPreferences(prefs: { bedtime?: string, weekStartsOn?: string, useEmojiTitle?: boolean }) {
  const user = await getDefaultUser();
  await prisma.user.update({
    where: { id: user.id },
    data: prefs
  });
  revalidatePath('/settings');
  revalidatePath('/');
}

export async function deleteHabit(habitId: string) {
  const user = await getDefaultUser();
  await prisma.$transaction([
    prisma.habitLog.deleteMany({ where: { habitId, userId: user.id } }),
    prisma.habit.delete({ where: { id: habitId, userId: user.id } })
  ]);
  revalidatePath('/');
}
