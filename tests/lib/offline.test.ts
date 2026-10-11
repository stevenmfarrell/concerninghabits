import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The server actions the offline layer tries first
const server = vi.hoisted(() => ({
  logHabitEvent: vi.fn(),
  deleteHabitLog: vi.fn(),
  updateHabitLog: vi.fn(),
  skipToday: vi.fn(),
  undoSkip: vi.fn(),
}));
vi.mock('@/app/actions/entries', () => ({ logHabitEvent: server.logHabitEvent, deleteHabitLog: server.deleteHabitLog, updateHabitLog: server.updateHabitLog }));
vi.mock('@/app/actions/skips', () => ({ skipToday: server.skipToday, undoSkip: server.undoSkip }));

import { deleteEntry, logEntry, queueTextEntry, skip, unskip, updateEntry } from '@/lib/offline/actions';
import { getOutbox, removeOps } from '@/lib/offline/outbox';
import { isReachable, setOutboxUser, setReachable, syncOutbox } from '@/lib/offline/sync';
import { toggledSkipLabel } from '@/lib/cadence';

const run = { id: 'run', name: 'Run' };
const offline = () => Promise.reject(new TypeError('Failed to fetch'));
// A fetch that answers /api/sync with `respond`, given the ops sent
const syncServer = (respond: (ops: { opId: string; kind: string }[]) => unknown) =>
  vi.fn(async (_url: string, init: RequestInit) => new Response(JSON.stringify({ results: respond(JSON.parse(String(init.body)).ops) }), { status: 200 }));

describe('the offline outbox', () => {
  beforeEach(async () => {
    Object.values(server).forEach(fn => fn.mockReset());
    await removeOps(getOutbox().map(op => op.opId));
    setOutboxUser({ id: 'me', bedtime: '00:00' });
    setReachable(true);
    vi.stubGlobal('navigator', { onLine: true });
    // Sending fails unless a test says otherwise, so what's queued stays queued
    vi.stubGlobal('fetch', vi.fn(offline));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('logs on the server when it can, with an id made here', async () => {
    server.logHabitEvent.mockImplementation(async (_habitId, _values, _at, id) => ({ id }));
    const result = await logEntry(run, { distance: 3 });
    expect(result.queued).toBe(false);
    expect(server.logHabitEvent).toHaveBeenCalledWith('run', { distance: 3 }, undefined, result.logId);
    expect(result.logId).toMatch(/^[0-9a-f-]{36}$/);
    expect(getOutbox()).toHaveLength(0);
  });

  it('keeps an entry for later when the connection fails, with the same id', async () => {
    server.logHabitEvent.mockImplementation(offline);
    const result = await logEntry(run, { distance: 3 });
    expect(result.queued).toBe(true);
    expect(getOutbox()).toMatchObject([{ kind: 'log', entryId: result.logId, habitId: 'run', values: { distance: 3 }, userId: 'me', label: 'Run', status: 'pending' }]);
    expect(server.logHabitEvent.mock.calls[0][3]).toBe(result.logId);
    expect(isReachable()).toBe(false);
  });

  it('throws when the server turns it down, keeping nothing', async () => {
    server.logHabitEvent.mockRejectedValue(new Error('Invalid log data'));
    await expect(logEntry(run, {})).rejects.toThrow('Invalid log data');
    expect(getOutbox()).toHaveLength(0);
  });

  it('changes or takes back an entry that hasn\'t been sent, without asking the server', async () => {
    server.logHabitEvent.mockImplementation(offline);
    const { logId } = await logEntry(run, { distance: 3 });
    await updateEntry(logId, run, { distance: 4 });
    expect(getOutbox()).toMatchObject([{ kind: 'log', entryId: logId, values: { distance: 4 } }]);
    await deleteEntry(logId, run);
    expect(getOutbox()).toHaveLength(0);
    expect(server.updateHabitLog).not.toHaveBeenCalled();
    expect(server.deleteHabitLog).not.toHaveBeenCalled();
  });

  it('keeps only the latest edit of an entry the server has, and drops it once it\'s deleted', async () => {
    server.updateHabitLog.mockImplementation(offline);
    server.deleteHabitLog.mockImplementation(offline);
    await updateEntry('e1', run, { distance: 1 });
    await updateEntry('e1', run, { distance: 2 });
    expect(getOutbox()).toMatchObject([{ kind: 'update', entryId: 'e1', values: { distance: 2 } }]);
    await deleteEntry('e1', run);
    expect(getOutbox()).toMatchObject([{ kind: 'delete', entryId: 'e1' }]);
  });

  it('skips on the user\'s own today when offline, and an undo before sending cancels it', async () => {
    server.skipToday.mockImplementation(offline);
    server.undoSkip.mockImplementation(offline);
    const target = { kind: 'habit' as const, id: 'run', name: 'Run' };
    const { day, queued } = await skip(target);
    expect(queued).toBe(true);
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getOutbox()).toMatchObject([{ kind: 'skip', target: { kind: 'habit', id: 'run' }, day }]);
    await unskip(target, day);
    expect(getOutbox()).toHaveLength(0);
    expect(server.undoSkip).not.toHaveBeenCalled();
  });

  it('keeps text to fill in later', async () => {
    await queueTextEntry(null, 'ran 3 miles');
    expect(getOutbox()).toMatchObject([{ kind: 'text', habitId: null, text: 'ran 3 miles', label: '“ran 3 miles”' }]);
  });

  describe('syncing', () => {
    it('sends only the signed-in user\'s changes, removes those made, and keeps those turned down', async () => {
      server.logHabitEvent.mockImplementation(offline);
      await logEntry(run, { distance: 1 });
      await logEntry(run, {});
      setOutboxUser({ id: 'someone-else', bedtime: '00:00' });
      await queueTextEntry(null, 'theirs');
      setOutboxUser({ id: 'me', bedtime: '00:00' });

      const fetch = syncServer(ops => ops.map((op, i) => (i === 0 ? { opId: op.opId, status: 'done' } : { opId: op.opId, status: 'failed', error: 'Distance is required', habitId: 'run', values: {} })));
      vi.stubGlobal('fetch', fetch);
      const onSynced = vi.fn();
      const { setOnSynced } = await import('@/lib/offline/sync');
      setOnSynced(onSynced);
      await syncOutbox();
      setOnSynced(null);

      const sent = JSON.parse(String(fetch.mock.calls[0][1].body)).ops;
      expect(sent).toHaveLength(2);
      expect(sent[0]).not.toHaveProperty('label');
      expect(sent[0]).not.toHaveProperty('status');
      expect(getOutbox()).toMatchObject([
        { kind: 'log', status: 'failed', error: 'Distance is required', failedHabitId: 'run' },
        { kind: 'text', userId: 'someone-else', status: 'pending' },
      ]);
      expect(onSynced).toHaveBeenCalledTimes(1);
      expect(isReachable()).toBe(true);
    });

    it('still sends after a sync that had nothing to send', async () => {
      await syncOutbox();
      server.logHabitEvent.mockImplementation(offline);
      await logEntry(run, {});
      const fetch = syncServer(ops => ops.map(op => ({ opId: op.opId, status: 'done' })));
      vi.stubGlobal('fetch', fetch);
      await syncOutbox();
      expect(fetch).toHaveBeenCalled();
      expect(getOutbox()).toHaveLength(0);
    });

    it('goes again for a change made while a sync was running', async () => {
      server.logHabitEvent.mockImplementation(offline);
      await logEntry(run, { distance: 1 });
      let release!: () => void;
      const sent: number[] = [];
      vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
        const ops = JSON.parse(String(init.body)).ops as { opId: string }[];
        sent.push(ops.length);
        // The first batch waits until the second change has been made
        if (sent.length === 1) await new Promise<void>(resolve => { release = resolve; });
        return new Response(JSON.stringify({ results: ops.map(op => ({ opId: op.opId, status: 'done' })) }));
      }));
      const first = syncOutbox();
      await vi.waitFor(() => expect(sent).toHaveLength(1));
      await queueTextEntry(run, 'another run');
      const second = syncOutbox();
      release();
      await Promise.all([first, second]);
      expect(sent).toEqual([1, 1]);
      expect(getOutbox()).toHaveLength(0);
    });

    it('stops when the server can\'t be reached, or keeps everything for later', async () => {
      server.logHabitEvent.mockImplementation(offline);
      await logEntry(run, {});
      await syncOutbox();
      expect(getOutbox()).toHaveLength(1);
      expect(isReachable()).toBe(false);

      const fetch = syncServer(ops => ops.map(op => ({ opId: op.opId, status: 'retry', error: 'later' })));
      vi.stubGlobal('fetch', fetch);
      await syncOutbox();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(getOutbox()).toMatchObject([{ status: 'pending' }]);
    });
  });
});

describe('toggledSkipLabel', () => {
  it('swaps a skip button\'s label between done and not', () => {
    expect(toggledSkipLabel('Skip today')).toBe('Skipped today');
    expect(toggledSkipLabel('Skipped this week')).toBe('Skip this week');
    expect(toggledSkipLabel('Postpone 2 days')).toBe('Postponed 2 days');
    expect(toggledSkipLabel('Postponed a day')).toBe('Postpone a day');
  });
});
