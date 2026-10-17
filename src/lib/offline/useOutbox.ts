'use client';

import { useSyncExternalStore } from 'react';
import { civilDateFor, civilDayKey } from '../timezone';
import { getOutbox, subscribeOutbox, type QueuedOp } from './outbox';
import { getOutboxUser, isReachable, subscribeReachable } from './sync';
import type { Skippable } from '@/lib/skips';

// Reading the outbox (see outbox.ts) from components: the signed-in user's changes waiting to be
// sent. Empty on the server and while hydrating, so pages render the same as the server's at first.

const EMPTY: readonly QueuedOp[] = [];

// The signed-in user's waiting changes, oldest first
export function useOutbox(): readonly QueuedOp[] {
  const all = useSyncExternalStore(subscribeOutbox, getOutbox, () => EMPTY);
  const user = getOutboxUser();
  return user ? all.filter(op => op.userId === user.id) : EMPTY;
}

// Whether the server can be reached, as far as anyone's found out (see setReachable). True on the
// server and while hydrating.
export function useReachable() {
  return useSyncExternalStore(subscribeReachable, isReachable, () => true);
}

export type QueuedEntry = QueuedOp & { kind: 'log' | 'text' };
const isEntry = (op: QueuedOp): op is QueuedEntry => op.kind === 'log' || op.kind === 'text';

// New entries on `habitId` waiting to be sent, or turned down, newest first
export function useQueuedEntries(habitId: string): QueuedEntry[] {
  return useOutbox().filter(isEntry).filter(op => op.habitId === habitId).reverse();
}

// How many new entries on any of `habitIds` are waiting to be sent from today (the user's day, by
// their bedtime), for a ring to count toward its cadence before they're sent: a ring shows the
// current period, and an entry backdated to another day may not fall in it
export function useQueuedToday(habitIds: readonly string[]) {
  const outbox = useOutbox();
  const user = getOutboxUser();
  if (!user || outbox.length === 0) return 0;
  const owner = { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, bedtime: user.bedtime };
  const today = civilDayKey(civilDateFor(new Date(), owner));
  return outbox.filter(op => isEntry(op) && op.status === 'pending' && op.habitId !== null && habitIds.includes(op.habitId)
    && civilDayKey(civilDateFor(op.createdAt, owner)) === today).length;
}

// A change to an entry the server has, waiting to be sent: an edit or a deletion
export function useQueuedEntryChange(entryId: string) {
  return useOutbox().find(op => (op.kind === 'update' || op.kind === 'delete') && op.entryId === entryId) ?? null;
}

// Whether `target` has a skip on `day` waiting to be sent ('skip'), or the taking back of one
// ('unskip'), or neither (null)
export function useQueuedSkip(target: Skippable, day: string | null) {
  const op = useOutbox().find(o => (o.kind === 'skip' || o.kind === 'unskip') && o.target.kind === target.kind && o.target.id === target.id && (day === null || o.day === day));
  return op ? { kind: op.kind as 'skip' | 'unskip', day: (op as QueuedOp & { day: string }).day } : null;
}
