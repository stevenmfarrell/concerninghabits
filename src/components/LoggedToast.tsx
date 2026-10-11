'use client';

import toast, { type Toast } from 'react-hot-toast';
import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteEntry, unskip } from '@/lib/offline/actions';
import { SkipIcon, type SkipTarget } from '@/components/logging/skipping';
import { fieldTitle } from '@/components/widgets/habitForm';
import { formatLogValue } from '@/lib/format';
import type { FieldSchema } from '@/lib/formFields';

export interface LoggedEntry {
  habitId: string;
  habitName: string;
  logId: string;
  data: Record<string, unknown>;
  schemaProperties: Record<string, FieldSchema> | undefined;
  // How the entry was made when it wasn't typed in by hand, e.g. `From “ran a mile”`. Its presence
  // marks an automatic entry, which stays up longer so there's time to check it.
  source?: string;
  // Kept on this device to send once back online (see src/lib/offline), rather than logged yet
  queued?: boolean;
}

// What a toast says about something kept to send once back online
export const QUEUED_DETAIL = 'Saved on this device · syncs when you\'re back online';

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
      await deleteEntry(entry.logId, { id: entry.habitId, name: entry.habitName });
      onUndone?.();
      toast.success(onUndone ? 'Entry undone. Edit it and log again.' : 'Entry undone.');
    } catch (err) {
      toast.error(`Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const fields = Object.entries(entry.data).filter(([, val]) => val !== undefined && val !== null && val !== '');
  const listed = fields.slice(0, MAX_LISTED_FIELDS);
  // One line per field, so a long value (e.g. a note) is cut short on its own line rather than
  // pushing the fields after it out of the toast
  const values = listed.map(([key, val]) => `${fieldTitle(key, entry.schemaProperties)} ${formatLogValue(val, entry.schemaProperties?.[key])}`);
  if (fields.length > listed.length) values.push(`+${fields.length - listed.length} more`);

  toast.custom(t => (
    <ToastCard
      t={t}
      icon={<Check className="w-5 h-5" strokeWidth={3} />}
      iconClassName="bg-accent text-on-accent"
      title={`${entry.habitName} logged`}
      detail={entry.queued ? (entry.source ? `${entry.source} · saved offline` : QUEUED_DETAIL) : entry.source}
      values={values}
      onUndo={() => undo(t)}
    />
  ), {
    id: toastId,
    duration: entry.source || entry.queued ? AUTOMATIC_DURATION_MS : MANUAL_DURATION_MS,
  });
}

// Confirms a habit or category just skipped (e.g. swiped away on the Agenda), with an Undo that
// takes the skip back. `label` says what was skipped, e.g. "Skipped today" or "Postponed 2 days";
// `day` is the skip's (see skipToday). `postpones` is for a skip that puts it off (see postpones).
export function showSkippedToast({ target, label, day, postpones = false, queued = false }: { target: SkipTarget; label: string; day: string; postpones?: boolean; queued?: boolean }) {
  const undo = async (t: Toast) => {
    toast.dismiss(t.id);
    try {
      await unskip(target, day);
      toast.success(postpones ? 'Postponement undone.' : 'Skip undone.');
    } catch (err) {
      toast.error(`Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  toast.custom(t => (
    <ToastCard
      t={t}
      icon={<SkipIcon postpones={postpones} className="w-4 h-4" />}
      iconClassName="bg-on-inverse/15 text-on-inverse"
      title={target.name}
      detail={queued ? `${label} · saved offline` : label}
      onUndo={() => undo(t)}
    />
  ), { duration: MANUAL_DURATION_MS });
}

function ToastCard({ t, icon, iconClassName, title, detail, values, onUndo }: {
  t: Toast;
  icon: ReactNode;
  iconClassName: string;
  title: string;
  detail?: string;
  values?: string[];
  onUndo: () => void;
}) {
  return (
    <div
      role="status"
      className={`w-[min(26rem,calc(100vw-2rem))] bg-inverse text-on-inverse rounded-2xl shadow-lg p-4 flex items-start gap-3 transition-all duration-200 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClassName}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 space-y-1 self-center">
        <p className="font-semibold truncate">{title}</p>
        {detail && <p className="text-sm text-on-inverse/60 truncate">{detail}</p>}
        {values?.map((line, i) => <p key={i} className="text-sm text-on-inverse/85 truncate">{line}</p>)}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="inverse" size="sm" onClick={onUndo}>
          Undo
        </Button>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="p-1.5 rounded-full text-on-inverse/60 hover:text-on-inverse hover:bg-on-inverse/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
