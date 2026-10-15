'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import CopyField from '@/components/CopyField';
import { createInviteLink } from '@/app/actions/invites';

// Makes a new invite link as it opens (see src/lib/invites.ts) and shows it to copy or send. With a
// habit, whoever accepts also joins it. The link is only shown here: only its hash is kept. On a
// self-hosted server (`cloud` false), only someone with an account on it can accept.
export default function InviteDialog({ habit, cloud, onClose }: { habit?: { id: string; name: string }; cloud: boolean; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  // The phone's share sheet, where there is one. The dialog only opens on a tap, so never on the server.
  const canShare = typeof navigator.share === 'function';
  // One link per opening, even when React runs the effect twice in development
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createInviteLink(habit?.id)
      .then(token => setLink(`${window.location.origin}/invite/${token}`))
      .catch(err => {
        toast.error(`Couldn't make an invite link: ${err instanceof Error ? err.message : 'Unknown error'}`);
        onClose();
      });
  }, [habit?.id, onClose]);

  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: 'Concerning Habits', text: habit ? `Join me on ${habit.name} in Concerning Habits` : 'Connect with me on Concerning Habits', url: link });
    } catch {
      // Closing the share sheet rejects too; the link is still here to copy
    }
  };

  return (
    <Dialog label="Invite Someone" onClose={onClose}>
      <div className="p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full shrink-0 bg-accent-soft-strong text-accent-ink">
            <Link2 className="w-6 h-6" />
          </div>
          <div className="space-y-2 min-w-0">
            <h3 className="text-xl font-bold text-ink">Invite Someone</h3>
            <p className="text-ink-muted leading-relaxed">
              Send this link to the person you want to connect with.
              {habit && <> Accepting also adds them to <span className="font-medium text-ink-secondary">{habit.name}</span>.</>}
              {' '}It works once, for a week.
              {!cloud && ' They\'ll need an account on this server.'}
            </p>
          </div>
        </div>
        {link
          ? <CopyField value={link} label="invite link" />
          : <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-ink-muted" /></div>}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">Done</Button>
        {canShare && (
          <Button variant="primary" onClick={share} disabled={!link} className="w-full sm:w-auto">
            <Send className="w-4 h-4" /> Send Link
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
