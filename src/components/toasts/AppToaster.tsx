'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import toast, { resolveValue, ToastBar, useToaster, type Toast } from 'react-hot-toast';
import { BOTTOM_NAV_CLEARANCE } from '@/components/BottomNav';
import { TOAST_OPTIONS } from './notify';

// The most toasts shown at once, newest first. react-hot-toast has no limit, so older ones beyond
// it are dismissed as new ones arrive. Logged and skipped toasts share one of these (see notify).
const MAX_VISIBLE_TOASTS = 2;
// How far a toast is dragged (down, or to either side) before letting go dismisses it
const SWIPE_DISMISS_PX = 48;
// How far a finger moves before it's a swipe rather than a tap on the toast's buttons
const SWIPE_SLOP_PX = 8;

// The app's toasts, drawn here with react-hot-toast's timers (useToaster) rather than its <Toaster>,
// so the app decides how they behave:
// - A toast pauses only while a mouse rests on it, to read it. react-hot-toast's own pauses on any
//   hover, and a tap on a phone is an emulated hover that never leaves, so a tapped toast stayed
//   paused until the next tap elsewhere.
// - A toast swiped down or aside is dismissed.
// - They sit just above the bottom nav and the quill that rises out of it.
export default function AppToaster() {
  const { toasts, handlers } = useToaster(TOAST_OPTIONS);
  // The toast the mouse is resting on, if any
  const hovered = useRef<string | null>(null);

  useEffect(() => {
    toasts.filter(t => t.visible).slice(MAX_VISIBLE_TOASTS).forEach(t => toast.dismiss(t.id));
  }, [toasts]);

  // A toast dismissed under the mouse (its Undo or close clicked) leaves without a pointerleave, which
  // would leave every toast paused
  useEffect(() => {
    if (hovered.current && !toasts.some(t => t.id === hovered.current && t.visible)) {
      hovered.current = null;
      handlers.endPause();
    }
  }, [toasts, handlers]);

  const hover = (id: string | null) => {
    hovered.current = id;
    if (id) handlers.startPause();
    else handlers.endPause();
  };

  return (
    <div
      className="fixed inset-x-0 z-[70] flex flex-col-reverse items-center gap-2 px-4 pointer-events-none"
      style={{ bottom: `calc(${BOTTOM_NAV_CLEARANCE} + env(safe-area-inset-bottom))` }}
    >
      {toasts.map(t => <ToastItem key={t.id} t={t} onHover={hover} onHeight={handlers.updateHeight} />)}
    </div>
  );
}

function ToastItem({ t, onHover, onHeight }: { t: Toast; onHover: (id: string | null) => void; onHeight: (id: string, height: number) => void }) {
  const swipe = useSwipeToDismiss(t);
  const ref = useRef<HTMLDivElement>(null);

  // react-hot-toast's own toasts (ToastBar) stay invisible until their height is known, which its
  // <Toaster> would report
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onHeight(t.id, el.getBoundingClientRect().height);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [t.id, onHeight]);

  return (
    <div
      ref={ref}
      className={`touch-none ${t.visible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={swipe.style}
      onPointerEnter={e => e.pointerType === 'mouse' && onHover(t.id)}
      onPointerLeave={e => e.pointerType === 'mouse' && onHover(null)}
      {...swipe.handlers}
    >
      {t.type === 'custom' ? resolveValue(t.message, t) : <ToastBar toast={t} position="bottom-center" />}
    </div>
  );
}

// Dragging a toast with a finger moves it along; let go far enough down or aside and it's dismissed,
// otherwise it springs back. A touch that barely moves is left alone, as a tap on Undo or close.
function useSwipeToDismiss(t: Toast) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  const end = () => {
    start.current = null;
    setOffset(null);
  };

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current || start.current.id !== e.pointerId) return;
      const x = e.clientX - start.current.x;
      // Only down: up would be into the page
      const y = Math.max(0, e.clientY - start.current.y);
      if (!offset && Math.hypot(x, y) < SWIPE_SLOP_PX) return;
      if (!offset) e.currentTarget.setPointerCapture(e.pointerId);
      setOffset({ x, y });
    },
    onPointerUp: () => {
      if (offset && (offset.y > SWIPE_DISMISS_PX || Math.abs(offset.x) > SWIPE_DISMISS_PX)) toast.dismiss(t.id);
      end();
    },
    onPointerCancel: end,
  };

  const style = offset
    ? { transform: `translate(${offset.x}px, ${offset.y}px)`, opacity: Math.max(0.3, 1 - Math.hypot(offset.x, offset.y) / 160) }
    : { transition: 'transform 150ms ease-out' };
  return { handlers, style };
}
