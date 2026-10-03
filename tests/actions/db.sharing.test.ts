import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import {
  createCategory,
  deleteHabit,
  deleteHabitLog,
  getCategory,
  getHabit,
  getHabitLogs,
  getUncategorizedHabits,
  leaveHabit,
  logHabitEvent,
  reorderHabits,
  saveHabit,
  setHabitCategory,
  setHabitSharing,
  updateHabit,
} from '@/app/actions/db';
import { deleteUser } from '@/app/actions/auth';
import { UNCATEGORIZED_ID } from '@/lib/constants';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string, isAdmin = false) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x', isAdmin },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return { user, sessionId: session.id };
}

describe('habit sharing', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let habitId: string;

  const asOwner = () => setSessionCookie(owner.sessionId);
  const asMember = () => setSessionCookie(member.sessionId);
  const asOutsider = () => setSessionCookie(outsider.sessionId);

  // Each test starts from a fresh household: an owner with a chore shared with one member, and an
  // outsider it isn't shared with.
  beforeEach(async () => {
    owner = await createTestUser('Owner');
    member = await createTestUser('Member');
    outsider = await createTestUser('Outsider');

    asOwner();
    const category = await createCategory('Chores', 'List');
    const habit = await saveHabit('Take out trash', '', testSchema, category.id);
    habitId = habit.id;
    await setHabitSharing(habitId, [member.user.id]);
  });

  it('shows a shared habit in the new member\'s Uncategorized list, but not the owner\'s', async () => {
    asMember();
    expect((await getUncategorizedHabits()).map(h => h.id)).toContain(habitId);
    const uncategorized = await getCategory(UNCATEGORIZED_ID);
    expect(uncategorized?.habits.map(h => h.id)).toContain(habitId);

    asOwner();
    expect((await getUncategorizedHabits()).map(h => h.id)).not.toContain(habitId);
  });

  it('lets a member see the habit, but marks them as not the owner', async () => {
    asMember();
    const habit = await getHabit(habitId);
    expect(habit?.isOwner).toBe(false);
    expect(habit?.memberIds).toEqual([owner.user.id, member.user.id]);
  });

  it('lets a member log entries that everyone with the habit sees', async () => {
    asMember();
    const log = await logHabitEvent(habitId, {});
    expect(log.userId).toBe(member.user.id);

    asOwner();
    const logs = await getHabitLogs(habitId);
    expect(logs.map(l => l.id)).toContain(log.id);
  });

  it('keeps a shared habit hidden from users it isn\'t shared with', async () => {
    asOutsider();
    await expect(getHabit(habitId)).resolves.toBeNull();
    await expect(getHabitLogs(habitId)).rejects.toThrow('Unauthorized');
    await expect(logHabitEvent(habitId, {})).rejects.toThrow('Unauthorized');
    await expect(setHabitCategory(habitId, null)).rejects.toThrow('Unauthorized');
  });

  it('only lets the owner edit, share, or delete the habit', async () => {
    asMember();
    await expect(updateHabit(habitId, 'Hacked', '', testSchema)).rejects.toThrow('Unauthorized');
    await expect(setHabitSharing(habitId, [member.user.id, outsider.user.id])).rejects.toThrow('Unauthorized');
    await expect(deleteHabit(habitId)).rejects.toThrow('Unauthorized');
  });

  it('lets members delete only their own entries, and the owner delete anyone\'s', async () => {
    asOwner();
    const ownerLog = await logHabitEvent(habitId, {});
    asMember();
    const memberLog = await logHabitEvent(habitId, {});

    const asSeenByMember = await getHabitLogs(habitId);
    expect(asSeenByMember.find(l => l.id === ownerLog.id)?.canDelete).toBe(false);
    expect(asSeenByMember.find(l => l.id === memberLog.id)?.canDelete).toBe(true);
    await expect(deleteHabitLog(ownerLog.id, habitId)).rejects.toThrow('Unauthorized');

    asOwner();
    await deleteHabitLog(memberLog.id, habitId);
    expect(await prisma.habitLog.findUnique({ where: { id: memberLog.id } })).toBeNull();
  });

  it('rejects deleting an entry through a different habit id than the one it belongs to', async () => {
    asOwner();
    const otherHabit = await saveHabit('Owner Other Habit', '', testSchema);
    asMember();
    const memberLog = await logHabitEvent(habitId, {});

    asOwner();
    await expect(deleteHabitLog(memberLog.id, otherHabit.id)).rejects.toThrow('Unauthorized');
  });

  it('lets a member file the habit into their own category without moving it for the owner', async () => {
    asMember();
    const memberCategory = await createCategory('My Chores', 'List');
    await setHabitCategory(habitId, memberCategory.id);

    expect((await getCategory(memberCategory.id))?.habits.map(h => h.id)).toEqual([habitId]);
    expect((await getUncategorizedHabits()).map(h => h.id)).not.toContain(habitId);

    asOwner();
    const ownerView = await getHabit(habitId);
    expect(ownerView?.categoryId).not.toBe(memberCategory.id);
  });

  it('rejects filing a shared habit into someone else\'s category', async () => {
    asOwner();
    const ownerCategory = await createCategory('Owner Only', 'List');

    asMember();
    await expect(setHabitCategory(habitId, ownerCategory.id)).rejects.toThrow('Unauthorized');
  });

  it('keeps order per person', async () => {
    asMember();
    await reorderHabits([{ id: habitId, order: 3 }]);

    asOwner();
    const ownerMembership = await prisma.habitMember.findUnique({
      where: { habitId_userId: { habitId, userId: owner.user.id } },
    });
    expect(ownerMembership?.order).not.toBe(3);
  });

  it('removes access when the owner unshares, but keeps the entries that person logged', async () => {
    asMember();
    const memberLog = await logHabitEvent(habitId, {});

    asOwner();
    await setHabitSharing(habitId, []);
    expect((await getHabitLogs(habitId)).map(l => l.id)).toContain(memberLog.id);

    asMember();
    await expect(getHabit(habitId)).resolves.toBeNull();
  });

  it('keeps the owner as a member no matter what list of users they share with', async () => {
    asOwner();
    await setHabitSharing(habitId, [owner.user.id]);
    expect((await getHabit(habitId))?.memberIds).toEqual([owner.user.id]);
  });

  it('rejects sharing with a user that doesn\'t exist', async () => {
    asOwner();
    await expect(setHabitSharing(habitId, ['not-a-user'])).rejects.toThrow('Unknown user');
  });

  it('lets a member remove a shared habit from their lists, but not the owner', async () => {
    asMember();
    await leaveHabit(habitId);
    await expect(getHabit(habitId)).resolves.toBeNull();

    asOwner();
    await expect(leaveHabit(habitId)).rejects.toThrow();
    expect(await getHabit(habitId)).not.toBeNull();
  });

  it('deletes a shared habit, and everyone\'s entries on it, when the owner deletes it', async () => {
    asMember();
    await logHabitEvent(habitId, {});

    asOwner();
    await deleteHabit(habitId);
    expect(await prisma.habit.findUnique({ where: { id: habitId } })).toBeNull();
    expect(await prisma.habitLog.count({ where: { habitId } })).toBe(0);
    expect(await prisma.habitMember.count({ where: { habitId } })).toBe(0);
  });

  it('deletes a user who owns a shared habit and logged on others\' habits', async () => {
    const admin = await createTestUser('Admin', true);

    // The member logs on the owner's habit, and shares a habit of their own with the owner
    asMember();
    await logHabitEvent(habitId, {});
    const memberHabit = await saveHabit('Member Habit', '', testSchema);
    await setHabitSharing(memberHabit.id, [owner.user.id]);
    asOwner();
    const ownerLogOnMemberHabit = await logHabitEvent(memberHabit.id, {});

    setSessionCookie(admin.sessionId);
    await expect(deleteUser(owner.user.id)).resolves.toEqual({ success: true });

    expect(await prisma.habit.findUnique({ where: { id: habitId } })).toBeNull();
    expect(await prisma.habitLog.findUnique({ where: { id: ownerLogOnMemberHabit.id } })).toBeNull();
    expect(await prisma.habitMember.count({ where: { habitId: memberHabit.id } })).toBe(1);
  });
});
