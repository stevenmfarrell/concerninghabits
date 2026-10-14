'use client';

import { useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import PersonLabel from '@/components/PersonLabel';
import { setHabitSharing } from '@/app/actions/habits';
import type { Person } from '@/lib/userColors';

interface ShareDialogProps {
  habitId: string;
  habitName: string;
  // Everyone the habit could be shared with: the people the owner is connected to (everyone else on
  // a self-hosted server), and anyone already on it
  candidates: Person[];
  // The hosted version, where that's only people they've connected with (see connections.ts)
  cloud: boolean;
  sharedWithIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

// Picks who a habit is shared with. Shared members can see the habit and its
// history and log entries into it; only the owner can change or delete it.
export default function ShareDialog({ habitId, habitName, candidates, cloud, sharedWithIds, onClose, onSaved }: ShareDialogProps) {
  const [selected, setSelected] = useState(() => new Set(sharedWithIds));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setHabitSharing(habitId, [...selected]);
      toast.success(selected.size > 0 ? 'Sharing updated' : 'Habit is no longer shared');
      onSaved();
    } catch (err) {
      toast.error(`Failed to update sharing: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSaving(false);
    }
  };

  return (
    <Dialog label="Share Habit">
      <div className="p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full shrink-0 bg-accent-soft-strong text-accent-ink">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-2 min-w-0">
            <h3 className="text-xl font-bold text-ink">Share Habit</h3>
            <p className="text-ink-muted leading-relaxed">
              People you share <span className="font-medium text-ink-secondary">{habitName}</span> with can see its history and log entries. It shows up in their Uncategorized list.
            </p>
          </div>
        </div>

        {candidates.length === 0 ? (
          <p className="text-sm text-ink-muted italic">
            {cloud
              ? 'You aren\'t connected with anyone yet. You can share with someone once they accept your invite.'
              : 'There\'s no one else to share with yet. An admin can add family members under Settings.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {candidates.map(person => {
              const isSelected = selected.has(person.id);
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => toggle(person.id)}
                    disabled={saving}
                    aria-pressed={isSelected}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${isSelected ? 'border-accent-line-strong bg-accent-soft' : 'border-line bg-surface-subtle hover:bg-surface-muted'}`}
                  >
                    <PersonLabel person={person} size="sm" />
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-accent border-accent text-on-accent' : 'border-line-strong bg-surface'}`}>
                      {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || candidates.length === 0} className="w-full sm:w-auto">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
