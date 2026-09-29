'use client';

import { useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import PersonLabel from '@/components/PersonLabel';
import { setHabitSharing } from '../../actions/db';
import type { Person } from '@/lib/userColors';

interface ShareDialogProps {
  habitId: string;
  habitName: string;
  // Everyone the habit could be shared with (the other users on this instance)
  candidates: Person[];
  sharedWithIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

// Picks which family members a habit is shared with. Shared members can see the habit and its
// history and log entries into it; only the owner can change or delete it.
export default function ShareDialog({ habitId, habitName, candidates, sharedWithIds, onClose, onSaved }: ShareDialogProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full shrink-0 bg-emerald-100 text-emerald-600">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-2 min-w-0">
              <h3 className="text-xl font-bold text-stone-900">Share Habit</h3>
              <p className="text-stone-500 leading-relaxed">
                People you share <span className="font-medium text-stone-700">{habitName}</span> with can see its history and log entries. It shows up in their Uncategorized list.
              </p>
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="text-sm text-stone-500 italic">There&apos;s no one else to share with yet. An admin can add family members under Settings.</p>
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
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${isSelected ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'}`}
                    >
                      <PersonLabel person={person} size="sm" />
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300 bg-white'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="p-4 sm:px-8 sm:py-6 bg-stone-50 border-t border-stone-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || candidates.length === 0} className="w-full sm:w-auto">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
