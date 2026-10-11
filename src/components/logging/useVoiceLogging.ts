'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { parseVoiceLog } from '@/app/actions/habit';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';
import { queueTextEntry } from '@/lib/offline/actions';
import { isNetworkError } from '@/lib/offline/sync';

// `source` describes where the data came from, for the logged-entry toast
type OnExtracted = (data: Record<string, unknown>, loadingToastId: string, source: string) => void | Promise<void>;

// Voice logging: record a phrase, send the transcript to the AI parser, and hand any extracted
// fields to `onExtracted`. Isolated in its own hook so LogClient doesn't also have to reason about
// SpeechRecognition's lifecycle alongside its photo/CSV/form concerns. `processTranscript` is also
// exposed for a phrase said or typed elsewhere (the dashboard's SmartEntry) that was matched to this habit.
// Offline, the phrase is kept to fill in an entry on `habit` once back online (see src/lib/offline),
// and `onQueued` is called, e.g. to close the entry sheet.
export function useVoiceLogging(habit: { id: string; name: string; schema: string; aiContext?: string | null }, onExtracted: OnExtracted, onQueued?: () => void) {
  const [isProcessing, setIsProcessing] = useState(false);
  const habitSchema = habit.schema;
  const aiContext = habit.aiContext ?? null;

  const keepForLater = async (transcript: string, loadingToast: string) => {
    try {
      await queueTextEntry(habit, transcript);
      toast(`“${transcript}” will be filled in and logged once you're back online`, { id: loadingToast, icon: '📴', duration: 8000 });
      onQueued?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t save it', { id: loadingToast });
    }
  };

  const processTranscript = async (transcript: string, loadingMessage = 'AI is processing your voice...') => {
    setIsProcessing(true);
    const loadingToast = toast.loading(loadingMessage);

    try {
      if (!navigator.onLine) return await keepForLater(transcript, loadingToast);
      const result = await parseVoiceLog(habitSchema, transcript, aiContext);
      if (result.success && result.data) {
        await onExtracted(result.data, loadingToast, `From “${transcript}”`);
      } else {
        toast.error(result.error || 'AI could not understand', { id: loadingToast });
      }
    } catch (err) {
      if (isNetworkError(err)) await keepForLater(transcript, loadingToast);
      else toast.error('Failed to connect to AI', { id: loadingToast });
    } finally {
      setIsProcessing(false);
    }
  };

  const { isListening, toggleListen } = useSpeechRecognition(processTranscript);

  return { isListening, isProcessing, toggleListen, processTranscript };
}
