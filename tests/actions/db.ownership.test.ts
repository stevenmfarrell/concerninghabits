import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { createCategory, deleteCategory, getCategory, reorderCategories, setCategoryCadence, updateCategory } from '@/app/actions/categories';
import { deleteHabitLog, getHabitLogPresence, getHabitLogs, logHabitEvent, updateHabitLog } from '@/app/actions/entries';
import { deleteHabit, getHabit, isMqttConfigured, leaveHabit, reorderHabits, saveHabit, setHabitAiContext, setHabitCadence, setHabitCategory, setHabitSharing, updateHabit } from '@/app/actions/habits';
import { getPeople, removeConnection, updateUserPreferences } from '@/app/actions/user';
import { exportHabitLogsCsv, importHabitLogsCsv } from '@/app/actions/csv';
import { deleteCalculatedField, deleteChart, saveCalculatedField } from '@/app/actions/charts';
import { generateChart, logSmartEntry, prefillSmartEntry } from '@/app/actions/habit';
import { getHabitReminder, removePushSubscription, setHabitReminder } from '@/app/actions/reminders';
import { revokeApiKey, setApiKeyPermissions } from '@/app/actions/apiKeys';
import { skipToday, undoSkip } from '@/app/actions/skips';
import { createInviteLink } from '@/app/actions/invites';
import { createApiKey } from '@/lib/apiKeys';
import { connect } from '@/lib/connections';
import { GET as habitEntries } from '@/app/api/habits/[id]/entries/route';
import { GET as meta } from '@/app/api/meta/route';

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

// The hosted version puts strangers on one server, so nothing of one account's may reach another
// that isn't connected with it or on the same habit (see connections.ts)
describe('between accounts on the hosted version', () => {
  const formSchema = { type: 'object' as const, properties: { minutes: { type: 'number' as const, title: 'Minutes' } } };
  let sam: Awaited<ReturnType<typeof createTestUser>>;
  let pat: Awaited<ReturnType<typeof createTestUser>>;
  let quinn: Awaited<ReturnType<typeof createTestUser>>;
  let stranger: Awaited<ReturnType<typeof createTestUser>>;
  const as = (who: { sessionId: string }) => setSessionCookie(who.sessionId);

  beforeEach(async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
    sam = await createTestUser('Sam');
    pat = await createTestUser('Pat');
    quinn = await createTestUser('Quinn');
    stranger = await createTestUser('Stranger');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('a stranger can\'t read or change anything of a habit, through any action that takes its id', async () => {
    as(sam);
    const habit = await saveHabit('Sam\'s Run', '', formSchema);
    const category = await createCategory('Sam\'s Category', 'List');
    const log = await logHabitEvent(habit.id, { minutes: 30 });
    await saveCalculatedField(habit.id, null, { title: 'Hours', expression: 'minutes / 60', format: 'number' });
    const [calculated] = JSON.parse((await prisma.habit.findUniqueOrThrow({ where: { id: habit.id } })).calculatedFields);

    as(stranger);
    const ownCategory = await createCategory('Mine', 'List');
    const unauthorized = [
      () => getHabitLogs(habit.id),
      () => getHabitLogPresence(habit.id),
      () => exportHabitLogsCsv(habit.id),
      () => importHabitLogsCsv(habit.id, 'Date,Minutes\n2026-01-01,5'),
      () => logHabitEvent(habit.id, { minutes: 1 }),
      () => updateHabitLog(log.id, habit.id, { minutes: 1 }),
      () => deleteHabitLog(log.id, habit.id),
      () => updateHabit(habit.id, 'Mine now', '', formSchema),
      () => setHabitCadence(habit.id, { type: 'none' }),
      () => setHabitCategory(habit.id, ownCategory.id),
      () => setHabitAiContext(habit.id, 'notes'),
      () => setHabitSharing(habit.id, [stranger.user.id]),
      () => deleteHabit(habit.id),
      () => leaveHabit(habit.id),
      () => setHabitReminder(habit.id, true, null),
      () => skipToday({ kind: 'habit', id: habit.id }),
      () => undoSkip({ kind: 'habit', id: habit.id }, '2026-01-01'),
      () => saveCalculatedField(habit.id, null, { title: 'Double', expression: 'minutes * 2', format: 'number' }),
      () => deleteCalculatedField(habit.id, calculated.key),
      () => deleteChart(habit.id, 'any'),
      () => createInviteLink(habit.id),
      () => setCategoryCadence(category.id, { type: 'none' }),
      () => skipToday({ kind: 'category', id: category.id }),
    ];
    // Called one at a time, so each rejection is caught as it happens
    for (const attempt of unauthorized) await expect(attempt()).rejects.toThrow('Unauthorized');

    await expect(getHabit(habit.id)).resolves.toBeNull();
    await expect(getCategory(category.id)).resolves.toBeNull();
    await expect(getHabitReminder(habit.id)).resolves.toBeNull();
    // These answer with an error rather than throwing, without asking the AI anything
    await expect(logSmartEntry(habit.id, 'ran 20 minutes')).resolves.toMatchObject({ success: false });
    await expect(prefillSmartEntry(habit.id, 'ran 20 minutes')).resolves.toEqual({});
    await expect(generateChart(habit.id, 'minutes over time')).resolves.toMatchObject({ success: false });

    // And nothing changed
    const after = await prisma.habit.findUniqueOrThrow({ where: { id: habit.id }, include: { members: true, logs: true, skips: true } });
    expect(after.name).toBe('Sam\'s Run');
    expect(after.members.map(m => m.userId)).toEqual([sam.user.id]);
    expect(after.logs.map(l => l.payload)).toEqual([JSON.stringify({ minutes: 30 })]);
    expect(after.skips).toEqual([]);
    expect(await prisma.categorySkip.count({ where: { categoryId: category.id } })).toBe(0);
  });

  it('a stranger can\'t change or remove someone else\'s API keys or reminder devices', async () => {
    const { record } = await createApiKey(sam.user.id, 'Shortcuts', { canLog: true, canRead: true });
    const endpoint = `https://push.example.test/${crypto.randomUUID()}`;
    await prisma.pushSubscription.create({ data: { userId: sam.user.id, endpoint, p256dh: 'p', auth: 'a' } });

    as(stranger);
    await expect(setApiKeyPermissions(record.id, { canLog: true, canRead: false })).rejects.toThrow('Unauthorized');
    await expect(revokeApiKey(record.id)).rejects.toThrow('Unauthorized');
    await removePushSubscription(endpoint);
    expect(await prisma.apiKey.findUniqueOrThrow({ where: { id: record.id } })).toMatchObject({ canRead: true });
    expect(await prisma.pushSubscription.count({ where: { userId: sam.user.id } })).toBe(1);
  });

  it('names someone only to the people connected with them or on a habit with them, everywhere entries are shown', async () => {
    // Sam shares a habit with Pat, who logs on it, then they disconnect, taking Pat off it. Sam then
    // shares it with Quinn, who has never been connected with Pat.
    await connect(sam.user.id, pat.user.id);
    await connect(sam.user.id, quinn.user.id);
    as(sam);
    const habit = await saveHabit('Family Walk', '', formSchema);
    await setHabitSharing(habit.id, [pat.user.id]);
    as(pat);
    await logHabitEvent(habit.id, { minutes: 20 });
    as(sam);
    await logHabitEvent(habit.id, { minutes: 30 });
    await removeConnection(pat.user.id);
    await setHabitSharing(habit.id, [quinn.user.id]);

    as(quinn);
    expect(Object.keys(await getPeople()).sort()).toEqual([sam.user.id, quinn.user.id].sort());
    const { csv } = await exportHabitLogsCsv(habit.id);
    expect(csv).toContain('Former member');
    expect(csv).toContain('Sam');
    expect(csv).not.toContain('Pat');

    const { key } = await createApiKey(quinn.user.id, 'Shortcuts', { canLog: false, canRead: true });
    const response = await habitEntries(
      new Request(`http://localhost:3000/api/habits/${habit.id}/entries`, { headers: { Authorization: `Bearer ${key}` } }),
      { params: Promise.resolve({ id: habit.id }) },
    );
    const { entries } = await response.json();
    expect(entries.map((e: { loggedBy: { name: string } }) => e.loggedBy.name).sort()).toEqual(['Former member', 'Sam']);

    // A stranger's key can't read the habit at all
    const strangerKey = (await createApiKey(stranger.user.id, 'Mine', { canLog: false, canRead: true })).key;
    const refused = await habitEntries(
      new Request(`http://localhost:3000/api/habits/${habit.id}/entries`, { headers: { Authorization: `Bearer ${strangerKey}` } }),
      { params: Promise.resolve({ id: habit.id }) },
    );
    expect(refused.status).toBe(404);
  });

  it('never publishes entries to MQTT, where everyone\'s would go to one broker', async () => {
    vi.stubEnv('MQTT_URL', 'mqtt://broker.example.test:1883');
    as(sam);
    expect(await isMqttConfigured()).toBe(false);
    expect((await (await meta()).json()).features.mqtt).toBe(false);
    vi.stubEnv('DEPLOYMENT_MODE', 'selfhost');
    expect(await isMqttConfigured()).toBe(true);
  });
});
