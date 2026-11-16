'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { OVERLAY } from '@/components/ui/Dialog';

// The part of the screen the on-screen keyboard leaves visible, as a style placing the overlay over
// just that, or undefined while it's the whole screen. A `fixed` element is laid out against the
// whole screen even while the keyboard is up (iOS Safari, and Android Chrome by default), so a sheet
// pinned to the bottom would sit under the keyboard, its button with it.
function useVisibleArea(): CSSProperties | undefined {
  const [area, setArea] = useState<CSSProperties>();
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height;
      // A pixel or two of difference is rounding, not a keyboard
      setArea(covered > 1 || viewport.offsetTop > 1 ? { top: viewport.offsetTop, height: viewport.height, bottom: 'auto' } : undefined);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return area;
}

// A pane that slides up from the bottom over the page, with a title, optional buttons beside it,
// and a close button. Tapping the backdrop closes it too. Used for a habit's entry form (see
// LogEntrySheet) and the editor's form preview. `footer` (e.g. a form's submit button) stays in view
// below the rest, which scrolls, and the sheet sits above the on-screen keyboard while it's up.
export default function BottomSheet({ title, ariaLabel, headerActions, footer, onClose, children }: {
  title: ReactNode;
  // For screen readers, when `title` alone doesn't say what the pane is for
  ariaLabel?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const visibleArea = useVisibleArea();
  const safeArea = { paddingBottom: 'env(safe-area-inset-bottom)' };

  return (
    <div className={`${OVERLAY} flex items-end justify-center`} style={visibleArea} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        className="bg-surface rounded-t-2xl shadow-xl w-full max-w-xl max-h-[90%] flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="min-h-0 overflow-y-auto" style={footer ? undefined : safeArea}>
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="flex-1 min-w-0 text-xl font-bold text-ink truncate">{title}</h2>
              {headerActions}
              <IconButton onClick={onClose} edge="right" title="Close">
                <X className="w-6 h-6" />
              </IconButton>
            </div>
            {children}
          </div>
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line-subtle" style={safeArea}>
            <div className="px-6 py-4">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
