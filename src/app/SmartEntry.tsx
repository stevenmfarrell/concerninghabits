'use client';

import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { SquarePen, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import QuillIconWavy from '@/components/QuillIconWavy';
import SpeakOrType, { type SpeakOrTypeStatus } from '@/components/SpeakOrType';
import { generateHabitSchema, interpretSmartEntry, logSmartEntry, prefillSmartEntry, type HabitCandidate } from './actions/habit';
import { showLoggedToast } from '@/components/LoggedToast';
import { fieldsOf } from '@/lib/formFields';
import { prefillHref } from '@/lib/prefillHref';
import { queueTextEntry } from '@/lib/offline/actions';
import { isNetworkError } from '@/lib/offline/sync';

// The app's main button, raised in the middle of the bottom nav on every page: say or type what you did, or a habit you want to start. The server's
// habit matcher (Jev, the AI model, or shared words; see src/lib/habitMatcher.ts) picks which habit
// it's about (or a new one) and whether it reports something done. Something done on an existing
// habit is filled in and logged right here (or finished on the habit's page if it needs more than
// was said); a new habit is drafted by the AI model for the user to review, with the input as its
// first entry when it was something done. When the matcher isn't sure which habit, the user picks
// from its top candidates instead. Said to be done on an earlier day ("yesterday", "on October 10th"),
// it's logged then (see whenDone). What `userId` said lately is offered to say again (see recentKey).
export default function SmartEntry({ userId }: { userId: string }) {
  const router = useRouter();
  const [, startNavigation] = useTransition();
  // While the input is being matched or a new habit drafted: what's happening, and the input
  const [status, setStatus] = useState<SpeakOrTypeStatus>(null);
  const [picker, setPicker] = useState<{ input: string; candidates: HabitCandidate[]; didIt: boolean; loggedAt?: Date } | null>(null);

  const closePanel = () => setStatus(null);
  // Goes to `href`, closing the panel once the page it's going to is showing: in the same
  // transition, so the panel says what it's opening until then. It's in the bottom nav, so it stays
  // mounted from page to page.
  const openPage = (href: string) => startNavigation(() => {
    router.push(href);
    closePanel();
  });

  // Continues in the panel until it opens a page, or logs or fails right here
  // `loggedAt` is when the input says it was done, if earlier than now
  const proceed = async (candidate: HabitCandidate, input: string, didIt: boolean, loggedAt?: Date) => {
    setPicker(null);

    if (candidate.habitId && didIt) {
      // Logged right here, like everywhere else in the app. Only an entry that needs more than was
      // said goes to the habit's page, with what could be filled in, to finish it there.
      setStatus({ message: `Logging ${candidate.name}...`, input });
      const result = await logSmartEntry(candidate.habitId, input);
      if (!result.success) {
        closePanel();
        toast.error(result.error);
      } else if (result.logged) {
        closePanel();
        showLoggedToast({
          habitId: candidate.habitId,
          habitName: candidate.name,
          logId: result.logId,
          data: result.data,
          schemaProperties: fieldsOf(result.schema),
          source: `From “${input}”`,
          loggedAt: result.createdAt,
        });
      } else {
        toast(`Add the rest of the details for ${candidate.name}`, { icon: '✏️' });
        setStatus({ message: `Opening ${candidate.name}...`, input });
        openPage(prefillHref(candidate.habitId, result.data, result.loggedAt));
      }
      return;
    }

    if (candidate.habitId) {
      // e.g. "I want to run more" when they already track running: show the habit, log nothing. If
      // the input names values for its form, though, it may have been something done after all, so
      // they're filled in on the habit's entry sheet, to log with a tap if it was.
      setStatus({ message: `Opening ${candidate.name}...`, input });
      const data = await prefillSmartEntry(candidate.habitId, input);
      if (Object.keys(data).length > 0) {
        toast(`Check the details for ${candidate.name}, then log it`, { icon: '✏️' });
        openPage(prefillHref(candidate.habitId, data, loggedAt));
      } else {
        toast(`You already track ${candidate.name}`, { icon: '👍' });
        openPage(`/log/${candidate.habitId}`);
      }
      return;
    }

    setStatus({ message: 'Designing a new habit...', input });
    const result = await generateHabitSchema(
      didIt ? `Something I just did, which I want to start tracking as a habit: "${input}"` : input
    );
    if (result.success) {
      // The input rides along so saving the drafted habit can also log it as the first entry
      sessionStorage.setItem('draftHabit', JSON.stringify({ ...result, transcript: input, logFirstEntry: didIt, ...(loggedAt ? { loggedAt: loggedAt.toISOString() } : {}) }));
      openPage('/create/refine');
    } else {
      closePanel();
      toast.error(result.error || 'Failed to design a new habit');
    }
  };

  // Offline, what was said is kept to match to a habit and log once back online (see logToAnyHabit),
  // since that takes the AI on the server
  const keepForLater = async (input: string) => {
    closePanel();
    try {
      await queueTextEntry(null, input);
      toast(`“${input}” will be matched to a habit and logged once you're back online`, { icon: '📴', duration: 8000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t save it');
    }
  };

  const handleInput = async (input: string) => {
    if (!navigator.onLine) return keepForLater(input);
    setStatus({ message: 'Matching to your habits...', input });

    try {
      const result = await interpretSmartEntry(input);
      if (!result.success) {
        closePanel();
        toast.error(result.error);
      } else if (result.confident) {
        await proceed(result.candidates[0], input, result.didIt, result.loggedAt);
      } else {
        closePanel();
        // Always offer a new habit, even when it's not among the matcher's top candidates
        const candidates = result.candidates.some(c => !c.habitId)
          ? result.candidates
          : [...result.candidates, { habitId: null, name: 'New habit', probability: null }];
        setPicker({ input, candidates, didIt: result.didIt, loggedAt: result.loggedAt });
      }
    } catch (err) {
      if (isNetworkError(err)) return keepForLater(input);
      closePanel();
      toast.error('Failed to connect to AI');
    }
  };

  return (
    <>
      <SpeakOrType
        icon={<QuillIconWavy className="w-7 h-7" strokeWidth={2.5} />}
        ariaLabel={{ speak: 'Say what you did', type: 'Type what you did' }}
        panelLink={{ href: '/create', label: 'Build a habit by hand', icon: <SquarePen className="w-4 h-4" /> }}
        prompt={{
          listening: 'Listening...',
          typing: 'What do you want to log?',
          hint: "Tell me something you did, or a habit you'd like to start.",
        }}
        examples={EXAMPLES}
        recentKey={`smartEntryRecent:${userId}`}
        status={status}
        onInput={handleInput}
      />

      {/* Portaled to <body>, like SpeakOrType's panel, so an ancestor (e.g. a transformed one) can't
          make `fixed` relative to it rather than the screen */}
      {picker && createPortal(
        <Dialog label="Which habit was that?">
          <div className="p-6 sm:p-8 space-y-4">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-ink">Which habit was that?</h3>
              <p className="text-ink-muted leading-relaxed">“{picker.input}”</p>
            </div>
            <div className="flex flex-col gap-2">
              {picker.candidates.map(candidate => (
                <Button
                  key={candidate.habitId ?? 'new'}
                  variant="outline"
                  size="lg"
                  onClick={() => proceed(candidate, picker.input, picker.didIt, picker.loggedAt)}
                  className="w-full"
                >
                  {!candidate.habitId && <Sparkles className="w-5 h-5 text-accent-ink shrink-0" />}
                  <span className="flex-1 min-w-0 truncate text-left">{candidate.name}</span>
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPicker(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
          </DialogFooter>
        </Dialog>,
        document.body
      )}
    </>
  );
}

const EXAMPLES = [
  'I ran 3 miles in 28 minutes',
  'Took my vitamins',
  'Practiced piano for half an hour',
  'Biked to work',
  'I want to start drinking more water',
];
