import type { Op } from './ops';

// The browser's outbox: changes made while the server couldn't be reached (see ops.ts), kept in
// IndexedDB so they survive the app being closed, until they're sent (see sync.ts). Browser-only.
//
// Its contents are mirrored in memory, in the order they were made, for components to read through
// useSyncExternalStore (see useOutbox.ts). Other tabs of the app are told of each change, to load it
// again. Without IndexedDB (e.g. some private windows), it's only kept in memory, for this page.

// A change waiting in the outbox
export type QueuedOp = Op & {
  // When it was made, for ordering and showing
  queuedAt: string;
  // What it's about in words, e.g. a habit's name, for listing it
  label: string;
  // Waiting to be sent, or turned down by the server and waiting for the user (see OpResult)
  status: 'pending' | 'failed';
  error?: string;
  // From a failed one's result: the habit it was for and the values it had, for finishing it by hand
  failedHabitId?: string;
  failedValues?: Record<string, unknown>;
};

const DB_NAME = 'concerning-habits';
const STORE = 'outbox';
const CHANNEL = 'concerning-habits-outbox';

let ops: readonly QueuedOp[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'opId' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
const db = () => (dbPromise ??= openDb());

// Runs `work` on the store in one transaction, resolving once it's written (or at once without IndexedDB)
async function inStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const database = await db();
  if (!database) return undefined;
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const byQueuedAt = (a: QueuedOp, b: QueuedOp) => a.queuedAt.localeCompare(b.queuedAt);

function publish(next: QueuedOp[], { broadcast = true } = {}) {
  ops = [...next].sort(byQueuedAt);
  listeners.forEach(listener => listener());
  if (broadcast) channel?.postMessage('changed');
}

async function readAll() {
  const stored = await inStore<QueuedOp[]>('readonly', store => store.getAll()).catch(() => undefined);
  return stored ?? null;
}

// Loads what's kept, once per page. Safe to call often.
export function loadOutbox() {
  if (typeof window === 'undefined') return Promise.resolve();
  loading ??= (async () => {
    if (typeof BroadcastChannel !== 'undefined' && !channel) {
      channel = new BroadcastChannel(CHANNEL);
      // Another tab changed it: load it again, without telling the others back
      channel.onmessage = async () => {
        const stored = await readAll();
        if (stored) publish(stored, { broadcast: false });
      };
    }
    const stored = await readAll();
    // Anything added while loading is kept too
    if (stored) publish([...stored, ...ops.filter(op => !stored.some(s => s.opId === op.opId))], { broadcast: false });
  })();
  return loading;
}

export function subscribeOutbox(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getOutbox = () => ops;

export async function addOp(op: QueuedOp) {
  publish([...ops, op]);
  await inStore('readwrite', store => store.put(op)).catch(() => {});
}

export async function updateOp(opId: string, patch: Partial<QueuedOp>) {
  const current = ops.find(op => op.opId === opId);
  if (!current) return;
  const next = { ...current, ...patch } as QueuedOp;
  publish(ops.map(op => (op.opId === opId ? next : op)));
  await inStore('readwrite', store => store.put(next)).catch(() => {});
}

export async function removeOps(opIds: string[]) {
  if (opIds.length === 0) return;
  const removing = new Set(opIds);
  publish(ops.filter(op => !removing.has(op.opId)));
  await inStore('readwrite', store => {
    opIds.forEach(id => store.delete(id));
  }).catch(() => {});
}
