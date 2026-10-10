'use client';

import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { INPUT_SM } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PANE_INSET } from '@/components/Pane';
import { clockTimeOf, describeReminder, formatDayMinute, nudgeTime, type ReminderStatus } from '@/lib/reminders';
import { PUSH_UNAVAILABLE, usePushSubscription } from './usePushSubscription';

// The user's own reminder for a habit, as the editor's draft holds it: on or off, and the time
// they set, if any ("HH:MM")
export interface ReminderDraft {
  enabled: boolean;
  remindAt: string | null;
}

// A reminder as the editor first shows it: on only if it's actually being sent, so one paused for
// going unanswered shows as off, and turning it on (and saving) resumes it
export const reminderDraftOf = (status: ReminderStatus): ReminderDraft => ({ enabled: status.enabled && !status.muted, remindAt: status.remindAt });

// The status to describe for a draft: the saved one (still paused, if it is) until it's changed
function draftStatus(status: ReminderStatus, draft: ReminderDraft): ReminderStatus {
  if (draft.enabled) return { ...status, enabled: true, muted: false, remindAt: draft.remindAt };
  return status.muted && status.enabled ? status : { ...status, enabled: false };
}

// When a reminder that's on nudges, e.g. "7 PM" or "9:49 PM"
export function reminderTime(status: ReminderStatus, bedtime: string) {
  return formatDayMinute(nudgeTime(status.remindAt, status.learned, bedtime).at, bedtime).replace(':00 ', ' ');
}

// The folded section's one-line summary of a reminder
export function reminderSummary(status: ReminderStatus, draft: ReminderDraft, bedtime: string) {
  const shown = draftStatus(status, draft);
  if (shown.muted) return 'Paused';
  if (!shown.enabled) return 'Off';
  return `Nudge by ${reminderTime(shown, bedtime)}`;
}

type ReminderMode = 'off' | 'usual' | 'set';

const MODES: { value: ReminderMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'usual', label: 'Usual time' },
  { value: 'set', label: 'Set time' },
];

const modeOf = (draft: ReminderDraft): ReminderMode => (!draft.enabled ? 'off' : draft.remindAt ? 'set' : 'usual');

// The reminder's settings: off, by when it's usually logged, or at a time the user picks, with a
// line on what that'll do. Changes go to `onChange`, for the habit editor's draft or the habit page's
// dialog to save. Each member of a shared habit has their own. A row of a pane's list by default;
// `inDialog` lays it out for a dialog instead.
//
// A reminder is no use without a device to get it on, so turning one on also turns on reminders for
// this device (the browser asks to allow notifications), unless it already gets them. That's done
// on the tap itself, since browsers (iOS's especially) only ask for permission in answer to one.
// `hasDevice` is whether any of the user's devices get reminders, which may be other than this one.
export default function ReminderSettings({ status, draft, onChange, bedtime, hasDevice, disabled, inDialog = false }: {
  status: ReminderStatus;
  draft: ReminderDraft;
  onChange: (draft: ReminderDraft) => void;
  bedtime: string;
  hasDevice: boolean;
  disabled?: boolean;
  inDialog?: boolean;
}) {
  const shown = draftStatus(status, draft);
  const mode = modeOf(draft);
  const push = usePushSubscription();

  const turnOnDevice = () => {
    push.enable().catch(err => toast.error(`Couldn't turn on reminders for this device: ${err instanceof Error ? err.message : 'Unknown error'}`));
  };

  const choose = (next: ReminderMode) => {
    if (next !== 'off' && !draft.enabled && push.state === 'off') turnOnDevice();
    if (next === 'off') onChange({ enabled: false, remindAt: draft.remindAt });
    else if (next === 'usual') onChange({ enabled: true, remindAt: null });
    // Starting from when it would nudge by its usual time, so there's always a time to adjust
    else onChange({ enabled: true, remindAt: draft.remindAt ?? clockTimeOf(nudgeTime(null, status.learned, bedtime).at, bedtime) });
  };

  return (
    <div className={`${inDialog ? '' : PANE_INSET + ' py-3'} space-y-3 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <SegmentedControl size="md" label="Reminder" options={MODES} value={mode} onChange={choose} />
      {mode === 'set' && (
        <input
          type="time"
          aria-label="Remind at"
          value={draft.remindAt ?? ''}
          // Cleared (some browsers allow it), it goes back to the usual time
          onChange={e => onChange({ enabled: true, remindAt: e.target.value || null })}
          className={`${INPUT_SM} w-40`}
          disabled={disabled}
        />
      )}
      <p className="text-sm text-ink-muted">{describeReminder(shown, bedtime)}</p>
      {draft.enabled && <DeviceStatus push={push} hasDevice={hasDevice} onTurnOn={turnOnDevice} />}
    </div>
  );
}

// Whether this device will get the reminder, and if not, a button to turn it on, or why it can't
function DeviceStatus({ push, hasDevice, onTurnOn }: { push: ReturnType<typeof usePushSubscription>; hasDevice: boolean; onTurnOn: () => void }) {
  const others = hasDevice ? ' Your other devices still get reminders.' : '';
  if (push.state === 'loading') return null;
  if (push.state === 'on') return <p className="text-sm text-ink-muted">This device gets reminders.</p>;
  if (push.state === 'off') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-ink-muted">This device doesn&apos;t get reminders yet.{others}</p>
        <Button variant="outline" size="sm" onClick={onTurnOn} disabled={push.busy}>
          {push.busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Turn On Here
        </Button>
      </div>
    );
  }
  return <p className="text-sm text-ink-muted">{PUSH_UNAVAILABLE[push.state]}{others}</p>;
}
