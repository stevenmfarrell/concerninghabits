import type { DefaultToastOptions } from 'react-hot-toast';

// The app's toast defaults, shared by the <Toaster> and ToastTouchResume, which runs react-hot-toast's
// timers too and must give each toast the same duration
export const TOAST_OPTIONS: DefaultToastOptions = {
  duration: 4000,
  success: {
    style: {
      background: '#1c1917', // stone-900
      color: '#fff',
      fontWeight: '500',
    },
    iconTheme: {
      primary: '#10b981', // emerald-500
      secondary: '#fff',
    },
  },
};
