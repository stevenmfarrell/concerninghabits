'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { logHabitEvent } from '@/app/actions/db';
import { showLoggedToast } from '@/components/LoggedToast';
import { parseHabitSchema, type HabitFormProperties } from '@/components/widgets/habitForm';
import { requestReopen, subscribeReopen, takeReopen } from './pendingReopen';

// What logging needs to know about a habit. `aiContext` is the viewer's own notes on it, for
// voice and photo logging.
export interface LoggableHabit {
  id: string;
  name: string;
  schema: string;
  aiContext?: string | null;
}

export interface LogOptions {
  createdAt?: Date;
  // How an automatic entry was made, for the logged toast, e.g. `From “ran a mile”`
  source?: string;
  // A loading toast for the logged toast to replace
  toastId?: string;
}

// The one way an entry gets logged from a habit's Log button, on its page or in a list row:
// a habit with no form is logged on the tap; one with a form opens the entry sheet (see
// LogEntrySheet) to fill in. Either way it happens in place, confirmed by the logged toast with an
// Undo. Undoing an entry with a form reopens the sheet with its values, to correct and log again
// (see pendingReopen).
export function useHabitLogger(habit: LoggableHabit, { initialData = {}, onLogged }: {
  initialData?: Record<string, unknown>;
  onLogged?: () => void;
} = {}) {
  const schema = parseHabitSchema(habit.schema);
  const properties = schema.properties as HabitFormProperties | undefined;
  const hasForm = Object.keys(properties ?? {}).length > 0;

  const [formData, setFormData] = useState<Record<string, unknown>>(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Whether the sheet opened straight to picking a custom date, e.g. to backdate a habit with no form
  const [sheetBackdate, setSheetBackdate] = useState(false);
  const [busy, setBusy] = useState(false);

  // An undone entry for this habit, put back in the sheet to correct and log again: one waiting
  // when this Log button appears (e.g. a habit restored from the Due page's done chips), or arriving while
  // it's showing
  useEffect(() => {
    const reopen = () => {
      const data = takeReopen(habit.id);
      if (!data) return;
      setFormData(data);
      setSheetBackdate(false);
      setSheetOpen(true);
    };
    reopen();
    return subscribeReopen(reopen);
  }, [habit.id]);

  const isComplete = (data: Record<string, unknown>) =>
    (schema.required ?? []).every(field => data[field] !== undefined && data[field] !== null && data[field] !== '');

  const logEntry = async (data: Record<string, unknown>, { createdAt, source, toastId }: LogOptions = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      const log = await logHabitEvent(habit.id, data, createdAt);
      showLoggedToast(
        { habitId: habit.id, habitName: habit.name, logId: log.id, data, schemaProperties: properties, source },
        {
          toastId,
          // Through pendingReopen rather than this hook's own state: logging may have unmounted it
          onUndone: hasForm ? () => requestReopen(habit.id, data) : undefined,
        },
      );
      setFormData({});
      setSheetOpen(false);
      onLogged?.();
    } catch (err) {
      toast.error(`Failed to log entry: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const openSheet = ({ backdate = false } = {}) => {
    setSheetBackdate(backdate);
    setSheetOpen(true);
  };

  // The Log button: logs a habit with no form straight away, or opens the sheet to fill one in
  const start = () => (hasForm ? openSheet() : logEntry({}));

  // Values filled in by AI (from voice, a photo, or something said on the dashboard): logged
  // straight away when they complete the form, otherwise left in the sheet to finish
  const fillIn = async (data: Record<string, unknown>, source: string, toastId: string) => {
    if (Object.keys(data).length === 0) {
      toast.error('Could not find any relevant data.', { id: toastId });
      return;
    }
    const merged = { ...formData, ...data };
    if (isComplete(merged)) {
      await logEntry(merged, { source, toastId });
    } else {
      setFormData(merged);
      openSheet();
      toast.success('Form partially filled by AI. Please complete missing fields.', { id: toastId });
    }
  };

  return {
    habit,
    schema,
    properties,
    hasForm,
    formData,
    setFormData,
    sheetOpen,
    sheetBackdate,
    openSheet,
    closeSheet: () => setSheetOpen(false),
    busy,
    isComplete,
    logEntry,
    start,
    fillIn,
  };
}

export type HabitLogger = ReturnType<typeof useHabitLogger>;
