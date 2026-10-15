import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cookieJar, setSessionCookie, connectSignedInUserTo } from '../setup';
import { getDayEntries } from '@/app/actions/entries';
import { saveHabit, setHabitSharing } from '@/app/actions/habits';
import { TIMEZONE_COOKIE } from '@/lib/timezone';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    // The default bedtime is 01:00: anything before 1am counts toward the previous day
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return { user, sessionId: session.id };
}

describe('getDayEntries', () => {
  let me: Awaited<ReturnType<typeof createTestUser>>;
  let partner: Awaited<ReturnType<typeof createTestUser>>;
  let habitId: string;

  const log = (userId: string, iso: string) =>
    prisma.habitLog.create({ data: { habitId, userId, payload: '{"laps":3}', createdAt: new Date(iso) } });

  beforeEach(async () => {
    me = await createTestUser('Me');
    partner = await createTestUser('Partner');
    cookieJar.set(TIMEZONE_COOKIE, 'America/New_York');

    setSessionCookie(me.sessionId);
    habitId = (await saveHabit('Swim', '', testSchema)).id;
    await connectSignedInUserTo(partner.user.id);
    await setHabitSharing(habitId, [partner.user.id]);
  });

  afterEach(() => {
    cookieJar.delete(TIMEZONE_COOKIE);
  });

  it('returns my entries on that day in my time zone, with bedtime deciding where the day ends', async () => {
    const noon = await log(me.user.id, '2024-03-10T17:00:00Z'); // 1pm EDT on the 10th
    const afterMidnight = await log(me.user.id, '2024-03-11T04:30:00Z'); // 12:30am on the 11th, before bedtime
    await log(me.user.id, '2024-03-11T16:00:00Z'); // noon on the 11th
    await log(me.user.id, '2024-03-10T04:30:00Z'); // 11:30pm on the 9th

    const entries = await getDayEntries('2024-03-10');
    expect(entries.map(e => e.id)).toEqual([noon.id, afterMidnight.id]);
    expect(entries[0].payload).toEqual({ laps: 3 });
  });

  it('leaves out other people\'s entries on a shared habit', async () => {
    await log(partner.user.id, '2024-03-10T17:00:00Z');
    expect(await getDayEntries('2024-03-10')).toEqual([]);
  });

  it('rejects a malformed day', async () => {
    await expect(getDayEntries('March 10')).rejects.toThrow('Invalid day');
  });
});
