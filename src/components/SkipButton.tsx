'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { skipToday, undoSkip } from '@/app/actions/skips';
import { SkipIcon, type SkipTarget } from '@/components/logging/skipping';
import type { SkipState } from '@/lib/cadence';
import { PILL } from '@/components/CadenceQuickEdit';

// On a habit's or category's page, a pill beside its cadence (see HealthHeader): skips it for now
// (e.g. "Skip today", "Skip this week") while it's due, so a sick day or a trip doesn't count against
// it, or for one that postpones (see postpones), puts it off ("Postpone 2 days"). Once skipped, the
// pill says so and undoes it: one tap either way. The page refreshes through the actions'
// revalidation, which swaps one for the other.
export default function SkipButton({ target, skip }: { target: SkipTarget; skip: SkipState }) {
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(`${failure}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const icon = busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipIcon postpones={skip.postpones} className="w-4 h-4" />;
  const day = skip.skippedDay;

  return day ? (
    <button
      type="button"
      onClick={() => run(() => undoSkip(target, day), 'Failed to undo')}
      disabled={busy}
      className={`${PILL} bg-surface-subtle border-line-subtle text-ink-muted hover:bg-surface-muted`}
      aria-label={`${skip.label}. Undo`}
    >
      {icon}
      {skip.label}
      <span className="text-ink-secondary">· Undo</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => run(() => skipToday(target), skip.postpones ? 'Failed to postpone' : 'Failed to skip')}
      disabled={busy}
      className={`${PILL} bg-surface border-line text-ink-secondary hover:bg-surface-subtle`}
    >
      {icon}
      {skip.label}
    </button>
  );
}
