import * as LucideIcons from 'lucide-react';

// Whether `name` is one of the icons IconPicker offers. Checked on the server when a category's
// icon is saved, since it comes from the browser.
export function isIconName(name: string) {
  return /^[A-Z]/.test(name) && !name.endsWith('Icon') && typeof (LucideIcons as Record<string, unknown>)[name] === 'object';
}
