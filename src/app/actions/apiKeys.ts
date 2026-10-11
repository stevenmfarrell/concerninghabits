'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createApiKey, type ApiPermissions } from '@/lib/apiKeys';
import { MAX_NAME_LENGTH } from '@/lib/constants';
import { getDefaultUser } from './user';

// The most keys a user can have at once
const MAX_API_KEYS = 50;

const KEY_FIELDS = { id: true, name: true, prefix: true, canLog: true, canRead: true, createdAt: true, lastUsedAt: true } as const;

// The user's API keys (see src/lib/apiKeys.ts), newest first, without the keys themselves, which
// aren't kept
export async function getApiKeys() {
  const user = await getDefaultUser();
  return prisma.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: KEY_FIELDS });
}

// Makes a key named `name` (e.g. "iPhone Shortcuts") allowed what `permissions` say, returning it
// this once
export async function makeApiKey(name: string, permissions: ApiPermissions): Promise<{ success: true; key: string } | { success: false; error: string }> {
  const user = await getDefaultUser();
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Give the key a name' };
  // Checked here as well as typed, since they come from the browser
  const canLog = permissions?.canLog === true;
  const canRead = permissions?.canRead === true;
  if (!canLog && !canRead) return { success: false, error: 'Let the key log entries, read them, or both' };
  if (trimmed.length > MAX_NAME_LENGTH) return { success: false, error: `Keep the name under ${MAX_NAME_LENGTH} characters` };
  if (await prisma.apiKey.count({ where: { userId: user.id } }) >= MAX_API_KEYS) {
    return { success: false, error: `You can have up to ${MAX_API_KEYS} keys. Revoke one you don't use first.` };
  }

  const { key } = await createApiKey(user.id, trimmed, { canLog, canRead });
  revalidatePath('/settings/api-keys');
  return { success: true, key };
}

// Changes what one of the user's keys may do. It has to be allowed one thing at least.
export async function setApiKeyPermissions(id: string, permissions: ApiPermissions) {
  const user = await getDefaultUser();
  const canLog = permissions?.canLog === true;
  const canRead = permissions?.canRead === true;
  if (!canLog && !canRead) throw new Error('A key has to be allowed to log or read');
  const { count } = await prisma.apiKey.updateMany({ where: { id, userId: user.id }, data: { canLog, canRead } });
  if (count === 0) throw new Error('Unauthorized');
  revalidatePath('/settings/api-keys');
}

// Revokes one of the user's keys: anything still using it gets turned away from then on
export async function revokeApiKey(id: string) {
  const user = await getDefaultUser();
  const { count } = await prisma.apiKey.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) throw new Error('Unauthorized');
  revalidatePath('/settings/api-keys');
}
