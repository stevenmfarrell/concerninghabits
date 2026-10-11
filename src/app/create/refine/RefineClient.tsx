'use client';

import { useState, useEffect } from 'react';
import { saveHabit } from '../../actions/db';
import { setHabitReminder } from '../../actions/reminders';
import HabitEditor, { type HabitDraft as EditorDraft } from '../../../components/HabitEditor';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage } from '@/components/Pane';
import type { HabitSchema } from '@/lib/types';
import { NO_CADENCE, type Cadence } from '@/lib/cadence';
import { setPendingSmartEntry } from '@/lib/pendingSmartEntry';
import { newHabitReminderStatus } from '@/lib/reminders';
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

// `weekStartsOn` is the user's, for the cadence picker's days of the week, and `bedtime` and
// `hasDevice` (whether any of their devices get reminders) are for the new habit's reminder
export default function RefineClient({ weekStartsOn, bedtime, hasDevice }: { weekStartsOn: string; bedtime: string; hasDevice: boolean }) {
  const router = useRouter();

  const [draft] = useState<HabitDraft | null>(readDraft);
  const [logFirstEntry, setLogFirstEntry] = useState(draft?.logFirstEntry ?? true);

  useEffect(() => {
    if (!draft) router.replace('/create');
  }, [draft, router]);

  const handleSave = async ({ title, description, schema, categoryId, cadence, publishToMqtt, aiContext, calculatedFields, reminder }: EditorDraft) => {
    const habit = await saveHabit(title, description, schema, categoryId, cadence, publishToMqtt, aiContext, calculatedFields);
    sessionStorage.removeItem('draftHabit');
    // A reminder is the user's own, on their membership, so it's set once the habit exists. Only one
    // with a cadence is ever due, so only one with a cadence can run late.
    if (reminder?.enabled && cadence.type !== 'none') {
      await setHabitReminder(habit.id, true, reminder.remindAt);
    }

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
    // Back goes to the New Habit page, to start over
    <PanePage width="3xl" header={<PageHeader title="New Habit" backHref="/create" />}>
      {source && <p className={`${PANE_INSET} py-3 text-ink-muted break-words`}>From “{source}”</p>}

      <HabitEditor
        mode="create"
        weekStartsOn={weekStartsOn}
        initial={{
          title: draft.schema?.title || '',
          description: draft.schema?.description || '',
          schema: draft.schema,
          cadence: draft.cadence ?? NO_CADENCE,
          categoryId: draft.categoryId || '',
          publishToMqtt: false,
          aiContext: '',
          calculatedFields: [],
          reminder: { enabled: false, remindAt: null },
        }}
        reminderContext={{ status: newHabitReminderStatus(draft.cadence ?? NO_CADENCE), bedtime, hasDevice }}
        onSave={handleSave}
        onChangeTitle={handleTitleChange}
        saveBarExtra={draft.transcript && (
          <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer min-w-0">
            <input
              type="checkbox"
              className="w-4 h-4 accent-accent shrink-0"
              checked={logFirstEntry}
              onChange={e => setLogFirstEntry(e.target.checked)}
            />
            <span className="truncate">Log it as the first entry</span>
          </label>
        )}
      />
    </PanePage>
  );
}
