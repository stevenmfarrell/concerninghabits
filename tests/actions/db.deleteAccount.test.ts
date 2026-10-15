import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cookieJar, setSessionCookie } from '../setup';
import { deleteMyAccount } from '@/app/actions/auth';
import { logHabitEvent } from '@/app/actions/entries';
import { saveHabit, setHabitSharing } from '@/app/actions/habits';
import { createInviteLink } from '@/app/actions/invites';
import { createCategory } from '@/app/actions/categories';
import { createApiKey } from '@/lib/apiKeys';
import { connect } from '@/lib/connections';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string, isAdmin = false) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x', isAdmin },
  });
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  return { user, sessionId: session.id };
}

type TestUser = Awaited<ReturnType<typeof createTestUser>>;
const as = (who: TestUser) => setSessionCookie(who.sessionId);
const exists = async (who: TestUser) => (await prisma.user.count({ where: { id: who.user.id } })) === 1;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('deleting your own account', () => {
  it('deletes everything in it, signs out, and leaves other people\'s habits and entries alone', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
    const sam = await createTestUser('Sam');
    const pat = await createTestUser('Pat');
    await connect(sam.user.id, pat.user.id);
    await prisma.identity.create({ data: { userId: sam.user.id, provider: 'google', subject: crypto.randomUUID() } });
    await createApiKey(sam.user.id, 'Shortcuts', { canLog: true, canRead: true });

    // Sam shares a habit with Pat, and Pat shares one with Sam; both log on both
    as(sam);
    await createCategory('Sam\'s', 'List');
    const samsHabit = await saveHabit('Sam\'s Run', '', testSchema);
    await setHabitSharing(samsHabit.id, [pat.user.id]);
    await createInviteLink();
    as(pat);
    const patsHabit = await saveHabit('Pat\'s Read', '', testSchema);
    await setHabitSharing(patsHabit.id, [sam.user.id]);
    await logHabitEvent(samsHabit.id, {});
    await logHabitEvent(patsHabit.id, {});
    as(sam);
    await logHabitEvent(samsHabit.id, {});
    await logHabitEvent(patsHabit.id, {});

    await expect(deleteMyAccount('delete')).rejects.toThrow('REDIRECT:/login');
    expect(cookieJar.has('session')).toBe(false);
    expect(await exists(sam)).toBe(false);
    const leftovers = await Promise.all([
      prisma.habit.count({ where: { userId: sam.user.id } }),
      prisma.category.count({ where: { userId: sam.user.id } }),
      prisma.habitLog.count({ where: { userId: sam.user.id } }),
      prisma.session.count({ where: { userId: sam.user.id } }),
      prisma.identity.count({ where: { userId: sam.user.id } }),
      prisma.apiKey.count({ where: { userId: sam.user.id } }),
      prisma.invite.count({ where: { inviterId: sam.user.id } }),
      prisma.connection.count({ where: { OR: [{ userAId: sam.user.id }, { userBId: sam.user.id }] } }),
      prisma.habitMember.count({ where: { userId: sam.user.id } }),
    ]);
    expect(leftovers).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // Sam's habit went for Pat too, with Pat's entry on it; Pat's habit stays with Pat's entry
    expect(await prisma.habit.count({ where: { id: samsHabit.id } })).toBe(0);
    expect(await prisma.habitLog.findMany({ where: { habitId: patsHabit.id } })).toMatchObject([{ userId: pat.user.id }]);
    expect(await exists(pat)).toBe(true);
  });

  it('only once DELETE is typed', async () => {
    const sam = await createTestUser('Sam');
    as(sam);
    expect(await deleteMyAccount('yes')).toEqual({ error: 'Type DELETE to confirm' });
    expect(await exists(sam)).toBe(true);
  });

  it('isn\'t open to a self-hosted server\'s admin while others are on it, who\'d be left without one', async () => {
    const admin = await createTestUser('Admin', true);
    const kid = await createTestUser('Kid');
    as(admin);
    expect(await deleteMyAccount('DELETE')).toMatchObject({ error: expect.stringContaining('remove the other accounts under Family Users') });
    expect(await exists(admin)).toBe(true);

    // Anyone else can delete theirs
    as(kid);
    await expect(deleteMyAccount('DELETE')).rejects.toThrow('REDIRECT:/login');
    expect(await exists(kid)).toBe(false);
  });

  it('is open to the hosted version\'s users even if marked as admin, since it has no admin', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
    const marked = await createTestUser('Marked', true);
    await createTestUser('Other');
    as(marked);
    await expect(deleteMyAccount('DELETE')).rejects.toThrow('REDIRECT:/login');
    expect(await exists(marked)).toBe(false);
  });
});
