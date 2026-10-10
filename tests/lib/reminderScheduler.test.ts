import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { IGNORED_LIMIT, MAX_PER_DAY } from '@/lib/reminders';

const sent: { userId: string; title: string; body: string; habitId?: string }[] = [];
vi.mock('@/lib/push', () => ({
  sendPush: async (userId: string, payload: { title: string; body: string; habitId?: string }) => {
    sent.push({ userId, ...payload });
    return true;
  },
}));

const { runReminderTick } = await import('@/lib/reminderScheduler');

// Denver (MDT, UTC-6) with a 01:00 bedtime. `at(day, h, m)` is h:mm in Denver on October `day`.
const at = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, day, h + 6, m));
const daily = JSON.stringify({ type: 'daily', timesPerDay: 1 });

async function createUser() {
  return prisma.user.create({
    data: {
      name: 'Rem', email: `rem-${crypto.randomUUID()}@example.test`, passwordHash: 'x', timeZone: 'America/Denver', bedtime: '01:00',
      pushSubscriptions: { create: { endpoint: `https://push.example/${crypto.randomUUID()}`, p256dh: 'k', auth: 'a' } },
    },
  });
}

async function createHabit(userId: string, name: string, logTimes: Date[], member: { remind?: boolean; remindAt?: string } = { remind: true }, cadence = daily) {
  const habit = await prisma.habit.create({
    data: {
      name, schema: '{"type":"object","properties":{}}', cadence, userId,
      members: { create: { userId, remind: member.remind ?? true, remindAt: member.remindAt } },
      logs: { create: logTimes.map(createdAt => ({ userId, payload: '{}', createdAt })) },
    },
  });
  return habit.id;
}

// Logged at 11:40pm on each of the 10 days before October 20th
const usuallyAt2340 = Array.from({ length: 10 }, (_, i) => at(10 + i, 23, 40));

describe('runReminderTick', () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  beforeEach(async () => {
    sent.length = 0;
    user = await createUser();
  });
  const mine = () => sent.filter(s => s.userId === user.id);

  it('says nothing about a bedtime habit in the evening, before it\'s late', async () => {
    await createHabit(user.id, 'Meds', usuallyAt2340);
    await runReminderTick(at(20, 21, 0));
    await runReminderTick(at(20, 23, 50));
    expect(mine()).toEqual([]);
  });

  it('nudges once it\'s running late, then not again that day', async () => {
    const habitId = await createHabit(user.id, 'Meds', usuallyAt2340);
    // Every time was 11:40pm, so it's late 20 minutes after, and nudged up to 30 minutes later
    await runReminderTick(at(21, 0, 30)); // 12:30am, still the 20th by the 01:00 bedtime
    expect(mine()).toEqual([expect.objectContaining({ title: 'Meds', habitId })]);
    await runReminderTick(at(21, 0, 40));
    expect(mine()).toHaveLength(1);
  });

  it('says nothing once it\'s logged', async () => {
    await createHabit(user.id, 'Meds', [...usuallyAt2340, at(20, 22, 0)]);
    await runReminderTick(at(21, 0, 30));
    expect(mine()).toEqual([]);
  });

  it('puts habits running late together in one notification', async () => {
    const morning = (h: number, m: number) => Array.from({ length: 10 }, (_, i) => at(10 + i, h, m));
    await createHabit(user.id, 'Vitamins', morning(8, 0));
    await createHabit(user.id, 'Stretch', morning(8, 10));
    await runReminderTick(at(20, 8, 30));
    await runReminderTick(at(20, 8, 50));
    expect(mine()).toEqual([expect.objectContaining({ title: 'Running behind', body: 'Vitamins, Stretch' })]);
  });

  it('judges a habit done several times a day by when its next entry usually comes', async () => {
    const threeTimes = JSON.stringify({ type: 'daily', timesPerDay: 3 });
    // On past days: 8am, 1pm and 6pm. Today: just the 8am one so far.
    const history = Array.from({ length: 10 }, (_, i) => [at(10 + i, 8), at(10 + i, 13), at(10 + i, 18)]).flat();
    await createHabit(user.id, 'Water', [...history, at(20, 8)], undefined, threeTimes);
    await runReminderTick(at(20, 13, 30));
    expect(mine()).toEqual([]);
    await runReminderTick(at(20, 13, 50));
    expect(mine()).toEqual([expect.objectContaining({ title: 'Water', body: "1 of 3 so far. You're usually at 2 by 1:00 PM." })]);
  });

  it('keeps to a set time with no history', async () => {
    await createHabit(user.id, 'New prescription', [], { remindAt: '21:00' });
    await runReminderTick(at(20, 20, 59));
    expect(mine()).toEqual([]);
    await runReminderTick(at(20, 21, 0));
    expect(mine()).toHaveLength(1);
  });

  it('leaves alone a habit with reminders off', async () => {
    await createHabit(user.id, 'Meds', usuallyAt2340, { remind: false });
    await runReminderTick(at(21, 0, 30));
    expect(mine()).toEqual([]);
  });

  it(`sends at most ${MAX_PER_DAY} a day`, async () => {
    for (let h = 8; h < 8 + MAX_PER_DAY + 2; h++) await createHabit(user.id, `At ${h}`, [], { remindAt: `${String(h).padStart(2, '0')}:00` });
    for (let h = 8; h < 8 + MAX_PER_DAY + 2; h++) await runReminderTick(at(20, h, 0));
    expect(mine()).toHaveLength(MAX_PER_DAY);
  });

  it(`pauses a reminder after ${IGNORED_LIMIT} unanswered days`, async () => {
    const habitId = await createHabit(user.id, 'Floss', [], { remindAt: '21:00' });
    for (let day = 10; day < 10 + IGNORED_LIMIT; day++) await runReminderTick(at(day, 21, 0));
    expect(mine()).toHaveLength(IGNORED_LIMIT);
    await runReminderTick(at(10 + IGNORED_LIMIT, 21, 0));
    expect(mine()).toHaveLength(IGNORED_LIMIT);
    const member = await prisma.habitMember.findUniqueOrThrow({ where: { habitId_userId: { habitId, userId: user.id } } });
    expect(member.remindMutedAt).not.toBeNull();
  });

  it('keeps reminding about one that does get answered', async () => {
    const habitId = await createHabit(user.id, 'Floss', [], { remindAt: '21:00' });
    for (let day = 10; day < 10 + IGNORED_LIMIT + 1; day++) {
      await runReminderTick(at(day, 21, 0));
      if (day === 12) await prisma.habitLog.create({ data: { habitId, userId: user.id, payload: '{}', createdAt: at(day, 21, 30) } });
    }
    expect(mine()).toHaveLength(IGNORED_LIMIT + 1);
  });
});
