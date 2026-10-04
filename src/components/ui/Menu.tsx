// The look of a dropdown menu anchored to a button (a kebab menu, a field picker). Position the
// panel yourself, always with `top-full` or `bottom-full` (see UI_STANDARDS.md), e.g.
// `${MENU_PANEL} absolute right-0 top-full mt-1 w-56`, and put a MenuBackdrop behind it so a tap
// outside closes it.
export const MENU_PANEL = 'bg-surface rounded-xl shadow-lg border border-line-subtle py-2 z-50';

// An action in a menu: an icon and a label
export const MENU_ITEM = 'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left text-ink-secondary hover:bg-surface-subtle hover:text-accent-ink transition-colors';
export const MENU_ITEM_DANGER = 'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left text-danger-ink hover:bg-danger-soft transition-colors';

// A line between groups of items
export const MENU_SEPARATOR = 'my-2 border-t border-line-subtle';

// One of a list of choices (e.g. a select's options), with the chosen one highlighted. Its
// horizontal padding is left to the caller.
export function menuOptionClasses(selected: boolean) {
  return `w-full py-2 text-left text-sm flex items-center gap-2 transition-colors ${selected ? 'bg-accent-soft text-accent-ink-strong font-medium' : 'text-ink-secondary hover:bg-surface-subtle'}`;
}

// Covers the screen behind an open menu, closing it on a tap outside
export function MenuBackdrop({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-40" onClick={onClose} />;
}
