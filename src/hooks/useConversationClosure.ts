import { useState, useEffect, useRef, useCallback } from 'react';

export interface ClosureState {
  showPrompt: boolean;
  isComplete: boolean;
  dismiss: () => void;
}

export function useConversationClosure(
  messagesLength: number,
  isStreaming: boolean,
  hasActiveClarifications: boolean,
): ClosureState {
  const [showPrompt, setShowPrompt] = useState(false);
  const [alreadyShown, setAlreadyShown] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (alreadyShown) return;

    // Reset timer on new activity
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (messagesLength === 0 || isStreaming || hasActiveClarifications) {
      setShowPrompt(false);
      return;
    }

    // Start idle timer
    idleTimerRef.current = setTimeout(() => {
      setShowPrompt(true);
      setAlreadyShown(true);
    }, 12_000); // 12s idle threshold (D-25)

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [messagesLength, isStreaming, hasActiveClarifications, alreadyShown]);

  const dismiss = useCallback(() => {
    setShowPrompt(false);
  }, []);

  return { showPrompt, isComplete: alreadyShown, dismiss };
}
