'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Mic, Sparkles } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';
import { MAX_AI_INPUT_LENGTH } from '@/lib/constants';

// A one-line box for describing a change for AI to make (by default, to a habit's form), typed
// (Enter applies it) or spoken (the mic applies what was heard). `applying` while the change is
// being made; `onApply` resolves true once it's made, which clears the box. `placeholder`,
// `applyingPlaceholder` and `label` word it for something other than the form.
//
// `fills` is where what AI makes appears, which the send arrow points to: the form `above` it (the
// editor's box, under the form's fields), or the fields `below` it (a sheet's box, at its top).
export default function AiTweakInput({
  onApply,
  applying,
  disabled,
  placeholder = 'Ask AI to change the form',
  applyingPlaceholder = 'Updating the form...',
  label = 'Describe a change to the form for AI to make',
  fills = 'above',
  submitLabel = 'Apply change',
  speakLabel = 'Say a change',
}: {
  onApply: (change: string) => Promise<boolean>;
  applying: boolean;
  disabled?: boolean;
  placeholder?: string;
  applyingPlaceholder?: string;
  label?: string;
  fills?: 'above' | 'below';
  // The send and mic buttons' tooltips and accessible names
  submitLabel?: string;
  speakLabel?: string;
}) {
  const [text, setText] = useState('');
  const apply = async (change: string) => {
    if (await onApply(change)) setText('');
  };
  const { isListening, liveTranscript, start, stop } = useSpeechRecognition(transcript => {
    setText(transcript);
    apply(transcript);
  });

  const busy = applying || disabled;
  const submit = () => {
    const change = text.trim();
    if (change && !busy) apply(change);
  };

  return (
    <div className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-surface-subtle border border-line rounded-xl focus-within:ring-2 focus-within:ring-focus focus-within:border-focus">
      {applying ? <Loader2 className="w-4 h-4 text-accent-ink animate-spin shrink-0" /> : <Sparkles className="w-4 h-4 text-ink-subtle shrink-0" />}
      <input
        type="text"
        className="flex-1 min-w-0 bg-transparent py-1.5 text-sm focus:outline-none placeholder-ink-subtle"
        placeholder={isListening ? 'Listening...' : applying ? applyingPlaceholder : placeholder}
        value={isListening ? liveTranscript : text}
        maxLength={MAX_AI_INPUT_LENGTH}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        disabled={busy || isListening}
        aria-label={label}
        autoComplete="off"
        data-1p-ignore
        enterKeyHint="send"
      />
      <IconButton
        onClick={isListening ? stop : start}
        disabled={busy}
        title={isListening ? 'Stop listening' : speakLabel}
        aria-label={isListening ? 'Stop listening' : speakLabel}
        className={isListening ? 'text-danger-ink bg-danger-soft animate-pulse' : ''}
      >
        <Mic className="w-4 h-4" />
      </IconButton>
      <IconButton variant="solid" onClick={submit} disabled={busy || isListening || !text.trim()} title={submitLabel} aria-label={submitLabel}>
        {fills === 'below' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
      </IconButton>
    </div>
  );
}
