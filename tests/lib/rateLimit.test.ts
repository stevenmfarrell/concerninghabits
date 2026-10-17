import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { countRequest, uncountRequest } from '@/lib/rateLimit';

const WINDOW_MS = 60_000;

describe('countRequest', () => {
  it('lets no more than the limit through when requests arrive all at once', async () => {
    const identifier = `test:${crypto.randomUUID()}`;
    const allowed = await Promise.all(Array.from({ length: 20 }, () => countRequest(identifier, 5, WINDOW_MS)));
    expect(allowed.filter(Boolean)).toHaveLength(5);
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { identifier } })).count).toBe(5);
  });

  it('starts a window over once it\'s ended, counting the request that started it', async () => {
    const identifier = `test:${crypto.randomUUID()}`;
    await prisma.rateLimit.create({ data: { identifier, count: 5, resetTime: new Date(Date.now() - 1) } });
    expect(await countRequest(identifier, 5, WINDOW_MS)).toBe(true);
    const limit = await prisma.rateLimit.findUniqueOrThrow({ where: { identifier } });
    expect(limit.count).toBe(1);
    expect(limit.resetTime.getTime()).toBeGreaterThan(Date.now());
  });

  it('gives a request back', async () => {
    const identifier = `test:${crypto.randomUUID()}`;
    expect(await countRequest(identifier, 1, WINDOW_MS)).toBe(true);
    expect(await countRequest(identifier, 1, WINDOW_MS)).toBe(false);
    await uncountRequest(identifier);
    expect(await countRequest(identifier, 1, WINDOW_MS)).toBe(true);
    // Never below none
    await uncountRequest(identifier);
    await uncountRequest(identifier);
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { identifier } })).count).toBe(0);
  });
});
