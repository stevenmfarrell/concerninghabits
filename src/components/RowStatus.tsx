import ProgressRing from './ProgressRing';
import type { RowStatus as Status } from '@/lib/dueList';
import type { ProgressPeriod } from '@/lib/cadence';
import { fuzzyDays } from '@/lib/format';

// How often, as a letter: upper case, unlike a span of time ("4w"), so the two don't read alike
const PERIOD_LETTERS: Record<ProgressPeriod, string> = { daily: 'D', weekly: 'W', monthly: 'M' };
const PERIOD_DESCRIPTIONS: Record<ProgressPeriod, string> = { daily: 'today', weekly: 'this week', monthly: 'this month' };

const TEXT = 'text-[11px] leading-none font-medium whitespace-nowrap';
// Every status is this wide, so they line up down the list, centered under each other
const BOX = 'shrink-0 w-11 flex flex-col items-center gap-0.5';

// What a due or upcoming row shows beside its calendar, kept as short as it can be, since a row's
// section already says a lot: everything in Due Now is due today, and everything in Upcoming is
// due later. So most rows show nothing, and a label marks the exceptions:
// - a progress ring with its period's letter inside, under the count, for several entries a
//   period ("2/3" over "W")
// - the letter alone, for once a week or month ("W", "M"); nothing for once a day
// - for every N days: how far off it's due, in grey ("3d", "2w"), or how overdue, in amber;
//   nothing on the day it's due, or before its first entry
// The full meaning is in each one's label for screen readers and its hover title.
export default function RowStatus({ status, color = 'emerald' }: { status: Status; color?: 'emerald' | 'blue' }) {
  if (status.kind === 'progress') {
    const label = `${status.done} of ${status.needed} done ${PERIOD_DESCRIPTIONS[status.period]}`;
    return (
      // 40px, the height of a row's Log button, so rows with a ring are no taller than others
      <div className={BOX} role="img" aria-label={label} title={label}>
        <ProgressRing progress={status} sublabel={PERIOD_LETTERS[status.period]} color={color} />
      </div>
    );
  }

  let text: string, tone: string, label: string;
  if (status.kind === 'period') {
    if (status.period === 'daily') return null;
    [text, tone, label] = [PERIOD_LETTERS[status.period], 'text-ink-muted', `Due ${status.period}`];
  } else {
    if (status.days === 0) return null;
    const span = fuzzyDays(Math.abs(status.days));
    [text, tone, label] = status.days > 0
      ? [span.short, 'text-ink-muted', `Due in ${span.count} ${span.unit}`]
      : [span.short, 'text-warning-ink-strong', `Due ${span.count} ${span.unit} ago`];
  }

  return (
    <div className={BOX} role="img" aria-label={label} title={label}>
      <span className={`${TEXT} ${tone}`}>{text}</span>
    </div>
  );
}
