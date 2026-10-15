import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { saveHabit } from '@/app/actions/habits';
import { getConnectedIds } from '@/app/actions/user';
import { acceptInviteLink, cancelInvite, createInviteLink, getPendingInvites } from '@/app/actions/invites';
import { connect, connectedIds } from '@/lib/connections';
import { hashInviteToken, MAX_PENDING_INVITES } from '@/lib/invites';

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

let sam: TestUser, pat: TestUser, stranger: TestUser;

beforeEach(async () => {
  vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
  sam = await createTestUser('Sam');
  pat = await createTestUser('Pat');
  stranger = await createTestUser('Stranger');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('invite links', () => {
  it('connects whoever accepts with whoever sent it, and works once', async () => {
    as(sam);
    const token = await createInviteLink();
    // Only the hash is kept
    expect(await prisma.invite.findFirst({ where: { inviterId: sam.user.id } })).toMatchObject({ hash: hashInviteToken(token) });
    expect(await getPendingInvites()).toHaveLength(1);

    as(pat);
    expect(await acceptInviteLink(token)).toEqual({ to: '/settings/people', message: 'You\'re connected with Sam' });
    expect(await getConnectedIds()).toEqual([sam.user.id]);
    expect(await connectedIds(sam.user.id)).toEqual([pat.user.id]);

    as(stranger);
    await expect(acceptInviteLink(token)).rejects.toThrow('This invite has already been used.');
    expect(await getConnectedIds()).toEqual([]);
    as(sam);
    expect(await getPendingInvites()).toEqual([]);
  });

  it('made from a habit\'s share dialog, also adds them to the habit', async () => {
    as(sam);
    const habit = await saveHabit('Water plants', '', testSchema);
    const token = await createInviteLink(habit.id);

    as(pat);
    expect(await acceptInviteLink(token)).toEqual({ to: `/log/${habit.id}`, message: 'You joined Water plants' });
    expect((await prisma.habitMember.findMany({ where: { habitId: habit.id } })).map(m => m.userId).sort()).toEqual([sam.user.id, pat.user.id].sort());
  });

  it('can only be made for a habit you own', async () => {
    as(sam);
    const habit = await saveHabit('Water plants', '', testSchema);
    as(pat);
    await expect(createInviteLink(habit.id)).rejects.toThrow('Unauthorized');
  });

  it('still connects them if the habit was deleted in the meantime', async () => {
    as(sam);
    const habit = await saveHabit('Water plants', '', testSchema);
    const token = await createInviteLink(habit.id);
    await prisma.habit.delete({ where: { id: habit.id } });

    as(pat);
    expect(await acceptInviteLink(token)).toEqual({ to: '/settings/people', message: 'You\'re connected with Sam' });
    expect(await getConnectedIds()).toEqual([sam.user.id]);
  });

  it('works for someone already connected, adding them to its habit', async () => {
    await connect(sam.user.id, pat.user.id);
    as(sam);
    const habit = await saveHabit('Water plants', '', testSchema);
    const token = await createInviteLink(habit.id);
    as(pat);
    await acceptInviteLink(token);
    expect(await prisma.habitMember.count({ where: { habitId: habit.id, userId: pat.user.id } })).toBe(1);
    expect(await prisma.connection.count({ where: { OR: [{ userAId: pat.user.id }, { userBId: pat.user.id }] } })).toBe(1);
  });

  it('can\'t be accepted by whoever made it', async () => {
    as(sam);
    const token = await createInviteLink();
    await expect(acceptInviteLink(token)).rejects.toThrow('This is your own invite.');
  });

  it('stops working after a week', async () => {
    as(sam);
    const token = await createInviteLink();
    const invite = await prisma.invite.findFirstOrThrow({ where: { inviterId: sam.user.id } });
    expect(invite.expiresAt.getTime() - invite.createdAt.getTime()).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -4);
    await prisma.invite.update({ where: { id: invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getPendingInvites()).toEqual([]);
    as(pat);
    await expect(acceptInviteLink(token)).rejects.toThrow('This invite has expired.');
    expect(await getConnectedIds()).toEqual([]);
  });

  it('stops working once canceled, which only its maker can do', async () => {
    as(sam);
    const token = await createInviteLink();
    const [invite] = await getPendingInvites();
    as(stranger);
    await cancelInvite(invite.id);
    expect(await prisma.invite.count({ where: { id: invite.id } })).toBe(1);

    as(sam);
    await cancelInvite(invite.id);
    as(pat);
    await expect(acceptInviteLink(token)).rejects.toThrow('This invite link doesn\'t work.');
    await expect(acceptInviteLink('made-up')).rejects.toThrow('This invite link doesn\'t work.');
  });

  it('limits how many can be waiting at once', async () => {
    as(sam);
    for (let i = 0; i < MAX_PENDING_INVITES; i++) await createInviteLink();
    await expect(createInviteLink()).rejects.toThrow(`You have ${MAX_PENDING_INVITES} invites waiting`);
  });

  it('works the same on a self-hosted server', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'selfhost');
    as(sam);
    const token = await createInviteLink();
    as(pat);
    await acceptInviteLink(token);
    expect(await getConnectedIds()).toEqual([sam.user.id]);
  });
});
