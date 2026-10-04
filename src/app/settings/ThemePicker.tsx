'use client';

import { useSyncExternalStore } from 'react';
import { PaneField } from '@/components/Pane';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { readThemePreference, setThemePreference, subscribeThemePreference, type ThemePreference } from '@/lib/theme';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Light or dark mode for this device. It applies as soon as it's picked, apart from the form's Save.
export default function ThemePicker() {
  // The choice is only in the browser, so the server renders 'system' and hydration corrects it
  const theme = useSyncExternalStore(subscribeThemePreference, readThemePreference, () => 'system' as const);

  return (
    <PaneField label="Theme" description="Saved on this device. System follows your device's light or dark setting.">
      <div>
        <SegmentedControl label="Theme" options={THEMES} value={theme} onChange={setThemePreference} />
      </div>
    </PaneField>
  );
}
