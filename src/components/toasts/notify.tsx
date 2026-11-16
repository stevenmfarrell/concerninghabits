'use client';

import toast, { type DefaultToastOptions, type Renderable, type Toast } from 'react-hot-toast';
import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteEntry, unskip } from '@/lib/offline/actions';
import { SkipIcon, type SkipTarget } from '@/components/logging/skipping';
import { fieldTitle } from '@/components/widgets/habitForm';
import { formatLogValue } from '@/lib/format';
import type { FieldSchema } from '@/lib/formFields';

// The app's toasts. Everyday ones (a saved setting, a failure) are react-hot-toast's own
// `toast.success` and `toast.error`, timed by TOAST_OPTIONS; the ones with more to them, an entry
// logged or a habit skipped with its Undo, something kept to send once back online, are here.
// AppToaster draws them all.

// How long each kind stays up, all in one place
export const TOAST_DURATIONS = {
  // A setting saved, a link copied, something kept offline
  info: 4000,
  // Something that went wrong, read more slowly
  error: 5000,
  // An entry logged or a habit skipped, with its Undo
  undoable: 5000,
  // An entry filled in by AI (from what was said, typed or photographed), with time to check it
  undoableAutomatic: 7000,
} as const;

// react-hot-toast's defaults, for the toasts called straight from it. A loading toast stays until
// it's replaced by what came of it (the toast it led to takes its id), so whatever shows one must
// replace or dismiss it on every path. Colors are the theme's (see globals.css), so toasts follow
// light and dark mode.
export const TOAST_OPTIONS: DefaultToastOptions = {
  duration: TOAST_DURATIONS.info,
  // Others (e.g. errors) keep react-hot-toast's white card, as the theme's surface
  style: {
    background: 'var(--surface)',
    color: 'var(--ink)',
  },
  success: {
    style: {
      background: 'var(--inverse)',
      color: 'var(--on-inverse)',
      fontWeight: '500',
    },
    iconTheme: {
      primary: 'var(--accent)',
      secondary: 'var(--on-accent)',
    },
  },
  error: { duration: TOAST_DURATIONS.error },
  loading: { duration: Infinity },
};

// Logged and skipped toasts share one slot: a new one replaces the last rather than stacking on it,
// so logging down a list leaves one toast at the bottom rather than a growing pile. Only the latest
// can be undone from its toast; an earlier entry is still in its habit's Entries.
const UNDO_TOAST_ID = 'undo';

export interface LoggedEntry {
  habitId: string;
  habitName: string;
  logId: string;
  data: Record<string, unknown>;
  schemaProperties: Record<string, FieldSchema> | undefined;
  // How the entry was made when it wasn't typed in by hand, e.g. `From “ran a mile”`. Its presence
  // marks an automatic entry, which stays up longer so there's time to check it.
  source?: string;
  // When it was done, when that isn't now (e.g. a backdated entry)
  loggedAt?: Date;
  // Kept on this device to send once back online (see src/lib/offline), rather than logged yet
  queued?: boolean;
}

// What a toast says about something kept to send once back online
const QUEUED_DETAIL = 'Saved on this device · syncs when you\'re back online';

// An entry's values on one line, e.g. "Distance 3.1 miles · Time 28m", cut short by the toast if
// it's too long, so a toast is the same height however many fields there are
export function summarizeValues(data: Record<string, unknown>, properties: Record<string, FieldSchema> | undefined) {
  return Object.entries(data)
    .filter(([, val]) => val !== undefined && val !== null && val !== '')
    .map(([key, val]) => `${fieldTitle(key, properties)} ${formatLogValue(val, properties?.[key])}`)
    .join(' · ');
}

// The day a backdated entry was logged on, for its toast, e.g. "For yesterday" or "For Sat, Oct 10".
// Nothing for one logged today.
export function loggedOn(loggedAt: Date | undefined, today = new Date()) {
  if (!loggedAt) return '';
  const day = new Date(loggedAt);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return '';
  if (day.toDateString() === yesterday.toDateString()) return 'For yesterday';
  return `For ${day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(day.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })}`;
}

export const notify = {
  // Shows `card` (a ToastCard) in the undo slot, replacing whatever was there, and `replaces` (e.g.
  // the "AI is filling in..." toast that led to it). `automatic` is for an entry filled in by AI,
  // which stays up longer. Also the tutorial's, for its made-up logs and skips.
  undoable(card: (t: Toast) => Renderable, { automatic = false, replaces }: { automatic?: boolean; replaces?: string } = {}) {
    if (replaces && replaces !== UNDO_TOAST_ID) toast.dismiss(replaces);
    toast.custom(card, { id: UNDO_TOAST_ID, duration: automatic ? TOAST_DURATIONS.undoableAutomatic : TOAST_DURATIONS.undoable });
  },

  // Confirms a just-logged entry, with what was logged and an Undo. Doesn't block or move the page:
  // logging happens in place, so the user stays where they logged from. Undo deletes the entry and
  // calls `onUndone`, e.g. for a form to take the entry's values back, ready to correct and log again.
  logged(entry: LoggedEntry, { onUndone, replaces }: { onUndone?: () => void; replaces?: string } = {}) {
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
    const detail = [loggedOn(entry.loggedAt), entry.queued ? (entry.source ? `${entry.source} · saved offline` : QUEUED_DETAIL) : entry.source];

    notify.undoable(t => (
      <ToastCard
        t={t}
        icon={<Check className="w-5 h-5" strokeWidth={3} />}
        iconClassName="bg-accent text-on-accent"
        title={`${entry.habitName} logged`}
        summary={summarizeValues(entry.data, entry.schemaProperties) || undefined}
        detail={detail.filter(Boolean).join(' · ') || undefined}
        onUndo={() => undo(t)}
      />
    ), { automatic: !!entry.source, replaces });
  },

  // Confirms a habit or category just skipped (e.g. swiped away on the Agenda), with an Undo that
  // takes the skip back. `label` says what was skipped, e.g. "Skipped today" or "Postponed 2 days";
  // `day` is the skip's (see skipToday). `postpones` is for a skip that puts it off (see postpones).
  skipped({ target, label, day, postpones = false, queued = false }: { target: SkipTarget; label: string; day: string; postpones?: boolean; queued?: boolean }) {
    const undo = async (t: Toast) => {
      toast.dismiss(t.id);
      try {
        await unskip(target, day);
        toast.success(postpones ? 'Postponement undone.' : 'Skip undone.');
      } catch (err) {
        toast.error(`Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    notify.undoable(t => (
      <ToastCard
        t={t}
        icon={<SkipIcon postpones={postpones} className="w-4 h-4" />}
        iconClassName="bg-on-inverse/15 text-on-inverse"
        title={target.name}
        detail={queued ? `${label} · saved offline` : label}
        onUndo={() => undo(t)}
      />
    ));
  },

  // Something said or typed, kept to fill in and log once back online (see src/lib/offline), e.g.
  // `“ran a mile” will be filled in and logged once you're back online`
  queued(message: string, { replaces }: { replaces?: string } = {}) {
    toast(message, { id: replaces, icon: '📴' });
  },

  // A toast that stays while something's under way (e.g. "AI is filling in your entry..."), for
  // what comes of it to replace by passing its id as `replaces` or `{ id }`
  progress(message: string) {
    return toast.loading(message);
  },
};

// A logged or skipped toast's card. Also the tutorial's, for its made-up logs and skips.
export function ToastCard({ t, icon, iconClassName, title, summary, detail, onUndo }: {
  t: Toast;
  icon: ReactNode;
  iconClassName: string;
  title: string;
  // What was logged, on one line (see summarizeValues)
  summary?: string;
  // Where it came from or when it's for, e.g. `From “ran a mile”`
  detail?: string;
  onUndo: () => void;
}) {
  return (
    <div
      role="status"
      className={`w-[min(26rem,calc(100vw-2rem))] bg-inverse text-on-inverse rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 transition-all duration-200 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClassName}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{title}</p>
        {summary && <p className="text-sm text-on-inverse/85 truncate">{summary}</p>}
        {detail && <p className="text-sm text-on-inverse/60 truncate">{detail}</p>}
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
