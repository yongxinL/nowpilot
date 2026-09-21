import { useEffect, useState } from 'react';
import {
  readOnboardingState,
  shouldPresentOnboarding,
  subscribeToOnboardingState,
} from './onboardingStateStore';

/** The surface render gate. `reading` claims nothing; `present` shows the flow. */
export type OnboardingGate = 'reading' | 'present' | 'hidden';

/**
 * The surface lifecycle hook: read the record once, then keep it in step with
 * the storage change event. Both surfaces call this from their root, so one
 * flow controller serves both and completion in one surface hides the other's
 * flow without a reload.
 */
export function useOnboardingGate(): OnboardingGate {
  const [gate, setGate] = useState<OnboardingGate>('reading');

  useEffect(() => {
    let alive = true;

    const apply = async () => {
      const result = await readOnboardingState();
      if (!alive) return;
      setGate(shouldPresentOnboarding(result) ? 'present' : 'hidden');
    };

    void apply();
    const unsubscribe = subscribeToOnboardingState(() => {
      void apply();
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return gate;
}
