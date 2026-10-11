import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { collectBackup, restoreBackup } from '@/app/actions/backupStore';
import { createCategory, setCategoryCadence } from '@/app/actions/categories';
import { logHabitEvent } from '@/app/actions/entries';
import { saveHabit, setHabitSharing } from '@/app/actions/habits';
import { skipToday } from '@/app/actions/skips';
import { setVacation } from '@/app/actions/vacation';
import { parseBackup, toCsv, type Backup } from '@/lib/backup';
import type { HabitSchema } from '@/lib/types';

const runSchema: HabitSchema = { type: 'object', properties: { distance: { type: 'number', title: 'Distance' } }, required: ['distance'] };

async function createTestUser(name: string) {
  const user = await prisma.user.create({ data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x', bedtime: '02:00' } });
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  return { user, sessionId: session.id };
}

// Everything of the user's a backup has, as if it were lost
async function wipe(userId: string) {
  await prisma.habitLog.deleteMany({ where: { habit: { userId } } });
  await prisma.habit.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId, parentId: { not: null } } });
  await prisma.category.deleteMany({ where: { userId } });
  await prisma.vacation.deleteMany({ where: { userId } });
}

const withoutDate = (backup: Backup) => ({ ...backup, exportedAt: '' });

describe('backup and restore', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let backup: Backup;

  beforeEach(async () => {
    owner = await createTestUser('Owner');
    setSessionCookie(owner.sessionId);
    const fitness = await createCategory('Fitness', 'Dumbbell');
    const cardio = await createCategory('Cardio', undefined, fitness.id);
    await setCategoryCadence(cardio.id, { type: 'calendarWeek', times: 3 });
    const run = await saveHabit('Running', 'Outdoors', runSchema, cardio.id, { type: 'daily', timesPerDay: 1 }, false, 'My usual loop is 3 miles');
    await logHabitEvent(run.id, { distance: 3 }, new Date('2026-10-01T08:00:00Z'));
    await logHabitEvent(run.id, { distance: 5 }, new Date('2026-10-02T08:00:00Z'));
    await skipToday({ kind: 'habit', id: run.id });
    await skipToday({ kind: 'category', id: cardio.id });
    await setVacation('2099-01-01', '2099-01-05');
    backup = await collectBackup(owner.user.id);
  });

  it('has the user\'s data', () => {
    expect(backup.categories.map(c => [c.name, c.parentId !== null])).toEqual([['Fitness', false], ['Cardio', true]]);
    expect(backup.habits).toEqual([expect.objectContaining({ name: 'Running', description: 'Outdoors', aiContext: 'My usual loop is 3 miles', categoryId: backup.categories[1].id })]);
    expect(backup.entries.map(e => e.values)).toEqual([{ distance: 3 }, { distance: 5 }]);
    expect(backup.habitSkips).toHaveLength(1);
    expect(backup.categorySkips).toHaveLength(1);
    expect(backup.vacations).toEqual([{ from: '2099-01-01', to: '2099-01-05' }]);
    expect(backup.preferences).toMatchObject({ bedtime: '02:00' });
  });

  it('restores everything lost, from JSON or CSV, the same as it was', async () => {
    await wipe(owner.user.id);
    const fromCsv = parseBackup(toCsv(backup));
    if (!('backup' in fromCsv)) throw new Error(fromCsv.problem);
    const result = await restoreBackup(owner.user.id, fromCsv.backup);
    expect(result).toEqual({ added: { categories: 2, habits: 1, entries: 2, skips: 2, vacations: 1 }, alreadyThere: 0, problems: [] });
    expect(withoutDate(await collectBackup(owner.user.id))).toEqual(withoutDate(backup));
  });

  it('skips what\'s already there, so restoring twice adds nothing', async () => {
    const result = await restoreBackup(owner.user.id, backup);
    expect(result.added).toEqual({ categories: 0, habits: 0, entries: 0, skips: 0, vacations: 0 });
    expect(result.alreadyThere).toBe(2 + 1 + 2 + 2 + 1);
    expect(await prisma.habitLog.count({ where: { userId: owner.user.id } })).toBe(2);
  });

  it('never takes over or changes someone else\'s data with the same ids', async () => {
    const other = await createTestUser('Other');
    const result = await restoreBackup(other.user.id, backup);
    expect(result.added).toMatchObject({ categories: 0, habits: 0, entries: 0, skips: 0 });
    expect(await prisma.habit.count({ where: { userId: other.user.id } })).toBe(0);
    expect(withoutDate(await collectBackup(owner.user.id))).toEqual(withoutDate(backup));
  });

  it('leaves out what the app wouldn\'t accept, saying why, and restores the rest', async () => {
    await wipe(owner.user.id);
    const [fitness, cardio] = backup.categories;
    const [run] = backup.habits;
    const result = await restoreBackup(owner.user.id, {
      ...backup,
      preferences: { bedtime: 'late' },
      // A subcategory under one that isn't there goes to the top level
      categories: [{ ...cardio, parentId: 'missing', cadence: { type: 'whenever' } }],
      habits: [run, { ...run, id: 'bad-form', name: 'Bad form', schema: { type: 'object', properties: { x: { type: 'date' } } } }],
      entries: [...backup.entries, { id: 'no-distance', habitId: run.id, createdAt: '2026-10-03T08:00:00Z', values: {} }, { id: 'orphan', habitId: 'bad-form', createdAt: '2026-10-04T08:00:00Z', values: {} }],
    });
    expect(result.added).toMatchObject({ categories: 1, habits: 1, entries: 2 });
    expect(result.problems).toEqual([
      'Preferences: not valid, so yours were kept',
      expect.stringMatching(/^Habit "Bad form": /),
      expect.stringMatching(/^Entry from 2026-10-03: Invalid log data: .*distance/i),
      'Entry from 2026-10-04: its habit wasn\'t restored',
    ]);
    const restored = await prisma.category.findUniqueOrThrow({ where: { id: cardio.id } });
    expect(restored).toMatchObject({ parentId: null, cadence: '{"type":"none"}' });
    expect(fitness).toBeDefined();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).bedtime).toBe('02:00');
  });

  it('has only the habits the user owns, and their own entries on them', async () => {
    const member = await createTestUser('Member');
    const [run] = backup.habits;
    await setHabitSharing(run.id, [member.user.id]);
    setSessionCookie(member.sessionId);
    await logHabitEvent(run.id, { distance: 1 });

    expect((await collectBackup(owner.user.id)).entries).toHaveLength(2);
    const membersBackup = await collectBackup(member.user.id);
    expect(membersBackup.habits).toEqual([]);
    expect(membersBackup.entries).toEqual([]);
  });
});
