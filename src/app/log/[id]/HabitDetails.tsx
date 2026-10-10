'use client';

import toast from 'react-hot-toast';
import { setHabitCadence, setHabitCategory } from '../../actions/db';
import { setHabitReminder } from '../../actions/reminders';
import ReminderQuickEdit from '@/components/reminders/ReminderQuickEdit';
import type { ReminderStatus } from '@/lib/reminders';
import CadenceQuickEdit from '@/components/CadenceQuickEdit';
import CategoryQuickEdit from '@/components/CategoryQuickEdit';
import { parseCadence } from '@/lib/cadence';
import type { CategoryOption, HabitDetail } from '@/lib/types';

// A habit's category, cadence and reminder, under its name on its page, each changeable on the spot.
// Any member can file the habit in their own categories and set their own reminder; only the owner
// can change its cadence, which is the same for everyone it's shared with. A habit with no cadence
// is never due, so never late, and has no reminder to show.
export default function HabitDetails({ habit, categories, reminder, bedtime }: {
  habit: HabitDetail;
  categories: CategoryOption[];
  reminder: { status: ReminderStatus; hasDevice: boolean } | null;
  bedtime: string;
}) {
  const cadence = parseCadence(habit.cadence);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <CategoryQuickEdit
        categoryId={habit.categoryId}
        categories={categories}
        onSave={async categoryId => {
          await setHabitCategory(habit.id, categoryId);
          toast.success('Category changed');
        }}
      />
      <CadenceQuickEdit
        cadence={cadence}
        onSave={habit.isOwner ? async next => {
          await setHabitCadence(habit.id, next);
          toast.success('Cadence changed');
        } : undefined}
        lockedTitle="Set by the habit's owner"
      />
      {reminder && cadence.type !== 'none' && (
        <ReminderQuickEdit
          status={reminder.status}
          bedtime={bedtime}
          hasDevice={reminder.hasDevice}
          onSave={async draft => {
            await setHabitReminder(habit.id, draft.enabled, draft.remindAt);
            toast.success(draft.enabled ? 'Reminder saved' : 'Reminder turned off');
          }}
        />
      )}
    </div>
  );
}
