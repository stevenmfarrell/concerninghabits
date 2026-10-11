import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma';
import { countRequest } from './rateLimit';

// API keys let another app (a shortcut, Home Assistant, an NFC tag) log entries as a user through the
// API routes under /api (see ApiKey), and read a habit's recent entries: whichever of those the key
// is allowed (see ApiPermissions). A key can't change or delete anything, so one that leaks can at
// worst add entries or show the user's history. Server-only.

// Every key starts with this, so it's recognizable wherever it's pasted (and by secret scanners)
export const API_KEY_PREFIX = 'ch_';
// How much of a key the keys list shows, to tell them apart
const SHOWN_PREFIX_LENGTH = API_KEY_PREFIX.length + 4;
// How many requests one key can make in an hour, generous enough for a busy automation
export const MAX_API_REQUESTS_PER_HOUR = 600;
const WINDOW_MS = 60 * 60 * 1000;
// A key's last use is written at most this often, so a busy automation doesn't write on every request
const LAST_USED_RESOLUTION_MS = 60 * 1000;

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

// What a key may do: log entries, and read a habit's entries
export interface ApiPermissions {
  canLog: boolean;
  canRead: boolean;
}

export type ApiPermission = 'log' | 'read';

// A new key for the user, allowed what `permissions` say, returned this once: only its hash is kept.
// 32 random bytes, so a hash without a salt or a slow function is enough (unlike a password, there's
// nothing to guess).
export async function createApiKey(userId: string, name: string, { canLog, canRead }: ApiPermissions) {
  const key = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  const record = await prisma.apiKey.create({
    data: { userId, name, hash: hashApiKey(key), prefix: key.slice(0, SHOWN_PREFIX_LENGTH), canLog, canRead },
    select: { id: true, name: true, prefix: true, canLog: true, canRead: true, createdAt: true, lastUsedAt: true },
  });
  return { key, record };
}

// The key a request was sent with: in the Authorization header (`Bearer ch_...`), an X-API-Key
// header, or for an app that can't set headers, the `key` query parameter
export function apiKeyFrom(request: Request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return bearer ?? request.headers.get('x-api-key')?.trim() ?? new URL(request.url).searchParams.get('key');
}

export type ApiAuth =
  | { ok: true; keyId: string; user: { id: string; name: string; timeZone: string | null; bedtime: string } }
  | { ok: false; response: Response };

// Who a request to the API is from, by its key, or the response to send when it can't go ahead: no
// key or an unknown one, one that isn't allowed `permission`, or one that's made too many requests
// lately
export async function authenticateApiRequest(request: Request, permission: ApiPermission): Promise<ApiAuth> {
  const key = apiKeyFrom(request);
  const record = key?.startsWith(API_KEY_PREFIX)
    ? await prisma.apiKey.findUnique({
        where: { hash: hashApiKey(key) },
        include: { user: { select: { id: true, name: true, timeZone: true, bedtime: true } } },
      })
    : null;
  if (!record) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Send a valid API key, as "Authorization: Bearer ch_...", "X-API-Key: ch_..." or ?key=ch_... Make one under Settings → API Keys.' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
      ),
    };
  }

  if (permission === 'log' ? !record.canLog : !record.canRead) {
    return {
      ok: false,
      response: Response.json(
        { error: `The key "${record.name}" isn't allowed to ${permission === 'log' ? 'log entries' : 'read entries'}. Make one that is under Settings → API Keys.` },
        { status: 403 },
      ),
    };
  }

  if (!(await countRequest(`api:${record.id}`, MAX_API_REQUESTS_PER_HOUR, WINDOW_MS))) {
    return { ok: false, response: Response.json({ error: 'This key has made too many requests. Try again in a little while.' }, { status: 429 }) };
  }

  const now = Date.now();
  if (!record.lastUsedAt || now - record.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date(now) } });
  }
  return { ok: true, keyId: record.id, user: record.user };
}
