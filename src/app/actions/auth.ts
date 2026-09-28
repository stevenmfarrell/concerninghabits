'use server';

import { prisma } from '@/lib/prisma';
import { createSession, deleteSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// Failed logins allowed per client (IP + email). Keyed per client so a stranger can't lock you out.
const MAX_FAILURES_PER_CLIENT = 5;
// Failed logins allowed per email across all clients. The client IP comes from x-forwarded-for,
// which callers can spoof, so this cap is what actually limits password guessing.
const MAX_FAILURES_PER_EMAIL = 20;

async function getClientIp() {
  const headerStore = await headers();
  // A reverse proxy appends the address it saw, so the last entry is the most trustworthy
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',').map(ip => ip.trim()).filter(Boolean);
  return forwardedFor?.at(-1) ?? headerStore.get('x-real-ip') ?? 'unknown';
}

async function getFailureCount(identifier: string) {
  const limit = await prisma.rateLimit.findUnique({ where: { identifier } });
  if (!limit || limit.resetTime < new Date()) return 0;
  return limit.count;
}

async function recordFailure(identifier: string) {
  const now = new Date();
  const limit = await prisma.rateLimit.findUnique({ where: { identifier } });
  if (limit && limit.resetTime >= now) {
    await prisma.rateLimit.update({ where: { identifier }, data: { count: { increment: 1 } } });
  } else {
    const resetTime = new Date(now.getTime() + LOGIN_WINDOW_MS);
    await prisma.rateLimit.upsert({
      where: { identifier },
      create: { identifier, count: 1, resetTime },
      update: { count: 1, resetTime },
    });
  }
}

// Compared against when the email has no account, so response time doesn't reveal which emails exist
let dummyPasswordHash: string | undefined;
const getDummyPasswordHash = () => (dummyPasswordHash ??= bcrypt.hashSync('not-a-real-password', 10));

function checkPasswordLength(password: string) {
  return password.length < MIN_PASSWORD_LENGTH ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters` : null;
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  const clientKey = `login:${await getClientIp()}:${normalizedEmail}`;
  const accountKey = `login:${normalizedEmail}`;

  const [clientFailures, accountFailures] = await Promise.all([getFailureCount(clientKey), getFailureCount(accountKey)]);
  if (clientFailures >= MAX_FAILURES_PER_CLIENT || accountFailures >= MAX_FAILURES_PER_EMAIL) {
    return { error: 'Too many login attempts. Please try again later.' };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  const isValidPassword = await bcrypt.compare(password, user?.passwordHash ?? getDummyPasswordHash());

  if (!user || !isValidPassword) {
    await Promise.all([recordFailure(clientKey), recordFailure(accountKey)]);
    return { error: 'Invalid email or password' };
  }

  // Only failures count, so a successful login clears this client's count. The per-email count is
  // left to expire so a correct login can't reset the budget of someone guessing from elsewhere.
  await prisma.rateLimit.deleteMany({ where: { identifier: clientKey } });

  await createSession(user.id);
  redirect('/');
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

  const defaults = [
    { name: 'Mind', icon: 'Brain' },
    { name: 'Body', icon: 'PersonStanding' },
    { name: 'Chores', icon: 'Broom' },
    { name: 'Other', icon: 'CheckSquare' }
  ];
  for (const cat of defaults) {
    await prisma.category.create({
      data: { ...cat, userId: user.id }
    });
  }

  await createSession(user.id);
  redirect('/');
}

export async function provisionUser(formData: FormData) {
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

  if (!currentUser?.isAdmin) {
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

  const defaults = [
    { name: 'Mind', icon: 'Brain' },
    { name: 'Body', icon: 'PersonStanding' },
    { name: 'Chores', icon: 'Broom' },
    { name: 'Other', icon: 'CheckSquare' }
  ];
  for (const cat of defaults) {
    await prisma.category.create({
      data: { ...cat, userId: user.id }
    });
  }

  const { revalidatePath } = await import('next/cache');
  revalidatePath('/settings/users');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}

export async function deleteUser(userIdToDelete: string) {
  const { verifySession } = await import('@/lib/auth');
  const session = await verifySession();
  
  if (!session?.userId) {
    return { error: 'Unauthorized' };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId }
  });

  if (!currentUser?.isAdmin) {
    return { error: 'Only admins can delete accounts' };
  }
  
  if (currentUser.id === userIdToDelete) {
    return { error: 'You cannot delete yourself' };
  }

  await prisma.$transaction([
    prisma.habitLog.deleteMany({ where: { userId: userIdToDelete } }),
    prisma.habit.deleteMany({ where: { userId: userIdToDelete } }),
    prisma.category.deleteMany({ where: { userId: userIdToDelete } }),
    prisma.user.delete({ where: { id: userIdToDelete } })
  ]);

  const { revalidatePath } = await import('next/cache');
  revalidatePath('/settings/users');
  return { success: true };
}

export async function updatePassword(formData: FormData) {
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
