'use client';

import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { UserMinus, Trash2 } from 'lucide-react';
import { deleteHabit, leaveHabit, setHabitAiContext, setHabitCategory, updateHabit } from '../../actions/db';
import { setHabitReminder } from '../../actions/reminders';
import { reminderDraftOf } from '@/components/reminders/ReminderSettings';
import type { ReminderStatus } from '@/lib/reminders';
import HabitEditor, { type HabitDraft, type RemoveAction } from '@/components/HabitEditor';
import { parseHabitSchema } from '@/components/widgets/habitForm';
import { parseCadence } from '@/lib/cadence';
import { parseCalculatedFields } from '@/lib/calculatedFields';
import type { ChartEntry } from '@/lib/charts';
import type { CategoryOption, HabitDetail } from '@/lib/types';
import type { Person } from '@/lib/userColors';

// A habit's edit page, below its header: the full editor for its owner, or for someone it's shared
// with, just their own category and notes for AI. Saving goes back to the habit's page.
// `entries` are the habit's recent entries, to preview a calculated field's values with.
// `reminder` is the viewer's own reminder for it (see getHabitReminder), with their bedtime.
export default function EditClient({ habit, owner, categories, entries, reminder, bedtime }: {
  habit: HabitDetail;
  owner: Person | undefined;
  categories: CategoryOption[];
  entries: ChartEntry[];
  reminder: { status: ReminderStatus; hasDevice: boolean } | null;
  bedtime: string;
}) {
  const router = useRouter();
  const habitHref = `/log/${habit.id}`;

  const initial: HabitDraft = {
    title: habit.name,
    description: habit.description || '',
    schema: parseHabitSchema(habit.schema),
    cadence: parseCadence(habit.cadence),
    categoryId: habit.categoryId || '',
    publishToMqtt: habit.publishToMqtt,
    aiContext: habit.aiContext || '',
    calculatedFields: parseCalculatedFields(habit.calculatedFields),
    reminder: reminder ? reminderDraftOf(reminder.status) : undefined,
  };

  const handleSave = async (draft: HabitDraft) => {
    if (habit.isOwner) {
      await updateHabit(habit.id, draft.title, draft.description, draft.schema, draft.categoryId, draft.cadence, draft.publishToMqtt, draft.aiContext, draft.calculatedFields);
    } else {
      // All someone it's shared with can change
      if (draft.categoryId !== initial.categoryId) await setHabitCategory(habit.id, draft.categoryId || null);
      if (draft.aiContext.trim() !== initial.aiContext) await setHabitAiContext(habit.id, draft.aiContext);
    }
    // Everyone's own, owner or not
    if (draft.reminder && JSON.stringify(draft.reminder) !== JSON.stringify(initial.reminder)) {
      await setHabitReminder(habit.id, draft.reminder.enabled, draft.reminder.remindAt);
    }
    toast.success('Changes saved');
    router.push(habitHref);
  };

  const remove: RemoveAction = habit.isOwner
    ? {
        label: 'Delete Habit',
        icon: <Trash2 className="w-4 h-4" />,
        confirmTitle: 'Delete Habit',
        confirmMessage: `Are you sure you want to delete "${habit.name}"? This will permanently delete all of its history and logs.${
          habit.memberIds.length > 1 ? " It's shared, so it will also be deleted for everyone it's shared with, along with their entries." : ''
        }`,
        confirmText: 'Delete Habit',
        onConfirm: async () => {
          await deleteHabit(habit.id);
          router.push('/');
        },
      }
    : {
        label: 'Remove from My Habits',
        icon: <UserMinus className="w-4 h-4" />,
        confirmTitle: 'Remove Shared Habit',
        confirmMessage: `Remove "${habit.name}" from your habits? You'll stop seeing it, but the entries you logged stay in its history. ${owner?.name ?? 'The owner'} can share it with you again.`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await leaveHabit(habit.id);
          router.push('/');
        },
      };

  return (
    <HabitEditor
      mode={habit.isOwner ? 'edit' : 'shared'}
      initial={initial}
      owner={owner}
      onSave={handleSave}
      remove={remove}
      categories={categories}
      entries={entries}
      reminderContext={reminder ? { ...reminder, bedtime } : undefined}
    />
  );
}
