import type { ReactNode } from 'react';

// Emerald is the accent, blue a category's color, amber a warning (see the theme in globals.css)
export type ToggleColor = 'emerald' | 'blue' | 'amber';

const ON_CLASSES: Record<ToggleColor, { track: string; icon: string }> = {
  emerald: { track: 'bg-accent', icon: 'bg-accent-soft-strong text-accent-ink' },
  blue: { track: 'bg-category', icon: 'bg-category-soft-strong text-category-ink' },
  amber: { track: 'bg-warning', icon: 'bg-warning-soft-strong text-warning-ink' },
};

// A setting that's on or off, as a row: an icon, a title and description, and a switch. The whole
// row is the label, so tapping anywhere on it flips the switch. `bare` drops its own box, for a row in
// a pane's list (see Pane), where the list's hairlines separate it from its neighbors.
export function Toggle({ icon, title, description, checked, onChange, disabled, color = 'emerald', bare = false }: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  color?: ToggleColor;
  bare?: boolean;
}) {
  const on = ON_CLASSES[color];
  return (
    <label className={`flex items-center justify-between gap-4 transition-colors ${bare ? 'pane-inset py-3' : 'p-4 bg-surface-subtle border border-line rounded-xl'} ${disabled ? 'opacity-60' : `cursor-pointer ${bare ? 'hover:bg-surface-subtle' : 'hover:bg-surface-muted'}`}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg shrink-0 ${checked ? on.icon : 'bg-surface-strong text-ink-muted'}`}>{icon}</div>
        <div className="min-w-0">
          <div className="font-semibold text-ink text-sm">{title}</div>
          {description && <div className="text-xs text-ink-muted break-words">{description}</div>}
        </div>
      </div>
      <div className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${checked ? on.track : 'bg-line-strong'}`}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
      </div>
    </label>
  );
}
