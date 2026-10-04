import type { DefaultToastOptions } from 'react-hot-toast';

// The app's toast defaults, shared by the <Toaster> and ToastTouchResume, which runs react-hot-toast's
// timers too and must give each toast the same duration
// Colors are the theme's (see globals.css), so toasts follow light and dark mode
export const TOAST_OPTIONS: DefaultToastOptions = {
  duration: 4000,
  // Others (e.g. errors) keep react-hot-toast's white card, as the theme's surface
  style: {
    background: 'var(--surface)',
    color: 'var(--ink)',
  },
  success: {
    style: {
      background: 'var(--inverse)',
      color: 'var(--on-inverse)',
      fontWeight: '500',
    },
    iconTheme: {
      primary: 'var(--accent)',
      secondary: 'var(--on-accent)',
    },
  },
};
