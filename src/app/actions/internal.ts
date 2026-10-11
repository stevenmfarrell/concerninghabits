// Helpers the server actions share: access checks, the queries their lists are built from, and
// checks on what's saved. Not actions themselves (a 'use server' file may only export async
// functions), so only ever imported by server code.

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import rjsfValidator from '@rjsf/validator-ajv8';
import { MAX_LOG_PAYLOAD_BYTES } from '@/lib/constants';
import { parseHabitSchema } from '@/lib/habitSchema';
import { cadenceSchema, type Cadence } from '@/lib/cadence';
import type { HabitSchema } from '@/lib/types';
import { calculatedFieldsSchema, type CalculatedField } from '@/lib/calculatedFields';
import { fieldsOf } from '@/lib/formFields';

// Habits placed in a list without a chosen position (new, newly shared, or moved to another
// category) go to the end of it.
export const END_OF_LIST_ORDER = 9999;

// The Agenda page and the Habits page both list habits with their recent entries, so anything that
// changes a habit, a category, or an entry refreshes both
export function revalidateLists() {
  revalidatePath('/');
  revalidatePath('/habits');
}

// After a habit's entries change: its page, the lists, and the History view
export function revalidateEntries(habitId: string) {
  revalidatePath(`/log/${habitId}`);
  revalidateLists();
  revalidatePath('/history');
}

// A cadence as it's stored (Habit.cadence, Category.cadence), checked here as well as typed, since
// it comes from the browser
export function cadenceJson(cadence: Cadence) {
  return JSON.stringify(cadenceSchema.parse(cadence));
}

export async function getOwnedCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.userId !== userId) throw new Error("Unauthorized");
  return category;
}

// Categories nest one level deep: a parent must be a top-level category, and a category
// that has subcategories can't itself be nested. This also rules out parent cycles.
// This is the authority on that rule — computeDrop/applyDrop in categoryDrop.ts encode the same
// constraint client-side (for the live drag preview) and must stay consistent with it.
export async function assertValidParent(userId: string, parentId: string, categoryId?: string) {
  if (parentId === categoryId) throw new Error("A category can't be its own parent");
  const parent = await getOwnedCategory(userId, parentId);
  if (parent.parentId) throw new Error("Subcategories can't have subcategories");
  if (categoryId && await prisma.category.count({ where: { parentId: categoryId } }) > 0) {
    throw new Error("A category with subcategories can't be nested");
  }
}

// A user's habits in one list (a category, uncategorized), in that user's saved order,
// each with the recent log times its mini calendar shows, and the days it was skipped. Logs are everyone's, not just the
// viewer's: a shared habit's history is the whole household's.
export const habitListRows = (logsCutoff: Date) => ({
  orderBy: [{ order: 'asc' }, { habit: { name: 'asc' } }],
  include: {
    habit: {
      include: {
        logs: { where: { createdAt: { gte: logsCutoff } }, select: { createdAt: true, userId: true } },
        // All of them, not just recent ones: there are few, and an every-N-days skip can count for months
        skips: { select: { day: true } },
        _count: { select: { members: true } },
      }
    }
  }
}) satisfies Prisma.HabitMemberFindManyArgs;

export type HabitListMembership = Prisma.HabitMemberGetPayload<ReturnType<typeof habitListRows>>;

// Flatten a membership onto its habit, so list rows read the viewer's own order and category the
// same way whether the habit is theirs or shared with them.
export function toHabitListItem({ habit, order, categoryId, aiContext }: HabitListMembership) {
  return { ...habit, order, categoryId, aiContext, memberCount: habit._count.members };
}

export function withHabits<C extends { habitMembers: HabitListMembership[] }>({ habitMembers, ...category }: C) {
  return { ...category, habits: habitMembers.map(toHabitListItem) };
}

// The days a category was skipped (see CategorySkip), all of them, as for a habit's
export const categorySkips = { select: { day: true } } as const;

// The earliest log time a calendar of `weeks` weeks (see ActivityCalendar) can need. A calendar
// never starts more than `weeks` weeks back, but a weekly or monthly habit's first cell is filled if
// the habit was done anytime in that week or month, even before the calendar starts. So snap to the
// 1st of the month, then keep a generous buffer: another whole month and week, which also covers
// week starts, the viewer's time zone vs. the server's, and bedtime (logs before bedtime count
// toward the previous day).
export function getRecentLogsCutoff(weeks: number) {
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7);
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  return cutoff;
}

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

// Files a habit into one of the user's categories (or Uncategorized when null), moving it to the
// end of that list if it's changing lists.
export async function fileHabit(userId: string, habitId: string, categoryId: string | null) {
  const membership = await getMembership(userId, habitId);
  const change = filingChange(membership.categoryId, categoryId);
  if (!change) return;
  await prisma.habitMember.update({ where: { habitId_userId: { habitId, userId } }, data: change });
}

// What filing a membership now in `current` into `categoryId` changes about it (see fileHabit), or
// null when it's already there
export function filingChange(current: string | null, categoryId: string | null) {
  return current === categoryId ? null : { categoryId, order: END_OF_LIST_ORDER };
}

// Logs an entry on a habit `user` has, as them: checked like any entry (see sanitizeLogPayload),
// and published to MQTT when the habit is. Takes the user rather than reading the session, since
// the API logs as whoever its key belongs to (see src/lib/apiKeys.ts).
export async function createHabitLog(user: { id: string; name: string }, habitId: string, payload: Record<string, unknown>, createdAt?: Date) {
  const { habit } = await getMembership(user.id, habitId);

  const sanitizedPayload = sanitizeLogPayload(habit, payload);

  const log = await prisma.habitLog.create({
    data: {
      habitId,
      userId: user.id,
      payload: JSON.stringify(sanitizedPayload),
      ...(createdAt ? { createdAt } : {})
    }
  });

  try {
    if (habit.publishToMqtt) {
      const { publishHabitLog } = await import('@/lib/mqtt');
      publishHabitLog(user, habit, sanitizedPayload);
    }
  } catch (e) {
    console.error('Failed to trigger MQTT publish', e);
  }

  revalidateEntries(habitId);
  return log;
}

// An entry's values with any keys the habit's own schema doesn't define dropped, validated against
// the schema the same as the client-side rjsf Form would. The browser only enforces this in the UI.
export function sanitizeLogPayload(habit: { schema: string }, payload: Record<string, unknown>) {
  const schema: HabitSchema = { type: 'object', ...parseHabitSchema(habit.schema) };
  const properties = fieldsOf(schema);
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key in properties)
  );

  const { errors } = rjsfValidator.validateFormData(sanitizedPayload, schema);
  if (errors.length > 0) {
    throw new Error(`Invalid log data: ${errors.map(e => e.stack).join('; ')}`);
  }
  const problem = payloadSizeProblem(sanitizedPayload);
  if (problem) throw new Error(problem);
  return sanitizedPayload;
}

// Why an entry's values are too big to store (see MAX_LOG_PAYLOAD_BYTES), or null if they fit
function payloadSizeProblem(payload: Record<string, unknown>) {
  const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (bytes <= MAX_LOG_PAYLOAD_BYTES) return null;
  return `This entry is too long (${(bytes / 1024).toFixed(1)} KB; the limit is ${MAX_LOG_PAYLOAD_BYTES / 1024} KB)`;
}

// Anyone can edit or delete an entry they logged; a habit's owner can also edit or delete anyone's
// entry on it
export function canChangeLog(userId: string, log: { userId: string }, habit: { userId: string }) {
  return log.userId === userId || habit.userId === userId;
}

// An entry the user may edit or delete, checked to belong to `habitId`
export async function getChangeableLog(userId: string, logId: string, habitId: string) {
  const log = await prisma.habitLog.findUnique({ where: { id: logId }, include: { habit: { select: { userId: true, schema: true } } } });
  if (!log || log.habitId !== habitId || !canChangeLog(userId, log, log.habit)) throw new Error("Unauthorized");
  return log;
}

// A habit's calculated fields as saved with its form, checked here as well as typed since they come
// from the browser. One whose formula uses a field the form no longer has is kept (the editor shows
// it as needing fixing, and charts leave it out), but a key can't clash with a form field's.
export function checkCalculatedFields(fields: CalculatedField[], schema: HabitSchema) {
  const checked = calculatedFieldsSchema.parse(fields);
  const formKeys = Object.keys(fieldsOf(schema));
  const clash = checked.find(field => formKeys.includes(field.key));
  if (clash) throw new Error(`"${clash.title}" has the same key as a form field`);
  return checked;
}
