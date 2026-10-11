'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import CopyField from '@/components/CopyField';
import { makeApiKey } from '@/app/actions/apiKeys';
import { describeField, fieldsOf, type FieldSchema } from '@/lib/formFields';
import { parseHabitSchema } from '@/lib/habitSchema';
import { MAX_NAME_LENGTH } from '@/lib/constants';

// A value to show for a field in the example request
function exampleValue(field: FieldSchema) {
  if (Array.isArray(field.enum) && field.enum.length > 0) return field.enum[0];
  if (field['x-widget'] === 'duration') return 30;
  if (field.type === 'number' || field.type === 'integer') return 1;
  if (field.type === 'boolean') return true;
  return '...';
}

// How another app logs this habit through the API (see src/app/api/habits/[id]/log/route.ts): its
// address, its form's field keys, an example request, where to read its entries, and for an app that
// can't send headers, a key made on the spot to put in the address
export default function WebhookDialog({ habit, onClose }: { habit: { id: string; name: string; schema: string }; onClose: () => void }) {
  const [making, setMaking] = useState(false);
  const [keyedUrl, setKeyedUrl] = useState<string | null>(null);

  const base = `${window.location.origin}/api/habits/${habit.id}`;
  const url = `${base}/log`;
  const schema = parseHabitSchema(habit.schema);
  const fields = Object.entries(fieldsOf(schema));
  const required = new Set(schema.required ?? []);
  const body = fields.length > 0 ? JSON.stringify({ values: Object.fromEntries(fields.map(([key, field]) => [key, exampleValue(field)])) }) : null;
  const curl = `curl -X POST ${url} \\\n  -H "Authorization: Bearer YOUR_KEY"${body ? ` \\\n  -d '${body}'` : ''}`;

  const makeKeyedUrl = async () => {
    setMaking(true);
    try {
      // Only to log: an address with a key in it is the likeliest to be seen by someone else
      const result = await makeApiKey(`${habit.name} webhook`.slice(0, MAX_NAME_LENGTH), { canLog: true, canRead: false });
      if (result.success) setKeyedUrl(`${url}?key=${result.key}`);
      else toast.error(result.error);
    } catch {
      toast.error('Couldn\'t make a key');
    } finally {
      setMaking(false);
    }
  };

  return (
    <Dialog label="Log from Another App" onClose={onClose}>
      <div className="p-6 sm:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full shrink-0 bg-accent-soft-strong text-accent-ink">
            <Zap className="w-6 h-6" />
          </div>
          <div className="space-y-2 min-w-0">
            <h3 className="text-xl font-bold text-ink">Log from Another App</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Apps like Shortcuts and Home Assistant can log {habit.name} with a POST request to this address, sending an <Link href="/settings/api-keys" className="text-accent-ink underline">API key</Link>.
            </p>
          </div>
        </div>

        <CopyField label="address" value={url} />

        {fields.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-ink">Its fields</h4>
            <ul className="text-sm space-y-1">
              {fields.map(([key, field]) => (
                <li key={key} className="flex flex-wrap gap-x-2">
                  <code className="font-mono text-xs text-ink py-0.5">{key}</code>
                  <span className="text-ink-muted">{describeField(field)}{required.has(key) ? ', required' : ''}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-muted">
              Send them under <code className="font-mono text-xs">&quot;values&quot;</code>, or send <code className="font-mono text-xs">{'{"text": "..."}'}</code> in your own words for AI to fill them in. A duration is in minutes.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">Example</h4>
          <CopyField label="request" multiline value={curl} />
          <p className="text-sm text-ink-muted">
            Add <code className="font-mono text-xs">&quot;at&quot;</code>, a date and time, for something done earlier.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">Its latest entries</h4>
          <p className="text-sm text-ink-muted">GET this address with a key that can read entries, for up to 100 at a time:</p>
          <CopyField label="entries address" value={`${base}/entries?limit=10`} />
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">For an app that can&apos;t send headers</h4>
          {keyedUrl ? (
            <>
              <CopyField label="address with key" value={keyedUrl} />
              <p className="text-sm text-ink-muted">
                Copy it now: its key won&apos;t be shown again. It can only log, but to any of your habits, so keep it private. Change or revoke it under Settings → API Keys.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                Make a key just for this that can only log, put into the address, to POST to as it is (e.g. from an NFC tag or a Stream Deck).
              </p>
              <Button variant="outline" size="sm" onClick={makeKeyedUrl} disabled={making}>
                {making && <Loader2 className="w-4 h-4 animate-spin" />}
                Make Address with Key
              </Button>
            </>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </Dialog>
  );
}
