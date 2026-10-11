'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { parseCivilDayKey, todayKeyFor } from '@/lib/timezone';
import { revalidateLists, getOwnedCategory, getMembership } from './internal';
import { getDefaultUser } from './user';

// What can be skipped: a habit, or a category with a cadence of its own (see CategorySkip)
export interface Skippable {
  kind: 'habit' | 'category';
  id: string;
}

// Checks the current user can skip it, as anyone who has a habit can, the same as logging it, and
// only a category's owner, as for anything about a category. Returns its page.
async function skippablePage(userId: string, target: Skippable) {
  if (target.kind === 'habit') {
    await getMembership(userId, target.id);
    return `/log/${target.id}`;
  }
  await getOwnedCategory(userId, target.id);
  return `/categories/${target.id}`;
}

// Skips it for today, the viewer's day, returning that day (a civil day key): it counts toward its
// cadence like an entry today would (see CadenceSnapshot). A habit's skip is the habit's, for
// everyone who has it; a category's excuses its own cadence, not its habits'.
export async function skipToday(target: Skippable) {
  const user = await getDefaultUser();
  const page = await skippablePage(user.id, target);
  const day = todayKeyFor(user);
  if (target.kind === 'habit') {
    await prisma.habitSkip.upsert({ where: { habitId_day: { habitId: target.id, day } }, create: { habitId: target.id, day, userId: user.id }, update: {} });
  } else {
    await prisma.categorySkip.upsert({ where: { categoryId_day: { categoryId: target.id, day } }, create: { categoryId: target.id, day }, update: {} });
  }
  revalidateLists();
  revalidatePath(page);
  return day;
}

// Takes back its skip made on `day` (see skipToday)
export async function undoSkip(target: Skippable, day: string) {
  const user = await getDefaultUser();
  const page = await skippablePage(user.id, target);
  if (!parseCivilDayKey(day)) throw new Error('Invalid day');
  if (target.kind === 'habit') await prisma.habitSkip.deleteMany({ where: { habitId: target.id, day } });
  else await prisma.categorySkip.deleteMany({ where: { categoryId: target.id, day } });
  revalidateLists();
  revalidatePath(page);
}
