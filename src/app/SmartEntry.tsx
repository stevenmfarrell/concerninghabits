'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Keyboard, Loader2, Mic, SquarePen, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import QuillIconWavy from '@/components/QuillIconWavy';
import { generateHabitSchema, interpretSmartEntry, type HabitCandidate } from './actions/habit';
import { setPendingSmartEntry } from '@/lib/pendingSmartEntry';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';

type Mode = 'speak' | 'type';

// The viewer's chosen input mode, remembered in localStorage. Read through useSyncExternalStore so
// the server render and hydration use the default and the stored choice applies right after,
// without a hydration mismatch.
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

// The dashboard's main button: say or type what you did, or a habit you want to start. Jev picks
// which habit it's about (or a new one) and whether it reports something done. Something done on an
// existing habit goes to that habit's log page, which fills in and submits the entry; a new habit is
// drafted by Gemini for the user to review, with the input as its first entry when it was something
// done. When Jev isn't sure which habit, the user picks from its top candidates instead.
export default function SmartEntry() {
  const router = useRouter();
  const mode = useSyncExternalStore(subscribeMode, readMode, () => 'speak' as const);
  const [menuOpen, setMenuOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [picker, setPicker] = useState<{ input: string; candidates: HabitCandidate[]; didIt: boolean } | null>(null);

  const proceed = async (candidate: HabitCandidate, input: string, didIt: boolean, toastId?: string) => {
    setPicker(null);

    if (candidate.habitId) {
      if (toastId) toast.dismiss(toastId);
      if (didIt) {
        setPendingSmartEntry(candidate.habitId, input);
      } else {
        // e.g. "I want to run more" when they already track running: show the habit, log nothing
        toast(`You already track ${candidate.name}`, { icon: '👍' });
      }
      router.push(`/log/${candidate.habitId}`);
      return;
    }

    setIsProcessing(true);
    const loadingToast = toast.loading('Designing a new habit...', { id: toastId });
    const result = await generateHabitSchema(
      didIt ? `Something I just did, which I want to start tracking as a habit: "${input}"` : input
    );
    if (result.success) {
      // The input rides along so saving the drafted habit can also log it as the first entry
      sessionStorage.setItem('draftHabit', JSON.stringify({ ...result, transcript: input, logFirstEntry: didIt }));
      toast.dismiss(loadingToast);
      router.push('/create/refine');
    } else {
      toast.error(result.error || 'Failed to design a new habit', { id: loadingToast });
      setIsProcessing(false);
    }
  };

  const handleInput = async (input: string) => {
    setIsProcessing(true);
    const loadingToast = toast.loading(`Matching “${input}”...`);

    try {
      const result = await interpretSmartEntry(input);
      if (!result.success) {
        toast.error(result.error, { id: loadingToast });
      } else if (result.confident) {
        await proceed(result.candidates[0], input, result.didIt, loadingToast);
        return;
      } else {
        toast.dismiss(loadingToast);
        // Always offer a new habit, even when it's not among Jev's top candidates
        const candidates = result.candidates.some(c => !c.habitId)
          ? result.candidates
          : [...result.candidates, { habitId: null, name: 'New habit', probability: 0 }];
        setPicker({ input, candidates, didIt: result.didIt });
      }
    } catch {
      toast.error('Failed to connect to AI', { id: loadingToast });
    }
    setIsProcessing(false);
  };

  const { isListening, toggleListen } = useSpeechRecognition(handleInput);

  const handleMainClick = () => {
    if (mode === 'speak') toggleListen();
    else setTyping(true);
  };

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const input = typedInput.trim();
    if (!input) return;
    setTyping(false);
    setTypedInput('');
    handleInput(input);
  };

  const chooseMode = (next: Mode) => {
    storeMode(next);
    setMenuOpen(false);
  };

  const mainLabel = isListening ? 'Stop listening' : mode === 'speak' ? 'Say what you did' : 'Type what you did';

  return (
    <>
      <div className="relative flex">
        <Button
          size="lg"
          onClick={handleMainClick}
          disabled={isProcessing}
          title={mainLabel}
          aria-label={mainLabel}
          aria-pressed={mode === 'speak' ? isListening : undefined}
          className="rounded-r-none px-5!"
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <QuillIconWavy className="w-6 h-6" strokeWidth={2.5} />
          )}
          {isListening ? (
            <span className="w-6 h-6 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
            </span>
          ) : mode === 'speak' ? (
            <Mic className="w-6 h-6" strokeWidth={2.5} />
          ) : (
            <Keyboard className="w-6 h-6" strokeWidth={2.5} />
          )}
        </Button>
        <Button
          size="lg"
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={isProcessing || isListening}
          title="More ways to add"
          aria-label="More ways to add"
          aria-expanded={menuOpen}
          className="rounded-l-none px-2.5! border-l border-emerald-700"
        >
          <ChevronDown className="w-5 h-5" />
        </Button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-lg border border-stone-100 py-2 z-50">
              {([
                { value: 'speak', label: 'Speak', icon: Mic },
                { value: 'type', label: 'Type', icon: Keyboard },
              ] as const).map(({ value, label, icon: ModeIcon }) => (
                <button
                  key={value}
                  onClick={() => chooseMode(value)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors text-left"
                >
                  <ModeIcon className="w-4 h-4" />
                  <span className="flex-1">{label}</span>
                  {mode === value && <Check className="w-4 h-4 text-emerald-600" />}
                </button>
              ))}
              <div className="my-2 border-t border-stone-100" />
              <Link
                href="/create"
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors"
              >
                <SquarePen className="w-4 h-4" />
                Build a habit manually
              </Link>
            </div>
          </>
        )}
      </div>

      {typing && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-24 sm:pt-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={submitTyped} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-stone-900">What did you do?</h3>
                <p className="text-stone-500 text-sm">Or describe a habit you&apos;d like to start tracking.</p>
              </div>
              <textarea
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[96px] resize-none"
                placeholder='e.g. "Ran 3 miles in 28 minutes"'
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
            </div>
            <div className="p-4 sm:px-8 sm:py-6 bg-stone-50 border-t border-stone-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setTyping(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={!typedInput.trim()} className="w-full sm:w-auto">
                <QuillIconWavy className="w-4 h-4" strokeWidth={2.5} />
                Go
              </Button>
            </div>
          </form>
        </div>
      )}

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-stone-900">Which habit was that?</h3>
                <p className="text-stone-500 leading-relaxed">“{picker.input}”</p>
              </div>
              <div className="flex flex-col gap-2">
                {picker.candidates.map(candidate => (
                  <Button
                    key={candidate.habitId ?? 'new'}
                    variant="outline"
                    size="lg"
                    onClick={() => proceed(candidate, picker.input, picker.didIt)}
                    className="w-full"
                  >
                    {!candidate.habitId && <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />}
                    <span className="flex-1 min-w-0 truncate text-left">{candidate.name}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-4 sm:px-8 sm:py-6 bg-stone-50 border-t border-stone-100 flex justify-end">
              <Button variant="ghost" onClick={() => setPicker(null)} className="w-full sm:w-auto">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
