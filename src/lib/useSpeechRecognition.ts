'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

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

// Records one spoken phrase with the browser's speech recognition and hands its transcript to
// `onTranscript`. Shared by the habit log page's voice logging and the dashboard's voice capture.
export function useSpeechRecognition(onTranscript: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Kept current so the effect below doesn't need to recreate the recognition object (and lose
  // its listening state) every time `onTranscript`'s identity changes.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  useEffect(() => {
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

    recognition.onresult = (event) => {
      setIsListening(false);
      onTranscriptRef.current(event.results[0][0].transcript);
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
    return () => recognition.stop();
  }, []);

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

  return { isListening, toggleListen };
}
