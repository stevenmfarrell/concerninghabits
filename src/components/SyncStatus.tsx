'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AlertTriangle, CloudOff, Loader2, NotebookPen, Pencil, RotateCcw, SkipForward, Trash2, Undo2 } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { Button } from '@/components/ui/Button';
import { removeOps, updateOp, type QueuedOp } from '@/lib/offline/outbox';
import { syncOutbox } from '@/lib/offline/sync';
import { useOutbox, useReachable } from '@/lib/offline/useOutbox';
import { prefillHref } from '@/lib/prefillHref';
import { formatLogValue } from '@/lib/format';

// A queued change's values in a line, e.g. "distance 3.1 · notes Easy run". The outbox doesn't keep
// the habit's form, so its fields go by their keys.
function describeValues(values: Record<string, unknown>) {
  return Object.entries(values)
    .filter(([, val]) => val !== undefined && val !== null && val !== '')
    .map(([key, val]) => `${key.replace(/_/g, ' ')} ${formatLogValue(val)}`)
    .join(' · ');
}

// What a queued change is, in a line under its habit's name
function describeOp(op: QueuedOp) {
  switch (op.kind) {
    case 'log': return describeValues(op.values) || 'Entry';
    case 'text': return op.habitId ? `“${op.text}”` : 'To match to a habit';
    case 'update': return `Edit${describeValues(op.values) ? `: ${describeValues(op.values)}` : ''}`;
    case 'delete': return 'Delete an entry';
    case 'skip': return `Skip ${op.day}`;
    case 'unskip': return `Undo skip on ${op.day}`;
  }
}

function OpIcon({ op }: { op: QueuedOp }) {
  const className = 'w-4 h-4';
  switch (op.kind) {
    case 'log':
    case 'text': return <NotebookPen className={className} />;
    case 'update': return <Pencil className={className} />;
    case 'delete': return <Trash2 className={className} />;
    case 'skip': return <SkipForward className={className} />;
    case 'unskip': return <Undo2 className={className} />;
  }
}

// The habit page a turned-down entry can be finished on by hand, with what it had filled in: only
// when the server named the habit, which it doesn't for one that's gone
function finishHref(op: QueuedOp) {
  if (!op.failedHabitId || (op.kind !== 'log' && op.kind !== 'text')) return null;
  return prefillHref(op.failedHabitId, op.failedValues ?? (op.kind === 'log' ? op.values : {}));
}

// The outbox's state, in a pill just above the bottom nav: offline, changes waiting to be sent (or
// being sent), and any the server turned down. Nothing while everything's sent and the server can be
// reached. Tapping it lists the changes, to send them now or fix or discard those turned down.
export default function SyncStatus() {
  const outbox = useOutbox();
  const reachable = useReachable();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const pending = outbox.filter(op => op.status === 'pending').length;
  const failed = outbox.filter(op => op.status === 'failed').length;
  const settled = reachable && outbox.length === 0;

  // Everything's sent (or discarded): nothing left to show, so the sheet's closed, and stays closed
  // when something's waiting again
  if (settled) {
    if (open) setOpen(false);
    return null;
  }

  const sendNow = async () => {
    setSending(true);
    try {
      await syncOutbox();
    } finally {
      setSending(false);
    }
  };

  const retry = async (op: QueuedOp) => {
    await updateOp(op.opId, { status: 'pending', error: undefined });
    void syncOutbox();
  };

  const label = failed > 0
    ? `${failed} couldn't sync`
    : !reachable
      ? pending > 0 ? `Offline · ${pending} waiting` : 'Offline'
      : `Syncing ${pending}…`;
  const icon = failed > 0
    ? <AlertTriangle className="w-4 h-4" />
    : !reachable ? <CloudOff className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md border transition-colors ${
          failed > 0 ? 'bg-warning-soft-strong text-warning-ink border-warning-line' : 'bg-inverse text-on-inverse border-transparent'
        }`}
      >
        {icon}
        {label}
      </button>

      {/* Portaled to <body>: the nav it sits on is transformed and blurred, which would make `fixed`
          relative to the nav rather than the screen */}
      {open && createPortal(
        <BottomSheet title={!reachable ? 'Offline' : pending > 0 ? 'Syncing' : 'Couldn\'t Sync'} onClose={() => setOpen(false)}>
          <p className="text-sm text-ink-muted">
            {!reachable
              ? 'You can keep logging, editing and skipping. Changes are kept on this device and sent as soon as you\'re back online. AI fills in anything you said or typed once it\'s sent.'
              : pending > 0
                ? 'These changes were made while offline, and are being sent now.'
                : 'These changes were made while offline, but couldn\'t be made as they were. Finish them by hand, try again, or discard them.'}
          </p>

          {outbox.length > 0 && (
            <ul className="divide-y divide-line-subtle -mx-6 border-y border-line-subtle">
              {[...outbox].reverse().map(op => {
                const href = op.status === 'failed' ? finishHref(op) : null;
                return (
                  <li key={op.opId} className="px-6 py-3 flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${op.status === 'failed' ? 'bg-warning-soft-strong text-warning-ink' : 'bg-surface-muted text-ink-muted'}`}>
                      <OpIcon op={op} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-ink truncate">{op.label}</p>
                      <p className="text-sm text-ink-muted break-words">{describeOp(op)}</p>
                      {op.status === 'failed' && <p className="text-sm text-warning-ink break-words">{op.error}</p>}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {href && (
                          <Link
                            href={href}
                            onClick={() => {
                              void removeOps([op.opId]);
                              setOpen(false);
                            }}
                            className="text-sm font-medium text-accent-ink hover:underline"
                          >
                            Finish by hand
                          </Link>
                        )}
                        {op.status === 'failed' && (
                          <button type="button" onClick={() => retry(op)} className="text-sm font-medium text-ink-secondary hover:underline inline-flex items-center gap-1">
                            <RotateCcw className="w-3.5 h-3.5" /> Try again
                          </button>
                        )}
                        <button type="button" onClick={() => removeOps([op.opId])} className="text-sm font-medium text-danger-ink hover:underline">
                          Discard
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {pending > 0 && (
            <Button variant="outline" onClick={sendNow} disabled={sending} className="w-full">
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              Try Sending Now
            </Button>
          )}
        </BottomSheet>,
        document.body,
      )}
    </>
  );
}
