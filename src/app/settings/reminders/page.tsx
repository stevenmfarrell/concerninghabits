import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getReminderOverview } from '@/app/actions/reminders';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';
import DeviceReminders from '@/components/reminders/DeviceReminders';
import { describeReminder, IGNORED_LIMIT, MAX_PER_DAY } from '@/lib/reminders';

// Reminders: turning them on for this device, and the habits they're on for, each linking to its
// editor, where they're turned on or off
export default async function RemindersPage() {
  const { habits, bedtime } = await getReminderOverview();

  return (
    <PanePage width="3xl" header={<PageHeader title="Reminders" backHref="/settings" />}>
      <p className={`${PANE_INSET} py-4 text-sm text-ink-muted`}>
        A reminder is only sent when you&apos;re running late on a habit, judged by when you usually log it.
        Habits running late around the same time share one notification, there are never more
        than {MAX_PER_DAY} a day, and a reminder that goes unanswered {IGNORED_LIMIT} days in a row pauses itself.
      </p>

      <PaneSection title="This Device">
        <DeviceReminders />
      </PaneSection>

      <PaneSection title="Habits" empty={habits.length === 0 && 'No reminders yet. Turn one on in a habit’s Edit Habit, under More settings.'}>
        {habits.map(habit => (
          <Link key={habit.id} href={`/edit/${habit.id}`} className={`flex items-center justify-between gap-3 ${PANE_INSET} py-3 hover:bg-surface-subtle transition-colors group`}>
            <div className="min-w-0">
              <div className="font-semibold text-ink text-sm truncate">{habit.name}</div>
              <div className="text-xs text-ink-muted">{describeReminder(habit.status, bedtime)}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-subtle group-hover:text-ink-secondary transition-colors shrink-0" />
          </Link>
        ))}
      </PaneSection>
    </PanePage>
  );
}
