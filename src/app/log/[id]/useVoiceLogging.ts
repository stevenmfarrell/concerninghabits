'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { parseVoiceLog } from '../../actions/habit';

// The Web Speech API isn't in TS's DOM lib; this covers the small surface used here.
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type OnExtracted = (data: Record<string, unknown>, loadingToastId: string) => void | Promise<void>;

// Voice logging: record a phrase, send the transcript to the AI parser, and hand any extracted
// fields to `onExtracted`. Isolated in its own hook so LogClient doesn't also have to reason about
// SpeechRecognition's lifecycle alongside its photo/CSV/form concerns.
export function useVoiceLogging(habitSchema: string, onExtracted: OnExtracted) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Kept current so the effect below doesn't need to recreate the recognition object (and lose
  // its listening state) every time `onExtracted`'s identity changes.
  const onExtractedRef = useRef(onExtracted);
  useEffect(() => {
    onExtractedRef.current = onExtracted;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const globalWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognition = globalWindow.SpeechRecognition || globalWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      setIsProcessing(true);
      const loadingToast = toast.loading('AI is processing your voice...');

      try {
        const result = await parseVoiceLog(habitSchema, transcript);
        if (result.success && result.data) {
          await onExtractedRef.current(result.data, loadingToast);
        } else {
          toast.error(result.error || 'AI could not understand', { id: loadingToast });
        }
      } catch {
        toast.error('Failed to connect to AI', { id: loadingToast });
      } finally {
        setIsProcessing(false);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      if (event.error !== 'aborted') {
        toast.error(`Microphone error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [habitSchema]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast('Listening...', { icon: '🎙️' });
      } catch (e) {
        console.error(e);
      }
    }
  };

  return { isListening, isProcessing, toggleListen };
}
