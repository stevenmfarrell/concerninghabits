import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { AI_NOT_IN_PLAN, aiRequestProblem } from '@/lib/aiLimits';
import { MAX_AI_INPUT_LENGTH, MAX_AI_REQUESTS_PER_HOUR } from '@/lib/constants';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('aiRequestProblem', () => {
  it('refuses input over the length limit without counting it', async () => {
    const userId = crypto.randomUUID();
    expect(await aiRequestProblem(userId, 'x'.repeat(MAX_AI_INPUT_LENGTH + 1))).toMatch(/too long/);
    expect(await prisma.rateLimit.findUnique({ where: { identifier: `ai:${userId}` } })).toBeNull();
    expect(await aiRequestProblem(userId, 'x'.repeat(MAX_AI_INPUT_LENGTH), null, undefined)).toBeNull();
  });

  it('allows a set number of requests an hour per user, then starts over', async () => {
    const userId = crypto.randomUUID();
    const identifier = `ai:${userId}`;
    await prisma.rateLimit.create({ data: { identifier, count: MAX_AI_REQUESTS_PER_HOUR - 1, resetTime: new Date(Date.now() + 60_000) } });

    expect(await aiRequestProblem(userId, 'hi')).toBeNull();
    expect(await aiRequestProblem(userId, 'hi')).toMatch(/a lot of AI requests/);
    // Someone else's requests don't count
    expect(await aiRequestProblem(crypto.randomUUID(), 'hi')).toBeNull();

    await prisma.rateLimit.update({ where: { identifier }, data: { resetTime: new Date(Date.now() - 1) } });
    expect(await aiRequestProblem(userId, 'hi')).toBeNull();
    expect((await prisma.rateLimit.findUnique({ where: { identifier } }))?.count).toBe(1);
  });

  it('refuses, on the hosted version, an account whose plan doesn\'t include AI, without counting it', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
    const email = `${crypto.randomUUID()}@example.test`;
    const { id } = await prisma.user.create({ data: { name: 'Ali', email, trialEndsAt: new Date(Date.now() - 1) } });
    expect(await aiRequestProblem(id, 'hi')).toBe(AI_NOT_IN_PLAN);
    expect(await prisma.rateLimit.findUnique({ where: { identifier: `ai:${id}` } })).toBeNull();
    // Nor one that isn't there
    expect(await aiRequestProblem(crypto.randomUUID(), 'hi')).toBe(AI_NOT_IN_PLAN);

    await prisma.user.update({ where: { id }, data: { paidUntil: new Date(Date.now() + 60_000) } });
    expect(await aiRequestProblem(id, 'hi')).toBeNull();

    // A self-hosted server has no plans
    await prisma.user.update({ where: { id }, data: { paidUntil: null } });
    vi.stubEnv('DEPLOYMENT_MODE', 'selfhost');
    expect(await aiRequestProblem(id, 'hi')).toBeNull();
  });
});
