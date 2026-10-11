// Reading a user's data into a backup and restoring one (see src/lib/backup.ts). Not actions
// themselves: they take a user id, so they're only called from the backup route, for the
// signed-in user (see src/app/api/backup/route.ts).
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BACKUP_FORMAT, BACKUP_VERSION, type Backup } from '@/lib/backup';
import { cadenceSchema, DEFAULT_CADENCE, NO_CADENCE, parseCadence } from '@/lib/cadence';
import { parseCalculatedFields, type CalculatedField } from '@/lib/calculatedFields';
import { parseCharts } from '@/lib/charts';
import { MAX_AI_CONTEXT_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from '@/lib/constants';
import { habitSchemaProblem, parseEntryValues, parseHabitSchema } from '@/lib/habitSchema';
import { isIconName } from '@/lib/icons';
import { userPreferencesSchema } from '@/lib/preferences';
import type { HabitSchema } from '@/lib/types';
import { checkCalculatedFields, sanitizeLogPayload } from './internal';

// Everything of `userId`'s that goes in a backup (see Backup)
export async function collectBackup(userId: string, now = new Date()): Promise<Backup> {
  const [user, categories, habits, entries, categorySkips, vacations] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { bedtime: true, weekStartsOn: true, useEmojiTitle: true, unitSystem: true, emojiModifier: true } }),
    prisma.category.findMany({ where: { userId }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.habit.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { members: { where: { userId } }, skips: { orderBy: { day: 'asc' } } } }),
    // Only their own: someone else's entries on a habit they share belong to that person
    prisma.habitLog.findMany({ where: { userId, habit: { userId } }, orderBy: { createdAt: 'asc' } }),
    prisma.categorySkip.findMany({ where: { category: { userId } }, orderBy: { day: 'asc' } }),
    prisma.vacation.findMany({ where: { userId }, orderBy: { from: 'asc' } }),
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    preferences: user,
    // Top-level categories first, so each subcategory's parent comes before it
    categories: [...categories].sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null)).map(c => ({
      id: c.id, name: c.name, icon: c.icon, parentId: c.parentId, order: c.order, cadence: parseCadence(c.cadence, NO_CADENCE),
    })),
    habits: habits.map(h => {
      const membership = h.members[0];
      return {
        id: h.id,
        name: h.name,
        description: h.description,
        schema: parseHabitSchema(h.schema),
        cadence: parseCadence(h.cadence),
        calculatedFields: parseCalculatedFields(h.calculatedFields),
        charts: parseCharts(h.charts),
        publishToMqtt: h.publishToMqtt,
        createdAt: h.createdAt.toISOString(),
        categoryId: membership?.categoryId ?? null,
        order: membership?.order ?? 0,
        aiContext: membership?.aiContext ?? null,
        remind: membership?.remind ?? false,
        remindAt: membership?.remindAt ?? null,
      };
    }),
    entries: entries.map(e => ({ id: e.id, habitId: e.habitId, createdAt: e.createdAt.toISOString(), values: parseEntryValues(e.payload) ?? {} })),
    habitSkips: habits.flatMap(h => h.skips.map(s => ({ habitId: h.id, day: s.day }))),
    categorySkips: categorySkips.map(s => ({ categoryId: s.categoryId, day: s.day })),
    vacations: vacations.map(v => ({ from: v.from, to: v.to })),
  };
}

// What restoring a backup did: how many of each record it added, how many it left out because
// they were already there (or someone else's), and what it couldn't restore and why
export interface RestoreResult {
  added: { categories: number; habits: number; entries: number; skips: number; vacations: number };
  alreadyThere: number;
  problems: string[];
}

// Problems listed in a result, at most; the rest are counted
const MAX_LISTED_PROBLEMS = 20;
const REMIND_AT = /^([01]\d|2[0-3]):[0-5]\d$/;

// Adds what's in `backup` to `userId`'s data, all of it or (if anything goes wrong) none of it.
// Nothing is changed or deleted, except preferences, which take the backup's. Each record is checked
// by the same rules as when it's made in the app; one that fails is left out, saying why.
export async function restoreBackup(userId: string, backup: Backup): Promise<RestoreResult> {
  const result: RestoreResult = { added: { categories: 0, habits: 0, entries: 0, skips: 0, vacations: 0 }, alreadyThere: 0, problems: [] };
  let unlisted = 0;
  const problem = (message: string) => {
    if (result.problems.length < MAX_LISTED_PROBLEMS) result.problems.push(message);
    else unlisted++;
  };

  await prisma.$transaction(async tx => {
    const preferences = userPreferencesSchema.safeParse(backup.preferences);
    if (preferences.success) await tx.user.update({ where: { id: userId }, data: preferences.data });
    else problem('Preferences: not valid, so yours were kept');

    // Categories: the user's own, by id, with their parents, so a subcategory only goes under a
    // top-level category of theirs (categories nest one level deep)
    const owned = new Map((await tx.category.findMany({ where: { userId }, select: { id: true, parentId: true } })).map(c => [c.id, c.parentId]));
    const takenCategoryIds = new Set((await tx.category.findMany({ where: { id: { in: backup.categories.map(c => c.id) } }, select: { id: true } })).map(c => c.id));
    const topLevelFirst = [...backup.categories].sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null));
    for (const category of topLevelFirst) {
      if (takenCategoryIds.has(category.id)) { result.alreadyThere++; continue; }
      const name = category.name.trim();
      if (!name || name.length > MAX_NAME_LENGTH) { problem(`Category "${category.name.slice(0, 40)}": its name isn't valid`); continue; }
      const parentId = category.parentId && owned.has(category.parentId) && owned.get(category.parentId) === null ? category.parentId : null;
      const cadence = cadenceSchema.safeParse(category.cadence);
      await tx.category.create({
        data: {
          id: category.id, userId, name, parentId, order: category.order,
          icon: category.icon && isIconName(category.icon) ? category.icon : null,
          cadence: JSON.stringify(cadence.success ? cadence.data : NO_CADENCE),
        },
      });
      owned.set(category.id, parentId);
      result.added.categories++;
    }

    // Habits, with the user's own filing of each; entries and skips only go on habits they own
    const ownedHabits = new Map((await tx.habit.findMany({ where: { userId }, select: { id: true, schema: true } })).map(h => [h.id, h.schema]));
    const takenHabitIds = new Set((await tx.habit.findMany({ where: { id: { in: backup.habits.map(h => h.id) } }, select: { id: true } })).map(h => h.id));
    for (const habit of backup.habits) {
      if (takenHabitIds.has(habit.id)) { result.alreadyThere++; continue; }
      const label = `Habit "${habit.name.slice(0, 40)}"`;
      const name = habit.name.trim();
      const schema = (habit.schema ?? {}) as HabitSchema;
      const invalid = !name || name.length > MAX_NAME_LENGTH ? 'its name isn\'t valid'
        : (habit.description ?? '').length > MAX_DESCRIPTION_LENGTH ? 'its description is too long'
        : habitSchemaProblem(schema);
      if (invalid) { problem(`${label}: ${invalid}`); continue; }
      const cadence = cadenceSchema.safeParse(habit.cadence);
      let calculatedFields: unknown[] = [];
      try {
        calculatedFields = checkCalculatedFields(habit.calculatedFields as CalculatedField[], schema);
      } catch {
        problem(`${label}: its calculated fields weren't valid, so they were left out`);
      }
      const aiContext = habit.aiContext?.trim() ? habit.aiContext.trim().slice(0, MAX_AI_CONTEXT_LENGTH) : null;
      const schemaJson = JSON.stringify(schema);
      await tx.habit.create({
        data: {
          id: habit.id, userId, name, description: habit.description, schema: schemaJson,
          cadence: JSON.stringify(cadence.success ? cadence.data : DEFAULT_CADENCE),
          calculatedFields: JSON.stringify(calculatedFields),
          charts: JSON.stringify(parseCharts(JSON.stringify(habit.charts ?? []))),
          publishToMqtt: habit.publishToMqtt,
          createdAt: new Date(habit.createdAt),
          members: {
            create: {
              userId, order: habit.order, aiContext, remind: habit.remind,
              categoryId: habit.categoryId && owned.has(habit.categoryId) ? habit.categoryId : null,
              remindAt: habit.remindAt && REMIND_AT.test(habit.remindAt) ? habit.remindAt : null,
            },
          },
        },
      });
      ownedHabits.set(habit.id, schemaJson);
      result.added.habits++;
    }

    // Entries, each checked against its habit's form the same as one logged in the app
    const takenEntryIds = new Set<string>();
    for (let i = 0; i < backup.entries.length; i += 500) {
      const ids = backup.entries.slice(i, i + 500).map(e => e.id);
      for (const { id } of await tx.habitLog.findMany({ where: { id: { in: ids } }, select: { id: true } })) takenEntryIds.add(id);
    }
    const entries: Prisma.HabitLogCreateManyInput[] = [];
    for (const entry of backup.entries) {
      if (takenEntryIds.has(entry.id)) { result.alreadyThere++; continue; }
      const schema = ownedHabits.get(entry.habitId);
      if (schema === undefined) { problem(`Entry from ${entry.createdAt.slice(0, 10)}: its habit wasn't restored`); continue; }
      try {
        const values = sanitizeLogPayload({ schema }, entry.values);
        entries.push({ id: entry.id, habitId: entry.habitId, userId, payload: JSON.stringify(values), createdAt: new Date(entry.createdAt) });
      } catch (error) {
        problem(`Entry from ${entry.createdAt.slice(0, 10)}: ${error instanceof Error ? error.message : 'its values aren\'t valid'}`);
      }
    }
    for (let i = 0; i < entries.length; i += 500) await tx.habitLog.createMany({ data: entries.slice(i, i + 500) });
    result.added.entries = entries.length;

    // Skips, on habits and categories of the user's
    const habitSkipsThere = new Set((await tx.habitSkip.findMany({ where: { habitId: { in: [...ownedHabits.keys()] } }, select: { habitId: true, day: true } })).map(s => `${s.habitId} ${s.day}`));
    const habitSkips = backup.habitSkips.filter(s => {
      if (!ownedHabits.has(s.habitId)) return false;
      if (habitSkipsThere.has(`${s.habitId} ${s.day}`)) { result.alreadyThere++; return false; }
      habitSkipsThere.add(`${s.habitId} ${s.day}`);
      return true;
    });
    if (habitSkips.length > 0) await tx.habitSkip.createMany({ data: habitSkips.map(s => ({ ...s, userId })) });
    const categorySkipsThere = new Set((await tx.categorySkip.findMany({ where: { categoryId: { in: [...owned.keys()] } }, select: { categoryId: true, day: true } })).map(s => `${s.categoryId} ${s.day}`));
    const categorySkips = backup.categorySkips.filter(s => {
      if (!owned.has(s.categoryId)) return false;
      if (categorySkipsThere.has(`${s.categoryId} ${s.day}`)) { result.alreadyThere++; return false; }
      categorySkipsThere.add(`${s.categoryId} ${s.day}`);
      return true;
    });
    if (categorySkips.length > 0) await tx.categorySkip.createMany({ data: categorySkips });
    result.added.skips = habitSkips.length + categorySkips.length;

    // Vacations, unless one with the same dates is there already
    const vacationsThere = new Set((await tx.vacation.findMany({ where: { userId }, select: { from: true, to: true } })).map(v => `${v.from} ${v.to}`));
    for (const vacation of backup.vacations) {
      if (vacation.to !== null && vacation.to < vacation.from) { problem(`Vacation from ${vacation.from}: it ends before it starts`); continue; }
      if (vacationsThere.has(`${vacation.from} ${vacation.to}`)) { result.alreadyThere++; continue; }
      await tx.vacation.create({ data: { userId, from: vacation.from, to: vacation.to } });
      vacationsThere.add(`${vacation.from} ${vacation.to}`);
      result.added.vacations++;
    }
  }, { timeout: 120_000 });

  if (unlisted > 0) result.problems.push(`…and ${unlisted} more`);
  return result;
}
