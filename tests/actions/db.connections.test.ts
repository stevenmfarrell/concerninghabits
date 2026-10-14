import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { saveHabit, setHabitSharing } from '@/app/actions/habits';
import { logHabitEvent } from '@/app/actions/entries';
import { getConnectedIds, getPeople, removeConnection } from '@/app/actions/user';
import { connect, connectedIds } from '@/lib/connections';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  return { user, sessionId: session.id };
}

type TestUser = Awaited<ReturnType<typeof createTestUser>>;
const as = (who: TestUser) => setSessionCookie(who.sessionId);
const peopleIds = async () => Object.keys(await getPeople());

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('on a self-hosted server', () => {
  it('everyone is connected: they see each other and can share with each other', async () => {
    const sam = await createTestUser('Sam');
    const pat = await createTestUser('Pat');
    as(sam);
    expect(await peopleIds()).toEqual(expect.arrayContaining([sam.user.id, pat.user.id]));
    expect(await getConnectedIds()).toContain(pat.user.id);
    const habit = await saveHabit('Water plants', '', testSchema);
    await setHabitSharing(habit.id, [pat.user.id]);
    expect(await prisma.habitMember.count({ where: { habitId: habit.id } })).toBe(2);
  });

  it('there\'s no one to disconnect from', async () => {
    const sam = await createTestUser('Sam');
    const pat = await createTestUser('Pat');
    as(sam);
    await expect(removeConnection(pat.user.id)).rejects.toThrow('Everyone on a self-hosted server is connected');
  });
});

describe('on the hosted version', () => {
  let sam: TestUser, pat: TestUser, stranger: TestUser;

  beforeEach(async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
    sam = await createTestUser('Sam');
    pat = await createTestUser('Pat');
    stranger = await createTestUser('Stranger');
  });

  it('only connected people see each other, and connecting works both ways', async () => {
    as(sam);
    expect(await peopleIds()).toEqual([sam.user.id]);
    expect(await getConnectedIds()).toEqual([]);

    await connect(pat.user.id, sam.user.id);
    await connect(sam.user.id, pat.user.id);
    expect(await prisma.connection.count({ where: { OR: [{ userAId: sam.user.id }, { userBId: sam.user.id }] } })).toBe(1);
    expect(await peopleIds()).toEqual([sam.user.id, pat.user.id]);
    expect(await connectedIds(pat.user.id)).toEqual([sam.user.id]);
    expect(await peopleIds()).not.toContain(stranger.user.id);
    await expect(connect(sam.user.id, sam.user.id)).rejects.toThrow('You can\'t connect with yourself');
  });

  it('shares only with connections, so a stranger\'s id can\'t be slipped in', async () => {
    await connect(sam.user.id, pat.user.id);
    as(sam);
    const habit = await saveHabit('Water plants', '', testSchema);
    await expect(setHabitSharing(habit.id, [stranger.user.id])).rejects.toThrow('You can only share with people you\'re connected to');
    await setHabitSharing(habit.id, [pat.user.id]);
    expect((await prisma.habitMember.findMany({ where: { habitId: habit.id } })).map(m => m.userId).sort()).toEqual([sam.user.id, pat.user.id].sort());
  });

  it('shows the other members of a habit you\'re on, but you can\'t share with them unless connected', async () => {
    // Sam shares a habit with both Pat and the stranger; Pat and the stranger aren't connected
    await connect(sam.user.id, pat.user.id);
    await connect(sam.user.id, stranger.user.id);
    as(sam);
    const habit = await saveHabit('Family walk', '', testSchema);
    await setHabitSharing(habit.id, [pat.user.id, stranger.user.id]);

    as(pat);
    expect(await peopleIds()).toEqual([sam.user.id, pat.user.id, stranger.user.id]);
    expect(await getConnectedIds()).toEqual([sam.user.id]);
    const own = await saveHabit('Pat\'s run', '', testSchema);
    await expect(setHabitSharing(own.id, [stranger.user.id])).rejects.toThrow('You can only share with people you\'re connected to');
  });

  it('removing a connection takes each off the other\'s habits, keeping their entries', async () => {
    await connect(sam.user.id, pat.user.id);
    as(sam);
    const samsHabit = await saveHabit('Water plants', '', testSchema);
    await setHabitSharing(samsHabit.id, [pat.user.id]);
    as(pat);
    const patsHabit = await saveHabit('Read', '', testSchema);
    await setHabitSharing(patsHabit.id, [sam.user.id]);
    await logHabitEvent(samsHabit.id, {});

    as(sam);
    await removeConnection(pat.user.id);
    expect(await getConnectedIds()).toEqual([]);
    expect(await peopleIds()).toEqual([sam.user.id]);
    expect(await prisma.habitMember.findMany({ where: { habitId: samsHabit.id } })).toMatchObject([{ userId: sam.user.id }]);
    expect(await prisma.habitMember.findMany({ where: { habitId: patsHabit.id } })).toMatchObject([{ userId: pat.user.id }]);
    expect(await prisma.habitLog.count({ where: { habitId: samsHabit.id, userId: pat.user.id } })).toBe(1);
  });
});
