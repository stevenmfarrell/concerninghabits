'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { MAX_HISTORY_WEEKS, MAX_NAME_LENGTH, UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { isIconName } from '@/lib/icons';
import { NO_CADENCE, type Cadence } from '@/lib/cadence';
import { getUncategorizedHabits } from './habits';
import { cadenceJson, revalidateLists, getOwnedCategory, assertValidParent, habitListRows, withHabits, categorySkips, getRecentLogsCutoff } from './internal';
import { getDefaultUser } from './user';

// `weeks` bounds how far back logs are fetched: enough for the 4-week row calendars by default, or
// more for a caller that looks further back (the Habits page, for each category's consistency)
export async function getCategoriesWithHierarchy(weeks = 5) {
  const user = await getDefaultUser();
  const logsCutoff = getRecentLogsCutoff(weeks);
  const categories = await prisma.category.findMany({
    where: { userId: user.id, parentId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { habitMembers: habitListRows(logsCutoff), skips: categorySkips }
      },
      habitMembers: habitListRows(logsCutoff),
      skips: categorySkips
    }
  });
  return categories.map(category => ({ ...withHabits(category), children: category.children.map(withHabits) }));
}

// `weeks` bounds how far back logs are fetched for the activity heatmap; pass the widest horizon
// a caller might display (the habit page's horizon toggle tops out at MAX_HISTORY_WEEKS).
export async function getCategory(id: string, weeks: number = MAX_HISTORY_WEEKS) {
  const user = await getDefaultUser();

  // Habits without a category get a synthetic category so they can use the same pages
  if (id === UNCATEGORIZED_ID) {
    const habits = await getUncategorizedHabits(weeks);
    return {
      id: UNCATEGORIZED_ID,
      name: 'Uncategorized',
      icon: UNCATEGORIZED_ICON,
      cadence: JSON.stringify(NO_CADENCE),
      parentId: null,
      parent: null,
      children: [] as never[],
      habits,
      // Never skipped: it has no cadence
      skips: [] as { day: string }[],
    };
  }

  const logsCutoff = getRecentLogsCutoff(weeks);
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { habitMembers: habitListRows(logsCutoff), skips: categorySkips }
      },
      habitMembers: habitListRows(logsCutoff),
      skips: categorySkips,
      parent: true
    }
  });
  if (!category || category.userId !== user.id) return null;
  return { ...withHabits(category), children: category.children.map(withHabits) };
}

export async function getCategories() {
  const user = await getDefaultUser();
  return prisma.category.findMany({
    where: { userId: user.id },
    orderBy: [{ order: 'asc' }, { name: 'asc' }]
    
  });
}

// A category's name and icon checked, since they come from the browser
function checkCategory(name: string, icon: string | null | undefined) {
  if (!name.trim()) throw new Error('Give the category a name');
  if (name.length > MAX_NAME_LENGTH) throw new Error(`Category names must be ${MAX_NAME_LENGTH} characters or fewer`);
  if (icon && !isIconName(icon)) throw new Error('Unknown icon');
}

export async function createCategory(name: string, icon?: string, parentId?: string) {
  const user = await getDefaultUser();
  checkCategory(name, icon);
  if (parentId) await assertValidParent(user.id, parentId);
  const category = await prisma.category.create({
    data: { name, icon, userId: user.id, parentId: parentId || null }
  });
  revalidateLists();
  return category;
}

export async function updateCategory(id: string, name: string, icon: string | null, parentId?: string | null) {
  const user = await getDefaultUser();
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) throw new Error("Unauthorized");
  checkCategory(name, icon);
  if (parentId) await assertValidParent(user.id, parentId, id);

  const category = await prisma.category.update({
    where: { id },
    data: { name, icon, parentId: parentId || null }
  });
  revalidateLists();
  return category;
}

// How often the user means to do something in one of their categories (any habit in it or its
// subcategories counts)
export async function setCategoryCadence(id: string, cadence: Cadence) {
  const user = await getDefaultUser();
  await getOwnedCategory(user.id, id);
  await prisma.category.update({
    where: { id },
    data: { cadence: cadenceJson(cadence) },
  });
  revalidateLists();
  revalidatePath(`/categories/${id}`);
}

export async function deleteCategory(id: string) {
  const user = await getDefaultUser();
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) throw new Error("Unauthorized");

  // First move any habits filed here to Uncategorized
  await prisma.habitMember.updateMany({
    where: { categoryId: id, userId: user.id },
    data: { categoryId: null }
  });
  
  await prisma.category.delete({
    where: { id }
  });
  revalidateLists();
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
  
  revalidateLists();
}
