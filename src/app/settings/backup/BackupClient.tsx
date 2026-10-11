'use client';

import { useRef, useState } from 'react';
import { FileJson, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { buttonClasses, Button } from '@/components/ui/Button';
import { PANE_INSET, PaneSection } from '@/components/Pane';
import type { RestoreResult } from '@/app/actions/backupStore';

// A restore's outcome in words, e.g. "Added 3 habits and 120 entries. 4 were already here."
function describeRestore({ added, alreadyThere }: RestoreResult) {
  const counts = [
    [added.categories, 'category', 'categories'],
    [added.habits, 'habit', 'habits'],
    [added.entries, 'entry', 'entries'],
    [added.skips, 'skip', 'skips'],
    [added.vacations, 'vacation', 'vacations'],
  ] as const;
  const parts = counts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  const addedText = parts.length === 0 ? 'Nothing new to add.' : `Added ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}.`;
  return alreadyThere > 0 ? `${addedText} ${alreadyThere} ${alreadyThere === 1 ? 'was' : 'were'} already here.` : addedText;
}

// Downloads (plain links to the backup route, which sends the file) and a restore from a picked file
export default function BackupClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const restore = async (file: File) => {
    setRestoring(true);
    setResult(null);
    try {
      const response = await fetch('/api/backup', { method: 'POST', body: await file.text(), headers: { 'Content-Type': 'text/plain' } });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) throw new Error(body?.error ?? 'The restore didn\'t go through');
      setResult(body);
      toast.success(describeRestore(body));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The restore didn\'t go through');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <PaneSection title="Download">
        <div className={`${PANE_INSET} py-4 flex flex-wrap gap-3`}>
          <a href="/api/backup?format=json" download className={buttonClasses('outline')}>
            <FileJson className="w-5 h-5" />
            JSON
          </a>
          <a href="/api/backup?format=csv" download className={buttonClasses('outline')}>
            <FileSpreadsheet className="w-5 h-5" />
            CSV
          </a>
        </div>
      </PaneSection>

      <PaneSection title="Restore">
        <div className={`${PANE_INSET} py-4 space-y-3`}>
          <p className="text-sm text-ink-muted">
            Adds what&apos;s in a backup (JSON or CSV) to your data. Nothing you have now is changed or removed, except your preferences, and anything already here is skipped, so restoring the same backup twice is safe.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void restore(file);
            }}
          />
          <Button variant="outline" disabled={restoring} onClick={() => fileRef.current?.click()}>
            {restoring ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {restoring ? 'Restoring…' : 'Restore from a File'}
          </Button>
          {result && (
            <div className="text-sm text-ink-secondary space-y-1" role="status">
              <p>{describeRestore(result)}</p>
              {result.problems.length > 0 && (
                <>
                  <p className="text-ink-muted">Left out:</p>
                  <ul className="list-disc pl-5 text-ink-muted">
                    {result.problems.map((problem, i) => <li key={i}>{problem}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </PaneSection>
    </>
  );
}
