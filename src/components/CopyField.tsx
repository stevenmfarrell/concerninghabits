'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { IconButton } from '@/components/ui/IconButton';

// Something to copy as it is (a URL, a key, a request), in monospace with a copy button. `multiline`
// keeps its line breaks, for a request or a JSON body; otherwise it's one line that wraps anywhere.
export default function CopyField({ value, label, multiline = false }: { value: string; label: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Couldn\'t copy it. Select it and copy it yourself.');
    }
  };

  return (
    <div className="flex items-start gap-1 rounded-lg bg-surface-subtle border border-line pl-3 pr-1 py-1">
      <code className={`flex-1 min-w-0 py-1.5 text-xs font-mono text-ink select-all ${multiline ? 'whitespace-pre-wrap break-all' : 'break-all'}`}>
        {value}
      </code>
      <IconButton size="sm" onClick={copy} title={`Copy ${label}`} aria-label={`Copy ${label}`}>
        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
      </IconButton>
    </div>
  );
}
