'use client';

import toast, { type Toast } from 'react-hot-toast';
import { CalendarChevronsRight, Check, SkipForward, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteHabitLog, unskipHabit } from '@/app/actions/db';
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
  // One line per field, so a long value (e.g. a note) is cut short on its own line rather than
  // pushing the fields after it out of the toast
  const values = listed.map(([key, val]) => `${entry.schemaProperties?.[key]?.title || key} ${formatLogValue(val, entry.schemaProperties?.[key])}`);
  if (fields.length > listed.length) values.push(`+${fields.length - listed.length} more`);

  toast.custom(t => (
    <ToastCard
      t={t}
      icon={<Check className="w-5 h-5" strokeWidth={3} />}
      iconClassName="bg-accent text-on-accent"
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

// Confirms a habit just skipped (e.g. swiped away on the Agenda), with an Undo that takes the skip
// back. `label` says what was skipped, e.g. "Skipped today" or "Postponed 2 days"; `day` is the
// skip's (see skipHabit). `postpones` is for a skip that puts the habit off (see postpones).
export function showSkippedToast({ habitId, habitName, label, day, postpones = false }: { habitId: string; habitName: string; label: string; day: string; postpones?: boolean }) {
  const undo = async (t: Toast) => {
    toast.dismiss(t.id);
    try {
      await unskipHabit(habitId, day);
      toast.success(postpones ? 'Postponement undone.' : 'Skip undone.');
    } catch (err) {
      toast.error(`Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  toast.custom(t => (
    <ToastCard
      t={t}
      icon={postpones ? <CalendarChevronsRight className="w-4 h-4" strokeWidth={2.5} /> : <SkipForward className="w-4 h-4" strokeWidth={2.5} />}
      iconClassName="bg-on-inverse/15 text-on-inverse"
      title={habitName}
      detail={label}
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
