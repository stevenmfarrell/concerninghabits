'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mic, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { generateHabitSchema, matchSpokenHabit, type SpokenHabitCandidate } from './actions/habit';
import { PENDING_VOICE_LOG_KEY } from '@/lib/constants';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';

// The dashboard's "say what you did" button. Jev matches the phrase to one of the user's habits,
// whose log page then fills in and submits the entry, or to a new habit, which Gemini drafts for
// the user to review. When Jev isn't sure, the user picks from its top candidates instead.
export default function VoiceCapture() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [picker, setPicker] = useState<{ transcript: string; candidates: SpokenHabitCandidate[] } | null>(null);

  const proceed = async (candidate: SpokenHabitCandidate, transcript: string, toastId?: string) => {
    setPicker(null);

    if (candidate.habitId) {
      sessionStorage.setItem(PENDING_VOICE_LOG_KEY, JSON.stringify({ habitId: candidate.habitId, transcript }));
      if (toastId) toast.dismiss(toastId);
      router.push(`/log/${candidate.habitId}`);
      return;
    }

    setIsProcessing(true);
    const loadingToast = toast.loading('Designing a new habit...', { id: toastId });
    const result = await generateHabitSchema(`Something I just did, which I want to start tracking as a habit: "${transcript}"`);
    if (result.success) {
      // The transcript rides along so saving the drafted habit can also log it as the first entry
      sessionStorage.setItem('draftHabit', JSON.stringify({ ...result, transcript }));
      toast.dismiss(loadingToast);
      router.push('/create/refine');
    } else {
      toast.error(result.error || 'Failed to design a new habit', { id: loadingToast });
      setIsProcessing(false);
    }
  };

  const handleTranscript = async (transcript: string) => {
    setIsProcessing(true);
    const loadingToast = toast.loading(`Matching “${transcript}”...`);

    try {
      const result = await matchSpokenHabit(transcript);
      if (!result.success) {
        toast.error(result.error, { id: loadingToast });
      } else if (result.confident) {
        await proceed(result.candidates[0], transcript, loadingToast);
        return;
      } else {
        toast.dismiss(loadingToast);
        // Always offer a new habit, even when it's not among Jev's top candidates
        const candidates = result.candidates.some(c => !c.habitId)
          ? result.candidates
          : [...result.candidates, { habitId: null, name: 'New habit', probability: 0 }];
        setPicker({ transcript, candidates });
      }
    } catch {
      toast.error('Failed to connect to AI', { id: loadingToast });
    }
    setIsProcessing(false);
  };

  const { isListening, toggleListen } = useSpeechRecognition(handleTranscript);

  return (
    <>
      <Button
        variant="outline"
        onClick={toggleListen}
        disabled={isProcessing}
        title={isListening ? 'Stop listening' : 'Say what you did'}
        aria-label={isListening ? 'Stop listening' : 'Say what you did'}
        aria-pressed={isListening}
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isListening ? (
          <span className="w-5 h-5 flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          </span>
        ) : (
          <Mic className="w-5 h-5" />
        )}
        <span className="hidden sm:inline">{isListening ? 'Listening...' : 'I did...'}</span>
      </Button>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-stone-900">Which habit was that?</h3>
                <p className="text-stone-500 leading-relaxed">“{picker.transcript}”</p>
              </div>
              <div className="flex flex-col gap-2">
                {picker.candidates.map(candidate => (
                  <Button
                    key={candidate.habitId ?? 'new'}
                    variant="outline"
                    size="lg"
                    onClick={() => proceed(candidate, picker.transcript)}
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
