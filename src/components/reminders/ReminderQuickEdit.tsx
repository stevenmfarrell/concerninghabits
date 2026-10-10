'use client';

import { useState } from 'react';
import { AlarmClock, AlarmClockOff } from 'lucide-react';
import { PILL } from '@/components/CadenceQuickEdit';
import QuickEditDialog from '@/components/QuickEditDialog';
import type { ReminderStatus } from '@/lib/reminders';
import ReminderSettings, { reminderDraftOf, reminderTime, type ReminderDraft } from './ReminderSettings';

// The viewer's reminder for a habit as a pill beside its category and cadence (e.g. "7 PM", or
// "Off"), opening a dialog to change it. Saved on the spot by `onSave`, like the other pills.
export default function ReminderQuickEdit({ status, bedtime, hasDevice, onSave }: {
  status: ReminderStatus;
  bedtime: string;
  hasDevice: boolean;
  onSave: (draft: ReminderDraft) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const active = status.enabled && !status.muted;
  const label = active ? reminderTime(status, bedtime) : status.enabled ? 'Paused' : 'Off';
  const Icon = active ? AlarmClock : AlarmClockOff;

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${PILL} bg-surface border-line ${active ? 'text-ink-secondary' : 'text-ink-muted'} hover:bg-surface-subtle`}
        title="Change reminder"
      >
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </button>
      {editing && <ReminderDialog status={status} bedtime={bedtime} hasDevice={hasDevice} onSave={onSave} onClose={() => setEditing(false)} />}
    </>
  );
}

function ReminderDialog({ status, bedtime, hasDevice, onSave, onClose }: {
  status: ReminderStatus;
  bedtime: string;
  hasDevice: boolean;
  onSave: (draft: ReminderDraft) => Promise<void>;
  onClose: () => void;
}) {
  const initial = reminderDraftOf(status);
  const [draft, setDraft] = useState(initial);

  return (
    <QuickEditDialog
      title="Reminder"
      canSave={JSON.stringify(draft) !== JSON.stringify(initial)}
      onSave={() => onSave(draft)}
      onClose={onClose}
    >
      <ReminderSettings status={status} draft={draft} onChange={setDraft} bedtime={bedtime} hasDevice={hasDevice} inDialog />
    </QuickEditDialog>
  );
}
