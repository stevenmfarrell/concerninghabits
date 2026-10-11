'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CloudOff, X } from 'lucide-react';
import { PANE_SURFACE, PaneHeading } from '@/components/Pane';
import { IconButton } from '@/components/ui/IconButton';
import { fieldTitle } from '@/components/widgets/habitForm';
import { formatLogValue } from '@/lib/format';
import type { FieldSchema } from '@/lib/formFields';
import { removeOps } from '@/lib/offline/outbox';
import { useQueuedEntries, useQueuedEntryChange } from '@/lib/offline/useOutbox';

// Above a habit's entries, those logged on this device that haven't been sent yet (see
// src/lib/offline), newest first, laid out like the entries below them, each saying it's waiting (or
// why it was turned down) and with an X to discard it. Nothing when there are none.
export function QueuedEntries({ habitId, schemaProperties, timeZone }: {
  habitId: string;
  schemaProperties: Record<string, FieldSchema>;
  timeZone: string;
}) {
  const queued = useQueuedEntries(habitId);
  if (queued.length === 0) return null;

  return (
    <ul className="divide-y divide-line-subtle border-b border-line-subtle bg-surface-subtle/60">
      {queued.map(op => {
        const values = op.kind === 'log' ? Object.entries(op.values).filter(([, v]) => v !== undefined && v !== null && v !== '') : [];
        const failed = op.status === 'failed';
        return (
          <li key={op.opId} className="flex items-start gap-4 pane-inset py-3">
            <div className="w-30 shrink-0">
              <div className="inline-flex flex-col text-ink whitespace-nowrap">
                <span className="font-medium">{new Date(op.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone })}</span>
                <span className="text-sm text-ink-muted text-right">{new Date(op.createdAt).toLocaleTimeString('en-US', { timeStyle: 'short', timeZone })}</span>
              </div>
            </div>
            <div className="flex-1 text-ink-secondary min-w-0 space-y-1">
              {op.kind === 'text' ? (
                <p className="text-sm break-words">“{op.text}”</p>
              ) : values.length > 0 ? (
                values.map(([key, value]) => (
                  <div key={key} className="text-sm whitespace-pre-line break-words">
                    <span className="font-medium text-ink-secondary">{fieldTitle(key, schemaProperties)}:</span>{' '}
                    {formatLogValue(value, schemaProperties[key])}
                  </div>
                ))
              ) : (
                <span className="text-ink-subtle italic text-sm">Completed</span>
              )}
              <p className={`text-xs font-medium flex items-center gap-1 ${failed ? 'text-warning-ink' : 'text-ink-muted'}`}>
                {failed ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CloudOff className="w-3.5 h-3.5 shrink-0" />}
                {failed ? `Couldn't sync: ${op.error}` : op.kind === 'text' ? 'Waiting to sync, then AI fills it in' : 'Waiting to sync'}
              </p>
            </div>
            <div className="-my-1.5 -mr-2">
              <IconButton onClick={() => removeOps([op.opId])} title="Discard this entry" aria-label="Discard this entry">
                <X className="w-5 h-5" />
              </IconButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// For a habit the server has no entries for yet: its entries logged on this device that are waiting
// to be sent, as its Entries section, or with none, `children` (its empty state)
export function QueuedFirstEntries({ habitId, schemaProperties, timeZone, children }: {
  habitId: string;
  schemaProperties: Record<string, FieldSchema>;
  timeZone: string;
  children: ReactNode;
}) {
  if (useQueuedEntries(habitId).length === 0) return children;
  return (
    <section>
      <PaneHeading>Entries</PaneHeading>
      <div className={PANE_SURFACE}>
        <QueuedEntries habitId={habitId} schemaProperties={schemaProperties} timeZone={timeZone} />
      </div>
    </section>
  );
}

// Under an entry the server has, a change to it made on this device that hasn't been sent yet: an
// edit or a deletion. Nothing when there's none.
export function QueuedChangeNote({ entryId }: { entryId: string }) {
  const change = useQueuedEntryChange(entryId);
  if (!change) return null;
  const failed = change.status === 'failed';
  return (
    <p className={`mt-1 text-xs font-medium flex items-center gap-1 ${failed ? 'text-warning-ink' : 'text-ink-muted'}`}>
      {failed ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CloudOff className="w-3.5 h-3.5 shrink-0" />}
      {failed
        ? `Couldn't sync your ${change.kind === 'delete' ? 'deletion' : 'edit'}: ${change.error}`
        : change.kind === 'delete' ? 'Deleted on this device · waiting to sync' : 'Edited on this device · waiting to sync'}
    </p>
  );
}
