'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { skip as skipOrQueue, unskip } from '@/lib/offline/actions';
import { useQueuedSkip } from '@/lib/offline/useOutbox';
import { SkipIcon, type SkipTarget } from '@/components/logging/skipping';
import { toggledSkipLabel, type SkipState } from '@/lib/cadence';
import { PILL } from '@/components/CadenceQuickEdit';

// On a habit's or category's page, a pill beside its cadence (see HealthHeader): skips it for now
// (e.g. "Skip today", "Skip this week") while it's due, so a sick day or a trip doesn't count against
// it, or for one that postpones (see postpones), puts it off ("Postpone 2 days"). Once skipped, the
// pill says so and undoes it: one tap either way. The page refreshes through the actions'
// revalidation, which swaps one for the other. Offline, the skip (or its undoing) waits in the
// outbox (see src/lib/offline), and the pill shows it as done meanwhile.
export default function SkipButton({ target, skip }: { target: SkipTarget; skip: SkipState }) {
  const [busy, setBusy] = useState(false);
  const queued = useQueuedSkip(target, null);

  const run = async (action: () => Promise<{ queued: boolean }>, failure: string, savedOffline: string) => {
    setBusy(true);
    try {
      const result = await action();
      if (result.queued) toast(savedOffline, { icon: '📴' });
    } catch (err) {
      toast.error(`${failure}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  // As the server has it, unless a change to it is waiting to be sent
  const day = queued?.kind === 'skip' ? queued.day : queued?.kind === 'unskip' && queued.day === skip.skippedDay ? null : skip.skippedDay;
  const label = (day === null) === (skip.skippedDay === null) ? skip.label : toggledSkipLabel(skip.label);
  const icon = busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipIcon postpones={skip.postpones} className="w-4 h-4" />;

  return day ? (
    <button
      type="button"
      onClick={() => run(() => unskip(target, day), 'Failed to undo', 'Undone on this device · syncs when you\'re back online')}
      disabled={busy}
      className={`${PILL} bg-surface-subtle border-line-subtle text-ink-muted hover:bg-surface-muted`}
      aria-label={`${label}. Undo`}
    >
      {icon}
      {label}
      <span className="text-ink-secondary">· Undo</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => run(() => skipOrQueue(target), skip.postpones ? 'Failed to postpone' : 'Failed to skip', 'Saved on this device · syncs when you\'re back online')}
      disabled={busy}
      className={`${PILL} bg-surface border-line text-ink-secondary hover:bg-surface-subtle`}
    >
      {icon}
      {label}
    </button>
  );
}
