'use client';

import toast, { type Toast } from 'react-hot-toast';
import { Check, Undo2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteHabitLog } from '@/app/actions/db';
import { formatLogValue } from '@/lib/format';

type SchemaProperties = Record<string, { title?: string; 'x-widget'?: string; 'x-unit'?: string }> | undefined;

export interface LoggedEntry {
  habitId: string;
  habitName: string;
  logId: string;
  data: Record<string, unknown>;
  schemaProperties: SchemaProperties;
  // How the entry was made when it wasn't typed in by hand, e.g. `From “ran a mile”`. Its presence
  // marks an automatic entry, which stays up longer so there's time to check it.
  source?: string;
}

const MANUAL_DURATION_MS = 6000;
const AUTOMATIC_DURATION_MS = 10000;
// Most fields listed in the toast; the rest are summarized as "+N more"
const MAX_LISTED_FIELDS = 4;

// Confirms a just-logged entry, with what was logged and an Undo. Doesn't block or move the page:
// logging happens in place, so the user stays where they logged from. Undo deletes the entry and
// calls `onUndone`, e.g. for a form to take the entry's values back, ready to correct and log again.
// Replaces `toastId` when given, e.g. the "AI is processing..." toast that led to this entry.
export function showLoggedToast(entry: LoggedEntry, { onUndone, toastId }: { onUndone?: () => void; toastId?: string } = {}) {
  const undo = async (t: Toast) => {
    toast.dismiss(t.id);
    try {
      await deleteHabitLog(entry.logId, entry.habitId);
      onUndone?.();
      toast.success(onUndone ? 'Entry undone. Edit it and log again.' : 'Entry undone.');
    } catch (err) {
      toast.error(`Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const fields = Object.entries(entry.data).filter(([, val]) => val !== undefined && val !== null && val !== '');
  const listed = fields.slice(0, MAX_LISTED_FIELDS);
  const values = listed.length > 0
    ? listed.map(([key, val]) => `${entry.schemaProperties?.[key]?.title || key} ${formatLogValue(val, entry.schemaProperties?.[key])}`).join(' · ')
      + (fields.length > listed.length ? ` · +${fields.length - listed.length} more` : '')
    : null;

  toast.custom(t => (
    <ToastCard
      t={t}
      icon={<Check className="w-5 h-5" strokeWidth={3} />}
      iconClassName="bg-emerald-500"
      title={`${entry.habitName} logged`}
      detail={entry.source}
      values={values}
      onUndo={() => undo(t)}
    />
  ), {
    id: toastId,
    duration: entry.source ? AUTOMATIC_DURATION_MS : MANUAL_DURATION_MS,
  });
}

// Confirms a removed entry, with an Undo that restores it (e.g. turning a chip off in Log the day)
export function showRemovedToast(habitName: string, onUndo: () => Promise<void>) {
  toast.custom(t => (
    <ToastCard
      t={t}
      icon={<Undo2 className="w-4 h-4" strokeWidth={2.5} />}
      iconClassName="bg-stone-600"
      title={`${habitName} removed`}
      onUndo={async () => {
        toast.dismiss(t.id);
        try {
          await onUndo();
        } catch (err) {
          toast.error(`Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }}
    />
  ), { duration: MANUAL_DURATION_MS });
}

function ToastCard({ t, icon, iconClassName, title, detail, values, onUndo }: {
  t: Toast;
  icon: ReactNode;
  iconClassName: string;
  title: string;
  detail?: string;
  values?: string | null;
  onUndo: () => void;
}) {
  return (
    <div
      role="status"
      className={`w-[min(26rem,calc(100vw-2rem))] bg-stone-900 text-white rounded-2xl shadow-lg p-4 flex items-start gap-3 transition-all duration-200 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClassName}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 space-y-1 self-center">
        <p className="font-semibold truncate">{title}</p>
        {detail && <p className="text-sm text-stone-400 truncate">{detail}</p>}
        {values && <p className="text-sm text-stone-200">{values}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="inverse" size="sm" onClick={onUndo}>
          Undo
        </Button>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
