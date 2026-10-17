'use client';

import { startTransition, type RefObject } from 'react';
import { CalendarChevronsRight, SkipForward } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Skippable } from '@/lib/skips';
import { skip } from '@/lib/offline/actions';
import { showSkippedToast } from '@/components/LoggedToast';
import type { RowSwipe } from './RowGesture';
import { swipeAway } from './zoomAway';

// Something to skip, with its name for showing it
export interface SkipTarget extends Skippable {
  name: string;
}

// What a skip's called, before and after, and whether it's a postponement (see skipLabels)
export interface SkipLabels {
  skip: string;
  skipped: string;
  postpones: boolean;
}

// A skip's icon, or a postponement's
export function SkipIcon({ postpones, className }: { postpones: boolean; className?: string }) {
  return postpones ? <CalendarChevronsRight className={className} strokeWidth={2.5} /> : <SkipForward className={className} strokeWidth={2.5} />;
}

// An Agenda row's swipe to skip it (see RowGesture). It's gone from the moment it's swiped, before
// the server's asked, and put back if that fails. The skip is only made once the row's gone, and the
// page is rendered again without it in the same transition, before the toast offers an Undo: an Undo
// while the skip's still on its way would be overtaken by it, bringing the row back only for the
// skip to take it away again. `row` is the element that leaves (see swipeAway). None without
// `labels`, for a row that can't be skipped now.
export function useSkipSwipe(target: SkipTarget, labels: SkipLabels | undefined, row: RefObject<HTMLElement | null>): RowSwipe | undefined {
  if (!labels) return undefined;
  return {
    label: `${labels.skip}: ${target.name}`,
    reveal: (
      <>
        <SkipIcon postpones={labels.postpones} className="w-5 h-5" />
        <span className="text-sm font-semibold">{labels.skip}</span>
      </>
    ),
    onCommit: () => new Promise<void>(resolve => {
      startTransition(async () => {
        const leaving = swipeAway(row.current);
        await leaving?.finished.catch(() => {});
        try {
          const { day, queued } = await skip(target);
          showSkippedToast({ target, label: labels.skipped, day, postpones: labels.postpones, queued });
        } catch (err) {
          leaving?.cancel();
          toast.error(`Failed to ${labels.postpones ? 'postpone' : 'skip'}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        resolve();
      });
    }),
  };
}
