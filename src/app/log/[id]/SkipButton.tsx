'use client';

import { useState } from 'react';
import { Loader2, SkipForward } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { skipHabit, unskipHabit } from '../../actions/db';
import type { SkipState } from '@/lib/cadence';

// Under the Log Habit button: skips the habit for now (e.g. "Skip today", "Skip this week") while
// it's due, so a sick day or a trip doesn't count against it; or, once skipped, says so with an Undo.
// The page refreshes through the actions' revalidation, which swaps one for the other.
export default function SkipButton({ habitId, skip }: { habitId: string; skip: SkipState }) {
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

  const icon = busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />;

  if (skip.skippedDay) {
    const day = skip.skippedDay;
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-ink-muted">
        {icon}
        <span>{skip.label}</span>
        <Button variant="ghost" size="sm" onClick={() => run(() => unskipHabit(habitId, day), 'Failed to undo')} disabled={busy}>
          Undo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Button variant="ghost" size="sm" onClick={() => run(() => skipHabit(habitId), 'Failed to skip')} disabled={busy}>
        {icon}
        {skip.label}
      </Button>
    </div>
  );
}
