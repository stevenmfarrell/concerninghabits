'use client';

import { useLayoutEffect } from 'react';
import { applyTheme, watchTheme } from '@/lib/theme';

// Keeps <html>'s theme in step after THEME_SCRIPT first sets it: with the device's setting when
// that's what's followed, and with a choice made in another tab. It also re-applies it on mount,
// since React clears attributes it doesn't manage from <html> on Strict Mode's dev remount.
export default function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme();
    return watchTheme();
  }, []);

  return null;
}
