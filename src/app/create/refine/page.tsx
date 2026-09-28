'use client';

import { useState, useEffect } from 'react';
import { saveHabit } from '../../actions/db';
import HabitEditor from '../../../components/HabitEditor';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import BackLink from '@/components/BackLink';
import type { HabitSchema } from '@/lib/types';

interface HabitDraft {
  schema: HabitSchema;
  frequency?: string;
  categoryId?: string;
}

// Read lazily since sessionStorage isn't available on the server.
function readDraft(): HabitDraft | null {
  if (typeof window === 'undefined') return null;
  const draftData = sessionStorage.getItem('draftHabit');
  return draftData ? JSON.parse(draftData) : null;
}

export default function RefineHabit() {
  const router = useRouter();

  const [draft] = useState<HabitDraft | null>(readDraft);

  useEffect(() => {
    if (!draft) router.replace('/create');
  }, [draft, router]);

  const handleSave = async (title: string, description: string, schema: HabitSchema, categoryId: string, frequency: string, publishToMqtt: boolean) => {
    await saveHabit(title, description, schema, categoryId, frequency, publishToMqtt);
    sessionStorage.removeItem('draftHabit');
    router.push('/');
  };

  const handleTitleChange = (title: string) => {
    const currentDraft: Partial<HabitDraft> = JSON.parse(sessionStorage.getItem('draftHabit') || '{}');
    if (currentDraft.schema) currentDraft.schema.title = title;
    sessionStorage.setItem('draftHabit', JSON.stringify(currentDraft));
  };

  if (!draft) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>;
  }

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <BackLink href="/create">Back to Goal</BackLink>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-stone-900">Almost there...</h1>
            <p className="text-stone-600">Here is the draft we created. Make any updates and save when you&apos;re ready.</p>
          </div>
        </div>

        <HabitEditor
          initialTitle={draft.schema?.title || ''}
          initialDescription={draft.schema?.description || ''}
          initialSchema={draft.schema}
          initialFrequency={draft.frequency || 'daily'}
          initialCategoryId={draft.categoryId || ''}
          isCreateMode={true}
          onSave={handleSave}
          onChangeTitle={handleTitleChange}
        />
      </div>
    </main>
  );
}
