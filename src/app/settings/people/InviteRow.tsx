'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import InviteDialog from '@/components/InviteDialog';

// The Connected list's last row: makes an invite link to send someone
export default function InviteRow({ cloud }: { cloud: boolean }) {
  const [inviting, setInviting] = useState(false);
  return (
    <>
      {/* The list's last row, rather than a Button, so it reads as adding to the list */}
      <button
        type="button"
        onClick={() => setInviting(true)}
        className="w-full flex items-center gap-2 pane-inset py-3 text-left text-sm font-medium text-accent-ink-strong hover:bg-surface-subtle transition-colors"
      >
        <Plus className="w-4 h-4" /> Invite Someone
      </button>
      {inviting && <InviteDialog cloud={cloud} onClose={() => setInviting(false)} />}
    </>
  );
}
