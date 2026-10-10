'use client';

import { useEffect } from 'react';

// The reminders service worker (see ReminderSettings), which is the only one the app registers
export const SERVICE_WORKER_URL = '/sw.js';

// Removes any service worker other than the reminders one, e.g. one left by an older version of the
// app that cached pages, which could serve stale JS bundles
export default function SWUnregister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (const registration of registrations) {
          const worker = registration.active ?? registration.waiting ?? registration.installing;
          if (worker && new URL(worker.scriptURL).pathname === SERVICE_WORKER_URL) continue;
          registration.unregister();
        }
      });
    }
  }, []);

  return null;
}
