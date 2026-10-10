'use client';

import { useState } from 'react';
import { AlarmClock, AlarmClockOff, Lock, Repeat } from 'lucide-react';
import { CadencePicker, CadenceSettings } from './CadenceField';
import QuickEditDialog from './QuickEditDialog';
import ReminderSettings, { reminderDraftOf, type ReminderDraft } from './reminders/ReminderSettings';
import { describeCadence, type Cadence } from '@/lib/cadence';
import type { ReminderStatus } from '@/lib/reminders';

export const PILL = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors';

// The viewer's own reminder for a habit, changed in its cadence's dialog (see CadenceQuickEdit):
// each member of a shared habit has their own. Saved on the spot by `onSave`.
export interface CadenceReminder {
  status: ReminderStatus;
  bedtime: string;
  hasDevice: boolean;
  onSave: (draft: ReminderDraft) => Promise<void>;
}

// A cadence as a pill (e.g. "Every 3 days") that opens a dialog to change it, for a habit or a
// category. Without `onSave` it can't be changed, e.g. a shared habit's cadence for someone other than
// its owner, with `lockedTitle` saying why. `saveLabel` names the dialog's button (see
// QuickEditDialog). `weekStartsOn` is the user's, for the days of the week.
//
// On a habit's page, the viewer's `reminder` is changed in the same dialog, under the cadence, so
// it opens even when the cadence can't be changed. The pill shows an alarm clock while a reminder is
// on, a crossed-out one while it's paused for going unanswered, and nothing while it's off.
export default function CadenceQuickEdit({ cadence, weekStartsOn, onSave, lockedTitle, saveLabel, reminder }: {
  cadence: Cadence;
  weekStartsOn: string;
  onSave?: (cadence: Cadence) => Promise<void>;
  lockedTitle?: string;
  saveLabel?: string;
  reminder?: CadenceReminder;
}) {
  const [editing, setEditing] = useState(false);
  const description = describeCadence(cadence, { weekStartsOn });
  // No reminder for one with no cadence: it's never due, so never late
  const reminds = reminder && cadence.type !== 'none' ? reminder : undefined;
  const alarm = reminds?.status.enabled
    ? reminds.status.muted
      ? <AlarmClockOff className="w-4 h-4 shrink-0" aria-label="Reminder paused" />
      : <AlarmClock className="w-4 h-4 shrink-0" aria-label="Reminder on" />
    : null;

  if (!onSave && !reminds) {
    return (
      <span className={`${PILL} bg-surface-subtle border-line-subtle text-ink-muted`} title={lockedTitle}>
        <Repeat className="w-4 h-4 shrink-0" />
        {description}
        <Lock className="w-3 h-3 shrink-0" aria-label={lockedTitle} />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${PILL} bg-surface border-line text-ink-secondary hover:bg-surface-subtle`}
        title={onSave ? (reminds ? 'Change cadence or reminder' : 'Change cadence') : 'Change reminder'}
      >
        <Repeat className="w-4 h-4 shrink-0" />
        {description}
        {alarm}
      </button>
      {editing && (
        <CadenceDialog
          initial={cadence}
          weekStartsOn={weekStartsOn}
          onSave={onSave}
          lockedTitle={lockedTitle}
          saveLabel={saveLabel}
          reminder={reminder}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function CadenceDialog({ initial, weekStartsOn, onSave, lockedTitle, saveLabel, reminder, onClose }: {
  initial: Cadence;
  weekStartsOn: string;
  onSave?: (cadence: Cadence) => Promise<void>;
  lockedTitle?: string;
  saveLabel?: string;
  reminder?: CadenceReminder;
  onClose: () => void;
}) {
  const [cadence, setCadence] = useState(initial);
  const initialReminder = reminder ? reminderDraftOf(reminder.status) : null;
  const [reminderDraft, setReminderDraft] = useState(initialReminder);

  const cadenceChanged = JSON.stringify(cadence) !== JSON.stringify(initial);
  // The reminder goes with the cadence being chosen: none for no cadence
  const showsReminder = !!reminder && !!reminderDraft && cadence.type !== 'none';
  const reminderChanged = showsReminder && JSON.stringify(reminderDraft) !== JSON.stringify(initialReminder);

  return (
    <QuickEditDialog
      title={reminder ? 'Cadence & reminder' : 'Cadence'}
      canSave={cadenceChanged || reminderChanged}
      onSave={async () => {
        if (cadenceChanged) await onSave?.(cadence);
        if (reminderChanged) await reminder!.onSave(reminderDraft!);
      }}
      onClose={onClose}
      saveLabel={saveLabel}
    >
      {onSave ? (
        <>
          <CadencePicker value={cadence} onChange={setCadence} />
          <CadenceSettings value={cadence} onChange={setCadence} weekStartsOn={weekStartsOn} />
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-secondary">
          <Repeat className="w-4 h-4 shrink-0 text-ink-muted" />
          <span>{describeCadence(cadence, { weekStartsOn })}</span>
          {lockedTitle && <span className="inline-flex items-center gap-1 text-ink-muted"><Lock className="w-3 h-3" />{lockedTitle}</span>}
        </p>
      )}
      {showsReminder && (
        <div className="mt-6 pt-5 border-t border-line-subtle">
          <p className="text-sm font-semibold text-ink-secondary mb-2">Reminder</p>
          <ReminderSettings status={reminder.status} draft={reminderDraft} onChange={setReminderDraft} bedtime={reminder.bedtime} hasDevice={reminder.hasDevice} inDialog />
        </div>
      )}
    </QuickEditDialog>
  );
}
