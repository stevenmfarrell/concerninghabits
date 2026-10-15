'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cancelInvite } from '@/app/actions/invites';
import { IconButton } from '@/components/ui/IconButton';
import { PANE_INSET } from '@/components/Pane';

const day = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// An invite link still waiting to be accepted, with a way to cancel it so the link stops working.
// Its link isn't shown again: only its hash is kept.
export default function PendingInvite({ invite }: { invite: { id: string; createdAt: Date; expiresAt: Date; habit: { name: string } | null } }) {
  const [canceling, setCanceling] = useState(false);

  const cancel = async () => {
    setCanceling(true);
    try {
      await cancelInvite(invite.id);
    } catch (err) {
      toast.error(`Couldn't cancel the invite: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCanceling(false);
    }
  };

  return (
    <div className={`${PANE_INSET} py-3 flex items-center justify-between gap-3`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-secondary truncate">
          {invite.habit ? `Invite to ${invite.habit.name}` : 'Invite to connect'}
        </p>
        <p className="text-xs text-ink-muted">Made {day(invite.createdAt)} · expires {day(invite.expiresAt)}</p>
      </div>
      <IconButton onClick={cancel} disabled={canceling} edge="right" title="Cancel invite" aria-label="Cancel invite">
        {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
      </IconButton>
    </div>
  );
}
