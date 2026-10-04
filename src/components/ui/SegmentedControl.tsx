import type { ReactNode } from 'react';

// A small set of mutually exclusive choices as a row of segments, e.g. a chart's time range. 32px
// tall, like the rest of a section heading's controls (see PaneHeading). A segment shows its `icon`
// in place of its label when given one, with the label as its accessible name and tooltip. There's no
// track: the segments sit on whatever's behind them, like a ghost button, and the chosen one is
// filled with a strong gray.
export function SegmentedControl<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  // For screen readers, what the choice is of
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.icon ? option.label : undefined}
          title={option.icon ? option.label : undefined}
          onClick={() => onChange(option.value)}
          className={`h-8 flex items-center justify-center ${option.icon ? 'px-2' : 'px-2.5'} text-xs font-semibold rounded-lg transition-colors ${option.value === value ? 'bg-surface-strong text-ink' : 'text-ink-muted hover:text-ink'}`}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  );
}
