'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPushPublicKey, hasPushSubscription, removePushSubscription, savePushSubscription } from '@/app/actions/reminders';
import { SERVICE_WORKER_URL } from '@/components/SWUnregister';

// Whether this browser gets reminders, or why it can't:
// - insecure: served over plain http (other than localhost), where browsers don't allow push
// - needsInstall: an iPhone or iPad, which only allows push for an app added to the Home Screen
// - unsupported: no push in this browser at all
// - denied: the user blocked notifications for the site, which only they can undo, in the browser
export type PushState = 'loading' | 'insecure' | 'needsInstall' | 'unsupported' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true);

function unavailableReason(): PushState | null {
  if (!window.isSecureContext) return 'insecure';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !isStandalone() ? 'needsInstall' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  return null;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<PushState> => {
      const reason = unavailableReason();
      if (reason) return reason;
      // On only if this browser is subscribed and the server has it for whoever's signed in now
      const subscription = await currentSubscription();
      return subscription && await hasPushSubscription(subscription.endpoint) ? 'on' : 'off';
    })()
      .catch((): PushState => 'off')
      .then(next => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      const key = await getPushPublicKey();
      let subscription = await registration.pushManager.getSubscription();
      // One made with another key (the server's keys changed) can't receive this server's messages
      const subscribedKey = subscription?.options.applicationServerKey;
      if (subscription && subscribedKey && btoa(String.fromCharCode(...new Uint8Array(subscribedKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== key) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      await savePushSubscription(subscription.toJSON(), Intl.DateTimeFormat().resolvedOptions().timeZone);
      setState('on');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
