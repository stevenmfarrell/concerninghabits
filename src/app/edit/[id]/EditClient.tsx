'use client';

import { updateHabit, deleteHabit } from '../../actions/db';
import HabitEditor from '../../../components/HabitEditor';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { HabitDetail, HabitSchema } from '@/lib/types';

export default function EditClient({ habit }: { habit: HabitDetail }) {
  const router = useRouter();

  const handleSave = async (title: string, description: string, schema: HabitSchema, categoryId: string, frequency: string, publishToMqtt: boolean, aiContext: string) => {
    const saveToast = toast.loading("Saving changes...");
    await updateHabit(habit.id, title, description, schema, categoryId, frequency, publishToMqtt, aiContext);
    toast.success("Changes saved!", { id: saveToast });
    router.push('/');
  };

  const handleDelete = async () => {
    try {
      await deleteHabit(habit.id);
      router.push('/');
    } catch (e) {
      toast.error("Failed to delete habit: " + (e instanceof Error ? e.message : 'Unknown error'));
      throw e; // prevent unloading loading state if it failed
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-stone-900">Edit Habit</h1>
          <p className="text-stone-600">Update your habit&apos;s form, category, or cadence.</p>
        </div>
      </div>

      <HabitEditor
        initialTitle={habit.name}
        initialDescription={habit.description || ''}
        initialSchema={JSON.parse(habit.schema)}
        initialFrequency={habit.frequency || 'daily'}
        initialCategoryId={habit.categoryId || ''}
        initialPublishToMqtt={habit.publishToMqtt}
        initialAiContext={habit.aiContext || ''}
        onSave={handleSave}
        onDelete={handleDelete}
        deleteWarning={habit.memberIds.length > 1 ? "It's shared, so it will also be deleted for everyone it's shared with, along with their entries." : undefined}
      />
    </div>
  );
}
