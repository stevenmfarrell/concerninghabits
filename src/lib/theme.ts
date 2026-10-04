// Light or dark mode. The choice is per device, kept in localStorage; 'system' (or nothing stored)
// follows the device's own setting. It's applied as `data-theme` on <html>, which globals.css's
// theme colors key off.
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
// Fired on window when the choice changes in this tab ('storage' covers other tabs)
const CHANGE_EVENT = 'themechange';

// Run inline in <head> (see the root layout), so the page is painted in the right theme from the
// start. Kept in step with applyTheme below.
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(preference = readThemePreference()) {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage blocked (e.g. a private window): the choice still applies until the page reloads
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// For useSyncExternalStore: calls `onChange` when the stored choice changes, here or in another tab
export function subscribeThemePreference(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

// Follows the device's setting as it changes (e.g. at sunset), and a choice made in another tab
export function watchTheme() {
  const media = window.matchMedia(DARK_QUERY);
  const reapply = () => applyTheme();
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === null) reapply(); };
  media.addEventListener('change', reapply);
  window.addEventListener('storage', onStorage);
  return () => {
    media.removeEventListener('change', reapply);
    window.removeEventListener('storage', onStorage);
  };
}
