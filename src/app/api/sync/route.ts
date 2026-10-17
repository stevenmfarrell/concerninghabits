import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { MAX_OPS_PER_SYNC, opSchema, type Op, type OpResult } from '@/lib/offline/ops';
import { changeHabitLog, createHabitLog, removeHabitLog } from '@/lib/entries';
import { skipOn, unskipOn } from '@/lib/skips';
import { logFromInput, logToAnyHabit, type EntryUser } from '@/lib/smartEntry';

// Makes the changes the browser kept in its outbox while offline (see src/lib/offline), in the order
// they were made, as the signed-in user. The body is {"ops": [...]}; the answer is {"results": [...]},
// one per change saying what became of it (see OpResult). One change failing doesn't stop the rest.
// A route rather than a server action, so a page left from before a deploy can still send what it
// kept. Like the backup route, it checks the session itself (the proxy doesn't run on /api), and its
// SameSite=Lax cookie keeps another site from posting here as the user.

type SyncUser = EntryUser;

// Why a change can't be made, in words for the user, from what the action that tried it threw.
// `gone` when what it was for is gone (or isn't the user's), so there's no finishing it by hand.
function reason(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Unauthorized') return { error: 'You don\'t have this anymore, or it\'s been deleted', gone: true };
  return { error: message || fallback, gone: false };
}

// Makes one change. Anything it throws is the change failing, as it is.
async function apply(user: SyncUser, op: Op): Promise<OpResult> {
  const done = { opId: op.opId, status: 'done' } as const;
  const failed = (error: string, extra: { habitId?: string; values?: Record<string, unknown> } = {}): OpResult => ({ opId: op.opId, status: 'failed', error, ...extra });
  // A change that threw: with its habit and values to finish it by hand, unless what it was for is gone
  const threw = (error: unknown, fallback: string, extra: { habitId?: string; values?: Record<string, unknown> } = {}) => {
    const { error: message, gone } = reason(error, fallback);
    return failed(message, gone ? {} : extra);
  };

  switch (op.kind) {
    case 'log':
      try {
        await createHabitLog(user, op.habitId, op.values, new Date(op.createdAt), op.entryId);
        return done;
      } catch (error) {
        return threw(error, 'Its values aren\'t valid', { habitId: op.habitId, values: op.values });
      }

    case 'text': {
      const createdAt = new Date(op.createdAt);
      if (!op.habitId) {
        const result = await logToAnyHabit(user, op.text, createdAt, op.entryId);
        return result.logged ? done : failed(result.error, { habitId: result.habit?.id, values: result.data });
      }
      const result = await logFromInput(user, op.habitId, op.text, {}, createdAt, op.entryId);
      // Not found when the habit's gone, with nothing to finish by hand
      if (!result.success) return failed(result.error, result.error === 'Habit not found.' ? {} : { habitId: op.habitId });
      return result.logged ? done : failed(result.problem, { habitId: op.habitId, values: result.data });
    }

    case 'update':
      try {
        await changeHabitLog(user.id, op.entryId, op.habitId, op.values, op.createdAt ? new Date(op.createdAt) : undefined);
        return done;
      } catch (error) {
        return threw(error, 'Its values aren\'t valid', { habitId: op.habitId, values: op.values });
      }

    case 'delete': {
      // Already gone is as good as deleted
      if (!(await prisma.habitLog.findUnique({ where: { id: op.entryId }, select: { id: true } }))) return done;
      try {
        await removeHabitLog(user.id, op.entryId, op.habitId);
        return done;
      } catch (error) {
        return threw(error, 'It couldn\'t be deleted');
      }
    }

    case 'skip':
    case 'unskip':
      try {
        await (op.kind === 'skip' ? skipOn : unskipOn)(user.id, op.target, op.day);
        return done;
      } catch (error) {
        return threw(error, 'It couldn\'t be changed');
      }
  }
}

export async function POST(request: Request) {
  const session = await verifySession();
  if (!session) return Response.json({ error: 'You\'re signed out' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, timeZone: true, bedtime: true } });
  if (!user) return Response.json({ error: 'You\'re signed out' }, { status: 401 });

  const body = z.object({ ops: z.array(z.unknown()).max(MAX_OPS_PER_SYNC) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: `Send {"ops": [...]}, at most ${MAX_OPS_PER_SYNC} at a time` }, { status: 400 });

  const results: OpResult[] = [];
  for (const raw of body.data.ops) {
    const parsed = opSchema.safeParse(raw);
    const opId = typeof raw === 'object' && raw !== null && 'opId' in raw ? String(raw.opId) : '';
    if (!parsed.success) {
      results.push({ opId, status: 'failed', error: 'This change can\'t be read, so it can\'t be made' });
    } else if (parsed.data.userId !== user.id) {
      // Someone else's, made on this device before they signed out: kept for when they're back
      results.push({ opId, status: 'retry', error: 'Made by someone else signed in on this device' });
    } else {
      results.push(await apply(user, parsed.data));
    }
  }
  return Response.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
}
