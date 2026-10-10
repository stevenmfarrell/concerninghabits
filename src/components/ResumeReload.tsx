'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// How long the app has to have been in the background before coming back reloads it
const RELOAD_AFTER_MS = 30 * 60 * 1000;

// Reloads the page when the app comes back after a long time in the background. A phone keeps a
// home screen app's page frozen in memory rather than loading it again, so it can come back
// running code from before a deploy (whose first request the new server may not understand) over a
// network connection that's since gone dead, which made the first tap after a while do nothing. It
// also brings back yesterday's Agenda the next morning. A reload starts fresh on all three.
//
// Unless that would lose something: not with a dialog or sheet open, or after anything was typed
// or picked on the current page, since there's no telling whether it was saved.
export default function ResumeReload() {
  const pathname = usePathname();
  const edited = useRef(false);

  // A new page starts with nothing edited
  useEffect(() => {
    edited.current = false;
  }, [pathname]);

  useEffect(() => {
    let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null;

    const markEdited = () => {
      edited.current = true;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away < RELOAD_AFTER_MS || edited.current || document.querySelector('[aria-modal="true"]')) return;
      window.location.reload();
    };

    document.addEventListener('input', markEdited, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('input', markEdited, { capture: true });
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
