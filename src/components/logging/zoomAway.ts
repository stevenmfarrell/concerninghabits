// A row that's just been done, on its way out of the Agenda's list (or skipped: see swipeAway): after a beat to show its ring's
// check, it pulls back a little and then zooms off the right side of the screen, and the rows below
// close up the gap. A row gesture's content slides (its `data-row-content`, see RowGesture), clipped
// by the gesture, so the page never scrolls sideways; `row`, the element around it, closes up.
// The last row left in a SmoothHeight (Due Now) keeps its place instead, its section's white
// fading to the stone: what replaces the rows (DueNowCleared) takes it over, eased from there,
// rather than everything closing up and opening out again. `cancel` puts it back, e.g. if logging failed. With reduced motion it just fades.
export interface Leaving {
  finished: Promise<void>;
  cancel: () => void;
}

// Long enough for the check to land (see ProgressRing)
const PAUSE = 200;
const SLIDE = 340;
const CLOSE = 160;
const FADE = 220;
// If the row is somehow still there this long after it's gone (e.g. the page didn't drop it), it
// comes back rather than staying hidden
const STUCK = 1500;

export function zoomAway(row: HTMLElement | null): Leaving | undefined {
  return leave(row, content => content.animate(
    [
      // A wind-up to the left, then away, gathering speed
      { transform: 'translateX(0)', easing: 'cubic-bezier(0.3, 0, 0.4, 1)' },
      { transform: 'translateX(-12px)', offset: 0.2, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
      { transform: 'translateX(105%)' },
    ],
    { duration: SLIDE, delay: PAUSE, fill: 'forwards' },
  ));
}

// A row swiped to the left that's just been skipped, leaving the same way: carried on off the left
// side of the screen from wherever the finger let go of it, straight away, then the rows below close
// up the gap
export function swipeAway(row: HTMLElement | null): Leaving | undefined {
  // From where the swipe left it (its inline transform), so it doesn't jump back first
  return leave(row, content => content.animate([{ transform: 'translateX(-105%)' }], { duration: SWIPE_SLIDE, easing: 'ease-in', fill: 'forwards' }));
}

// How long a swiped row takes to carry on off the screen
const SWIPE_SLIDE = 180;

// Sends a row's content away by `slideAway` (just a fade, with reduced motion), then closes up the
// gap it leaves, or fades its section's white if it's the last row there
function leave(row: HTMLElement | null, slideAway: (content: HTMLElement) => Animation): Leaving | undefined {
  const content = row?.querySelector<HTMLElement>('[data-row-content]');
  if (!row || !content) return undefined;

  // Marked so a row leaving at the same time doesn't count as staying
  row.dataset.leaving = '';
  const smooth = row.closest('[data-smooth-height]');
  const keepsPlace = !!smooth && [...smooth.querySelectorAll('[data-row-content]')].every(other => other.closest('[data-leaving]'));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slide = reduced
    ? content.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: PAUSE, fill: 'forwards' })
    : slideAway(content);
  // Closing up the gap, or for the last row, fading its section's white
  let close: Animation | undefined;

  const cancel = () => {
    delete row.dataset.leaving;
    slide.cancel();
    close?.cancel();
  };

  const finished = slide.finished.then(async () => {
    const surface = keepsPlace ? row.closest<HTMLElement>('[data-pane-surface]') : null;
    if (surface) {
      close = surface.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: 'ease-out', fill: 'forwards' });
    } else if (!keepsPlace) {
      close = row.animate([{ height: `${row.offsetHeight}px` }, { height: '0px' }], { duration: CLOSE, easing: 'ease-in-out', fill: 'forwards' });
      row.style.overflow = 'hidden';
    }
    await close?.finished;
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
