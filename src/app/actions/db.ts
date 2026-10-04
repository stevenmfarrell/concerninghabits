'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cache } from 'react';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import rjsfValidator from '@rjsf/validator-ajv8';

import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MAX_AI_CONTEXT_LENGTH, MAX_CSV_IMPORT_ROWS, MAX_HISTORY_WEEKS, UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { userPreferencesSchema } from '@/lib/preferences';
import { cadenceSchema, DEFAULT_CADENCE, NO_CADENCE, type Cadence } from '@/lib/cadence';
import { TIMEZONE_COOKIE, civilDayKey, isValidTimeZone, parseBedtimeOffsetMinutes, parseCivilDayKey, toCivilDate } from '@/lib/timezone';
import { encodeCsv, parseCsv } from '@/lib/csv';
import { assignUserColors } from '@/lib/userColors';
import { cookies, headers } from 'next/headers';
import { RETURN_TO_HEADER, withReturnTo } from '@/lib/returnTo';
import type { HabitSchema } from '@/lib/types';
import { calculatedFieldProblem, calculatedFieldSchema, calculatedFieldsSchema, MAX_CALCULATED_FIELDS, parseCalculatedFields, type CalculatedField } from '@/lib/calculatedFields';
import { keyFor } from '@/lib/formFields';

type SchemaProperty = { type?: string; title?: string };

// Habits placed in a list without a chosen position (new, newly shared, or moved to another
// category) go to the end of it.
const END_OF_LIST_ORDER = 9999;

export async function getDefaultUser(allowNeedsUpdate = false) {
  return getRequestUser(allowNeedsUpdate);
}

// Memoized per request, since every action a page calls starts with getDefaultUser. Kept separate
// because a 'use server' file may only export async functions, not the function cache() returns.
const getRequestUser = cache(async (allowNeedsUpdate: boolean) => {
  const session = await verifySession();
  
  if (!session?.userId) {
    redirect(withReturnTo('/api/logout', (await headers()).get(RETURN_TO_HEADER)));
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

  return { ...user, timeZone: await getRequestTimeZone() };
});

// The viewer's time zone, reported by the browser in a cookie (see TimeZoneSync). Until the
// browser has reported it, fall back to the server's time zone.
async function getRequestTimeZone() {
  const timeZone = (await cookies()).get(TIMEZONE_COOKIE)?.value;
  return isValidTimeZone(timeZone) ? timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// The Agenda page and the Habits page both list habits with their recent entries, so anything that
// changes a habit, a category, or an entry refreshes both
function revalidateLists() {
  revalidatePath('/');
  revalidatePath('/habits');
}

async function getOwnedCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.userId !== userId) throw new Error("Unauthorized");
  return category;
}

// Categories nest one level deep: a parent must be a top-level category, and a category
// that has subcategories can't itself be nested. This also rules out parent cycles.
// This is the authority on that rule — computeDrop/applyDrop in categoryDrop.ts encode the same
// constraint client-side (for the live drag preview) and must stay consistent with it.
async function assertValidParent(userId: string, parentId: string, categoryId?: string) {
  if (parentId === categoryId) throw new Error("A category can't be its own parent");
  const parent = await getOwnedCategory(userId, parentId);
  if (parent.parentId) throw new Error("Subcategories can't have subcategories");
  if (categoryId && await prisma.category.count({ where: { parentId: categoryId } }) > 0) {
    throw new Error("A category with subcategories can't be nested");
  }
}

// A user's habits in one list (a category, uncategorized), in that user's saved order,
// each with the recent log times its mini calendar shows. Logs are everyone's, not just the
// viewer's: a shared habit's history is the whole household's.
const habitListRows = (logsCutoff: Date) => ({
  orderBy: [{ order: 'asc' }, { habit: { name: 'asc' } }],
  include: {
    habit: {
      include: {
        logs: { where: { createdAt: { gte: logsCutoff } }, select: { createdAt: true, userId: true } },
        _count: { select: { members: true } },
      }
    }
  }
}) satisfies Prisma.HabitMemberFindManyArgs;

type HabitListMembership = Prisma.HabitMemberGetPayload<ReturnType<typeof habitListRows>>;

// Flatten a membership onto its habit, so list rows read the viewer's own order and category the
// same way whether the habit is theirs or shared with them.
function toHabitListItem({ habit, order, categoryId, aiContext }: HabitListMembership) {
  return { ...habit, order, categoryId, aiContext, memberCount: habit._count.members };
}

function withHabits<C extends { habitMembers: HabitListMembership[] }>({ habitMembers, ...category }: C) {
  return { ...category, habits: habitMembers.map(toHabitListItem) };
}

export async function getCategoriesWithHierarchy() {
  const user = await getDefaultUser();
  // Only the 4-week row calendars read this, but the cutoff is generous so it stays
  // correct if a caller ever asks for a longer view.
  const logsCutoff = getRecentLogsCutoff(5);
  const categories = await prisma.category.findMany({
    where: { userId: user.id, parentId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { habitMembers: habitListRows(logsCutoff) }
      },
      habitMembers: habitListRows(logsCutoff)
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
    };
  }

  const logsCutoff = getRecentLogsCutoff(weeks);
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { habitMembers: habitListRows(logsCutoff) }
      },
      habitMembers: habitListRows(logsCutoff),
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

export async function createCategory(name: string, icon?: string, parentId?: string) {
  const user = await getDefaultUser();
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
    // Checked here as well as typed, since it comes from the browser
    data: { cadence: JSON.stringify(cadenceSchema.parse(cadence)) },
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

export async function saveHabit(name: string, description: string, schema: HabitSchema, categoryId?: string, cadence: Cadence = DEFAULT_CADENCE, publishToMqtt: boolean = false, aiContext?: string, calculatedFields: CalculatedField[] = []) {
  const user = await getDefaultUser();
  if (!name.trim()) throw new Error('Give your habit a title');
  if (categoryId) await getOwnedCategory(user.id, categoryId);
  const normalizedAiContext = normalizeAiContext(aiContext);
  const checkedCalculatedFields = checkCalculatedFields(calculatedFields, schema);

  try {
    const habit = await prisma.habit.create({
      data: {
        name,
        description,
        schema: JSON.stringify(schema),
        // Checked here as well as typed, since it comes from the browser
        cadence: JSON.stringify(cadenceSchema.parse(cadence)),
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

// The earliest log time a calendar of `weeks` weeks (see ActivityCalendar) can need. A calendar
// never starts more than `weeks` weeks back, but a weekly or monthly habit's first cell is filled if
// the habit was done anytime in that week or month, even before the calendar starts. So snap to the
// 1st of the month, then keep a generous buffer: another whole month and week, which also covers
// week starts, the viewer's time zone vs. the server's, and bedtime (logs before bedtime count
// toward the previous day).
function getRecentLogsCutoff(weeks: number) {
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7);
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  return cutoff;
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
    include: { habit: { include: { members: { select: { userId: true }, orderBy: { createdAt: 'asc' } } } } }
  });
  if (!membership) return null;
  const { habit: { members, ...habit }, categoryId, aiContext } = membership;
  return {
    ...habit,
    categoryId,
    aiContext,
    isOwner: habit.userId === user.id,
    memberIds: members.map(m => m.userId),
  };
}

export async function logHabitEvent(habitId: string, payload: Record<string, unknown>, createdAt?: Date) {
  const user = await getDefaultUser();
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
  
  revalidatePath(`/log/${habitId}`);
  revalidateLists();
  revalidatePath('/history');
  return log;
}

// An entry's values with any keys the habit's own schema doesn't define dropped, validated against
// the schema the same as the client-side rjsf Form would. The browser only enforces this in the UI.
function sanitizeLogPayload(habit: { schema: string }, payload: Record<string, unknown>) {
  const schema: HabitSchema = { type: 'object', ...parseHabitSchema(habit) };
  const properties = (schema.properties || {}) as Record<string, SchemaProperty>;
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key in properties)
  );

  const { errors } = rjsfValidator.validateFormData(sanitizedPayload, schema);
  if (errors.length > 0) {
    throw new Error(`Invalid log data: ${errors.map(e => e.stack).join('; ')}`);
  }
  return sanitizedPayload;
}

// Anyone can edit or delete an entry they logged; a habit's owner can also edit or delete anyone's
// entry on it
function canChangeLog(userId: string, log: { userId: string }, habit: { userId: string }) {
  return log.userId === userId || habit.userId === userId;
}

// An entry the user may edit or delete, checked to belong to `habitId`
async function getChangeableLog(userId: string, logId: string, habitId: string) {
  const log = await prisma.habitLog.findUnique({ where: { id: logId }, include: { habit: { select: { userId: true, schema: true } } } });
  if (!log || log.habitId !== habitId || !canChangeLog(userId, log, log.habit)) throw new Error("Unauthorized");
  return log;
}

// Corrects an entry's values, and its time when `createdAt` is given. Not republished to MQTT,
// which announces new entries.
export async function updateHabitLog(logId: string, habitId: string, payload: Record<string, unknown>, createdAt?: Date) {
  const user = await getDefaultUser();
  const log = await getChangeableLog(user.id, logId, habitId);
  if (createdAt && Number.isNaN(createdAt.getTime())) throw new Error('Invalid date');

  await prisma.habitLog.update({
    where: { id: logId },
    data: {
      payload: JSON.stringify(sanitizeLogPayload(log.habit, payload)),
      ...(createdAt ? { createdAt } : {}),
    },
  });
  revalidatePath(`/log/${habitId}`);
  revalidateLists();
  revalidatePath('/history');
}

export async function deleteHabitLog(logId: string, habitId: string) {
  const user = await getDefaultUser();
  await getChangeableLog(user.id, logId, habitId);

  await prisma.habitLog.delete({
    where: { id: logId }
  });
  revalidatePath(`/log/${habitId}`);
  revalidateLists();
  revalidatePath('/history');
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The current user's own entries on one of their days (`dayKey`, a civil date like "2024-03-10" in
// their time zone, with their bedtime deciding when a day ends), oldest first, for the History
// view. Only their own: on a shared habit, someone else's entry doesn't check it off for them.
export async function getDayEntries(dayKey: string) {
  const user = await getDefaultUser();
  const day = parseCivilDayKey(dayKey);
  if (!day) throw new Error('Invalid day');

  // Where a day starts and ends in UTC depends on the time zone and bedtime, so fetch a generous
  // window around it and keep the logs that fall on it exactly
  const offset = parseBedtimeOffsetMinutes(user.bedtime);
  const logs = await prisma.habitLog.findMany({
    where: { userId: user.id, createdAt: { gte: new Date(day.getTime() - 2 * DAY_MS), lt: new Date(day.getTime() + 3 * DAY_MS) } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, habitId: true, payload: true, createdAt: true },
  });

  return logs
    .filter(log => civilDayKey(toCivilDate(log.createdAt, user.timeZone, offset)) === dayKey)
    .map(log => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(log.payload);
      } catch {}
      return { ...log, payload };
    });
}

// Every entry on a habit the user can see, whoever logged it, newest first. `canChange` says
// whether the current user may edit or delete that entry.
// A habit's logs, newest first, going back far enough for a calendar of `weeks` weeks (see
// getRecentLogsCutoff). Pass the widest horizon the caller might display.
export async function getHabitLogs(habitId: string, weeks: number = MAX_HISTORY_WEEKS) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  const logs = await prisma.habitLog.findMany({
    where: { habitId, createdAt: { gte: getRecentLogsCutoff(weeks) } },
    orderBy: { createdAt: 'desc' }
  });
  return logs.map(log => ({ ...log, canChange: canChangeLog(user.id, log, habit) }));
}

// What the habit page's history needs to know about a habit's logs beyond getHabitLogs' window: whether it
// has any at all, and whether anyone besides the owner has ever logged it (see isSharedHabit).
export async function getHabitLogPresence(habitId: string) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  const [anyLog, otherPersonLog] = await Promise.all([
    prisma.habitLog.findFirst({ where: { habitId }, select: { id: true } }),
    prisma.habitLog.findFirst({ where: { habitId, userId: { not: habit.userId } }, select: { id: true } }),
  ]);
  return { hasLogs: !!anyLog, hasLogsFromOthers: !!otherPersonLog };
}

// The user's membership in a habit (their own, or one shared with them), with the habit.
// Membership is what grants access: viewing, logging, and filing the habit in a category.
async function getMembership(userId: string, habitId: string) {
  const membership = await prisma.habitMember.findUnique({
    where: { habitId_userId: { habitId, userId } },
    include: { habit: true }
  });
  if (!membership) throw new Error("Unauthorized");
  return membership;
}

// A habit the user owns. Only the owner can change its form, share it, or delete it.
async function getOwnedHabit(userId: string, habitId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== userId) throw new Error("Unauthorized");
  return habit;
}

function parseHabitSchema(habit: { schema: string }): HabitSchema {
  try {
    return JSON.parse(habit.schema || '{}');
  } catch {
    return {};
  }
}

function getHabitSchemaProperties(habit: { schema: string }): Record<string, SchemaProperty> {
  return (parseHabitSchema(habit).properties || {}) as Record<string, SchemaProperty>;
}

export async function exportHabitLogsCsv(habitId: string) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  const properties = getHabitSchemaProperties(habit);
  const fieldKeys = Object.keys(properties);

  const logs = await prisma.habitLog.findMany({
    where: { habitId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } } }
  });

  // Name who logged each entry once more than one person has. Import ignores this column, since
  // it matches no form field.
  const includeLoggedBy = new Set(logs.map(log => log.userId)).size > 1;

  const header = ['Date', ...fieldKeys.map(key => properties[key].title || key), ...(includeLoggedBy ? ['Logged By'] : [])];
  const rows = logs.map(log => {
    const payload = JSON.parse(log.payload) as Record<string, unknown>;
    return [
      log.createdAt.toISOString(),
      ...fieldKeys.map(key => {
        const val = payload[key];
        return val === undefined || val === null ? '' : String(val);
      }),
      ...(includeLoggedBy ? [log.user.name] : [])
    ];
  });

  const safeName = habit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'habit';
  return { filename: `${safeName}-log.csv`, csv: encodeCsv([header, ...rows]) };
}

export async function importHabitLogsCsv(habitId: string, csvText: string) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  const properties = getHabitSchemaProperties(habit);

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { imported: 0, skipped: 0, errors: ['The CSV file is empty.'] };
  }

  const [header, ...dataRows] = rows;
  if (dataRows.length > MAX_CSV_IMPORT_ROWS) {
    throw new Error(`CSV has too many rows (max ${MAX_CSV_IMPORT_ROWS}).`);
  }

  // Match each non-date column to a schema field by header title or key, case-insensitively.
  const columnKeys: (string | null)[] = header.slice(1).map(col => {
    const normalized = col.trim().toLowerCase();
    return Object.keys(properties).find(key =>
      key.toLowerCase() === normalized || (properties[key].title || '').toLowerCase() === normalized
    ) || null;
  });

  const errors: string[] = [];
  const toCreate: { habitId: string; userId: string; payload: string; createdAt?: Date }[] = [];

  dataRows.forEach((row, i) => {
    const rowNum = i + 2; // +1 for 0-index, +1 for the header row
    const dateStr = row[0]?.trim();
    let createdAt: Date | undefined;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        errors.push(`Row ${rowNum}: could not parse date "${dateStr}".`);
        return;
      }
      createdAt = parsed;
    }

    const payload: Record<string, unknown> = {};
    columnKeys.forEach((key, colIdx) => {
      if (!key) return;
      const raw = row[colIdx + 1]?.trim();
      if (!raw) return;

      const propType = properties[key].type;
      if (propType === 'number' || propType === 'integer') {
        const num = Number(raw);
        if (!isNaN(num)) payload[key] = num;
      } else if (propType === 'boolean') {
        payload[key] = raw.toLowerCase() === 'true' || raw === '1';
      } else {
        payload[key] = raw;
      }
    });

    toCreate.push({
      habitId,
      userId: user.id,
      payload: JSON.stringify(payload),
      ...(createdAt ? { createdAt } : {})
    });
  });

  if (toCreate.length > 0) {
    await prisma.habitLog.createMany({ data: toCreate });
  }

  revalidatePath(`/log/${habitId}`);
  revalidateLists();

  return { imported: toCreate.length, skipped: dataRows.length - toCreate.length, errors };
}

// Changes the habit's definition (owner only) and which of the owner's categories it's filed in.
// Its calculated fields are left as they are unless `calculatedFields` is given.
export async function updateHabit(id: string, name: string, description: string, schema: HabitSchema, categoryId?: string, cadence: Cadence = DEFAULT_CADENCE, publishToMqtt: boolean = false, aiContext?: string, calculatedFields?: CalculatedField[]) {
  const user = await getDefaultUser();
  if (!name.trim()) throw new Error('Give your habit a title');
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
        // Checked here as well as typed, since it comes from the browser
        cadence: JSON.stringify(cadenceSchema.parse(cadence)),
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

export async function updateUserPreferences(prefs: { bedtime?: string, weekStartsOn?: string, useEmojiTitle?: boolean, unitSystem?: string, emojiModifier?: string | null }) {
  const user = await getDefaultUser();
  // Server action arguments come straight from the client; only allow known preference fields
  const data = userPreferencesSchema.parse(prefs);
  await prisma.user.update({
    where: { id: user.id },
    data
  });
  revalidatePath('/settings');
  revalidateLists();
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

// Files a habit into one of the user's categories (or Uncategorized when null), moving it to the
// end of that list if it's changing lists.
async function fileHabit(userId: string, habitId: string, categoryId: string | null) {
  const membership = await getMembership(userId, habitId);
  if (membership.categoryId === categoryId) return;
  await prisma.habitMember.update({
    where: { habitId_userId: { habitId, userId } },
    data: { categoryId, order: END_OF_LIST_ORDER }
  });
}

// A habit's calculated fields as saved with its form, checked here as well as typed since they come
// from the browser. One whose formula uses a field the form no longer has is kept (the editor shows
// it as needing fixing, and charts leave it out), but a key can't clash with a form field's.
function checkCalculatedFields(fields: CalculatedField[], schema: HabitSchema) {
  const checked = calculatedFieldsSchema.parse(fields);
  const formKeys = Object.keys(schema.properties ?? {});
  const clash = checked.find(field => formKeys.includes(field.key));
  if (clash) throw new Error(`"${clash.title}" has the same key as a form field`);
  return checked;
}

// Adds a calculated field to a habit (`key` null), or changes one, saving straight away, e.g. from
// the habit page's Trends. Owner only, like the rest of the habit's definition. Unlike saving the
// whole habit, the formula has to work with the form as it is. Returns the field as saved, with its
// key: a new one's is made from its title.
export async function saveCalculatedField(habitId: string, key: string | null, field: Omit<CalculatedField, 'key'>) {
  const user = await getDefaultUser();
  const habit = await getOwnedHabit(user.id, habitId);
  const schema = parseHabitSchema(habit);
  const existing = parseCalculatedFields(habit.calculatedFields);
  if (key !== null && !existing.some(f => f.key === key)) throw new Error('That calculated field no longer exists');
  if (key === null && existing.length >= MAX_CALCULATED_FIELDS) throw new Error(`A habit can have at most ${MAX_CALCULATED_FIELDS} calculated fields`);

  const fieldKey = key ?? keyFor(field.title, [...Object.keys(schema.properties ?? {}), ...existing.map(f => f.key)]);
  const saved = calculatedFieldSchema.parse({ ...field, key: fieldKey });
  const problem = calculatedFieldProblem(saved, schema);
  if (problem) throw new Error(problem);

  const next = key === null ? [...existing, saved] : existing.map(f => (f.key === key ? saved : f));
  await prisma.habit.update({ where: { id: habitId }, data: { calculatedFields: JSON.stringify(checkCalculatedFields(next, schema)) } });
  revalidatePath(`/log/${habitId}`);
  return saved;
}

// Removes a calculated field from a habit. Owner only. Nothing logged changes, since a calculated
// field's values are worked out rather than stored.
export async function deleteCalculatedField(habitId: string, key: string) {
  const user = await getDefaultUser();
  const habit = await getOwnedHabit(user.id, habitId);
  const remaining = parseCalculatedFields(habit.calculatedFields).filter(f => f.key !== key);
  await prisma.habit.update({ where: { id: habitId }, data: { calculatedFields: JSON.stringify(remaining) } });
  revalidatePath(`/log/${habitId}`);
}

// Changes how often the habit is meant to be done. Owner only: unlike where it's filed, the cadence
// is part of the habit itself, the same for everyone it's shared with.
export async function setHabitCadence(habitId: string, cadence: Cadence) {
  const user = await getDefaultUser();
  await getOwnedHabit(user.id, habitId);
  await prisma.habit.update({
    where: { id: habitId },
    // Checked here as well as typed, since it comes from the browser
    data: { cadence: JSON.stringify(cadenceSchema.parse(cadence)) },
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

// Everyone on this instance with their display color as the current user sees it (green for
// themselves), in account creation order. An instance is one household, so users can see each
// other's names to share habits and read shared history.
export async function getPeople() {
  const user = await getDefaultUser();
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true } });
  return assignUserColors(users, user.id);
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
