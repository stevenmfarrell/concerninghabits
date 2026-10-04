'use client';

import { useState } from 'react';
import { ArrowUp, Loader2, Mic, Sparkles } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';

// A one-line box for describing a change to a habit's form for AI to make, typed (Enter applies it)
// or spoken (the mic applies what was heard). `applying` while the change is being made; `onApply`
// resolves true once it's made, which clears the box.
export default function AiTweakInput({ onApply, applying, disabled }: {
  onApply: (change: string) => Promise<boolean>;
  applying: boolean;
  disabled?: boolean;
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
        placeholder={isListening ? 'Listening...' : applying ? 'Updating the form...' : 'Ask AI to change the form'}
        value={isListening ? liveTranscript : text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        disabled={busy || isListening}
        aria-label="Describe a change to the form for AI to make"
        autoComplete="off"
        data-1p-ignore
        enterKeyHint="send"
      />
      <IconButton
        onClick={isListening ? stop : start}
        disabled={busy}
        title={isListening ? 'Stop listening' : 'Say a change'}
        aria-label={isListening ? 'Stop listening' : 'Say a change'}
        className={isListening ? 'text-danger-ink bg-danger-soft animate-pulse' : ''}
      >
        <Mic className="w-4 h-4" />
      </IconButton>
      <IconButton variant="solid" onClick={submit} disabled={busy || isListening || !text.trim()} title="Apply change" aria-label="Apply change">
        <ArrowUp className="w-4 h-4" />
      </IconButton>
    </div>
  );
}
