import { fuzzyDays } from '@/lib/format';

// What a row that counts down (every N days), or a weekly or monthly one not done yet, shows beside
// its calendar: how far off it's due (for a weekly or monthly one, its period's last day), in grey
// ("3d", "2w"), or how overdue, in amber. Nothing on the day it's due, or before a countdown's
// first entry (`days` null). How far along a row
// is goes in its ring instead (see LogRing). The full meaning is in its label for screen readers and
// its hover title.
export default function RowStatus({ days }: { days: number | null }) {
  if (days === null || days === 0) return null;
  const span = fuzzyDays(Math.abs(days));
  const [tone, label] = days > 0
    ? ['text-ink-muted', `Due in ${span.count} ${span.unit}`]
    : ['text-warning-ink-strong', `Due ${span.count} ${span.unit} ago`];

  return (
    <div className="shrink-0" role="img" aria-label={label} title={label}>
      <span className={`text-[11px] leading-none font-medium whitespace-nowrap ${tone}`}>{span.short}</span>
    </div>
  );
}
