'use client';

import toast, { type Toast } from 'react-hot-toast';
import { Check, X } from 'lucide-react';
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

// The log page URL with the entry's values as prefill params (see LogClient), so undoing an entry
// reopens the form with what was submitted, ready to correct and log again
function prefillUrl({ habitId, data }: LoggedEntry) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') params.set(key, String(val));
  }
  return params.size ? `/log/${habitId}?${params}` : `/log/${habitId}`;
}

// Confirms a just-logged entry, with what was logged and an Undo. Doesn't block the page, so the
// user can carry on (callers navigate to the habit's history, where the new entry shows). Replaces
// `toastId` when given, e.g. the "AI is processing..." toast that led to this entry.
export function showLoggedToast(entry: LoggedEntry, navigate: (href: string) => void, toastId?: string) {
  const undo = async (t: Toast) => {
    toast.dismiss(t.id);
    try {
      await deleteHabitLog(entry.logId, entry.habitId);
      navigate(prefillUrl(entry));
      toast.success('Entry undone. Edit it and log again.');
    } catch (err) {
      toast.error(`Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  toast.custom(t => <LoggedToastCard t={t} entry={entry} onUndo={() => undo(t)} />, {
    id: toastId,
    duration: entry.source ? AUTOMATIC_DURATION_MS : MANUAL_DURATION_MS,
  });
}

function LoggedToastCard({ t, entry, onUndo }: { t: Toast; entry: LoggedEntry; onUndo: () => void }) {
  const fields = Object.entries(entry.data).filter(([, val]) => val !== undefined && val !== null && val !== '');
  const listed = fields.slice(0, MAX_LISTED_FIELDS);

  return (
    <div
      role="status"
      className={`w-[min(26rem,calc(100vw-2rem))] bg-stone-900 text-white rounded-2xl shadow-lg p-4 flex items-start gap-3 transition-all duration-200 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
        <Check className="w-5 h-5" strokeWidth={3} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-semibold truncate">{entry.habitName} logged</p>
        {entry.source && <p className="text-sm text-stone-400 truncate">{entry.source}</p>}
        {listed.length > 0 && (
          <p className="text-sm text-stone-200">
            {listed.map(([key, val]) => `${entry.schemaProperties?.[key]?.title || key} ${formatLogValue(val, entry.schemaProperties?.[key])}`).join(' · ')}
            {fields.length > listed.length && ` · +${fields.length - listed.length} more`}
          </p>
        )}
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
