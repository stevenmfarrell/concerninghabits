'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import rjsfValidator from '@rjsf/validator-ajv8';

import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MAX_CSV_IMPORT_ROWS, MAX_HISTORY_WEEKS, UNCATEGORIZED_ID, UNCATEGORIZED_ICON } from '@/lib/constants';
import { userPreferencesSchema } from '@/lib/preferences';
import { TIMEZONE_COOKIE, isValidTimeZone } from '@/lib/timezone';
import { encodeCsv, parseCsv } from '@/lib/csv';
import { cookies } from 'next/headers';
import type { HabitSchema } from '@/lib/types';

type SchemaProperty = { type?: string; title?: string };

export async function getDefaultUser(allowNeedsUpdate = false) {
  const session = await verifySession();
  
  if (!session?.userId) {
    redirect('/api/logout');
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
}

// The viewer's time zone, reported by the browser in a cookie (see TimeZoneSync). Until the
// browser has reported it, fall back to the server's time zone.
async function getRequestTimeZone() {
  const timeZone = (await cookies()).get(TIMEZONE_COOKIE)?.value;
  return isValidTimeZone(timeZone) ? timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone;
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

export async function getCategoriesWithHierarchy() {
  const user = await getDefaultUser();
  // Only the dashboard's 3-week calendars read this, but the cutoff is generous so it stays
  // correct if a caller ever asks for a longer view.
  const logsCutoff = getRecentLogsCutoff(5);
  return prisma.category.findMany({
    where: { userId: user.id, parentId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: {
          habits: {
            include: { logs: { where: { createdAt: { gte: logsCutoff } }, select: { createdAt: true } } }
          }
        }
      },
      habits: {
        include: { logs: { where: { createdAt: { gte: logsCutoff } }, select: { createdAt: true } } }
      }
    }
  });
}

// `weeks` bounds how far back logs are fetched for the activity heatmap; pass the widest horizon
// a caller might display (the history page's horizon toggle tops out at MAX_HISTORY_WEEKS).
export async function getCategory(id: string, weeks: number = MAX_HISTORY_WEEKS) {
  const user = await getDefaultUser();

  // Habits without a category get a synthetic category so they can use the same pages
  if (id === UNCATEGORIZED_ID) {
    const habits = await getUncategorizedHabits(weeks);
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

  const logsCutoff = getRecentLogsCutoff(weeks);
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: {
          habits: {
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
            include: { logs: { where: { createdAt: { gte: logsCutoff } }, select: { createdAt: true } } }
          }
        }
      },
      habits: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { logs: { where: { createdAt: { gte: logsCutoff } }, select: { createdAt: true } } }
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
  if (parentId) await assertValidParent(user.id, parentId);
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
  if (parentId) await assertValidParent(user.id, parentId, id);

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

export async function saveHabit(name: string, description: string, schema: HabitSchema, categoryId?: string, frequency: string = 'daily', publishToMqtt: boolean = false) {
  const user = await getDefaultUser();
  if (categoryId) await getOwnedCategory(user.id, categoryId);

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
  } catch (error) {
    throw new Error("Prisma Create Error: " + (error instanceof Error ? error.message : String(error)));
  }
}

// A cutoff a few days earlier than `weeks` back, snapped to the start of a week and month, so a
// heatmap of exactly `weeks` weeks (and monthly habits near the start of that window) render correctly.
function getRecentLogsCutoff(weeks: number) {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - (weeks * 7 + 12));
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
        where: { createdAt: { gte: getRecentLogsCutoff(5) } },
        select: { createdAt: true }
      }
    }
  });
}

// `weeks` bounds how far back logs are fetched; see getCategory, which shares this cutoff with the
// "Uncategorized" synthetic category's history view.
export async function getUncategorizedHabits(weeks: number = MAX_HISTORY_WEEKS) {
  const user = await getDefaultUser();
  return prisma.habit.findMany({
    where: { userId: user.id, categoryId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { logs: { where: { createdAt: { gte: getRecentLogsCutoff(weeks) } }, select: { createdAt: true } } }
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

export async function logHabitEvent(habitId: string, payload: Record<string, unknown>, createdAt?: Date) {
  const user = await getDefaultUser();
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== user.id) throw new Error("Unauthorized");

  const schema: HabitSchema = { type: 'object', ...parseHabitSchema(habit) };
  const properties = (schema.properties || {}) as Record<string, SchemaProperty>;

  // Drop any keys the habit's own schema doesn't define, then validate the rest against it,
  // same as the client-side rjsf Form would. The browser only enforces this in the UI.
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key in properties)
  );

  const { errors } = rjsfValidator.validateFormData(sanitizedPayload, schema);
  if (errors.length > 0) {
    throw new Error(`Invalid log data: ${errors.map(e => e.stack).join('; ')}`);
  }

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
  const habit = await getOwnedHabit(user.id, habitId);
  const properties = getHabitSchemaProperties(habit);
  const fieldKeys = Object.keys(properties);

  const logs = await prisma.habitLog.findMany({
    where: { habitId, userId: user.id },
    orderBy: { createdAt: 'asc' }
  });

  const header = ['Date', ...fieldKeys.map(key => properties[key].title || key)];
  const rows = logs.map(log => {
    const payload = JSON.parse(log.payload) as Record<string, unknown>;
    return [
      log.createdAt.toISOString(),
      ...fieldKeys.map(key => {
        const val = payload[key];
        return val === undefined || val === null ? '' : String(val);
      })
    ];
  });

  const safeName = habit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'habit';
  return { filename: `${safeName}-log.csv`, csv: encodeCsv([header, ...rows]) };
}

export async function importHabitLogsCsv(habitId: string, csvText: string) {
  const user = await getDefaultUser();
  const habit = await getOwnedHabit(user.id, habitId);
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
  revalidatePath(`/history/${habitId}`);
  revalidatePath('/');

  return { imported: toCreate.length, skipped: dataRows.length - toCreate.length, errors };
}

export async function updateHabit(id: string, name: string, description: string, schema: HabitSchema, categoryId?: string, frequency: string = 'daily', publishToMqtt: boolean = false) {
  const user = await getDefaultUser();
  const existing = await prisma.habit.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) throw new Error("Unauthorized");
  if (categoryId) await getOwnedCategory(user.id, categoryId);

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
