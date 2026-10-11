import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { createCategory, deleteCategory, reorderCategories, updateCategory } from '@/app/actions/categories';
import { deleteHabitLog, logHabitEvent } from '@/app/actions/entries';
import { getHabit, reorderHabits, saveHabit, updateHabit } from '@/app/actions/habits';
import { updateUserPreferences } from '@/app/actions/user';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return { user, sessionId: session.id };
}

describe('server actions only let a user touch their own data', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>;
  let bob: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    alice = await createTestUser('Alice');
    bob = await createTestUser('Bob');
  });

  const asAlice = () => setSessionCookie(alice.sessionId);
  const asBob = () => setSessionCookie(bob.sessionId);

  it('rejects updating another user\'s category', async () => {
    asAlice();
    const category = await createCategory('Alice Category', 'List');

    asBob();
    await expect(updateCategory(category.id, 'Hacked', 'List')).rejects.toThrow('Unauthorized');
  });

  it('rejects deleting another user\'s category', async () => {
    asAlice();
    const category = await createCategory('Alice Category To Delete', 'List');

    asBob();
    await expect(deleteCategory(category.id)).rejects.toThrow('Unauthorized');
  });

  it('rejects nesting a new category under another user\'s category', async () => {
    asAlice();
    const parent = await createCategory('Alice Parent', 'List');

    asBob();
    await expect(createCategory('Bob Child', 'List', parent.id)).rejects.toThrow('Unauthorized');
  });

  it('rejects creating a habit under another user\'s category', async () => {
    asAlice();
    const category = await createCategory('Alice Habit Category', 'List');

    asBob();
    await expect(saveHabit('Bob Habit', '', testSchema, category.id)).rejects.toThrow('Unauthorized');
  });

  it('rejects updating another user\'s habit', async () => {
    asAlice();
    const habit = await saveHabit('Alice Habit', '', testSchema);

    asBob();
    await expect(updateHabit(habit.id, 'Hacked', '', testSchema)).rejects.toThrow('Unauthorized');
  });

  it('hides another user\'s habit instead of returning it', async () => {
    asAlice();
    const habit = await saveHabit('Alice Private Habit', '', testSchema);

    asBob();
    await expect(getHabit(habit.id)).resolves.toBeNull();
  });

  it('rejects logging an event against another user\'s habit', async () => {
    asAlice();
    const habit = await saveHabit('Alice Loggable Habit', '', testSchema);

    asBob();
    await expect(logHabitEvent(habit.id, {})).rejects.toThrow('Unauthorized');
  });

  it('rejects deleting another user\'s log entry', async () => {
    asAlice();
    const habit = await saveHabit('Alice Habit With A Log', '', testSchema);
    const log = await logHabitEvent(habit.id, {});

    asBob();
    await expect(deleteHabitLog(log.id, habit.id)).rejects.toThrow('Unauthorized');
  });

  it('rejects reordering another user\'s habits', async () => {
    asAlice();
    const habit = await saveHabit('Alice Orderable Habit', '', testSchema);

    asBob();
    await expect(reorderHabits([{ id: habit.id, order: 0 }])).rejects.toThrow();
  });

  it('silently skips another user\'s category when reordering (no cross-user write)', async () => {
    asAlice();
    const category = await createCategory('Alice Orderable Category', 'List');

    asBob();
    await reorderCategories([{ id: category.id, order: 999 }]);

    const unchanged = await prisma.category.findUnique({ where: { id: category.id } });
    expect(unchanged?.order).not.toBe(999);
  });

  it('strips fields outside the preferences schema, even if a caller sends them', async () => {
    asBob();
    // A real client is typed against updateUserPreferences's parameters, so this simulates a
    // request that bypasses that type (e.g. a raw fetch to the server action endpoint).
    const maliciousPayload = { bedtime: '02:00', isAdmin: true, passwordHash: 'pwned' } as unknown as Parameters<typeof updateUserPreferences>[0];
    await updateUserPreferences(maliciousPayload);

    const refreshed = await prisma.user.findUnique({ where: { id: bob.user.id } });
    expect(refreshed?.isAdmin).toBe(false);
    expect(refreshed?.passwordHash).toBe('x');
    expect(refreshed?.bedtime).toBe('02:00');
  });
});
