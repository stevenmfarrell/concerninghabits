'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check, Keyboard, Loader2, Mic } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import QuillIconWavy from '@/components/QuillIconWavy';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';
import { MAX_AI_INPUT_LENGTH } from '@/lib/constants';

type Mode = 'speak' | 'type';

// The viewer's chosen input mode, remembered in localStorage and shared by every SpeakOrType, so
// choosing Type once applies everywhere. Read through useSyncExternalStore so the server render and
// hydration use the default and the stored choice applies right after, without a hydration mismatch.
// (The key predates this component, from when only the dashboard's SmartEntry had it.)
const MODE_KEY = 'smartEntryMode';
const modeListeners = new Set<() => void>();
function subscribeMode(listener: () => void) {
  modeListeners.add(listener);
  return () => { modeListeners.delete(listener); };
}
function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'type' ? 'type' : 'speak';
  } catch {
    return 'speak';
  }
}
function storeMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
  modeListeners.forEach(listener => listener());
}

// What the parent is doing with submitted input; the panel stays open showing it until cleared
export type SpeakOrTypeStatus = { message: string; input: string } | null;

interface SpeakOrTypeProps {
  // In the round button, with a small badge for whether a tap speaks or types
  icon: ReactNode;
  ariaLabel: { speak: string; type: string };
  disabled?: boolean;
  // A link at the bottom of the panel to do it another way, e.g. build a habit by hand
  panelLink?: { href: string; label: string; icon: ReactNode };
  prompt: { listening: string; typing: string; hint: string; placeholder: string };
  examples: string[];
  status: SpeakOrTypeStatus;
  onInput: (input: string) => void;
}

// A round button for giving the AI some input by voice or typing, raised in the middle of the
// bottom nav (see BottomNav). A tap opens a full-screen panel: listening (live transcript, Done /
// Cancel) or a text box, whichever was used last, with example inputs and a button to switch to the
// other, then whatever `status` the parent sets while it works on the input.
export default function SpeakOrType({
  icon,
  ariaLabel,
  disabled,
  panelLink,
  prompt,
  examples,
  status,
  onInput,
}: SpeakOrTypeProps) {
  const mode = useSyncExternalStore(subscribeMode, readMode, () => 'speak' as const);
  const [typing, setTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');

  const { isListening, liveTranscript, start, stop, cancel } = useSpeechRecognition(onInput);

  const panelOpen = isListening || typing || status !== null;

  const handleMainClick = () => {
    if (mode === 'speak') start();
    else setTyping(true);
  };

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const input = typedInput.trim();
    if (!input) return;
    setTyping(false);
    setTypedInput('');
    onInput(input);
  };

  // An example tapped while listening stops it, and opens the text box with the example in it, as
  // tapping one while typing fills the box, so it can be changed before it's sent
  const pickWhileListening = (example: string) => {
    cancel();
    setTypedInput(example);
    setTyping(true);
  };

  // Switches between listening and typing, remembering the choice for next time
  const switchTo = (next: Mode) => {
    storeMode(next);
    if (next === 'type') {
      cancel();
      setTyping(true);
    } else {
      setTyping(false);
      start();
    }
  };

  // The panel's last row: switching to the other way of giving input, and `panelLink`
  const otherWays = (current: Mode) => (
    <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm">
      <Button type="button" variant="inverse-ghost" size="sm" onClick={() => switchTo(current === 'speak' ? 'type' : 'speak')}>
        {current === 'speak' ? <Keyboard className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {current === 'speak' ? 'Type instead' : 'Speak instead'}
      </Button>
      {panelLink && (
        <Link
          href={panelLink.href}
          onClick={() => {
            cancel();
            setTyping(false);
          }}
          className={buttonClasses('inverse-ghost', 'sm')}
        >
          {panelLink.icon}
          {panelLink.label}
        </Link>
      )}
    </div>
  );

  return (
    <>
      {/* Its own round shape rather than a Button: the nav's one raised control */}
      <button
        type="button"
        onClick={handleMainClick}
        disabled={disabled || panelOpen}
        title={ariaLabel[mode]}
        aria-label={ariaLabel[mode]}
        className="relative w-14 h-14 rounded-full bg-accent text-on-accent shadow-lg ring-4 ring-canvas flex items-center justify-center hover:bg-accent-hover active:scale-95 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-focus"
      >
        {icon}
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-surface text-accent-ink border border-line flex items-center justify-center" aria-hidden="true">
          {mode === 'speak' ? <Mic className="w-3 h-3" strokeWidth={2.5} /> : <Keyboard className="w-3 h-3" strokeWidth={2.5} />}
        </span>
      </button>

      {/* Full-screen while listening, typing, or working on the input. Above the bottom nav (z-50),
          and portaled to <body> since a transformed ancestor (e.g. an entry animation) would
          otherwise make `fixed` relative to it rather than the screen. */}
      {panelOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={status ? 'Working' : isListening ? 'Listening' : prompt.typing}
          className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-emerald-700 to-emerald-950 text-white animate-in fade-in duration-200"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {status ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-200" />
              <p className="text-2xl font-semibold max-w-xl break-words">“{status.input}”</p>
              <p className="text-emerald-100">{status.message}</p>
            </div>
          ) : isListening ? (
            <>
              <div className="flex-1 flex flex-col items-center justify-center gap-10 px-6 text-center">
                <div className="flex items-center gap-1.5 h-20" aria-hidden="true">
                  {[0, 0.35, 0.15, 0.5, 0.25, 0.45, 0.1].map((delay, i) => (
                    <span
                      key={i}
                      className="w-2 h-full rounded-full bg-emerald-300 animate-voice-bar motion-reduce:animate-none motion-reduce:h-1/3"
                      style={{ animationDelay: `${delay}s` }}
                    />
                  ))}
                </div>
                {liveTranscript ? (
                  <p className="text-2xl sm:text-3xl font-semibold max-w-xl break-words" aria-live="polite">{liveTranscript}</p>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-2xl font-semibold">{prompt.listening}</p>
                      <p className="text-emerald-100">{prompt.hint}</p>
                    </div>
                    <Examples examples={examples} heading="Try saying, or tap one" onPick={pickWhileListening} />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 px-6 pb-8">
                <Button variant="inverse" size="xl" onClick={stop} className="min-w-48 rounded-full!">
                  <Check className="w-6 h-6" strokeWidth={2.5} />
                  Done
                </Button>
                <Button variant="inverse-ghost" onClick={cancel}>
                  Cancel
                </Button>
                {otherWays('speak')}
              </div>
            </>
          ) : (
            <form onSubmit={submitTyped} className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
                <div className="space-y-1">
                  <p className="text-2xl font-semibold">{prompt.typing}</p>
                  <p className="text-emerald-100">{prompt.hint}</p>
                </div>
                <textarea
                  className="w-full max-w-xl px-4 py-3 bg-white text-stone-900 border-0 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-300 min-h-[112px] resize-none text-lg"
                  placeholder={prompt.placeholder}
                  maxLength={MAX_AI_INPUT_LENGTH}
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  autoFocus
                  autoComplete="off"
                  data-1p-ignore
                  enterKeyHint="send"
                />
                <Examples examples={examples} heading="Tap an example" onPick={setTypedInput} />
              </div>
              <div className="flex flex-col items-center gap-2 px-6 pb-8">
                <Button type="submit" variant="inverse" size="xl" disabled={!typedInput.trim()} className="min-w-48 rounded-full!">
                  <QuillIconWavy className="w-6 h-6" strokeWidth={2.5} />
                  Go
                </Button>
                <Button type="button" variant="inverse-ghost" onClick={() => setTyping(false)}>
                  Cancel
                </Button>
                {otherWays('type')}
              </div>
            </form>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

// Example inputs for the panel under `heading`, each a button, since anything shaped like one gets
// tapped: `onPick` puts it in the text box (opening it first, while listening)
function Examples({ examples, heading, onPick }: { examples: string[]; heading: string; onPick: (example: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/80">{heading}</p>
      <ul className="flex flex-wrap justify-center gap-2 max-w-xl">
        {examples.map(example => (
          <li key={example}>
            <button
              type="button"
              onClick={() => onPick(example)}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm text-emerald-50 transition-colors"
            >
              “{example}”
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
