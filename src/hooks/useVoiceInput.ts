import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseVoiceInputOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
}

export interface UseVoiceInputResult {
  isRecording: boolean;
  interimText: string;
  isSupported: boolean;
  toggle: () => void;
}

export function useVoiceInput(options?: UseVoiceInputOptions): UseVoiceInputResult {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as
        | typeof SpeechRecognition
        | undefined;

    setIsSupported(!!SpeechRecognitionAPI);

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          options?.onTranscript?.(finalTranscript, true);
        }
        setInterimText(interimTranscript || '');
      };

      recognition.onerror = () => {
        setIsRecording(false);
        setInterimText('');
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
    } else {
      setIsRecording(true);
      try {
        recognition.start();
      } catch {
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  return { isRecording, interimText, isSupported, toggle };
}
