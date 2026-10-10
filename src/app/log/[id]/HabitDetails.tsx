'use client';

import toast from 'react-hot-toast';
import { setHabitCadence, setHabitCategory } from '../../actions/db';
import { setHabitReminder } from '../../actions/reminders';
import type { ReminderStatus } from '@/lib/reminders';
import CadenceQuickEdit from '@/components/CadenceQuickEdit';
import CategoryQuickEdit from '@/components/CategoryQuickEdit';
import HealthHeader from '@/components/HealthPlant';
import SkipButton from '@/components/SkipButton';
import type { Consistency } from '@/lib/consistency';
import { parseCadence, type SkipState } from '@/lib/cadence';
import type { CategoryOption, HabitDetail } from '@/lib/types';

// A habit's category and cadence, under its name on its page, each changeable on the spot, beside its
// health (see HealthHeader): its category over its cadence, with skipping it (`skip`, see SkipButton)
// beside its cadence while it's due. The viewer's reminder is changed in its cadence's dialog (see
// CadenceQuickEdit). Any member can file the habit in their own categories, set their own reminder
// and skip it; only the owner can change its cadence, which is the same for everyone it's shared with.
// `bedtime` and `weekStartsOn` are the viewer's.
export default function HabitDetails({ habit, categories, reminder, consistency, skip, postpones, bedtime, weekStartsOn }: {
  habit: HabitDetail;
  categories: CategoryOption[];
  reminder: { status: ReminderStatus; hasDevice: boolean } | null;
  consistency: Consistency | null;
  skip: SkipState | null;
  postpones: boolean;
  bedtime: string;
  weekStartsOn: string;
}) {
  const cadence = parseCadence(habit.cadence);
  return (
    <HealthHeader
      consistency={consistency}
      noun="Habit"
      top={
        <CategoryQuickEdit
          categoryId={habit.categoryId}
          categories={categories}
          onSave={async categoryId => {
            await setHabitCategory(habit.id, categoryId);
            toast.success('Category changed');
          }}
        />
      }
      bottom={
        <>
          <CadenceQuickEdit
            cadence={cadence}
            weekStartsOn={weekStartsOn}
            onSave={habit.isOwner ? async next => {
              await setHabitCadence(habit.id, next);
              toast.success('Cadence changed');
            } : undefined}
            lockedTitle="Set by the habit's owner"
            reminder={reminder ? {
              ...reminder,
              bedtime,
              onSave: async draft => {
                await setHabitReminder(habit.id, draft.enabled, draft.remindAt);
                toast.success(draft.enabled ? 'Reminder saved' : 'Reminder turned off');
              },
            } : undefined}
          />
          {skip && <SkipButton target={{ kind: 'habit', id: habit.id, name: habit.name }} skip={skip} postpones={postpones} />}
        </>
      }
    />
  );
}
