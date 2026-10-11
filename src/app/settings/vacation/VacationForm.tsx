'use client';

import { useState } from 'react';
import { Loader2, TreePalm } from 'lucide-react';
import toast from 'react-hot-toast';
import { endVacation, setVacation } from '@/app/actions/vacation';
import { Button } from '@/components/ui/Button';
import { INPUT } from '@/components/ui/Input';
import { PANE_INSET, PaneField, PaneSection } from '@/components/Pane';
import { describeVacation, vacationProblem, type VacationRange } from '@/lib/vacation';

// The vacation the user is on, or has coming up, with a button to end or call it off; or with none,
// a form to start one today or later, ending on a date or whenever they end it. `today` is the
// user's, as a civil day key.
export default function VacationForm({ vacation, today }: { vacation: (VacationRange & { active: boolean }) | null; today: string }) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (vacation) {
    return (
      <PaneSection title={vacation.active ? 'On Vacation' : 'Coming Up'}>
        <div className={`${PANE_INSET} py-4 flex flex-wrap items-center justify-between gap-3`}>
          <p className="flex items-center gap-2 font-semibold text-ink">
            <TreePalm className="w-5 h-5 text-accent-ink shrink-0" />
            {describeVacation(vacation)}
          </p>
          <Button variant="outline" disabled={busy} onClick={() => run(endVacation, vacation.active ? 'Welcome back!' : 'Vacation called off')}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {vacation.active ? 'End Vacation' : 'Call Off'}
          </Button>
        </div>
      </PaneSection>
    );
  }

  const problem = vacationProblem(from, to || null, today);
  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (!problem) void run(() => setVacation(from, to || null), from === today ? 'Enjoy your vacation!' : 'Vacation scheduled');
    }}>
      <PaneSection title="Take a Break">
        <PaneField label="Starts" htmlFor="vacation-from">
          <input id="vacation-from" type="date" min={today} value={from} onChange={e => setFrom(e.target.value)} className={`${INPUT} sm:w-56`} required />
        </PaneField>
        <PaneField label="Ends" htmlFor="vacation-to" description="Its last day. Leave it empty to keep going until you end it.">
          <input id="vacation-to" type="date" min={from} value={to} onChange={e => setTo(e.target.value)} className={`${INPUT} sm:w-56`} />
        </PaneField>
      </PaneSection>
      <div className={`${PANE_INSET} py-4 flex flex-wrap items-center justify-end gap-3`}>
        {problem && from && <p className="text-sm text-danger-ink mr-auto">{problem}</p>}
        <Button type="submit" size="lg" disabled={busy || !!problem}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <TreePalm className="w-5 h-5" />}
          {from === today ? 'Start Vacation' : 'Schedule Vacation'}
        </Button>
      </div>
    </form>
  );
}
