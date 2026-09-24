import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../workspace/WorkspaceStore';
import {
  readOnboardingState,
  shouldPresentOnboardingForWriter,
  subscribeToOnboardingState,
  type OnboardingReadResult,
} from './onboardingStateStore';

/** The surface render gate. `reading` claims nothing; `present` shows the flow. */
export type OnboardingGate = 'reading' | 'present' | 'hidden';

/**
 * The surface lifecycle hook: read the record once, then keep it in step with
 * the storage change event **and** with the authoritative writer state.
 *
 * Both surfaces call this from their root, so one flow controller serves both
 * and completion in one surface hides the other's flow without a reload. The
 * writer gate is what makes "one controller" true across two live surfaces
 * (D2-32, RESEARCH Pitfall 10): a surface that is not the authoritative writer
 * resolves `'hidden'` immediately rather than `'reading'`, so a mirror never
 * waits on — and never shows — a competing flow (T-02-38, T-02-40). The
 * decision itself lives in `shouldPresentOnboardingForWriter`, so both surfaces
 * and the tests share one predicate.
 */
export function useOnboardingGate(): OnboardingGate {
  const writerState = useWorkspaceStore((state) => state.writerState);
  const [record, setRecord] = useState<OnboardingReadResult | null>(null);

  useEffect(() => {
    let alive = true;

    const apply = async () => {
      const result = await readOnboardingState();
      if (!alive) return;
      setRecord(result);
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

  // A non-writer claims nothing at all — not even `reading` — so a mirror never
  // waits on, and never shows, a competing flow (T-02-38, T-02-40).
  const pending: OnboardingGate = writerState === 'primary' ? 'reading' : 'hidden';
  if (record === null) return pending;

  return shouldPresentOnboardingForWriter(record, writerState) ? 'present' : 'hidden';
}
