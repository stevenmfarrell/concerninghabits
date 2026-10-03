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
  abort(): void;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

// Records one spoken phrase with the browser's speech recognition and hands its transcript to
// `onTranscript`. Shared by the habit log page's voice logging and the dashboard's SmartEntry.
//
// The browser ends the phrase at the first pause. `stop()` ends it now and still hands over what
// was heard; `cancel()` ends it and discards it. `liveTranscript` is the phrase so far, while
// listening.
export function useSpeechRecognition(onTranscript: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Whether this listen produced a transcript (or was cancelled), to say so when it heard nothing
  const handledRef = useRef(false);

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
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const result = event.results[0];
      setLiveTranscript(result[0].transcript);
      if (!result.isFinal) return;
      handledRef.current = true;
      setIsListening(false);
      setLiveTranscript('');
      onTranscriptRef.current(result[0].transcript);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      // Aborting is how cancel() and unmounting stop it, so it isn't an error
      if (event.error === 'aborted') return;
      // no-speech falls through to onend's "didn't catch anything"
      if (event.error === 'no-speech') return;
      handledRef.current = true;
      console.error('Speech recognition error', event.error);
      toast.error(`Microphone error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      setLiveTranscript('');
      if (!handledRef.current) toast("Didn't catch anything. Try again?", { icon: '🎙️' });
    };

    recognitionRef.current = recognition;
    return () => {
      handledRef.current = true;
      recognition.abort();
    };
  }, []);

  const start = () => {
    if (!recognitionRef.current) {
      toast.error('Voice recognition is not supported in this browser.');
      return;
    }
    handledRef.current = false;
    setLiveTranscript('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
    }
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  const cancel = () => {
    handledRef.current = true;
    recognitionRef.current?.abort();
  };

  const toggleListen = () => {
    if (isListening) {
      stop();
    } else {
      start();
      if (recognitionRef.current) toast('Listening...', { icon: '🎙️' });
    }
  };

  return { isListening, liveTranscript, start, stop, cancel, toggleListen };
}
