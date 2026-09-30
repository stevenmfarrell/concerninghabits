'use client';

import { useState, useEffect } from 'react';
import { saveHabit } from '../../actions/db';
import HabitEditor from '../../../components/HabitEditor';
import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';
import BackLink from '@/components/BackLink';
import type { HabitSchema } from '@/lib/types';
import { PENDING_VOICE_LOG_KEY } from '@/lib/constants';
import RefineLoading from './RefineLoading';

interface HabitDraft {
  schema: HabitSchema;
  frequency?: string;
  categoryId?: string;
  // What the user said on the dashboard, when the draft came from voice capture (see VoiceCapture)
  transcript?: string;
}

// Only rendered in the browser (see page.tsx), so sessionStorage is always available here.
function readDraft(): HabitDraft | null {
  const draftData = sessionStorage.getItem('draftHabit');
  return draftData ? JSON.parse(draftData) : null;
}

export default function RefineClient() {
  const router = useRouter();

  const [draft] = useState<HabitDraft | null>(readDraft);
  const [logFirstEntry, setLogFirstEntry] = useState(true);

  useEffect(() => {
    if (!draft) router.replace('/create');
  }, [draft, router]);

  const handleSave = async (title: string, description: string, schema: HabitSchema, categoryId: string, frequency: string, publishToMqtt: boolean) => {
    const habit = await saveHabit(title, description, schema, categoryId, frequency, publishToMqtt);
    sessionStorage.removeItem('draftHabit');

    // Hand what the user said to the new habit's log page, which fills the entry in against the
    // form as saved (it may have been edited here) and submits it, the same as for an existing habit
    if (draft?.transcript && logFirstEntry) {
      sessionStorage.setItem(PENDING_VOICE_LOG_KEY, JSON.stringify({ habitId: habit.id, transcript: draft.transcript }));
      router.push(`/log/${habit.id}`);
    } else {
      router.push('/');
    }
  };

  const handleTitleChange = (title: string) => {
    const currentDraft: Partial<HabitDraft> = JSON.parse(sessionStorage.getItem('draftHabit') || '{}');
    if (currentDraft.schema) currentDraft.schema.title = title;
    sessionStorage.setItem('draftHabit', JSON.stringify(currentDraft));
  };

  if (!draft) {
    return <RefineLoading />;
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

        {draft.transcript && (
          <label className="flex items-center justify-between gap-4 p-4 bg-white border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-lg shrink-0 ${logFirstEntry ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-200 text-stone-500'}`}>
                <Mic className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-stone-900 text-sm">Log it as the first entry</div>
                <div className="text-xs text-stone-500 break-words">“{draft.transcript}”</div>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${logFirstEntry ? 'bg-emerald-500' : 'bg-stone-300'}`}>
              <input type="checkbox" className="sr-only" checked={logFirstEntry} onChange={(e) => setLogFirstEntry(e.target.checked)} />
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${logFirstEntry ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </label>
        )}

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
