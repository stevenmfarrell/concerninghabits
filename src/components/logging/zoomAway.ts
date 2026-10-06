// A row that's just been done, on its way out of the Agenda's list: after a beat to show its ring's
// check, it pulls back a little and then zooms off the right side of the screen, and the rows below
// close up the gap. A row gesture's content slides (its `data-row-content`, see RowGesture), clipped
// by the gesture, so the page never scrolls sideways; `row`, the element around it, closes up.
// `cancel` puts it back, e.g. if logging failed. With reduced motion it just fades.
export interface Leaving {
  finished: Promise<void>;
  cancel: () => void;
}

// Long enough for the check to land (see ProgressRing)
const PAUSE = 200;
const SLIDE = 340;
const CLOSE = 160;
// If the row is somehow still there this long after it's gone (e.g. the page didn't drop it), it
// comes back rather than staying hidden
const STUCK = 1500;

export function zoomAway(row: HTMLElement | null): Leaving | undefined {
  const content = row?.querySelector<HTMLElement>('[data-row-content]');
  if (!row || !content) return undefined;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slide = content.animate(
    reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          // A wind-up to the left, then away, gathering speed
          { transform: 'translateX(0)', easing: 'cubic-bezier(0.3, 0, 0.4, 1)' },
          { transform: 'translateX(-12px)', offset: 0.2, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
          { transform: 'translateX(105%)' },
        ],
    { duration: reduced ? 200 : SLIDE, delay: PAUSE, fill: 'forwards' },
  );
  let close: Animation | undefined;

  const cancel = () => {
    slide.cancel();
    close?.cancel();
  };

  const finished = slide.finished.then(async () => {
    close = row.animate([{ height: `${row.offsetHeight}px` }, { height: '0px' }], { duration: CLOSE, easing: 'ease-in-out', fill: 'forwards' });
    row.style.overflow = 'hidden';
    await close.finished;
    setTimeout(() => {
      if (!row.isConnected) return;
      row.style.overflow = '';
      cancel();
    }, STUCK);
  });
  // Cancelling rejects it; whoever's waiting on it learns that from `cancel` having been called
  finished.catch(() => {});

  return {
    finished,
    cancel: () => {
      row.style.overflow = '';
      cancel();
    },
  };
}
