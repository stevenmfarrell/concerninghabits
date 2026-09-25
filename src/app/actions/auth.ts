'use server';

import { prisma } from '@/lib/prisma';
import { createSession, deleteSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { error: 'Invalid email or password' };
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    return { error: 'Invalid email or password' };
  }

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

  await prisma.user.update({
    where: { id: user.id },
    data: { 
      passwordHash: newPasswordHash,
      passwordNeedsUpdate: false
    }
  });

  return { success: true };
}
