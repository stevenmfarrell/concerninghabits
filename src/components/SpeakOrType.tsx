'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Keyboard, Loader2, Mic } from 'lucide-react';
import { Button, type ButtonSize } from '@/components/ui/Button';
import QuillIconWavy from '@/components/QuillIconWavy';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';
import { MENU_ITEM, MENU_PANEL, MENU_SEPARATOR, MenuBackdrop } from '@/components/ui/Menu';
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

const SPLIT_BORDER = { primary: 'border-accent-hover', secondary: 'border-inverse-hover' } as const;

// What the parent is doing with submitted input; the panel stays open showing it until cleared
export type SpeakOrTypeStatus = { message: string; input: string } | null;

interface SpeakOrTypeProps {
  // Shown before the mode's mic/keyboard icon
  icon: ReactNode;
  // Visible text after the icons; icon-only when omitted
  label?: string;
  ariaLabel: { speak: string; type: string };
  variant?: keyof typeof SPLIT_BORDER;
  size?: ButtonSize;
  disabled?: boolean;
  // Extra items at the bottom of the dropdown, after the Speak/Type choice
  menuExtras?: ReactNode;
  prompt: { listening: string; typing: string; hint: string; placeholder: string };
  examples: string[];
  status: SpeakOrTypeStatus;
  onInput: (input: string) => void;
}

// A split button for giving the AI some input by voice or typing, with a dropdown to switch between
// them. Either way it opens a full-screen panel: listening (live transcript, Done / Cancel) or a text
// box, with example inputs, then whatever `status` the parent sets while it works on the input.
export default function SpeakOrType({
  icon,
  label,
  ariaLabel,
  variant = 'primary',
  size = 'lg',
  disabled,
  menuExtras,
  prompt,
  examples,
  status,
  onInput,
}: SpeakOrTypeProps) {
  const mode = useSyncExternalStore(subscribeMode, readMode, () => 'speak' as const);
  const [menuOpen, setMenuOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');

  const { isListening, liveTranscript, start, stop, cancel } = useSpeechRecognition(onInput);

  const panelOpen = isListening || typing || status !== null;
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

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

  const chooseMode = (next: Mode) => {
    storeMode(next);
    setMenuOpen(false);
  };

  return (
    <>
      <div className="relative inline-flex">
        <Button
          variant={variant}
          size={size}
          onClick={handleMainClick}
          disabled={disabled || panelOpen}
          title={ariaLabel[mode]}
          aria-label={ariaLabel[mode]}
          className={`rounded-r-none ${label ? '' : 'px-5!'}`}
        >
          {icon}
          {mode === 'speak' ? <Mic className={iconSize} strokeWidth={2.5} /> : <Keyboard className={iconSize} strokeWidth={2.5} />}
          {label && <span>{label}</span>}
        </Button>
        <Button
          variant={variant}
          size={size}
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={disabled || panelOpen}
          title="Speak or type"
          aria-label="Speak or type"
          aria-expanded={menuOpen}
          className={`rounded-l-none px-2.5! border-l ${SPLIT_BORDER[variant]}`}
        >
          <ChevronDown className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
        </Button>

        {menuOpen && (
          <>
            <MenuBackdrop onClose={() => setMenuOpen(false)} />
            <div className={`${MENU_PANEL} absolute right-0 top-full mt-1 w-60`}>
              {([
                { value: 'speak', label: 'Speak', icon: Mic },
                { value: 'type', label: 'Type', icon: Keyboard },
              ] as const).map(({ value, label: modeLabel, icon: ModeIcon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseMode(value)}
                  className={MENU_ITEM}
                >
                  <ModeIcon className="w-4 h-4" />
                  <span className="flex-1">{modeLabel}</span>
                  {mode === value && <Check className="w-4 h-4 text-accent-ink" />}
                </button>
              ))}
              {menuExtras && (
                <>
                  <div className={MENU_SEPARATOR} />
                  {menuExtras}
                </>
              )}
            </div>
          </>
        )}
      </div>

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
