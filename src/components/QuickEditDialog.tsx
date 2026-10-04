'use client';

import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

// A small dialog to change one thing (e.g. a habit's category or cadence) on the spot. Saving
// refreshes the page through the server action's revalidation, then closes. Not overflow-hidden,
// so a dropdown inside can spill out of it. `saveLabel` renames its Save button, e.g. "Done" where
// the change only goes into a draft that's saved later (the habit editor).
export default function QuickEditDialog({ title, canSave, onSave, onClose, saveLabel = 'Save', children }: { title: string; canSave: boolean; onSave: () => Promise<void>; onClose: () => void; saveLabel?: string; children: ReactNode }) {
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave();
      onClose();
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSaving(false);
    }
  };

  return (
    // Not clipped, so a dropdown inside can spill out of it
    <Dialog label={title} onClose={onClose} size="sm" clip={false}>
      <div className="p-6 space-y-4">
        <h3 className="text-xl font-bold text-ink">{title}</h3>
        <div>{children}</div>
      </div>
      <div className="px-6 pb-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={!canSave || saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveLabel}
        </Button>
      </div>
    </Dialog>
  );
}
