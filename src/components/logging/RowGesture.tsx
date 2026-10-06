'use client';

import { useRef, useState, useSyncExternalStore, type MouseEvent, type PointerEvent, type ReactNode } from 'react';

// Pressing and holding the row does its action, as a tint fills it from the left: the fill waits
// HOLD_DELAY ms, so a tap doesn't flash it, then takes HOLD_DURATION ms
const HOLD_DELAY = 120;
const HOLD_DURATION = 380;
// How far a swiped row has to travel before letting go does its action: a share of its width, but
// never so little that a sloppy scroll could do it, nor so much that a full-width row on a desktop
// needs a long drag
const THRESHOLD_SHARE = 0.2;
const MIN_THRESHOLD = 72;
const MAX_THRESHOLD = 120;
// A quick flick to the left counts too, short of the threshold: moving at least this fast (px per
// ms, over the last FLICK_WINDOW ms before letting go) and at least FLICK_MIN_DISTANCE overall
const FLICK_VELOCITY = 0.5;
const FLICK_WINDOW = 100;
const FLICK_MIN_DISTANCE = 32;
// How far a finger moves before the gesture counts as a swipe or a scroll, whichever way it went
// (and stops counting as a hold)
const AXIS_LOCK = 8;
// Where a swiped row rests while its action finishes, so the spinner shows behind it
const BUSY_OFFSET = 80;
// Set on this device once the viewer has used a row's gesture, or dismissed the tip about it, after
// which the tip (see `tip`) isn't shown again. Shared by every row, so the tip goes from all of them
// at once.
const TIP_DONE_KEY = 'rowGestureTipDone';
const tipListeners = new Set<() => void>();

function isTipDone() {
  try {
    return localStorage.getItem(TIP_DONE_KEY) === '1';
  } catch {
    return true;
  }
}

function markTipDone() {
  try {
    localStorage.setItem(TIP_DONE_KEY, '1');
  } catch {}
  tipListeners.forEach(listener => listener());
}

function subscribeTip(listener: () => void) {
  tipListeners.add(listener);
  return () => {
    tipListeners.delete(listener);
  };
}

// A list row with an action done by a gesture, while a tap still follows the row's link:
// - `hold` (on by default): pressing and holding it fills the row with a tint from the left, emerald
//   (or a category's blue, with `tone="category"`), calling `onCommit` once it's full; the tint
//   stays until a promise `onCommit` returns settles. Lifting or moving first drains it away.
// - `swipe`: swiping it to the left slides it away over that color with `icon` on it, calling
//   `onCommit` when let go past the threshold, or flicked quickly. Short of the threshold it springs
//   back. If `onCommit` returns a promise, the row stays partway open over the icon (which should
//   show a spinner while `busy`) until it settles.
// Vertical drags are left to scrolling. On a touch screen, a hidden button labeled `label` does the
// same without the gesture, e.g. with a screen reader or a keyboard: focused from the keyboard, it
// rings the row (and slides a swipeable one partway open). With a mouse, the row has a visible
// button for this instead (see pointerOnly). `tip` shows a tip under the row about the hold, on a
// touch screen, until the viewer uses a row's gesture or taps it away (e.g. on a page's first row).
export default function RowGesture({ onCommit, label, icon, tone = 'accent', hold = true, swipe = false, busy = false, tip = false, children }: {
  onCommit: () => unknown;
  label: string;
  // What a swipe reveals
  icon?: ReactNode;
  tone?: 'accent' | 'category';
  hold?: boolean;
  swipe?: boolean;
  busy?: boolean;
  tip?: boolean;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [armed, setArmed] = useState(false);
  const [threshold, setThreshold] = useState(MIN_THRESHOLD);
  // Whether the hidden button has the keyboard's focus
  const [focused, setFocused] = useState(false);

  const rowRef = useRef<HTMLDivElement>(null);
  // Where the gesture started, which way it's going, and its recent positions, for a swipe's speed
  const gesture = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; samples: { x: number; t: number }[] } | null>(null);
  // Set when a swipe or hold ends, so the click that follows doesn't open the row's link
  const done = useRef(false);
  const fillRef = useRef<HTMLDivElement>(null);
  // The hold's fill, while the finger is down and it isn't full yet
  const holdAnimation = useRef<Animation | null>(null);
  // Done when rendered on the server, so the tip only appears once this device's answer is known
  const tipDone = useSyncExternalStore(subscribeTip, isTipDone, () => true);

  const reset = () => {
    gesture.current = null;
    setDragging(false);
    setArmed(false);
    setOffset(0);
  };

  const cancelHold = () => {
    holdAnimation.current?.cancel();
    holdAnimation.current = null;
  };

  // The fill reached the end with the finger still down: the action happens now, without waiting
  // for it to lift
  const completeHold = async (slider: HTMLDivElement, pointerId: number, fill: Animation) => {
    holdAnimation.current = null;
    gesture.current = null;
    done.current = true;
    // So the click on lifting comes back to the row, to be swallowed, rather than landing on a
    // sheet the action opens, or on the row's link
    try {
      slider.setPointerCapture(pointerId);
    } catch {}
    navigator.vibrate?.(15);
    markTipDone();
    // The tint stays while the action finishes, then drains away
    await onCommit();
    const fade = fillRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-out' });
    if (fade) await fade.finished.catch(() => {});
    fill.cancel();
  };

  // Keeps only the positions from the last FLICK_WINDOW ms, enough to tell how fast it's moving now
  const recordSample = (g: NonNullable<typeof gesture.current>, e: PointerEvent<HTMLDivElement>) => {
    g.samples.push({ x: e.clientX, t: e.timeStamp });
    while (g.samples.length > 2 && e.timeStamp - g.samples[0].t > FLICK_WINDOW) g.samples.shift();
  };

  const isFlick = (g: NonNullable<typeof gesture.current>, x: number) => {
    const first = g.samples[0];
    const last = g.samples[g.samples.length - 1];
    const elapsed = last.t - first.t;
    if (elapsed <= 0 || g.x - x < FLICK_MIN_DISTANCE) return false;
    return (first.x - last.x) / elapsed >= FLICK_VELOCITY;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
    setThreshold(Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, (rowRef.current?.offsetWidth ?? 0) * THRESHOLD_SHARE)));
    gesture.current = { x: e.clientX, y: e.clientY, axis: null, samples: [{ x: e.clientX, t: e.timeStamp }] };
    done.current = false;

    const fillEl = fillRef.current;
    if (!hold || !fillEl) return;
    cancelHold();
    const fill = fillEl.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: HOLD_DURATION,
      delay: HOLD_DELAY,
      easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
      fill: 'forwards',
    });
    holdAnimation.current = fill;
    const slider = e.currentTarget;
    const { pointerId } = e;
    fill.onfinish = () => {
      if (holdAnimation.current === fill) completeHold(slider, pointerId, fill);
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;

    if (!g.axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      // Moving, to scroll or swipe, isn't holding
      cancelHold();
      g.axis = swipe && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (g.axis === 'y') return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    if (g.axis !== 'x') return;
    recordSample(g, e);

    // Only to the left; a drag the other way just holds the row in place
    const next = Math.min(0, dx);
    setOffset(next);
    const nowArmed = -next >= threshold;
    if (nowArmed !== armed) {
      setArmed(nowArmed);
      if (nowArmed) navigator.vibrate?.(10);
    }
  };

  const onPointerUp = async (e: PointerEvent<HTMLDivElement>) => {
    cancelHold();
    const g = gesture.current;
    if (!g || g.axis !== 'x') {
      gesture.current = null;
      return;
    }
    done.current = true;
    recordSample(g, e);
    if (!armed && !isFlick(g, e.clientX)) return reset();

    gesture.current = null;
    setDragging(false);
    setArmed(false);
    markTipDone();
    // After the click a mouse fires on release, so it can't land on a sheet the action opens (and
    // close it straight away)
    await new Promise(resolve => setTimeout(resolve));
    const result = onCommit();
    if (result instanceof Promise) {
      setOffset(-BUSY_OFFSET);
      await result;
    }
    setOffset(0);
  };

  const onClickCapture = (e: MouseEvent) => {
    if (!done.current) return;
    done.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const shownOffset = offset || (swipe && focused ? -BUSY_OFFSET : 0);
  const progress = focused ? 1 : Math.min(1, -offset / threshold);
  const fillColor = tone === 'category' ? 'bg-category/20' : 'bg-accent/20';

  return (
    // The tip goes below the row, so it's outside the row's clipping
    <div>
      <div ref={rowRef} className="relative overflow-hidden">
        {swipe && (
          <div className={`absolute inset-0 ${tone === 'category' ? 'bg-category text-on-category' : 'bg-accent text-on-accent'} flex items-center justify-end pane-inset-r`} aria-hidden="true">
            <span
              className={`p-2 -m-2 rounded-full transition-transform duration-150 ${focused ? 'ring-2 ring-current' : ''}`}
              style={{ opacity: busy ? 1 : 0.4 + progress * 0.6, transform: `scale(${armed ? 1.15 : 0.85 + progress * 0.15})` }}
            >
              {icon}
            </span>
          </div>
        )}
        <div
          className={`relative select-none ${swipe ? 'touch-pan-y' : ''} ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
          // No callout on a long press either, iOS's link menu
          style={{ transform: shownOffset ? `translateX(${shownOffset}px)` : undefined, WebkitTouchCallout: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            cancelHold();
            reset();
          }}
          onClickCapture={onClickCapture}
          // Holding a finger on the row is the hold, not a request for the link's menu
          onContextMenu={e => {
            if (gesture.current || done.current) e.preventDefault();
          }}
          // A mouse drag on the row's link would start the browser's own link drag instead
          onDragStart={e => e.preventDefault()}
        >
          {children}
          {hold && (
            <div ref={fillRef} className={`absolute inset-0 pointer-events-none origin-left ${fillColor}`} style={{ transform: 'scaleX(0)' }} aria-hidden="true" />
          )}
          {/* A ring around the row while the hidden button has the keyboard's focus */}
          {focused && !swipe && <div className="absolute inset-0 pointer-events-none ring-2 ring-inset ring-focus" aria-hidden="true" />}
        </div>
        <button
          type="button"
          className="sr-only pointer-fine:hidden"
          onClick={onCommit}
          disabled={busy}
          onFocus={e => setFocused(e.currentTarget.matches(':focus-visible'))}
          onBlur={() => setFocused(false)}
        >
          {label}
        </button>
      </div>
      {tip && !tipDone && hold && (
        // Under the row, pointing up at it, pushing the rows below down rather than covering them
        <div className="pane-inset pt-1 pb-3 bg-surface pointer-fine:hidden">
          <button
            type="button"
            onClick={markTipDone}
            className="relative inline-flex items-center gap-2 rounded-xl bg-inverse text-on-inverse text-sm px-3 py-2 animate-in fade-in duration-300"
          >
            <span className="absolute -top-1 left-5 w-2.5 h-2.5 rotate-45 bg-inverse" aria-hidden="true" />
            Press and hold to log
            <span className="font-semibold">Got it</span>
          </button>
        </div>
      )}
    </div>
  );
}
