'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { MAX_AI_CONTEXT_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_HISTORY_WEEKS, MAX_NAME_LENGTH } from '@/lib/constants';
import { habitSchemaProblem } from '@/lib/habitSchema';
import { DEFAULT_CADENCE, type Cadence } from '@/lib/cadence';
import type { HabitSchema } from '@/lib/types';
import type { CalculatedField } from '@/lib/calculatedFields';
import { cadenceJson, END_OF_LIST_ORDER, revalidateLists, getOwnedCategory, habitListRows, toHabitListItem, getRecentLogsCutoff, getMembership, getOwnedHabit, fileHabit, checkCalculatedFields } from './internal';
import { getDefaultUser } from './user';

// A habit's name, description and form checked, since they come from the browser
function checkHabit(name: string, description: string, schema: HabitSchema) {
  if (!name.trim()) throw new Error('Give your habit a title');
  if (name.length > MAX_NAME_LENGTH) throw new Error(`Habit titles must be ${MAX_NAME_LENGTH} characters or fewer`);
  if ((description ?? '').length > MAX_DESCRIPTION_LENGTH) throw new Error(`Descriptions must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
  const problem = habitSchemaProblem(schema);
  if (problem) throw new Error(problem);
}

export async function saveHabit(name: string, description: string, schema: HabitSchema, categoryId?: string, cadence: Cadence = DEFAULT_CADENCE, publishToMqtt: boolean = false, aiContext?: string, calculatedFields: CalculatedField[] = []) {
  const user = await getDefaultUser();
  checkHabit(name, description, schema);
  if (categoryId) await getOwnedCategory(user.id, categoryId);
  const normalizedAiContext = normalizeAiContext(aiContext);
  const checkedCalculatedFields = checkCalculatedFields(calculatedFields, schema);

  try {
    const habit = await prisma.habit.create({
      data: {
        name,
        description,
        schema: JSON.stringify(schema),
        cadence: cadenceJson(cadence),
        calculatedFields: JSON.stringify(checkedCalculatedFields),
        publishToMqtt,
        userId: user.id,
        members: { create: { userId: user.id, categoryId: categoryId || null, order: END_OF_LIST_ORDER, aiContext: normalizedAiContext } },
      }
    });

    revalidateLists();
    return habit;
  } catch (error) {
    throw new Error("Prisma Create Error: " + (error instanceof Error ? error.message : String(error)));
  }
}

// When each of the user's habits was last logged, by anyone. List rows only carry the last few
// weeks of entries, but an every-N-days habit can still be done by an entry older than that.
export async function getLatestLogDates(): Promise<Record<string, Date>> {
  const user = await getDefaultUser();
  const latest = await prisma.habitLog.groupBy({
    by: ['habitId'],
    where: { habit: { members: { some: { userId: user.id } } } },
    _max: { createdAt: true },
  });
  return Object.fromEntries(latest.flatMap(l => (l._max.createdAt ? [[l.habitId, l._max.createdAt]] : [])));
}

// Every habit the user can log into (their own and ones shared with them), for matching something
// they said they did against their habits.
export async function getLoggableHabits() {
  const user = await getDefaultUser();
  const memberships = await prisma.habitMember.findMany({
    where: { userId: user.id },
    select: { aiContext: true, habit: { select: { id: true, name: true, description: true, schema: true } } },
  });
  return memberships.map(m => ({ ...m.habit, aiContext: m.aiContext }));
}

// `weeks` bounds how far back logs are fetched; see getCategory, which shares this cutoff with the
// "Uncategorized" synthetic category's history view.
export async function getUncategorizedHabits(weeks: number = MAX_HISTORY_WEEKS) {
  const user = await getDefaultUser();
  // Includes habits newly shared with this user, until they file them into a category
  const memberships = await prisma.habitMember.findMany({
    where: { userId: user.id, categoryId: null },
    ...habitListRows(getRecentLogsCutoff(weeks)),
  });
  return memberships.map(toHabitListItem);
}

// A habit the current user can see (their own or one shared with them), with their own placement
// of it and who has it. Null if they have no access.
export async function getHabit(id: string) {
  const user = await getDefaultUser();
  const membership = await prisma.habitMember.findUnique({
    where: { habitId_userId: { habitId: id, userId: user.id } },
    include: { habit: { include: { members: { select: { userId: true }, orderBy: { createdAt: 'asc' } }, skips: { select: { day: true } } } } }
  });
  if (!membership) return null;
  const { habit: { members, skips, ...habit }, categoryId, aiContext } = membership;
  return {
    ...habit,
    categoryId,
    aiContext,
    isOwner: habit.userId === user.id,
    memberIds: members.map(m => m.userId),
    skippedDays: skips.map(s => s.day),
  };
}

// Changes the habit's definition (owner only) and which of the owner's categories it's filed in.
// Its calculated fields are left as they are unless `calculatedFields` is given.
export async function updateHabit(id: string, name: string, description: string, schema: HabitSchema, categoryId?: string, cadence: Cadence = DEFAULT_CADENCE, publishToMqtt: boolean = false, aiContext?: string, calculatedFields?: CalculatedField[]) {
  const user = await getDefaultUser();
  checkHabit(name, description, schema);
  await getOwnedHabit(user.id, id);
  if (categoryId) await getOwnedCategory(user.id, categoryId);
  const normalizedAiContext = normalizeAiContext(aiContext);
  const checkedCalculatedFields = calculatedFields && checkCalculatedFields(calculatedFields, schema);

  try {
    const habit = await prisma.habit.update({
      where: { id },
      data: {
        name,
        description,
        schema: JSON.stringify(schema),
        cadence: cadenceJson(cadence),
        ...(checkedCalculatedFields ? { calculatedFields: JSON.stringify(checkedCalculatedFields) } : {}),
        publishToMqtt,
      }
    });
    await fileHabit(user.id, id, categoryId || null);
    await prisma.habitMember.update({
      where: { habitId_userId: { habitId: id, userId: user.id } },
      data: { aiContext: normalizedAiContext },
    });

    revalidateLists();
    revalidatePath(`/log/${id}`);
    return habit;
  } catch (error) {
    throw new Error("Prisma Update Error: " + (error instanceof Error ? error.message : String(error)));
  }
}

// Deletes the habit for everyone it's shared with, including every member's entries (owner only)
export async function deleteHabit(habitId: string) {
  const user = await getDefaultUser();
  await getOwnedHabit(user.id, habitId);
  // Memberships are removed along with the habit (onDelete: Cascade)
  await prisma.$transaction([
    prisma.habitLog.deleteMany({ where: { habitId } }),
    prisma.habit.delete({ where: { id: habitId } })
  ]);
  revalidateLists();
}

// Changes how often the habit is meant to be done. Owner only: unlike where it's filed, the cadence
// is part of the habit itself, the same for everyone it's shared with.
export async function setHabitCadence(habitId: string, cadence: Cadence) {
  const user = await getDefaultUser();
  await getOwnedHabit(user.id, habitId);
  await prisma.habit.update({
    where: { id: habitId },
    data: { cadence: cadenceJson(cadence) },
  });
  revalidateLists();
  revalidatePath(`/log/${habitId}`);
}

// Lets any member, not just the owner, file a habit into their own category tree
export async function setHabitCategory(habitId: string, categoryId: string | null) {
  const user = await getDefaultUser();
  if (categoryId) await getOwnedCategory(user.id, categoryId);
  await fileHabit(user.id, habitId, categoryId);
  revalidateLists();
  revalidatePath(`/log/${habitId}`);
}

// Blank context is stored as null; overlong context is refused rather than silently cut short
function normalizeAiContext(aiContext: string | undefined) {
  const trimmed = aiContext?.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_AI_CONTEXT_LENGTH) {
    throw new Error(`Context for AI must be ${MAX_AI_CONTEXT_LENGTH} characters or fewer`);
  }
  return trimmed;
}

// A member's own context for AI on a habit (see HabitMember.aiContext). Any member can set theirs,
// so this is how someone a habit is shared with sets it; the owner sets theirs through updateHabit.
export async function setHabitAiContext(habitId: string, aiContext: string) {
  const user = await getDefaultUser();
  await getMembership(user.id, habitId);
  await prisma.habitMember.update({
    where: { habitId_userId: { habitId, userId: user.id } },
    data: { aiContext: normalizeAiContext(aiContext) },
  });
  revalidatePath(`/log/${habitId}`);
  revalidatePath(`/edit/${habitId}`);
}

// Sets exactly which other users a habit is shared with (owner only). Newly added users find it in
// their Uncategorized list. Removed users lose access, but the entries they logged stay.
export async function setHabitSharing(habitId: string, userIds: string[]) {
  const user = await getDefaultUser();
  const habit = await getOwnedHabit(user.id, habitId);
  const sharedWith = [...new Set(z.array(z.string()).parse(userIds))].filter(id => id !== habit.userId);
  if (await prisma.user.count({ where: { id: { in: sharedWith } } }) !== sharedWith.length) {
    throw new Error("Unknown user");
  }

  const existing = await prisma.habitMember.findMany({ where: { habitId }, select: { userId: true } });
  const existingIds = new Set(existing.map(m => m.userId));
  await prisma.$transaction([
    prisma.habitMember.deleteMany({ where: { habitId, userId: { notIn: [habit.userId, ...sharedWith] } } }),
    prisma.habitMember.createMany({
      data: sharedWith.filter(id => !existingIds.has(id)).map(userId => ({ habitId, userId, order: END_OF_LIST_ORDER }))
    }),
  ]);

  revalidateLists();
  revalidatePath(`/log/${habitId}`);
}

// Removes a habit someone shared with you from your own lists. The entries you logged stay on it.
export async function leaveHabit(habitId: string) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  if (habit.userId === user.id) throw new Error("You own this habit. Delete it instead.");
  await prisma.habitMember.delete({ where: { habitId_userId: { habitId, userId: user.id } } });
  revalidateLists();
}

export async function isMqttConfigured() {
  return !!process.env.MQTT_URL;
}

export async function reorderHabits(updates: { id: string; order: number }[]) {
  const user = await getDefaultUser();
  
  // Order is per user, so this reorders the user's own memberships. Verify they have one for each
  // habit before updating.
  const memberships = await prisma.habitMember.findMany({
    where: { habitId: { in: updates.map(u => u.id) }, userId: user.id }
  });

  if (memberships.length !== updates.length) {
    throw new Error("Unauthorized or invalid habit IDs");
  }

  // Update in a transaction
  await prisma.$transaction(
    updates.map(update =>
      prisma.habitMember.update({
        where: { habitId_userId: { habitId: update.id, userId: user.id } },
        data: { order: update.order }
      })
    )
  );
  
  revalidateLists();
}
