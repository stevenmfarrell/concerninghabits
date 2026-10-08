'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

const Settled = createContext<RefObject<boolean> | null>(null);

// For something inside a SmoothHeight, to read as it mounts (in a layout effect): whether it's
// replacing what was shown there, e.g. DueNowCleared taking the place of the last row to leave,
// rather than arriving with the page
export function useReplacesContents() {
  return useContext(Settled);
}

// Eases its height to its new contents' when they change on a re-render, e.g. when the Agenda
// refreshes after an entry and Due Now drops several rows at once, or swaps them for DueNowCleared,
// rather than jumping everything below. A row closing up on its own (see zoomAway) isn't a
// re-render, so it isn't eased twice, and the last row in it doesn't close up at all, leaving its
// place to ease from. Clips its contents only while it's easing.
export default function SmoothHeight({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Its height as last laid out, kept current between renders
  const lastHeight = useRef<number | null>(null);
  const easing = useRef<Animation | null>(null);
  // Set after its first render's effects, so whatever mounts in it later is replacing something.
  // Unset again on unmount, so React running effects twice in development doesn't count as later.
  const settled = useRef(false);

  useEffect(() => {
    settled.current = true;
    return () => {
      settled.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    lastHeight.current = element.offsetHeight;
    const observer = new ResizeObserver(() => {
      lastHeight.current = element.offsetHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // After every render, before the observer hears of it: ease from the height it had to the new one
  useLayoutEffect(() => {
    const element = ref.current;
    const from = lastHeight.current;
    if (!element || from === null) return;
    // Measured without any easing still under way, which would hold it at an in-between height
    easing.current?.cancel();
    const to = element.offsetHeight;
    lastHeight.current = to;
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Clipped rather than hidden: hidden would make it a scroll container, pinning the sticky
    // heading inside it (see PaneHeading) a page header's height down until the easing ends
    element.style.overflow = 'clip';
    const ease = element.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 400, easing: 'cubic-bezier(0.33, 0, 0.2, 1)' });
    easing.current = ease;
    ease.finished.catch(() => {}).then(() => {
      if (easing.current !== ease) return;
      easing.current = null;
      element.style.overflow = '';
    });
  });

  return (
    <Settled.Provider value={settled}>
      <div ref={ref} data-smooth-height>{children}</div>
    </Settled.Provider>
  );
}
