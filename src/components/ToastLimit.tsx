'use client';

import { useEffect } from 'react';
import toast, { useToasterStore } from 'react-hot-toast';

// The most toasts shown at once. react-hot-toast has no limit option, so older ones beyond it are
// dismissed as new ones arrive (its list is newest first).
const MAX_VISIBLE_TOASTS = 2;

export default function ToastLimit() {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter(t => t.visible)
      .slice(MAX_VISIBLE_TOASTS)
      .forEach(t => toast.dismiss(t.id));
  }, [toasts]);

  return null;
}
