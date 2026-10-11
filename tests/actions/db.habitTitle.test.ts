import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { createCategory, updateCategory } from '@/app/actions/categories';
import { saveHabit, updateHabit } from '@/app/actions/habits';

const testSchema = { type: 'object' as const, properties: {} };

describe('habit titles', () => {
  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: 'Titler', email: `titler-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    setSessionCookie(session.id);
  });

  it('won\'t create a habit without a title', async () => {
    await expect(saveHabit('   ', '', testSchema)).rejects.toThrow('Give your habit a title');
  });

  it('won\'t clear an existing habit\'s title', async () => {
    const habit = await saveHabit('Read', '', testSchema);
    await expect(updateHabit(habit.id, '', '', testSchema)).rejects.toThrow('Give your habit a title');
    expect((await prisma.habit.findUnique({ where: { id: habit.id } }))?.name).toBe('Read');
  });

  it('won\'t save a title, description or form over the limits', async () => {
    await expect(saveHabit('x'.repeat(101), '', testSchema)).rejects.toThrow('100 characters or fewer');
    await expect(saveHabit('Read', 'x'.repeat(1001), testSchema)).rejects.toThrow('1000 characters or fewer');
    const habit = await saveHabit('x'.repeat(100), 'x'.repeat(1000), testSchema);
    await expect(updateHabit(habit.id, 'Read', '', { type: 'object', properties: { a: { type: 'number', title: 'x'.repeat(101) } } })).rejects.toThrow('Field names');
  });
});

describe('category names and icons', () => {
  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: 'Sorter', email: `sorter-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    setSessionCookie(session.id);
  });

  it('needs a name within the limit and a known icon, or none', async () => {
    await expect(createCategory('  ')).rejects.toThrow('Give the category a name');
    await expect(createCategory('x'.repeat(101))).rejects.toThrow('100 characters or fewer');
    await expect(createCategory('Fitness', 'NotAnIcon')).rejects.toThrow('Unknown icon');
    await expect(createCategory('Fitness', 'createLucideIcon')).rejects.toThrow('Unknown icon');

    const category = await createCategory('Fitness', 'Dumbbell');
    await updateCategory(category.id, 'Fitness', null);
    await expect(updateCategory(category.id, 'x'.repeat(101), null)).rejects.toThrow('100 characters or fewer');
    expect((await prisma.category.findUnique({ where: { id: category.id } }))?.name).toBe('Fitness');
  });
});

describe('updateHabit', () => {
  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: 'Filer', email: `filer-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    setSessionCookie(session.id);
  });

  const membership = (habitId: string) => prisma.habitMember.findFirstOrThrow({ where: { habitId } });

  it('files the habit at the end of a new category\'s list, and leaves it in place when the category is the same', async () => {
    const reading = await createCategory('Reading');
    const habit = await saveHabit('Read', '', testSchema);

    await updateHabit(habit.id, 'Read', '', testSchema, reading.id, undefined, false, 'Paperbacks');
    expect(await membership(habit.id)).toMatchObject({ categoryId: reading.id, order: 9999, aiContext: 'Paperbacks' });

    await prisma.habitMember.updateMany({ where: { habitId: habit.id }, data: { order: 2 } });
    await updateHabit(habit.id, 'Read more', '', testSchema, reading.id);
    expect(await membership(habit.id)).toMatchObject({ categoryId: reading.id, order: 2, aiContext: null });
  });

  it('refuses a category the user doesn\'t have, changing nothing', async () => {
    const habit = await saveHabit('Read', '', testSchema);
    await expect(updateHabit(habit.id, 'Renamed', '', testSchema, 'no-such-category')).rejects.toThrow();
    expect((await prisma.habit.findUnique({ where: { id: habit.id } }))?.name).toBe('Read');
  });
});
