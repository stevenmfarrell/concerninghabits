'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlarmClock, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendTestReminder } from '@/app/actions/reminders';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { PANE_INSET } from '@/components/Pane';
import { PUSH_UNAVAILABLE, usePushSubscription } from './usePushSubscription';

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

  const unavailable = PUSH_UNAVAILABLE[state];
  return (
    <>
      <Toggle
        bare
        icon={busy || state === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlarmClock className="w-5 h-5" />}
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
