import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPendingSmartEntry, takePendingSmartEntry } from '@/lib/pendingSmartEntry';

describe('pending smart entry handoff', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.useFakeTimers();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hands the input to the matching habit once', () => {
    setPendingSmartEntry('running', 'I ran a mile in 8 minutes');
    expect(takePendingSmartEntry('running')).toBe('I ran a mile in 8 minutes');
    expect(takePendingSmartEntry('running')).toBeNull();
  });

  it('ignores, and clears, input meant for a different habit', () => {
    setPendingSmartEntry('running', 'I ran a mile');
    expect(takePendingSmartEntry('cycling')).toBeNull();
    expect(takePendingSmartEntry('running')).toBeNull();
  });

  it('ignores input left behind for over a minute', () => {
    setPendingSmartEntry('running', 'I ran a mile');
    vi.advanceTimersByTime(61_000);
    expect(takePendingSmartEntry('running')).toBeNull();
  });

  it('ignores an entry without a timestamp, as written before the handoff had one', () => {
    store.set('pendingSmartEntry', JSON.stringify({ habitId: 'running', transcript: 'I ran a mile' }));
    expect(takePendingSmartEntry('running')).toBeNull();
  });
});
