'use client';

import { useState, useEffect } from 'react';
import { saveHabit } from '../../actions/db';
import HabitEditor, { type HabitDraft as EditorDraft } from '../../../components/HabitEditor';
import { useRouter } from 'next/navigation';
import BackLink from '@/components/BackLink';
import type { HabitSchema } from '@/lib/types';
import { NO_CADENCE, type Cadence } from '@/lib/cadence';
import { setPendingSmartEntry } from '@/lib/pendingSmartEntry';
import RefineLoading from './RefineLoading';

interface HabitDraft {
  schema: HabitSchema;
  // Suggested by the AI; missing when building a habit by hand, which starts with no cadence
  cadence?: Cadence;
  categoryId?: string;
  // What the user asked for on the New Habit page, shown as what the draft came from
  prompt?: string;
  // What the user said or typed on the dashboard, when the draft came from there (see SmartEntry),
  // and whether it reported something they did, so it's logged as the first entry by default
  transcript?: string;
  logFirstEntry?: boolean;
}

// Only rendered in the browser (see page.tsx), so sessionStorage is always available here.
function readDraft(): HabitDraft | null {
  const draftData = sessionStorage.getItem('draftHabit');
  return draftData ? JSON.parse(draftData) : null;
}

export default function RefineClient() {
  const router = useRouter();

  const [draft] = useState<HabitDraft | null>(readDraft);
  const [logFirstEntry, setLogFirstEntry] = useState(draft?.logFirstEntry ?? true);

  useEffect(() => {
    if (!draft) router.replace('/create');
  }, [draft, router]);

  const handleSave = async ({ title, description, schema, categoryId, cadence, publishToMqtt, aiContext }: EditorDraft) => {
    const habit = await saveHabit(title, description, schema, categoryId, cadence, publishToMqtt, aiContext);
    sessionStorage.removeItem('draftHabit');

    // Hand what the user said to the new habit's log page, which fills the entry in against the
    // form as saved (it may have been edited here) and submits it, the same as for an existing habit
    if (draft?.transcript && logFirstEntry) {
      setPendingSmartEntry(habit.id, draft.transcript);
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

  const source = draft.transcript ?? draft.prompt;

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <BackLink href="/create">Start over</BackLink>
          <h1 className="text-3xl font-bold text-stone-900">New Habit</h1>
          {source && <p className="text-stone-500 mt-1 break-words">From “{source}”</p>}
        </div>

        <HabitEditor
          mode="create"
          initial={{
            title: draft.schema?.title || '',
            description: draft.schema?.description || '',
            schema: draft.schema,
            cadence: draft.cadence ?? NO_CADENCE,
            categoryId: draft.categoryId || '',
            publishToMqtt: false,
            aiContext: '',
          }}
          onSave={handleSave}
          onChangeTitle={handleTitleChange}
          saveBarExtra={draft.transcript && (
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer min-w-0">
              <input
                type="checkbox"
                className="w-4 h-4 accent-emerald-600 shrink-0"
                checked={logFirstEntry}
                onChange={e => setLogFirstEntry(e.target.checked)}
              />
              <span className="truncate">Log it as the first entry</span>
            </label>
          )}
        />
      </div>
    </main>
  );
}
