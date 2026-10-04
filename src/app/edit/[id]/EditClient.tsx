'use client';

import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { LogOut, Trash2 } from 'lucide-react';
import { deleteHabit, leaveHabit, setHabitAiContext, setHabitCategory, updateHabit } from '../../actions/db';
import HabitEditor, { type HabitDraft, type RemoveAction } from '@/components/HabitEditor';
import { parseHabitSchema } from '@/components/widgets/habitForm';
import { parseCadence } from '@/lib/cadence';
import type { CategoryOption, HabitDetail } from '@/lib/types';
import type { Person } from '@/lib/userColors';

// A habit's edit page, below its header: the full editor for its owner, or for someone it's shared
// with, just their own category and notes for AI. Saving goes back to the habit's page.
export default function EditClient({ habit, owner, categories }: { habit: HabitDetail; owner: Person | undefined; categories: CategoryOption[] }) {
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
  };

  const handleSave = async (draft: HabitDraft) => {
    if (habit.isOwner) {
      await updateHabit(habit.id, draft.title, draft.description, draft.schema, draft.categoryId, draft.cadence, draft.publishToMqtt, draft.aiContext);
    } else {
      // All someone it's shared with can change
      if (draft.categoryId !== initial.categoryId) await setHabitCategory(habit.id, draft.categoryId || null);
      if (draft.aiContext.trim() !== initial.aiContext) await setHabitAiContext(habit.id, draft.aiContext);
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
        icon: <LogOut className="w-4 h-4" />,
        confirmTitle: 'Remove Shared Habit',
        confirmMessage: `Remove "${habit.name}" from your habits? You'll stop seeing it, but the entries you logged stay in its history. ${owner?.name ?? 'The owner'} can share it with you again.`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await leaveHabit(habit.id);
          router.push('/');
        },
      };

  return (
    <HabitEditor mode={habit.isOwner ? 'edit' : 'shared'} initial={initial} owner={owner} onSave={handleSave} remove={remove} categories={categories} />
  );
}
