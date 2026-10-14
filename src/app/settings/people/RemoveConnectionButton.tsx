'use client';

import { useState } from 'react';
import { Loader2, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import { removeConnection } from '@/app/actions/user';
import ConfirmDialog from '@/components/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';

export default function RemoveConnectionButton({ userId, userName }: { userId: string; userName: string }) {
  const [removing, setRemoving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await removeConnection(userId);
      toast.success(`Removed ${userName}`);
    } catch (err) {
      toast.error(`Couldn't remove ${userName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRemoving(false);
    }
    setConfirming(false);
  };

  return (
    <>
      <IconButton onClick={() => setConfirming(true)} disabled={removing} edge="right" title={`Remove ${userName}`} aria-label={`Remove ${userName}`}>
        {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
      </IconButton>

      <ConfirmDialog
        isOpen={confirming}
        title={`Remove ${userName}?`}
        message={`You won't be able to share habits with each other, and you'll each come off the habits the other shared with you. Entries already logged stay. To share again, one of you will need to invite the other.`}
        confirmText="Remove"
        isProcessing={removing}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
