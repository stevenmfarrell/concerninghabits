import ProgressRing from './ProgressRing';
import type { RowStatus as Status } from '@/lib/dueList';
import { fuzzyDays } from '@/lib/format';

const PERIOD_DESCRIPTIONS = { daily: 'today', weekly: 'this week', monthly: 'this month' } as const;

const TEXT = 'text-[11px] leading-none text-stone-500 whitespace-nowrap';
// Every status is this wide, so they line up down the list, centered under each other
const BOX = 'shrink-0 w-11 flex flex-col items-center gap-0.5';

// What a due or upcoming row shows beside its calendar: a progress ring over its period ("2/3"
// over "weekly"); just the period, for one done once a day, week, or month ("weekly"); or for a
// habit (or category) due every N days, when it's next due ("in 3" over "days", "new" over
// "today", "2 weeks" over "ago", fuzzier the further off; see fuzzyDays), or "never done" before
// its first entry
export default function RowStatus({ status, color = 'emerald' }: { status: Status; color?: 'emerald' | 'blue' }) {
  if (status.kind === 'progress') {
    const label = `${status.done} of ${status.needed} done ${PERIOD_DESCRIPTIONS[status.period]}`;
    return (
      // Ring and label together are 49px tall, more than a row's 40px Log button, so they spill 5px
      // into the row's padding top and bottom rather than making rows with a ring taller than others
      <div className={`${BOX} -my-[5px]`} role="img" aria-label={label} title={label}>
        <ProgressRing progress={status} color={color} />
        <span className={TEXT}>{status.period}</span>
      </div>
    );
  }

  // Text alone, a line or two, centered in the row
  const span = status.kind === 'dueIn' ? fuzzyDays(Math.abs(status.days)) : null;
  const [lines, label] =
    status.kind === 'period' ? [[status.period], `Due ${status.period}`]
    : status.kind === 'neverDone' ? [['never', 'done'], 'Not done yet']
    : status.days === 0 || !span ? [['new', 'today'], 'Due today']
    : status.days > 0 ? [[`in ${span.count}`, span.unit], `Due in ${span.count} ${span.unit}`]
    : [[`${span.count} ${span.unit}`, 'ago'], `Due ${span.count} ${span.unit} ago`];

  return (
    <div className={BOX} role="img" aria-label={label} title={label}>
      {lines.map(line => <span key={line} className={TEXT}>{line}</span>)}
    </div>
  );
}
