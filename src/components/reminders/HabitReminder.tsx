'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { setHabitReminder } from '@/app/actions/reminders';
import { IconButton } from '@/components/ui/IconButton';
import { INPUT_SM } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { PANE_INSET, PaneField, PaneSection } from '@/components/Pane';
import { describeReminder, reminderActive, type ReminderStatus } from '@/lib/reminders';

// A habit's reminder, on its page: a switch, what it'll do (or why it can't yet), and once it's on,
// an optional set time for when learning the usual one isn't wanted or isn't possible. Saved on
// the spot, like the habit's category and cadence. Each member of a shared habit has their own.
export default function HabitReminder({ habitId, status, bedtime, hasDevice }: { habitId: string; status: ReminderStatus; bedtime: string; hasDevice: boolean }) {
  const [saving, setSaving] = useState(false);
  const [time, setTime] = useState(status.remindAt ?? '');
  const active = reminderActive(status);

  const save = async (enabled: boolean, remindAt: string | null) => {
    setSaving(true);
    try {
      await setHabitReminder(habitId, enabled, remindAt);
    } catch (err) {
      toast.error(`Couldn't save the reminder: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTime(status.remindAt ?? '');
    } finally {
      setSaving(false);
    }
  };

  const saveTime = (next: string) => {
    setTime(next);
    if ((next || null) !== status.remindAt) save(true, next || null);
  };

  return (
    <PaneSection title="Reminder">
      <Toggle
        bare
        icon={saving ? <Loader2 className="w-5 h-5 animate-spin" /> : status.muted && status.enabled ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        title="Remind Me When I’m Late"
        description={describeReminder(status, bedtime)}
        checked={active}
        onChange={on => save(on, status.remindAt)}
        disabled={saving}
      />
      {/* Outside the toggle, whose whole row is its label, so tapping the link doesn't flip it */}
      {active && !hasDevice && (
        <p className={`${PANE_INSET} py-3 text-sm text-ink-muted`}>
          None of your devices get reminders yet. Turn them on in{' '}
          <Link href="/settings/reminders" className="text-accent-ink font-medium underline">Settings → Reminders</Link>.
        </p>
      )}
      {active && (
        <PaneField label="Remind At" htmlFor="remind-at" description="Leave empty to go by when you usually log it.">
          <div className="flex items-center gap-2">
            <input
              id="remind-at"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              onBlur={e => saveTime(e.target.value)}
              className={`${INPUT_SM} w-40`}
              disabled={saving}
            />
            {time && (
              <IconButton onClick={() => saveTime('')} title="Go by usual time" aria-label="Go by usual time" disabled={saving}>
                <X className="w-5 h-5" />
              </IconButton>
            )}
          </div>
        </PaneField>
      )}
    </PaneSection>
  );
}
