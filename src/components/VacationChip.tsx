'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, TreePalm, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { endVacation } from '@/app/actions/vacation';
import { describeVacation, type VacationRange } from '@/lib/vacation';

// At the top of the Agenda while the user's on vacation: what it is, linking to its settings, and a
// button to end it now, keeping the days already taken (see endVacation)
export default function VacationChip({ vacation }: { vacation: VacationRange & { active: boolean } }) {
  const [busy, setBusy] = useState(false);

  const end = async () => {
    setBusy(true);
    try {
      await endVacation();
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(`Couldn't end your vacation: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1 max-w-full pl-3 pr-1 py-1 rounded-full bg-accent-soft border border-accent-line text-sm font-medium text-accent-ink-strong">
      <Link href="/settings/vacation" className="flex items-center gap-2 min-w-0 hover:underline">
        <TreePalm className="w-4 h-4 shrink-0" />
        <span className="truncate">{describeVacation(vacation)}</span>
      </Link>
      <button
        type="button"
        onClick={end}
        disabled={busy}
        className="ml-1 shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-accent-ink-strong hover:bg-accent-soft-strong transition-colors disabled:opacity-60"
        title="End your vacation now"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        End
      </button>
    </div>
  );
}
