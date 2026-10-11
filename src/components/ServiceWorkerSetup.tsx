'use client';

import { useEffect } from 'react';

// The app's service worker (public/sw.js), which receives reminders and, in a production build, keeps
// pages and their files to open the app offline. In development it's registered without the `offline`
// flag, so it caches nothing and `next dev` is never served old code; that's also how reminders
// register it there (see usePushSubscription). One URL either way, so the two never fight over it.
export const SERVICE_WORKER_URL = process.env.NODE_ENV === 'production' ? '/sw.js?offline=1' : '/sw.js';
const SERVICE_WORKER_PATH = '/sw.js';

// The caches the service worker keeps pages in (see sw.js), which are cleared on signing out, since
// they hold what the signed-in user saw
const PAGE_CACHE_PREFIX = 'pages-';

// The tab pages kept ready to open offline, with the habits' and categories' pages they link to (see
// sw.js's "warm"), refreshed at most this often
const WARM_PAGES = ['/', '/habits', '/history', '/settings'];
const WARM_EVERY_MS = 6 * 60 * 60 * 1000;
const WARMED_KEY = 'pagesWarmedAt';

// Registers the service worker in a production build, and removes any other, e.g. one left by an
// older version of the app that cached pages without checking the network first, which could serve
// stale JS bundles. Signed in (`signedIn`), it has the tab pages kept for offline; signed out, it
// clears the pages kept.
export default function ServiceWorkerSetup({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        const worker = registration.active ?? registration.waiting ?? registration.installing;
        if (worker && new URL(worker.scriptURL).pathname === SERVICE_WORKER_PATH) continue;
        registration.unregister();
      }
    });
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return;
    if (!signedIn) {
      caches.keys().then(keys => keys.filter(key => key.startsWith(PAGE_CACHE_PREFIX)).forEach(key => caches.delete(key))).catch(() => {});
      try {
        localStorage.removeItem(WARMED_KEY);
      } catch {}
      return;
    }
    if (process.env.NODE_ENV !== 'production') return;
    const warm = () => {
      if (!navigator.onLine) return;
      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage({ type: 'warm', urls: WARM_PAGES, followLinks: true });
        try {
          localStorage.setItem(WARMED_KEY, String(Date.now()));
        } catch {}
      });
    };
    let warmedAt = 0;
    try {
      warmedAt = Number(localStorage.getItem(WARMED_KEY)) || 0;
    } catch {}
    if (Date.now() - warmedAt >= WARM_EVERY_MS) warm();
    // A new version of the worker took over: it may not have the tabs yet
    navigator.serviceWorker.addEventListener('controllerchange', warm);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', warm);
  }, [signedIn]);

  return null;
}
