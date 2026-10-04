'use client';

import { useEffect, useRef } from 'react';
import { useToaster, useToasterStore } from 'react-hot-toast';
import { TOAST_OPTIONS } from './toastOptions';

// react-hot-toast pauses every toast while the pointer is over them, until it leaves. A tap on a
// phone fires an emulated hover that never leaves (until the next tap elsewhere), so tapping a
// toast's button, e.g. Undo, left the toast that followed it paused for good. Pausing is for a
// mouse resting on a toast to read it, so a pause that came from a tap is ended straight away.
export default function ToastTouchResume() {
  const { handlers } = useToaster(TOAST_OPTIONS);
  const { pausedAt } = useToasterStore();
  const lastPointerType = useRef('mouse');

  useEffect(() => {
    const track = (e: PointerEvent) => {
      lastPointerType.current = e.pointerType;
    };
    document.addEventListener('pointerdown', track, { capture: true, passive: true });
    return () => document.removeEventListener('pointerdown', track, { capture: true });
  }, []);

  useEffect(() => {
    if (pausedAt && lastPointerType.current !== 'mouse') handlers.endPause();
  }, [pausedAt, handlers]);

  return null;
}
