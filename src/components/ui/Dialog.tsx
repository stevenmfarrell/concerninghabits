import type { ReactNode } from 'react';

// The dimmed, blurred backdrop behind a dialog or a bottom sheet. Above the bottom nav (z-50), which
// would otherwise show through it.
export const OVERLAY = 'fixed inset-0 z-[60] bg-overlay backdrop-blur-sm animate-in fade-in duration-200';

// A dialog centered over the page. With `onClose`, tapping the backdrop closes it; leave it out for
// one that must be answered with its buttons (e.g. a confirmation). `clip` rounds off its contents'
// corners (e.g. a footer's fill); turn it off when a dropdown inside needs to spill out of it.
export function Dialog({ label, onClose, size = 'md', clip = true, children }: {
  label?: string;
  onClose?: () => void;
  size?: 'sm' | 'md';
  clip?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${OVERLAY} flex items-center justify-center p-4`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`bg-surface rounded-2xl shadow-xl w-full ${size === 'sm' ? 'max-w-sm' : 'max-w-md'} ${clip ? 'overflow-hidden' : ''} animate-in zoom-in-95 duration-200`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// A dialog's buttons, on a fill along its bottom: stacked full-width on phones, the primary one on top
export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 sm:px-8 sm:py-6 bg-surface-subtle border-t border-line-subtle flex flex-col-reverse sm:flex-row justify-end gap-3">
      {children}
    </div>
  );
}
