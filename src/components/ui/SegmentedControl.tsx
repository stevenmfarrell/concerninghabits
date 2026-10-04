// A small set of mutually exclusive choices as a row of segments, e.g. a chart's time range
export function SegmentedControl<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // For screen readers, what the choice is of
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex bg-surface-muted rounded-lg p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${option.value === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink-secondary'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
