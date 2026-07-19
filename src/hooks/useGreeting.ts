import { usePreferenceStore } from '../core/memory/PreferenceMemoryStore';
import { useWorkspaceStore } from '../core/stores/workspaceStore';
import { generateGreeting } from '../core/greeting/GreetingService';
import type { Greeting } from '../core/greeting/GreetingService';

/**
 * React hook that subscribes to PreferenceMemoryStore.displayName and
 * workspaceStore.currentPageContext via individual selectors, then computes
 * the current time-of-day greeting.
 *
 * Individual selectors prevent re-renders from unrelated state changes
 * (matching useWorkspace.ts pattern).
 */
export function useGreeting(): Greeting {
  // Individual selectors — prevent re-renders from unrelated state changes
  const displayName = usePreferenceStore((s) => s.displayName);
  const currentPageContext = useWorkspaceStore((s) => s.currentPageContext);

  return generateGreeting({
    displayName,
    pageTitle: currentPageContext?.title,
  });
}
