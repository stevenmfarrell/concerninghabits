'use server';

import { prisma } from '@/lib/prisma';
import { createSession, deleteSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { seedDefaultCategories } from '@/lib/defaultCategories';
import { RETURN_TO_PARAM, safeReturnTo } from '@/lib/returnTo';
import { clientIp, countRequest, uncountRequest } from '@/lib/rateLimit';
import { isCloud, isServerAdmin, usesPasswords } from '@/lib/deployment';
import { deleteAccount, selfDeletionProblem } from '@/lib/accounts';
import { connectToEveryone } from '@/lib/connections';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// Failed logins allowed per client (IP + email). Keyed per client so a stranger can't lock you out.
const MAX_FAILURES_PER_CLIENT = 5;
// Failed logins allowed per email across all clients. The client IP comes from x-forwarded-for,
// which callers can spoof, so this cap is what actually limits password guessing.
const MAX_FAILURES_PER_EMAIL = 20;

async function getClientIp() {
  return clientIp(await headers());
}

// Compared against when the email has no account, so response time doesn't reveal which emails exist
let dummyPasswordHash: string | undefined;
const getDummyPasswordHash = () => (dummyPasswordHash ??= bcrypt.hashSync('not-a-real-password', 10));

function checkPasswordLength(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return `Password must be at most ${MAX_PASSWORD_BYTES} characters`;
  return null;
}

export async function login(formData: FormData) {
  // The hosted version signs in with Google only, and stores no passwords
  if (isCloud()) return { error: 'Sign in with Google' };
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  const clientKey = `login:${await getClientIp()}:${normalizedEmail}`;
  const accountKey = `login:${normalizedEmail}`;

  // Each attempt is counted before the password is checked, so attempts made all at once can't all
  // get in under the limit while the first are still being checked. Only failures are meant to
  // count, so a correct password gives its attempt back (see below).
  const [clientAllowed, accountAllowed] = await Promise.all([
    countRequest(clientKey, MAX_FAILURES_PER_CLIENT, LOGIN_WINDOW_MS),
    countRequest(accountKey, MAX_FAILURES_PER_EMAIL, LOGIN_WINDOW_MS),
  ]);
  if (!clientAllowed || !accountAllowed) {
    // An attempt turned away isn't one at all, so it's given back to the limit that let it through
    await Promise.all([clientAllowed && uncountRequest(clientKey), accountAllowed && uncountRequest(accountKey)]);
    return { error: 'Too many login attempts. Please try again later.' };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // An account without a password (it signs in with Google) is compared against the dummy too, for
  // the same timing, but can never match it: the dummy's own password must not sign anyone in
  const isValidPassword = await bcrypt.compare(password, user?.passwordHash ?? getDummyPasswordHash()) && !!user?.passwordHash;

  // Already counted as a failure above
  if (!user || !isValidPassword) return { error: 'Invalid email or password' };

  // Only failures count, so a successful login clears this client's count. The per-email count only
  // gets this attempt back, and the rest is left to expire, so a correct login can't reset the budget
  // of someone guessing from elsewhere.
  await Promise.all([prisma.rateLimit.deleteMany({ where: { identifier: clientKey } }), uncountRequest(accountKey)]);

  await createSession(user.id);
  redirect(safeReturnTo(formData.get(RETURN_TO_PARAM) as string | null) ?? '/');
}

export async function setupInitialAdmin(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { error: 'All fields are required' };
  }

  const passwordError = checkPasswordLength(password);
  if (passwordError) return { error: passwordError };

  // The hosted version has no first user to set up: everyone signs up with Google
  if (isCloud()) return { error: 'Sign in with Google' };

  // Ensure this is ONLY allowed if 0 users exist
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return { error: 'Setup is already complete. Please log in.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      isAdmin: true,
    },
  });

  await seedDefaultCategories(user.id);

  await createSession(user.id);
  redirect('/');
}

export async function provisionUser(formData: FormData) {
  // On the hosted version, accounts are made by signing in with Google, and nobody is everyone's
  // household (see connectToEveryone below)
  if (isCloud()) return { error: 'Accounts are made by signing in with Google' };
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { error: 'All fields are required' };
  }

  const passwordError = checkPasswordLength(password);
  if (passwordError) return { error: passwordError };

  const { verifySession } = await import('@/lib/auth');
  const session = await verifySession();
  
  if (!session?.userId) {
    return { error: 'Unauthorized' };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId }
  });

  if (!isServerAdmin(currentUser)) {
    return { error: 'Only admins can provision new accounts' };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: 'User with this email already exists' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      isAdmin: false,
      passwordNeedsUpdate: true,
    },
  });

  await seedDefaultCategories(user.id);
  // One household: they can share habits with everyone else on the server, and see their names
  await connectToEveryone(user.id);

  const { revalidatePath } = await import('next/cache');
  revalidatePath('/settings/users');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}

export async function deleteUser(userIdToDelete: string) {
  // The hosted version has no admin to remove other people's accounts
  if (isCloud()) return { error: 'Only admins can delete accounts' };
  const { verifySession } = await import('@/lib/auth');
  const session = await verifySession();
  
  if (!session?.userId) {
    return { error: 'Unauthorized' };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId }
  });

  if (!isServerAdmin(currentUser)) {
    return { error: 'Only admins can delete accounts' };
  }
  
  if (currentUser.id === userIdToDelete) {
    return { error: 'You cannot delete yourself' };
  }

  await deleteAccount(userIdToDelete);

  const { revalidatePath } = await import('next/cache');
  revalidatePath('/settings/users');
  return { success: true };
}

// Deletes the current user's own account and everything in it (see deleteAccount), then signs them
// out. `confirmation` is what they typed to confirm, which must be DELETE.
export async function deleteMyAccount(confirmation: string) {
  const { verifySession } = await import('@/lib/auth');
  const session = await verifySession();
  if (!session?.userId) return { error: 'Unauthorized' };
  if (confirmation.trim().toUpperCase() !== 'DELETE') return { error: 'Type DELETE to confirm' };

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, isAdmin: true } });
  if (!user) return { error: 'Unauthorized' };
  const problem = await selfDeletionProblem(user);
  if (problem) return { error: problem };

  await deleteAccount(user.id);
  // Its sessions went with it; this clears the cookie
  await deleteSession();
  redirect('/login');
}

export async function updatePassword(formData: FormData) {
  // The hosted version stores no passwords
  if (!usesPasswords()) return { error: 'This account signs in with Google, so it has no password' };
  const { verifySession } = await import('@/lib/auth');
  const session = await verifySession();
  
  if (!session?.userId) {
    return { error: 'Unauthorized' };
  }

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'All fields are required' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match' };
  }

  const passwordError = checkPasswordLength(newPassword);
  if (passwordError) return { error: passwordError };

  const user = await prisma.user.findUnique({
    where: { id: session.userId }
  });

  if (!user) {
    return { error: 'User not found' };
  }
  // An account that signs in with Google (see Identity) has no password to change
  if (!user.passwordHash) {
    return { error: 'This account signs in with Google, so it has no password' };
  }

  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isValidPassword) {
    return { error: 'Current password is incorrect' };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Changing the password signs out every other device
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordNeedsUpdate: false
      }
    }),
    prisma.session.deleteMany({ where: { userId: user.id, id: { not: session.sessionId } } }),
  ]);

  return { success: true };
}
