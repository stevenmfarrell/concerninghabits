'use client';

import { useState } from 'react';
import { Lock, Repeat } from 'lucide-react';
import { CadencePicker, CadenceSettings } from './CadenceField';
import QuickEditDialog from './QuickEditDialog';
import { describeCadence, type Cadence } from '@/lib/cadence';

export const PILL = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors';

// A cadence as a pill (e.g. "Every 3 days") that opens a dialog to change it, for a habit or a
// category. Without `onSave` it's shown but can't be changed, e.g. a shared habit's cadence for
// someone other than its owner, with `lockedTitle` saying why. `saveLabel` names the dialog's
// button (see QuickEditDialog). `weekStartsOn` is the user's, for the days of the week.
export default function CadenceQuickEdit({ cadence, weekStartsOn, onSave, lockedTitle, saveLabel }: {
  cadence: Cadence;
  weekStartsOn: string;
  onSave?: (cadence: Cadence) => Promise<void>;
  lockedTitle?: string;
  saveLabel?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!onSave) {
    return (
      <span className={`${PILL} bg-surface-subtle border-line-subtle text-ink-muted`} title={lockedTitle}>
        <Repeat className="w-4 h-4 shrink-0" />
        {describeCadence(cadence, { weekStartsOn })}
        <Lock className="w-3 h-3 shrink-0" aria-label={lockedTitle} />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${PILL} bg-surface border-line text-ink-secondary hover:bg-surface-subtle`}
        title="Change cadence"
      >
        <Repeat className="w-4 h-4 shrink-0" />
        {describeCadence(cadence, { weekStartsOn })}
      </button>
      {editing && <CadenceDialog initial={cadence} weekStartsOn={weekStartsOn} onSave={onSave} saveLabel={saveLabel} onClose={() => setEditing(false)} />}
    </>
  );
}

function CadenceDialog({ initial, weekStartsOn, onSave, saveLabel, onClose }: { initial: Cadence; weekStartsOn: string; onSave: (cadence: Cadence) => Promise<void>; saveLabel?: string; onClose: () => void }) {
  const [cadence, setCadence] = useState(initial);

  return (
    <QuickEditDialog
      title="Cadence"
      canSave={JSON.stringify(cadence) !== JSON.stringify(initial)}
      onSave={() => onSave(cadence)}
      onClose={onClose}
      saveLabel={saveLabel}
    >
      <CadencePicker value={cadence} onChange={setCadence} />
      <CadenceSettings value={cadence} onChange={setCadence} weekStartsOn={weekStartsOn} />
    </QuickEditDialog>
  );
}
