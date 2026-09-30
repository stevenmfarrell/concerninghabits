'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { parseVoiceLog } from '../../actions/habit';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';

type OnExtracted = (data: Record<string, unknown>, loadingToastId: string) => void | Promise<void>;

// Voice logging: record a phrase, send the transcript to the AI parser, and hand any extracted
// fields to `onExtracted`. Isolated in its own hook so LogClient doesn't also have to reason about
// SpeechRecognition's lifecycle alongside its photo/CSV/form concerns. `processTranscript` is also
// exposed for a phrase spoken elsewhere (the dashboard's voice capture) that was matched to this habit.
export function useVoiceLogging(habitSchema: string, aiContext: string | null, onExtracted: OnExtracted) {
  const [isProcessing, setIsProcessing] = useState(false);

  const processTranscript = async (transcript: string) => {
    setIsProcessing(true);
    const loadingToast = toast.loading('AI is processing your voice...');

    try {
      const result = await parseVoiceLog(habitSchema, transcript, aiContext);
      if (result.success && result.data) {
        await onExtracted(result.data, loadingToast);
      } else {
        toast.error(result.error || 'AI could not understand', { id: loadingToast });
      }
    } catch {
      toast.error('Failed to connect to AI', { id: loadingToast });
    } finally {
      setIsProcessing(false);
    }
  };

  const { isListening, toggleListen } = useSpeechRecognition(processTranscript);

  return { isListening, isProcessing, toggleListen, processTranscript };
}
