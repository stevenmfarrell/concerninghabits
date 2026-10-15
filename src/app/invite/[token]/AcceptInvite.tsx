'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, LinkButton } from '@/components/ui/Button';
import { acceptInviteLink } from '@/app/actions/invites';

// The invite page's buttons: accept, then go to the habit it added you to or to People
export default function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);

  const accept = async () => {
    setAccepting(true);
    try {
      const { to, message } = await acceptInviteLink(token);
      router.push(to);
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t accept the invite');
      setAccepting(false);
    }
  };

  return (
    <div className="flex flex-col-reverse sm:flex-row justify-center gap-3">
      <LinkButton href="/" variant="ghost">Not Now</LinkButton>
      <Button variant="primary" onClick={accept} disabled={accepting}>
        {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Accept
      </Button>
    </div>
  );
}
