import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { saveHabit, setHabitSharing } from '@/app/actions/habits';
import { logHabitEvent } from '@/app/actions/entries';
import { POST as sync } from '@/app/api/sync/route';
import type { HabitSchema } from '@/lib/types';
import type { OpResult } from '@/lib/offline/ops';

// The AI: Gemini filling in a form, and Jev matching text to a habit
const { generateObject, systemOne } = vi.hoisted(() => ({ generateObject: vi.fn(), systemOne: vi.fn() }));
// Only the request is faked: the rest of the SDK (e.g. wrapLanguageModel, see aiModel.ts) is real
vi.mock('ai', async importOriginal => ({ ...(await importOriginal<typeof import('ai')>()), generateObject }));
vi.mock('@typesafe-ai/sdk', () => ({
  choice: (question: string, criteria: unknown) => ({ question, criteria }),
  noul: (question: string) => ({ question }),
  TypeSafeClient: class { systemOne = systemOne; },
}));

const runSchema: HabitSchema = {
  type: 'object',
  properties: { distance: { type: 'number', title: 'Distance' } },
  required: ['distance'],
};

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return { user, sessionId: session.id };
}

async function send(ops: unknown[]) {
  const response = await sync(new Request('http://localhost:3000/api/sync', { method: 'POST', body: JSON.stringify({ ops }) }));
  return { status: response.status, results: (await response.json()).results as OpResult[] };
}

describe('syncing changes made offline', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let runId: string;
  let waterId: string;

  // A change by the owner, with a fresh op id
  const op = <T extends Record<string, unknown>>(fields: T) => ({ opId: crypto.randomUUID(), userId: owner.user.id, ...fields });
  const logOp = (habitId: string, values: Record<string, unknown> = {}, entryId = crypto.randomUUID()) =>
    op({ kind: 'log', entryId, habitId, values, createdAt: '2026-10-10T08:00:00.000Z' });

  beforeEach(async () => {
    generateObject.mockReset();
    systemOne.mockReset();
    // Matched by Jev, whatever the environment has set up
    vi.stubEnv('HABIT_MATCHER', 'jev');
    owner = await createTestUser('Owner');
    outsider = await createTestUser('Outsider');
    setSessionCookie(owner.sessionId);
    runId = (await saveHabit('Run', '', runSchema)).id;
    waterId = (await saveHabit('Water', '', { type: 'object', properties: {} })).id;
  });

  it('needs someone signed in', async () => {
    setSessionCookie(undefined);
    expect((await send([logOp(waterId)])).status).toBe(401);
  });

  it('logs an entry with its id and time, once however often it\'s sent', async () => {
    const entry = logOp(runId, { distance: 3 });
    const first = await send([entry]);
    expect(first.results).toEqual([{ opId: entry.opId, status: 'done' }]);
    expect((await send([entry])).results[0].status).toBe('done');

    const logs = await prisma.habitLog.findMany({ where: { habitId: runId } });
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(entry.entryId);
    expect(logs[0].createdAt.toISOString()).toBe('2026-10-10T08:00:00.000Z');
    expect(JSON.parse(logs[0].payload)).toEqual({ distance: 3 });
  });

  it('doesn\'t log an id twice from the app either, or take someone else\'s', async () => {
    const id = crypto.randomUUID();
    await logHabitEvent(waterId, {}, undefined, id);
    await logHabitEvent(waterId, {}, undefined, id);
    expect(await prisma.habitLog.count({ where: { habitId: waterId } })).toBe(1);
    await expect(logHabitEvent(runId, { distance: 1 }, undefined, id)).rejects.toThrow();
    await expect(logHabitEvent(waterId, {}, undefined, 'not-a-uuid')).rejects.toThrow();
  });

  it('fails an entry that can\'t be logged as it is, keeping its values, and carries on', async () => {
    const bad = logOp(runId, {});
    const good = logOp(waterId);
    const { results } = await send([bad, good]);
    expect(results[0]).toMatchObject({ opId: bad.opId, status: 'failed', habitId: runId, values: {} });
    expect(results[1]).toEqual({ opId: good.opId, status: 'done' });
  });

  it('fails an entry on a habit the user doesn\'t have', async () => {
    setSessionCookie(outsider.sessionId);
    const { results } = await send([{ ...logOp(runId, { distance: 1 }), userId: outsider.user.id }]);
    expect(results[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('don\'t have') });
    // Nothing to finish by hand
    expect(results[0]).not.toHaveProperty('habitId');
  });

  it('keeps someone else\'s changes for when they\'re signed in, and fails unreadable ones', async () => {
    const theirs = { ...logOp(waterId), userId: outsider.user.id };
    const { results } = await send([theirs, { opId: 'x', kind: 'nonsense' }]);
    expect(results[0]).toMatchObject({ opId: theirs.opId, status: 'retry' });
    expect(results[1]).toMatchObject({ opId: 'x', status: 'failed' });
    expect(await prisma.habitLog.count({ where: { habitId: waterId } })).toBe(0);
  });

  it('edits and deletes entries, and counts deleting one already gone as done', async () => {
    const entry = logOp(runId, { distance: 3 });
    await send([entry]);
    const { results } = await send([
      op({ kind: 'update', entryId: entry.entryId, habitId: runId, values: { distance: 4 }, createdAt: '2026-10-09T08:00:00.000Z' }),
    ]);
    expect(results[0].status).toBe('done');
    const log = await prisma.habitLog.findUniqueOrThrow({ where: { id: entry.entryId } });
    expect(JSON.parse(log.payload)).toEqual({ distance: 4 });
    expect(log.createdAt.toISOString()).toBe('2026-10-09T08:00:00.000Z');

    const remove = op({ kind: 'delete', entryId: entry.entryId, habitId: runId });
    expect((await send([remove])).results[0].status).toBe('done');
    expect((await send([remove])).results[0].status).toBe('done');
    expect(await prisma.habitLog.count({ where: { habitId: runId } })).toBe(0);
  });

  it('doesn\'t let an edit or deletion touch someone else\'s entry', async () => {
    const member = await createTestUser('Member');
    await setHabitSharing(runId, [member.user.id]);
    const entry = logOp(runId, { distance: 3 });
    await send([entry]);

    setSessionCookie(outsider.sessionId);
    const { results } = await send([
      { ...op({ kind: 'update', entryId: entry.entryId, habitId: runId, values: { distance: 9 } }), userId: outsider.user.id },
      { ...op({ kind: 'delete', entryId: entry.entryId, habitId: runId }), userId: outsider.user.id },
    ]);
    expect(results.map(r => r.status)).toEqual(['failed', 'failed']);
    expect(JSON.parse((await prisma.habitLog.findUniqueOrThrow({ where: { id: entry.entryId } })).payload)).toEqual({ distance: 3 });
  });

  it('skips and unskips on the day it was done', async () => {
    const target = { kind: 'habit', id: waterId };
    expect((await send([op({ kind: 'skip', target, day: '2026-10-10' })])).results[0].status).toBe('done');
    expect((await send([op({ kind: 'skip', target, day: '2026-10-10' })])).results[0].status).toBe('done');
    expect(await prisma.habitSkip.findMany({ where: { habitId: waterId } })).toMatchObject([{ day: '2026-10-10', userId: owner.user.id }]);

    expect((await send([op({ kind: 'unskip', target, day: '2026-10-10' })])).results[0].status).toBe('done');
    expect(await prisma.habitSkip.count({ where: { habitId: waterId } })).toBe(0);
  });

  it('fills in an entry from text on a habit, once, keeping what it could fill in when it falls short', async () => {
    generateObject.mockResolvedValue({ object: { distance: 5 } });
    const text = op({ kind: 'text', entryId: crypto.randomUUID(), habitId: runId, text: 'ran 5 miles', createdAt: '2026-10-10T08:00:00.000Z' });
    expect((await send([text])).results[0].status).toBe('done');
    expect((await send([text])).results[0].status).toBe('done');
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(await prisma.habitLog.count({ where: { habitId: runId } })).toBe(1);

    generateObject.mockResolvedValue({ object: {} });
    const vague = op({ kind: 'text', entryId: crypto.randomUUID(), habitId: runId, text: 'went running', createdAt: '2026-10-10T09:00:00.000Z' });
    expect((await send([vague])).results[0]).toMatchObject({ status: 'failed', habitId: runId, values: {} });
  });

  it('logs text saying an earlier day on that day, counted from when it was said', async () => {
    await prisma.user.update({ where: { id: owner.user.id }, data: { timeZone: 'America/Denver' } });
    generateObject.mockResolvedValue({ object: { distance: 5 } });
    const text = op({ kind: 'text', entryId: crypto.randomUUID(), habitId: runId, text: 'ran 5 miles yesterday', createdAt: '2026-10-10T20:00:00.000Z' });
    expect((await send([text])).results[0].status).toBe('done');
    expect((await prisma.habitLog.findUniqueOrThrow({ where: { id: text.entryId } })).createdAt.toISOString()).toBe('2026-10-09T18:00:00.000Z');
  });

  it('matches text to a habit first when it was said with none', async () => {
    systemOne.mockResolvedValue({ answers: { habit: { probabilities: { Run: 0.95, Water: 0.03, 'new habit': 0.02 }, confidence: 0.95 }, did_it: { noul: 0.9 } } });
    generateObject.mockResolvedValue({ object: { distance: 2 } });
    const text = op({ kind: 'text', entryId: crypto.randomUUID(), habitId: null, text: 'ran 2 miles', createdAt: '2026-10-10T08:00:00.000Z' });
    expect((await send([text])).results[0].status).toBe('done');
    expect((await prisma.habitLog.findUniqueOrThrow({ where: { id: text.entryId } })).habitId).toBe(runId);

    systemOne.mockResolvedValue({ answers: { habit: { probabilities: { Run: 0.5, Water: 0.45 }, confidence: 0.5 }, did_it: { noul: 0.9 } } });
    const unsure = op({ kind: 'text', entryId: crypto.randomUUID(), habitId: null, text: 'did it', createdAt: '2026-10-10T08:00:00.000Z' });
    expect((await send([unsure])).results[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('Not sure') });
  });
});
