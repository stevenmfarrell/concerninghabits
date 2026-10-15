'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { deleteMyAccount } from '@/app/actions/auth';
import { PANE_INSET, PaneField, PaneSection } from '@/components/Pane';
import { Button } from '@/components/ui/Button';
import { INPUT } from '@/components/ui/Input';

// Typing DELETE, then the button that deletes the account. The action signs out and goes to the
// sign-in page when it's done.
export default function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const confirmed = confirmation.trim().toUpperCase() === 'DELETE';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmed) return;
    setDeleting(true);
    // Resolves only with an error: otherwise it redirects
    const result = await deleteMyAccount(confirmation);
    if (result?.error) {
      toast.error(result.error);
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PaneSection title="Delete">
        <PaneField label="Type DELETE to confirm" htmlFor="confirm-delete">
          <input
            id="confirm-delete"
            className={`${INPUT} w-full`}
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={deleting}
          />
        </PaneField>
      </PaneSection>
      <div className={`${PANE_INSET} py-4`}>
        <Button type="submit" variant="danger" size="lg" disabled={!confirmed || deleting}>
          {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          Delete My Account
        </Button>
      </div>
    </form>
  );
}
