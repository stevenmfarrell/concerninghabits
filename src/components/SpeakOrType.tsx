'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
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

// How many things said lately are kept and offered, and how often the example shown moves on
const MAX_RECENT = 5;
const EXAMPLE_EVERY_MS = 4000;

// What was said or typed lately under `key`, newest first (see recentKey). Kept in this browser
// only; an unreadable store is as good as an empty one.
function readRecent(key: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

// Puts `input` first among what was said lately, once, however it was capitalized before
function rememberRecent(key: string, input: string) {
  const rest = readRecent(key).filter(item => item.toLowerCase() !== input.toLowerCase());
  try {
    localStorage.setItem(key, JSON.stringify([input, ...rest].slice(0, MAX_RECENT)));
  } catch {}
}

// What the parent is doing with submitted input; the panel stays open showing it until cleared
export type SpeakOrTypeStatus = { message: string; input: string } | null;

interface SpeakOrTypeProps {
  // In the round button
  icon: ReactNode;
  ariaLabel: { speak: string; type: string };
  disabled?: boolean;
  // A link at the bottom of the panel to do it another way, e.g. build a habit by hand
  panelLink?: { href: string; label: string; icon: ReactNode };
  prompt: { listening: string; typing: string; hint: string };
  // Things one might say, cycled through in the text box's placeholder and under "Listening..."
  examples: string[];
  // Where this browser keeps what was said or typed lately, offered to say again, edited or not;
  // none for a quill that shouldn't (the tutorial's). Per user, on a shared device.
  recentKey?: string;
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
  recentKey,
  status,
  onInput,
}: SpeakOrTypeProps) {
  const mode = useSyncExternalStore(subscribeMode, readMode, () => 'speak' as const);
  const [typing, setTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');

  // What was said or typed lately (see recentKey), read as the panel opens
  const [recent, setRecent] = useState<string[]>([]);
  // Which example the placeholder and "Try saying" show, moving on every few seconds while it's open
  const [exampleIndex, setExampleIndex] = useState(0);
  const example = examples[exampleIndex % examples.length];

  const submit = (input: string) => {
    if (recentKey) rememberRecent(recentKey, input);
    onInput(input);
  };

  const { isListening, liveTranscript, start, stop, cancel } = useSpeechRecognition(submit);

  const panelOpen = isListening || typing || status !== null;
  const asking = isListening || typing;

  useEffect(() => {
    if (!asking) return;
    const timer = setInterval(() => setExampleIndex(index => index + 1), EXAMPLE_EVERY_MS);
    return () => clearInterval(timer);
  }, [asking]);

  // Opens the panel listening or typing, with what was said lately
  const open = (next: Mode) => {
    setRecent(recentKey ? readRecent(recentKey) : []);
    if (next === 'speak') start();
    else setTyping(true);
  };

  const handleMainClick = () => open(mode);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const input = typedInput.trim();
    if (!input) return;
    setTyping(false);
    setTypedInput('');
    submit(input);
  };

  // Something said lately, tapped while listening, stops it and opens the text box with it in it, as
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
        className="w-14 h-14 rounded-full bg-accent text-on-accent shadow-lg ring-4 ring-canvas flex items-center justify-center hover:bg-accent-hover active:scale-95 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-focus"
      >
        {icon}
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
                    {recent.length > 0
                      ? <Recent recent={recent} onPick={pickWhileListening} />
                      : <p className="text-emerald-100/80">Try saying “{example}”</p>}
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
                  placeholder={`e.g. “${example}”`}
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
                {recent.length > 0 && <Recent recent={recent} onPick={setTypedInput} />}
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

// What was said or typed lately, newest first, each a button that puts it in the text box (opening
// it first, while listening) to send again, as it is or changed
function Recent({ recent, onPick }: { recent: string[]; onPick: (input: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/80">Recent</p>
      <ul className="flex flex-wrap justify-center gap-2 max-w-xl">
        {recent.map(input => (
          <li key={input}>
            <button
              type="button"
              onClick={() => onPick(input)}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm text-emerald-50 transition-colors"
            >
              {input}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
