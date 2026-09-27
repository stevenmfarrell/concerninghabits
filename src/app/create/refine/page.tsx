'use client';

import { useState, useEffect } from 'react';
import { saveHabit } from '../../actions/db';
import HabitEditor from '../../../components/HabitEditor';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function RefineHabit() {
  const router = useRouter();
  
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    const draftData = sessionStorage.getItem('draftHabit');
    if (!draftData) {
      router.replace('/create');
      return;
    }
    setDraft(JSON.parse(draftData));
  }, [router]);

  const handleSave = async (title: string, description: string, schema: any, categoryId: string, frequency: string, publishToMqtt: boolean) => {
    await saveHabit(title, description, schema, categoryId, frequency, publishToMqtt);
    sessionStorage.removeItem('draftHabit');
    router.push('/');
  };

  const handleTitleChange = (title: string) => {
    const currentDraft = JSON.parse(sessionStorage.getItem('draftHabit') || '{}');
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
          <Link href="/create" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Goal
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-stone-900">Almost there...</h1>
            <p className="text-stone-600">Here is the draft we created. Make any updates and save when you're ready.</p>
          </div>
        </div>

        <HabitEditor
          initialTitle={draft.schema?.title || ''}
          initialDescription={draft.schema?.description || ''}
          initialSchema={draft.schema}
          initialFrequency="daily"
          initialCategoryId=""
          isCreateMode={true}
          onSave={handleSave}
          onChangeTitle={handleTitleChange}
        />
      </div>
    </main>
  );
}
