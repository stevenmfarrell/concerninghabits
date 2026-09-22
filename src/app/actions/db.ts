'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// Helper to get or create a default user/family for prototyping
export async function getDefaultUser() {
  let family = await prisma.family.findFirst({
    include: { categories: true }
  });
  
  if (!family) {
    family = await prisma.family.create({
      data: {
        name: 'The Smiths',
      },
      include: { categories: true }
    });
  }

  if (family.categories.length === 0) {
    // Seed default categories
    const defaults = [
      { name: 'Mind', icon: 'Brain' },
      { name: 'Body', icon: 'Dumbbell' },
      { name: 'Chores', icon: 'CheckSquare' },
      { name: 'Other', icon: 'List' }
    ];
    for (const cat of defaults) {
      await prisma.category.create({
        data: { ...cat, familyId: family.id }
      });
    }
  }

  let user = await prisma.user.findFirst({ include: { family: true } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'John',
        familyId: family.id,
      },
      include: { family: true }
    });
  }
  
  return user;
}

export async function getCategories() {
  const user = await getDefaultUser();
  return prisma.category.findMany({
    where: { familyId: user.familyId },
    orderBy: { name: 'asc' }
  });
}

export async function createCategory(name: string, icon?: string) {
  const user = await getDefaultUser();
  const category = await prisma.category.create({
    data: { name, icon, familyId: user.familyId }
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

export async function saveHabit(name: string, description: string, prompt: string, schema: any, categoryId?: string, frequency: string = 'daily') {
  const user = await getDefaultUser();
  
  const habit = await prisma.habit.create({
    data: {
      name,
      description,
      prompt,
      schema: JSON.stringify(schema),
      categoryId,
      frequency,
      familyId: user.familyId,
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
    where: { familyId: user.familyId },
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

export async function updateHabit(id: string, name: string, description: string, prompt: string, schema: any, categoryId?: string, frequency: string = 'daily') {
  const habit = await prisma.habit.update({
    where: { id },
    data: {
      name,
      description,
      prompt,
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
