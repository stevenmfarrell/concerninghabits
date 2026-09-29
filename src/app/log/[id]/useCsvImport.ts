'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { importHabitLogsCsv } from '../../actions/db';

// CSV import: parse the picked file's rows against the habit's schema and report the outcome.
export function useCsvImport(habitId: string, onImported: () => void) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    setImporting(true);
    const loadingToast = toast.loading('Importing CSV...');
    try {
      const text = await file.text();
      const { imported, skipped, errors } = await importHabitLogsCsv(habitId, text);

      if (imported === 0 && errors.length > 0) {
        toast.error(errors[0], { id: loadingToast });
      } else {
        const summary = skipped > 0
          ? `Imported ${imported} ${imported === 1 ? 'entry' : 'entries'}, skipped ${skipped}.`
          : `Imported ${imported} ${imported === 1 ? 'entry' : 'entries'}.`;
        toast.success(summary, { id: loadingToast });
        if (errors.length > 0) {
          errors.slice(0, 3).forEach(err => toast.error(err));
        }
      }
      onImported();
    } catch (err) {
      toast.error(`Failed to import CSV: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: loadingToast });
    } finally {
      setImporting(false);
    }
  };

  return { importInputRef, importing, handleImportCsv };
}
