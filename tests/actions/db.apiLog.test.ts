import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, connectSignedInUserTo } from '../setup';
import { saveHabit, setHabitSharing } from '@/app/actions/habits';
import { getApiKeys, makeApiKey, revokeApiKey, setApiKeyPermissions } from '@/app/actions/apiKeys';
import type { ApiPermissions } from '@/lib/apiKeys';
import { hashApiKey } from '@/lib/apiKeys';
import type { HabitSchema } from '@/lib/types';
import { POST as logHabit } from '@/app/api/habits/[id]/log/route';
import { POST as smartLog } from '@/app/api/log/route';
import { GET as habitEntries } from '@/app/api/habits/[id]/entries/route';

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
  properties: {
    distance: { type: 'number', title: 'Distance' },
    treadmill: { type: 'boolean', title: 'Treadmill' },
  },
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

// A request to the API, with `key` in the Authorization header unless `inUrl`
function request(path: string, { key, body, inUrl = false }: { key?: string; body?: unknown; inUrl?: boolean } = {}) {
  const url = new URL(path, 'http://localhost:3000');
  if (key && inUrl) url.searchParams.set('key', key);
  return new Request(url, {
    method: 'POST',
    headers: key && !inUrl ? { Authorization: `Bearer ${key}` } : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const logTo = (habitId: string, options?: Parameters<typeof request>[1]) =>
  logHabit(request(`/api/habits/${habitId}/log`, options), { params: Promise.resolve({ id: habitId }) });

describe('logging through the API', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let runId: string;
  let waterId: string;
  let ownerKey: string;

  const newKey = async (sessionId: string, permissions: ApiPermissions = { canLog: true, canRead: true }) => {
    setSessionCookie(sessionId);
    const result = await makeApiKey('Shortcuts', permissions);
    if (!result.success) throw new Error(result.error);
    return result.key;
  };

  beforeEach(async () => {
    generateObject.mockReset();
    systemOne.mockReset();
    // Matched by Jev, whatever the environment has set up
    vi.stubEnv('HABIT_MATCHER', 'jev');
    owner = await createTestUser('Owner');
    member = await createTestUser('Member');
    outsider = await createTestUser('Outsider');

    setSessionCookie(owner.sessionId);
    runId = (await saveHabit('Run', '', runSchema)).id;
    waterId = (await saveHabit('Water', '', { type: 'object', properties: {} })).id;
    await connectSignedInUserTo(member.user.id);
    await setHabitSharing(runId, [member.user.id]);
    ownerKey = await newKey(owner.sessionId);
  });

  it('keeps only a hash of a key, and lists it by its prefix', async () => {
    const stored = await prisma.apiKey.findFirstOrThrow({ where: { userId: owner.user.id } });
    expect(stored.hash).toBe(hashApiKey(ownerKey));
    expect(stored.hash).not.toContain(ownerKey);
    expect(ownerKey.startsWith(stored.prefix)).toBe(true);
    setSessionCookie(owner.sessionId);
    const listed = await getApiKeys();
    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty('hash');
  });

  it('turns away a request with no key or an unknown one', async () => {
    expect((await logTo(waterId)).status).toBe(401);
    expect((await logTo(waterId, { key: 'ch_nope' })).status).toBe(401);
    expect(await prisma.habitLog.count({ where: { habitId: waterId } })).toBe(0);
  });

  it('logs a habit with no form from an empty body, with the key in the header or the URL', async () => {
    expect((await logTo(waterId, { key: ownerKey })).status).toBe(201);
    expect((await logTo(waterId, { key: ownerKey, inUrl: true })).status).toBe(201);
    const logs = await prisma.habitLog.findMany({ where: { habitId: waterId } });
    expect(logs).toHaveLength(2);
    expect(logs.every(log => log.userId === owner.user.id)).toBe(true);
    expect((await prisma.apiKey.findFirstOrThrow({ where: { userId: owner.user.id } })).lastUsedAt).not.toBeNull();
  });

  it('takes the key in an X-API-Key header too', async () => {
    const response = await logHabit(
      new Request(`http://localhost:3000/api/habits/${waterId}/log`, { method: 'POST', headers: { 'X-API-Key': ownerKey } }),
      { params: Promise.resolve({ id: waterId }) },
    );
    expect(response.status).toBe(201);
  });

  it('logs values, reading text as the field\'s type', async () => {
    const response = await logTo(runId, { key: ownerKey, body: { values: { distance: '3.1', treadmill: 'yes' } } });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.values).toEqual({ distance: 3.1, treadmill: true });
    expect(body.habit).toEqual({ id: runId, name: 'Run' });
    const log = await prisma.habitLog.findUniqueOrThrow({ where: { id: body.id } });
    expect(JSON.parse(log.payload)).toEqual({ distance: 3.1, treadmill: true });
  });

  it('says what\'s wrong with values the form doesn\'t take', async () => {
    const unknown = await logTo(runId, { key: ownerKey, body: { values: { miles: 3 } } });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toContain('"distance"');

    const flat = await logTo(runId, { key: ownerKey, body: { distance: 3 } });
    expect(flat.status).toBe(400);
    expect((await flat.json()).error).toContain('"values"');

    expect((await logTo(runId, { key: ownerKey, body: { values: { treadmill: true } } })).status).toBe(400);
    expect((await logTo(runId, { key: ownerKey, body: 'not json' })).status).toBe(400);
    expect(await prisma.habitLog.count({ where: { habitId: runId } })).toBe(0);
  });

  it('logs at an earlier time with "at", but not a future one', async () => {
    const at = '2026-01-02T07:30:00.000Z';
    const response = await logTo(waterId, { key: ownerKey, body: { at } });
    expect(response.status).toBe(201);
    expect((await response.json()).loggedAt).toBe(at);

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect((await logTo(waterId, { key: ownerKey, body: { at: future } })).status).toBe(400);
    expect((await logTo(waterId, { key: ownerKey, body: { at: 'yesterday' } })).status).toBe(400);
  });

  it('logs a habit shared with the key\'s user, but not someone else\'s', async () => {
    const memberKey = await newKey(member.sessionId);
    expect((await logTo(runId, { key: memberKey, body: { values: { distance: 2 } } })).status).toBe(201);
    expect((await prisma.habitLog.findFirstOrThrow({ where: { habitId: runId } })).userId).toBe(member.user.id);

    const outsiderKey = await newKey(outsider.sessionId);
    expect((await logTo(runId, { key: outsiderKey, body: { values: { distance: 2 } } })).status).toBe(404);
    expect((await logTo(waterId, { key: memberKey })).status).toBe(404);
  });

  it('stops working once revoked, which only its owner can do', async () => {
    const [key] = await prisma.apiKey.findMany({ where: { userId: owner.user.id } });
    setSessionCookie(outsider.sessionId);
    await expect(revokeApiKey(key.id)).rejects.toThrow();
    expect((await logTo(waterId, { key: ownerKey })).status).toBe(201);

    setSessionCookie(owner.sessionId);
    await revokeApiKey(key.id);
    expect((await logTo(waterId, { key: ownerKey })).status).toBe(401);
  });

  it('fills in values from text, with values sent alongside it winning', async () => {
    generateObject.mockResolvedValue({ object: { distance: 3, treadmill: false } });
    const response = await logTo(runId, { key: ownerKey, body: { text: 'ran 3 miles on the treadmill', values: { treadmill: true } } });
    expect(response.status).toBe(201);
    expect((await response.json()).values).toEqual({ distance: 3, treadmill: true });
  });

  it('logs on an earlier day when the text says so, counted from "at"', async () => {
    await prisma.user.update({ where: { id: owner.user.id }, data: { timeZone: 'America/Denver' } });
    generateObject.mockResolvedValue({ object: { distance: 3 } });
    // 2pm on October 10 in Denver: yesterday is October 9, logged at noon there
    const response = await logTo(runId, { key: ownerKey, body: { text: 'ran 3 miles yesterday', at: '2026-10-10T20:00:00.000Z' } });
    expect(response.status).toBe(201);
    expect((await response.json()).loggedAt).toBe('2026-10-09T18:00:00.000Z');
  });

  it('logs nothing from text that leaves a required field empty', async () => {
    generateObject.mockResolvedValue({ object: { treadmill: true } });
    const response = await logTo(runId, { key: ownerKey, body: { text: 'went for a run' } });
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain('Distance');
    expect(await prisma.habitLog.count({ where: { habitId: runId } })).toBe(0);
  });

  describe('reading a habit\'s entries', () => {
    const entriesOf = (habitId: string, key: string, query = '') =>
      habitEntries(
        new Request(`http://localhost:3000/api/habits/${habitId}/entries${query}`, { headers: { Authorization: `Bearer ${key}` } }),
        { params: Promise.resolve({ id: habitId }) },
      );

    it('sends the latest entries, newest first, everyone\'s on a shared habit', async () => {
      const memberKey = await newKey(member.sessionId);
      for (let i = 1; i <= 12; i++) {
        const at = new Date(Date.UTC(2026, 0, i)).toISOString();
        expect((await logTo(runId, { key: i % 2 ? ownerKey : memberKey, body: { values: { distance: i }, at } })).status).toBe(201);
      }

      const response = await entriesOf(runId, memberKey);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.habit).toEqual({ id: runId, name: 'Run' });
      expect(body.entries).toHaveLength(10);
      expect(body.entries.map((e: { values: { distance: number } }) => e.values.distance)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
      expect(body.entries[0].loggedBy).toEqual({ id: member.user.id, name: 'Member' });
      expect(body.entries[1].loggedBy).toEqual({ id: owner.user.id, name: 'Owner' });

      const three = await (await entriesOf(runId, ownerKey, '?limit=3')).json();
      expect(three.entries).toHaveLength(3);
    });

    it('turns away a bad limit, a habit the key\'s user doesn\'t have, and no key', async () => {
      expect((await entriesOf(runId, ownerKey, '?limit=0')).status).toBe(400);
      expect((await entriesOf(runId, ownerKey, '?limit=101')).status).toBe(400);
      expect((await entriesOf(runId, ownerKey, '?limit=abc')).status).toBe(400);
      expect((await entriesOf(runId, await newKey(outsider.sessionId))).status).toBe(404);
      expect((await entriesOf(runId, 'ch_nope')).status).toBe(401);
    });
  });

  describe('permissions', () => {
    const entriesOf = (habitId: string, key: string) =>
      habitEntries(new Request(`http://localhost:3000/api/habits/${habitId}/entries`, { headers: { 'X-API-Key': key } }), { params: Promise.resolve({ id: habitId }) });

    it('keeps a key that can only log from reading, and one that can only read from logging', async () => {
      const logOnly = await newKey(owner.sessionId, { canLog: true, canRead: false });
      expect((await logTo(waterId, { key: logOnly })).status).toBe(201);
      expect((await entriesOf(waterId, logOnly)).status).toBe(403);

      const readOnly = await newKey(owner.sessionId, { canLog: false, canRead: true });
      expect((await entriesOf(waterId, readOnly)).status).toBe(200);
      expect((await logTo(waterId, { key: readOnly })).status).toBe(403);
      expect((await smartLog(request('/api/log', { key: readOnly, body: { text: 'drank water' } }))).status).toBe(403);
      expect(systemOne).not.toHaveBeenCalled();
      expect(await prisma.habitLog.count({ where: { habitId: waterId } })).toBe(1);
    });

    it('won\'t make or leave a key that can do nothing', async () => {
      setSessionCookie(owner.sessionId);
      expect(await makeApiKey('Nothing', { canLog: false, canRead: false })).toMatchObject({ success: false });
      const [key] = await prisma.apiKey.findMany({ where: { userId: owner.user.id } });
      await expect(setApiKeyPermissions(key.id, { canLog: false, canRead: false })).rejects.toThrow();
    });

    it('holds a key to a change from its next request, which only its owner can make', async () => {
      const [key] = await prisma.apiKey.findMany({ where: { userId: owner.user.id } });
      setSessionCookie(outsider.sessionId);
      await expect(setApiKeyPermissions(key.id, { canLog: false, canRead: true })).rejects.toThrow();
      expect((await logTo(waterId, { key: ownerKey })).status).toBe(201);

      setSessionCookie(owner.sessionId);
      await setApiKeyPermissions(key.id, { canLog: false, canRead: true });
      expect((await logTo(waterId, { key: ownerKey })).status).toBe(403);
      expect((await getApiKeys())[0]).toMatchObject({ canLog: false, canRead: true });
    });
  });

  describe('to whichever habit the text is about', () => {
    const smart = (body: unknown) => smartLog(request('/api/log', { key: ownerKey, body }));
    const jevAnswers = (probabilities: Record<string, number>, confidence: number, didIt: number) =>
      systemOne.mockResolvedValue({ answers: { habit: { probabilities, confidence }, did_it: { noul: didIt } } });

    it('logs to the habit it\'s sure of', async () => {
      jevAnswers({ Run: 0.95, Water: 0.03, 'new habit': 0.02 }, 0.95, 0.9);
      generateObject.mockResolvedValue({ object: { distance: 4 } });
      const response = await smart({ text: 'ran 4 miles' });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.habit).toEqual({ id: runId, name: 'Run' });
      expect(body.values).toEqual({ distance: 4 });
    });

    it('logs nothing when unsure which habit, saying which it thought of', async () => {
      jevAnswers({ Run: 0.5, Water: 0.45, 'new habit': 0.05 }, 0.5, 0.9);
      const response = await smart({ text: 'did the thing' });
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.candidates.map((c: { habitId: string }) => c.habitId)).toEqual([runId, waterId]);
      expect(await prisma.habitLog.count({ where: { userId: owner.user.id } })).toBe(0);
    });

    it('logs nothing for a new habit or something not done', async () => {
      jevAnswers({ Run: 0.05, 'new habit': 0.95 }, 0.95, 0.9);
      expect((await smart({ text: 'did 20 minutes of yoga' })).status).toBe(422);
      jevAnswers({ Run: 0.95, 'new habit': 0.05 }, 0.95, 0.02);
      expect((await smart({ text: 'I want to run more' })).status).toBe(422);
      expect(await prisma.habitLog.count({ where: { userId: owner.user.id } })).toBe(0);
    });

    it('logs nothing when matching is turned off, offering the habits that share its words', async () => {
      vi.stubEnv('HABIT_MATCHER', 'none');
      const response = await smart({ text: 'went for a run' });
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toMatch(/turned off/);
      expect(body.candidates[0]).toEqual({ habitId: runId, name: 'Run', probability: null });
      expect(systemOne).not.toHaveBeenCalled();
      expect(generateObject).not.toHaveBeenCalled();
      expect(await prisma.habitLog.count({ where: { userId: owner.user.id } })).toBe(0);
    });

    it('needs text', async () => {
      expect((await smart({})).status).toBe(400);
      expect((await smart({ text: '  ' })).status).toBe(400);
    });
  });
});
