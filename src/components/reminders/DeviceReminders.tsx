'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendTestReminder } from '@/app/actions/reminders';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { PANE_INSET } from '@/components/Pane';
import { usePushSubscription, type PushState } from './usePushSubscription';

// Why this device can't get reminders, and what to do about it
const UNAVAILABLE: Partial<Record<PushState, string>> = {
  insecure: 'Notifications need the app to be served over https.',
  needsInstall: 'On iPhone and iPad, add this app to your Home Screen (Share, then Add to Home Screen) and open it from there to get reminders.',
  unsupported: "This browser can't show notifications from web apps.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.",
};

// The switch for reminders on this browser or device, as a row in a pane's list. Reminders go to
// every device it's on.
export default function DeviceReminders() {
  const { state, busy, enable, disable } = usePushSubscription();
  const [testing, setTesting] = useState(false);
  const router = useRouter();

  const toggle = async (on: boolean) => {
    try {
      await (on ? enable() : disable());
      router.refresh();
    } catch (err) {
      toast.error(`Couldn't ${on ? 'turn on' : 'turn off'} reminders: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await sendTestReminder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t send a test');
    } finally {
      setTesting(false);
    }
  };

  const unavailable = UNAVAILABLE[state];
  return (
    <>
      <Toggle
        bare
        icon={busy || state === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
        title="Reminders on This Device"
        description={unavailable ?? 'Notifications here when you’re running late on a habit'}
        checked={state === 'on'}
        onChange={toggle}
        disabled={busy || state === 'loading' || !!unavailable}
      />
      {state === 'on' && (
        <div className={`${PANE_INSET} py-3`}>
          <Button variant="outline" size="sm" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send a Test
          </Button>
        </div>
      )}
    </>
  );
}
