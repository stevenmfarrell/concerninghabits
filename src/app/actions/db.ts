'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { userPreferencesSchema } from '@/lib/preferences';

export async function getDefaultUser(allowNeedsUpdate = false) {
  const session = await verifySession();
  
  if (!session?.userId) {
    redirect('/login');
  }

  // The user record is passed to client components, so never include the password hash
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { categories: true },
    omit: { passwordHash: true }
  });

  if (!user) {
    redirect('/api/logout');
  }

  if (user.passwordNeedsUpdate && !allowNeedsUpdate) {
    redirect('/update-password');
  }

  return user;
}

export async function getCategoriesWithHierarchy() {
  const user = await getDefaultUser();
  return prisma.category.findMany({
    where: { userId: user.id, parentId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: {
          habits: {
            include: { logs: { select: { createdAt: true } } }
          }
        }
      },
      habits: {
        include: { logs: { select: { createdAt: true } } }
      }
    }
  });
}

export async function getCategory(id: string) {
  const user = await getDefaultUser();

  // Habits without a category get a synthetic category so they can use the same pages
  if (id === UNCATEGORIZED_ID) {
    const habits = await getUncategorizedHabits();
    return {
      id: UNCATEGORIZED_ID,
      name: 'Uncategorized',
      icon: UNCATEGORIZED_ICON,
      parentId: null,
      parent: null,
      children: [] as never[],
      habits,
    };
  }

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: {
          habits: {
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
            include: { logs: { select: { createdAt: true, payload: true } } }
          }
        }
      },
      habits: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { logs: { select: { createdAt: true, payload: true } } }
      },
      parent: true
    }
  });
  if (!category || category.userId !== user.id) return null;
  return category;
}

export async function getCategories() {
  const user = await getDefaultUser();
  return prisma.category.findMany({
    where: { userId: user.id },
    orderBy: [{ order: 'asc' }, { name: 'asc' }]
    
  });
}

export async function createCategory(name: string, icon?: string, parentId?: string) {
  const user = await getDefaultUser();
  const category = await prisma.category.create({
    data: { name, icon, userId: user.id, parentId: parentId || null }
  });
  revalidatePath('/');
  return category;
}

export async function updateCategory(id: string, name: string, icon: string, parentId?: string | null) {
  const user = await getDefaultUser();
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) throw new Error("Unauthorized");

  const category = await prisma.category.update({
    where: { id },
    data: { name, icon, parentId: parentId || null }
  });
  revalidatePath('/');
  return category;
}

export async function deleteCategory(id: string) {
  const user = await getDefaultUser();
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) throw new Error("Unauthorized");

  // First nullify any habits using this category
  await prisma.habit.updateMany({
    where: { categoryId: id, userId: user.id },
    data: { categoryId: null }
  });
  
  await prisma.category.delete({
    where: { id }
  });
  revalidatePath('/');
}

export async function saveHabit(name: string, description: string, schema: any, categoryId?: string, frequency: string = 'daily', publishToMqtt: boolean = false) {
  const user = await getDefaultUser();
  
  try {
    const habit = await prisma.habit.create({
      data: {
        name,
        description,
        schema: JSON.stringify(schema),
        categoryId: categoryId || null,
        frequency,
        publishToMqtt,
        userId: user.id,
        order: 9999,
      }
    });
    
    revalidatePath('/');
    return habit;
  } catch (error: any) {
    throw new Error("Prisma Create Error: " + error.message);
  }
}

function getRecentLogsCutoff() {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 40); // Go back enough for 5 weeks
  pastDate.setDate(1); // Snap to the 1st of that month to ensure we capture early-month logs for monthly habits
  pastDate.setDate(pastDate.getDate() - pastDate.getDay()); // Snap to the Sunday before the 1st to capture logs for partial weeks
  return pastDate;
}

export async function getFavoriteHabits() {
  const user = await getDefaultUser();
  return prisma.habit.findMany({
    where: { userId: user.id, isFavorite: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      logs: {
        where: { createdAt: { gte: getRecentLogsCutoff() } },
        select: { createdAt: true }
      }
    }
  });
}

export async function getUncategorizedHabits() {
  const user = await getDefaultUser();
  return prisma.habit.findMany({
    where: { userId: user.id, categoryId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { logs: { select: { createdAt: true, payload: true } } }
  });
}

export async function toggleFavorite(habitId: string) {
  const user = await getDefaultUser();
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== user.id) throw new Error("Unauthorized");

  const updated = await prisma.habit.update({
    where: { id: habitId },
    data: { isFavorite: !habit.isFavorite }
  });
  revalidatePath('/');
  revalidatePath(`/log/${habitId}`);
  return updated.isFavorite;
}

export async function getHabit(id: string) {
  const user = await getDefaultUser();
  const habit = await prisma.habit.findUnique({
    where: { id },
    include: { category: true }
  });
  if (!habit || habit.userId !== user.id) return null;
  return habit;
}

export async function logHabitEvent(habitId: string, payload: any, createdAt?: Date) {
  const user = await getDefaultUser();
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== user.id) throw new Error("Unauthorized");
  
  const log = await prisma.habitLog.create({
    data: {
      habitId,
      userId: user.id,
      payload: JSON.stringify(payload),
      ...(createdAt ? { createdAt } : {})
    }
  });

  try {
    if (habit.publishToMqtt) {
      const { publishHabitLog } = await import('@/lib/mqtt');
      publishHabitLog(user, habit, payload);
    }
  } catch (e) {
    console.error('Failed to trigger MQTT publish', e);
  }
  
  revalidatePath(`/log/${habitId}`);
  revalidatePath(`/history/${habitId}`);
  revalidatePath('/');
  return log;
}

export async function deleteHabitLog(logId: string, habitId: string) {
  const user = await getDefaultUser();
  const log = await prisma.habitLog.findUnique({ where: { id: logId } });
  if (!log || log.userId !== user.id) throw new Error("Unauthorized");

  await prisma.habitLog.delete({
    where: { id: logId }
  });
  revalidatePath(`/history/${habitId}`);
  revalidatePath('/');
}

export async function getHabitLogs(habitId: string) {
  const user = await getDefaultUser();
  return prisma.habitLog.findMany({
    where: { habitId, userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
}

export async function updateHabit(id: string, name: string, description: string, schema: any, categoryId?: string, frequency: string = 'daily', publishToMqtt: boolean = false) {
  const user = await getDefaultUser();
  const existing = await prisma.habit.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) throw new Error("Unauthorized");

  try {
    let newOrder = existing.order;
    if (existing.categoryId !== (categoryId || null)) {
      newOrder = 9999;
    }

    const habit = await prisma.habit.update({
      where: { id },
      data: {
        name,
        description,
        schema: JSON.stringify(schema),
        categoryId: categoryId || null,
        frequency,
        publishToMqtt,
        order: newOrder,
      }
    });
    
    revalidatePath('/');
    revalidatePath(`/log/${id}`);
    revalidatePath(`/history/${id}`);
    return habit;
  } catch (error: any) {
    throw new Error("Prisma Update Error: " + error.message);
  }
}

export async function updateUserPreferences(prefs: { bedtime?: string, weekStartsOn?: string, useEmojiTitle?: boolean, unitSystem?: string, emojiModifier?: string | null }) {
  const user = await getDefaultUser();
  // Server action arguments come straight from the client; only allow known preference fields
  const data = userPreferencesSchema.parse(prefs);
  await prisma.user.update({
    where: { id: user.id },
    data
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

export async function isMqttConfigured() {
  return !!process.env.MQTT_URL;
}

export async function reorderCategories(updates: { id: string, order: number }[]) {
  const user = await getDefaultUser();
  
  // Use a transaction to ensure all updates succeed or fail together
  await prisma.$transaction(
    updates.map(update => 
      prisma.category.updateMany({
        where: { id: update.id, userId: user.id },
        data: { order: update.order }
      })
    )
  );
  
  revalidatePath('/');
}

export async function reorderHabits(updates: { id: string; order: number }[]) {
  const user = await getDefaultUser();
  
  // Verify all habits belong to user before updating
  const habits = await prisma.habit.findMany({
    where: { id: { in: updates.map(u => u.id) }, userId: user.id }
  });
  
  if (habits.length !== updates.length) {
    throw new Error("Unauthorized or invalid habit IDs");
  }

  // Update in a transaction
  await prisma.$transaction(
    updates.map(update => 
      prisma.habit.update({
        where: { id: update.id },
        data: { order: update.order }
      })
    )
  );
  
  revalidatePath('/');
}
