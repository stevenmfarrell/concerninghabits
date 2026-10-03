'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';

// A pane that slides up from the bottom over the page, with a title, optional buttons beside it,
// and a close button. Tapping the backdrop closes it too. Used for a habit's entry form (see
// LogEntrySheet) and the editor's form preview.
export default function BottomSheet({ title, ariaLabel, headerActions, onClose, children }: {
  title: ReactNode;
  // For screen readers, when `title` alone doesn't say what the pane is for
  ariaLabel?: string;
  headerActions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    // Above the bottom nav (z-50), which would otherwise cover the bottom of the sheet on phones
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        className="bg-white rounded-t-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="flex-1 min-w-0 text-xl font-bold text-stone-900 truncate">{title}</h2>
            {headerActions}
            <IconButton onClick={onClose} edge="right" title="Close">
              <X className="w-6 h-6" />
            </IconButton>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
