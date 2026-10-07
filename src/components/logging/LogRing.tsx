'use client';

import { Check } from 'lucide-react';
import ProgressRing from '@/components/ProgressRing';
import type { RowStatus } from '@/lib/dueList';
import type { ProgressPeriod } from '@/lib/cadence';

const PERIOD_DESCRIPTIONS: Record<ProgressPeriod, string> = { daily: 'today', weekly: 'this week', monthly: 'this month' };

// The ring at the start of a row on the Agenda or the Habits pages: how far along it is toward done
// (see ProgressRing), and a tap on it logs it, like ticking a checkbox, while the rest of the row still opens its page and
// a press and hold anywhere on it logs it too (see RowGesture). One done with a single entry is an
// empty circle, showing a faint check on hover; one that takes several shows how many are done; one
// that's never done (0 of 0) stays empty. `pending`
// entries (see useHabitLogger) count toward it straight away, so it fills on the tap. There's no
// unticking: a tap adds an entry, which the logged toast's Undo takes back.
export default function LogRing({ status, pending = 0, label, onClick, disabled, color = 'emerald' }: {
  status: RowStatus;
  pending?: number;
  // What a tap does, e.g. "Log Water"; the count is added for screen readers
  label: string;
  // None for one that can't be logged (`disabled`), e.g. a category with no habits
  onClick?: () => unknown;
  disabled?: boolean;
  color?: 'emerald' | 'blue';
}) {
  const done = Math.min(status.done + pending, status.needed);
  const several = status.needed > 1;
  const progress = several && status.period ? `, ${done} of ${status.needed} done ${PERIOD_DESCRIPTIONS[status.period]}` : '';

  return (
    <button
      type="button"
      onClick={onClick}
      // So pressing the ring doesn't start the row's hold as well
      onPointerDown={e => e.stopPropagation()}
      disabled={disabled}
      title={label}
      aria-label={`${label}${progress}`}
      // Above the row's link, which is stretched over the row. Flex, so it's exactly the ring's
      // height: as a block, the ring would sit on a line of text, taller than it, and ride high.
      className="relative z-10 shrink-0 flex rounded-full group/ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50"
    >
      <ProgressRing progress={{ done, needed: status.needed }} showCount={several} size={44} color={color} />
      {status.needed === 1 && done === 0 && !disabled && (
        <span className={`absolute inset-0 flex items-center justify-center opacity-0 pointer-fine:group-hover/ring:opacity-40 transition-opacity ${color === 'blue' ? 'text-category-ink' : 'text-accent-ink'}`} aria-hidden="true">
          <Check className="w-5 h-5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
