import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { generateHabitSchema } from '@/app/actions/habit';

const { generateObject } = vi.hoisted(() => ({ generateObject: vi.fn() }));
// Only the request is faked: the rest of the SDK (e.g. wrapLanguageModel, see aiModel.ts) is real
vi.mock('ai', async importOriginal => ({ ...(await importOriginal<typeof import('ai')>()), generateObject }));

// What the AI model drafts, picking `category`
const drafted = (category?: string) => ({ object: { title: 'Run', type: 'object', properties: {}, ...(category ? { category } : {}) } });
const lastRequest = () => generateObject.mock.calls.at(-1)![0];

let ids: { cardio: string; home: string };

beforeEach(async () => {
  generateObject.mockReset();
  const user = await prisma.user.create({ data: { name: 'Cat', email: `cat-${crypto.randomUUID()}@example.test`, passwordHash: 'x' } });
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 3600e3) } });
  setSessionCookie(session.id);
  const fitness = await prisma.category.create({ data: { userId: user.id, name: 'Fitness', order: 0 } });
  const cardio = await prisma.category.create({ data: { userId: user.id, name: 'Cardio', parentId: fitness.id } });
  const home = await prisma.category.create({ data: { userId: user.id, name: 'Home', order: 1 } });
  await prisma.habit.create({ data: { userId: user.id, name: 'Morning Run', schema: '{}', members: { create: { userId: user.id, categoryId: cardio.id } } } });
  await prisma.habit.create({ data: { userId: user.id, name: 'Water Plants', schema: '{}', members: { create: { userId: user.id, categoryId: home.id } } } });
  ids = { cardio: cardio.id, home: home.id };
});

describe('the category a habit drafted with AI starts in', () => {
  it('is the AI\'s pick from the user\'s categories, each told with the habits in it', async () => {
    generateObject.mockResolvedValue(drafted('Fitness:Cardio'));
    expect(await generateHabitSchema('I want to start cycling')).toMatchObject({ success: true, categoryId: ids.cardio });
    expect(lastRequest().prompt).toBe(
      'User instructions: I want to start cycling\n\nThe user\'s categories, with the habits already in each:\n'
      + '- Fitness: (no habits yet)\n- Fitness:Cardio: Morning Run\n- Home: Water Plants',
    );
    expect(lastRequest().schema.shape.category.unwrap().options).toEqual(['Fitness', 'Fitness:Cardio', 'Home', '(none of these)']);
  });

  it('is none when the AI says none of them fits', async () => {
    generateObject.mockResolvedValue(drafted('(none of these)'));
    const result = await generateHabitSchema('learn Spanish');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('categoryId', undefined);
  });

  it('isn\'t asked for a change to a draft, which keeps its category', async () => {
    generateObject.mockResolvedValue(drafted());
    await generateHabitSchema('add a distance field', { type: 'object', properties: {} });
    expect(lastRequest().prompt).toBe('User instructions: add a distance field');
  });
});
