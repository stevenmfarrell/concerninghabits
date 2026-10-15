import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/apiKeys';
import { apiError } from '@/lib/apiRequests';
import { parseEntryValues } from '@/lib/habitSchema';
import { getMembership } from '@/app/actions/internal';
import { loggerNames } from '@/lib/connections';

// How many entries are sent when no `limit` is given, and the most that can be asked for
const DEFAULT_ENTRIES_LIMIT = 10;
const MAX_ENTRIES_LIMIT = 100;

// A habit's latest entries, newest first, for another app, as the user whose API key it sends (see
// src/lib/apiKeys.ts): `?limit=N` of them (10 unless given, at most 100). Like the habit's page,
// that's everyone's entries on a shared habit, each saying who logged it: by name for someone the
// key's user can see (see visibleUsers), and as a former member otherwise. Answers 401 for the key
// 403 for a key that can't read, and 404 for a habit the key's user doesn't have.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(request, 'read');
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const limitParam = new URL(request.url).searchParams.get('limit');
  const limit = limitParam === null ? DEFAULT_ENTRIES_LIMIT : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ENTRIES_LIMIT) {
    return apiError(`"limit" must be a whole number from 1 to ${MAX_ENTRIES_LIMIT}`, 400);
  }

  const membership = await getMembership(auth.user.id, id).catch(() => null);
  if (!membership) return apiError('There\'s no habit with that id that you can see', 404);
  const { habit } = membership;

  const [logs, nameOf] = await Promise.all([
    prisma.habitLog.findMany({ where: { habitId: id }, orderBy: { createdAt: 'desc' }, take: limit }),
    loggerNames(auth.user.id),
  ]);

  return Response.json({
    habit: { id: habit.id, name: habit.name },
    entries: logs.map(log => ({
      id: log.id,
      loggedAt: log.createdAt.toISOString(),
      values: parseEntryValues(log.payload) ?? {},
      loggedBy: { id: log.userId, name: nameOf(log.userId) },
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
