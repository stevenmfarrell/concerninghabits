'use client';

import { updateHabit, deleteHabit } from '../../actions/db';
import HabitEditor from '../../../components/HabitEditor';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditClient({ habit }: { habit: any }) {
  const router = useRouter();

  const handleSave = async (title: string, description: string, schema: any, categoryId: string, frequency: string) => {
    await updateHabit(habit.id, title, description, schema, categoryId, frequency);
    router.push('/');
  };

  const handleDelete = async () => {
    try {
      await deleteHabit(habit.id);
      router.push('/');
    } catch (e: any) {
      toast.error("Failed to delete habit: " + e.message);
      throw e; // prevent unloading loading state if it failed
    }
  };

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-stone-900">Edit Habit</h1>
            <p className="text-stone-600">Update your habit's form, category, or cadence.</p>
          </div>
        </div>

        <HabitEditor
          initialTitle={habit.name}
          initialDescription={habit.description || ''}
          initialSchema={JSON.parse(habit.schema)}
          initialFrequency={habit.frequency || 'daily'}
          initialCategoryId={habit.categoryId || ''}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </div>
    </main>
  );
}
