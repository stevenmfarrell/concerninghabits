import { deleteHabitLog, logHabitEvent, updateHabitLog } from '@/app/actions/entries';
import { skipToday, undoSkip } from '@/app/actions/skips';
import type { Skippable } from '@/lib/skips';
import { todayKeyFor } from '../timezone';
import { addOp, getOutbox, removeOps, updateOp, type QueuedOp } from './outbox';
import { getOutboxUser, isNetworkError, setReachable, syncOutbox } from './sync';
import type { Op } from './ops';

// Making changes from the browser whether or not the server can be reached: each is tried on the
// server first, as before, and only when the connection fails is it kept in the outbox (see
// outbox.ts) to be sent later, so it's never lost. A change to something still waiting in the
// outbox changes it there instead (undoing an entry not yet sent just takes it out). Each answers
// `queued` when it was kept for later. Errors from the server turning a change down are thrown as
// before. Browser-only.

// A random UUID. crypto.randomUUID only exists on https and localhost, and the app may be reached
// over plain http on a home network.
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function signedInUser() {
  const user = getOutboxUser();
  if (!user) throw new Error('You\'re signed out');
  return user;
}

// Keeps a change for later, and tries sending it at once in case the connection's already back
async function queue(op: Op, label: string) {
  await addOp({ ...op, queuedAt: new Date().toISOString(), label, status: 'pending' } as QueuedOp);
  setReachable(false);
  void syncOutbox();
}

// Tries `online` on the server, or when the connection fails, `offline` instead
async function tryServer<T>(online: () => Promise<T>, offline: () => Promise<T>): Promise<T> {
  try {
    return await online();
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    return offline();
  }
}

// The entry waiting in the outbox with `entryId`, if it's not been sent yet
const queuedEntry = (entryId: string) =>
  getOutbox().find((op): op is QueuedOp & { kind: 'log' | 'text' } => (op.kind === 'log' || op.kind === 'text') && op.entryId === entryId);

export async function logEntry(habit: { id: string; name: string }, values: Record<string, unknown>, createdAt?: Date) {
  const entryId = newId();
  return tryServer(
    async () => {
      const log = await logHabitEvent(habit.id, values, createdAt, entryId);
      setReachable(true);
      return { logId: log.id, queued: false };
    },
    async () => {
      await queue({ kind: 'log', opId: newId(), userId: signedInUser().id, entryId, habitId: habit.id, values, createdAt: (createdAt ?? new Date()).toISOString() }, habit.name);
      return { logId: entryId, queued: true };
    },
  );
}

// Something said or typed, kept for AI to fill in an entry from once back online: on `habit`, or
// with none, matched to a habit first (see logToAnyHabit). Only ever kept for later, since the AI
// is on the server; callers try it there first.
export async function queueTextEntry(habit: { id: string; name: string } | null, text: string) {
  const entryId = newId();
  await queue({ kind: 'text', opId: newId(), userId: signedInUser().id, entryId, habitId: habit?.id ?? null, text, createdAt: new Date().toISOString() }, habit?.name ?? `“${text}”`);
  return { logId: entryId, queued: true };
}

export async function deleteEntry(entryId: string, habit: { id: string; name: string }) {
  // Not sent yet: taking it out of the outbox is all there is to it, with any changes made to it
  const queued = queuedEntry(entryId);
  if (queued) {
    await removeOps(getOutbox().filter(op => op === queued || (op.kind === 'update' && op.entryId === entryId)).map(op => op.opId));
    return { queued: false };
  }
  return tryServer(
    async () => {
      await deleteHabitLog(entryId, habit.id);
      setReachable(true);
      return { queued: false };
    },
    async () => {
      // A change to it waiting to be sent no longer matters
      await removeOps(getOutbox().filter(op => op.kind === 'update' && op.entryId === entryId).map(op => op.opId));
      await queue({ kind: 'delete', opId: newId(), userId: signedInUser().id, entryId, habitId: habit.id }, habit.name);
      return { queued: true };
    },
  );
}

export async function updateEntry(entryId: string, habit: { id: string; name: string }, values: Record<string, unknown>, createdAt?: Date) {
  const queued = queuedEntry(entryId);
  if (queued?.kind === 'log') {
    // Not sent yet: change it where it waits, giving one turned down another try
    await updateOp(queued.opId, { values, ...(createdAt ? { createdAt: createdAt.toISOString() } : {}), status: 'pending', error: undefined });
    void syncOutbox();
    return { queued: true };
  }
  return tryServer(
    async () => {
      await updateHabitLog(entryId, habit.id, values, createdAt);
      setReachable(true);
      return { queued: false };
    },
    async () => {
      // Only its latest change needs sending
      await removeOps(getOutbox().filter(op => op.kind === 'update' && op.entryId === entryId).map(op => op.opId));
      await queue({ kind: 'update', opId: newId(), userId: signedInUser().id, entryId, habitId: habit.id, values, ...(createdAt ? { createdAt: createdAt.toISOString() } : {}) }, habit.name);
      return { queued: true };
    },
  );
}

const sameTarget = (a: Skippable, b: Skippable) => a.kind === b.kind && a.id === b.id;

// The skip or unskip of `target` on `day` waiting in the outbox, if there is one
const queuedSkipChange = (kind: 'skip' | 'unskip', target: Skippable, day: string) =>
  getOutbox().find(op => op.kind === kind && sameTarget(op.target, target) && op.day === day);

// Skips it for today, returning the day: the user's own today, worked out here when offline, by the
// same rule as the server's (their time zone and bedtime)
export async function skip(target: Skippable & { name: string }) {
  return tryServer(
    async () => {
      const day = await skipToday({ kind: target.kind, id: target.id });
      setReachable(true);
      return { day, queued: false };
    },
    async () => {
      const day = todayKeyFor({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, bedtime: signedInUser().bedtime });
      // Undoing a skip, then skipping again, before either was sent: the two cancel out
      const undone = queuedSkipChange('unskip', target, day);
      if (undone) await removeOps([undone.opId]);
      else await queue({ kind: 'skip', opId: newId(), userId: signedInUser().id, target: { kind: target.kind, id: target.id }, day }, target.name);
      return { day, queued: true };
    },
  );
}

export async function unskip(target: Skippable & { name: string }, day: string) {
  const queuedSkip = queuedSkipChange('skip', target, day);
  if (queuedSkip) {
    await removeOps([queuedSkip.opId]);
    return { queued: false };
  }
  return tryServer(
    async () => {
      await undoSkip({ kind: target.kind, id: target.id }, day);
      setReachable(true);
      return { queued: false };
    },
    async () => {
      await queue({ kind: 'unskip', opId: newId(), userId: signedInUser().id, target: { kind: target.kind, id: target.id }, day }, target.name);
      return { queued: true };
    },
  );
}
