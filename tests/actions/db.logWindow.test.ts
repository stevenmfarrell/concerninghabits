import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, connectSignedInUserTo } from '../setup';
import { getHabitLogPresence, getHabitLogs } from '@/app/actions/entries';
import { saveHabit, setHabitSharing } from '@/app/actions/habits';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date('2100-01-01') },
  });
  return { user, sessionId: session.id };
}

// getHabitLogs only reaches back as far as a calendar can need, so these pin "now" and check the
// edges of each calendar the app shows.
describe('habit log window', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let habitId: string;

  const addLog = (createdAt: string, userId = owner.user.id) =>
    prisma.habitLog.create({ data: { habitId, userId, payload: '{}', createdAt: new Date(createdAt) } });

  beforeEach(async () => {
    // A Monday. Only Date is faked, so Prisma's own timers keep working.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T12:00:00Z'));
    owner = await createTestUser('Owner');
    setSessionCookie(owner.sessionId);
    habitId = (await saveHabit('Pay rent', '', testSchema, undefined, { type: 'calendarMonth' })).id;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('covers the first month of the 1-year history calendar, even for viewers east of UTC', async () => {
    // The year view starts Oct 1, 2025. This is already Oct 1 in UTC+14.
    const log = await addLog('2025-09-30T11:00:00Z');
    expect((await getHabitLogs(habitId)).map(l => l.id)).toContain(log.id);
  });

  it('covers the whole first month of a 5-week calendar, so a monthly habit done early that month shows', async () => {
    // The 5-week calendar starts Sunday Aug 30, 2026, so August is filled by a log anytime in August.
    const log = await addLog('2026-08-01T00:30:00Z');
    expect((await getHabitLogs(habitId, 5)).map(l => l.id)).toContain(log.id);
  });

  it('leaves out logs older than any calendar needs, but still reports that the habit has logs', async () => {
    const old = await addLog('2023-01-15T12:00:00Z');
    expect((await getHabitLogs(habitId)).map(l => l.id)).not.toContain(old.id);
    expect(await getHabitLogPresence(habitId)).toEqual({ hasLogs: true, hasLogsFromOthers: false });
  });

  it('reports a former member\'s entries even when they fall outside the window', async () => {
    const member = await createTestUser('Member');
    await connectSignedInUserTo(member.user.id);
    await setHabitSharing(habitId, [member.user.id]);
    await addLog('2023-01-15T12:00:00Z', member.user.id);
    await setHabitSharing(habitId, []);

    expect(await getHabitLogPresence(habitId)).toEqual({ hasLogs: true, hasLogsFromOthers: true });
  });

  it('reports a habit with no logs', async () => {
    expect(await getHabitLogPresence(habitId)).toEqual({ hasLogs: false, hasLogsFromOthers: false });
  });
});
