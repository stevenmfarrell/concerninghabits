'use client';

import { useLayoutEffect, useRef } from 'react';
import InkArt from './ui/InkArt';
import { useReplacesContents } from './SmoothHeight';

// What the Agenda's Due Now shows once everything due today is done: the hobbit hole, home for the
// day, in a softened ink so it's warm rather than stark, over a line saying so. It takes the place of the last row to leave (see zoomAway),
// Due Now easing to its height (see SmoothHeight). When it takes the place of rows that were just there, the hobbit hole is drawn
// in from left to right as it arrives, and the words fade in after it; arriving with the page, it's
// just there, so it's a moment when the last row leaves rather than every time the page opens.
export default function DueNowCleared() {
  const artRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const replacesContents = useReplacesContents();

  // Runs only as it mounts, since replacesContents is the same ref throughout
  useLayoutEffect(() => {
    const art = artRef.current;
    const text = textRef.current;
    if (!replacesContents?.current || !art || !text) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gentle = 'cubic-bezier(0.33, 0, 0.2, 1)';
    const animations = [
      art.animate(
        reduced
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ clipPath: 'inset(0 100% 0 0)', opacity: 0.3 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }],
        { duration: reduced ? 400 : 1000, easing: gentle, fill: 'backwards' },
      ),
      text.animate(
        [{ opacity: 0, transform: reduced ? 'none' : 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
        { duration: 500, delay: reduced ? 200 : 450, easing: 'ease-out', fill: 'backwards' },
      ),
    ];
    return () => animations.forEach(animation => animation.cancel());
  }, [replacesContents]);

  return (
    <div className="py-3 flex flex-col items-center text-center">
      <div ref={artRef} className="w-52 sm:w-64 max-w-full mb-3">
        <InkArt src="/hobbit-hole.svg" aspect={446.05 / 97.79} className="w-full opacity-35" />
      </div>
      <div ref={textRef}>
        <h2 className="text-base font-semibold text-ink-secondary">All done for the day</h2>
      </div>
    </div>
  );
}
