import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { deleteUser, updatePassword } from '@/app/actions/auth';
import { getDefaultUser } from '@/app/actions/user';
import { isServerAdmin, usesPasswords } from '@/lib/deployment';
import UsersSettingsPage from '@/app/settings/users/page';
import UpdatePasswordPage from '@/app/update-password/page';

// An admin who still has to replace a temporary password, which a self-hosted server's admin page
// would have set: everything the hosted version must not offer
async function createAdmin() {
  const admin = await prisma.user.create({
    data: {
      name: 'Admin', email: `admin-${crypto.randomUUID()}@example.test`, isAdmin: true, passwordNeedsUpdate: true,
      passwordHash: await bcrypt.hash('the old password', 4),
    },
  });
  const session = await prisma.session.create({ data: { userId: admin.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  setSessionCookie(session.id);
  return admin;
}

function passwordForm() {
  const form = new FormData();
  form.set('currentPassword', 'the old password');
  form.set('newPassword', 'a long enough new password');
  form.set('confirmPassword', 'a long enough new password');
  return form;
}

let admin: Awaited<ReturnType<typeof createAdmin>>;
let other: { id: string };

beforeEach(async () => {
  admin = await createAdmin();
  other = await prisma.user.create({ data: { name: 'Other', email: `other-${crypto.randomUUID()}@example.test`, passwordHash: 'x' } });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('on a self-hosted server', () => {
  it('the admin has the admin\'s page and actions, and everyone has a password', async () => {
    expect(isServerAdmin(admin)).toBe(true);
    expect(usesPasswords()).toBe(true);
    // A temporary password has to be replaced before going on
    await expect(getDefaultUser()).rejects.toThrow('REDIRECT:/update-password');
    await expect(UsersSettingsPage()).rejects.toThrow('REDIRECT:/update-password');
    await expect(UpdatePasswordPage()).resolves.toBeTruthy();
    expect(await updatePassword(passwordForm())).toEqual({ success: true });

    await expect(UsersSettingsPage()).resolves.toBeTruthy();
    expect(await deleteUser(other.id)).toEqual({ success: true });
  });
});

describe('on the hosted version', () => {
  beforeEach(() => {
    vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
  });

  it('nobody is the server\'s admin, even someone marked as one', async () => {
    expect(isServerAdmin(admin)).toBe(false);
    await expect(UsersSettingsPage()).rejects.toThrow('NOT_FOUND');
    expect(await deleteUser(other.id)).toEqual({ error: 'Only admins can delete accounts' });
    expect(await prisma.user.count({ where: { id: other.id } })).toBe(1);
  });

  it('there are no passwords to change, or to replace before going on', async () => {
    expect(usesPasswords()).toBe(false);
    await expect(getDefaultUser()).resolves.toMatchObject({ id: admin.id });
    await expect(UpdatePasswordPage()).rejects.toThrow('NOT_FOUND');
    expect(await updatePassword(passwordForm())).toEqual({ error: 'This account signs in with Google, so it has no password' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).passwordNeedsUpdate).toBe(true);
  });
});
