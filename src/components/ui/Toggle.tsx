import type { ReactNode } from 'react';

export type ToggleColor = 'emerald' | 'blue' | 'amber';

const ON_CLASSES: Record<ToggleColor, { track: string; icon: string }> = {
  emerald: { track: 'bg-emerald-500', icon: 'bg-emerald-100 text-emerald-600' },
  blue: { track: 'bg-blue-500', icon: 'bg-blue-100 text-blue-600' },
  amber: { track: 'bg-amber-500', icon: 'bg-amber-100 text-amber-600' },
};

// A setting that's on or off, as a row: an icon, a title and description, and a switch. The whole
// row is the label, so tapping anywhere on it flips the switch.
export function Toggle({ icon, title, description, checked, onChange, disabled, color = 'emerald' }: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  color?: ToggleColor;
}) {
  const on = ON_CLASSES[color];
  return (
    <label className={`flex items-center justify-between gap-4 p-4 bg-stone-50 border border-stone-200 rounded-xl transition-colors ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-stone-100'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg shrink-0 ${checked ? on.icon : 'bg-stone-200 text-stone-500'}`}>{icon}</div>
        <div className="min-w-0">
          <div className="font-semibold text-stone-900 text-sm">{title}</div>
          {description && <div className="text-xs text-stone-500 break-words">{description}</div>}
        </div>
      </div>
      <div className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${checked ? on.track : 'bg-stone-300'}`}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
      </div>
    </label>
  );
}
