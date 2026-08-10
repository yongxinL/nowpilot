// src/types/workspace.ts — Source: §21.5 (verbatim) + Appendix C ProviderId
// Canonical home per R-1 / Appendix M.1 import path. D-18: the FULL §8.4 field
// set is declared; only the workspace/conversation/surface/tab identifiers are
// active in Phase 1 — the rest are inert by type presence only, preventing type
// churn in later phases (T-1-05).
import type { PageContext, TabContext } from '@/core/content/PageContext';
import type { ProviderId } from '@/core/ai/types';
// P-3/R-1 (Phase 3): ProviderId's SINGLE canonical home is src/core/ai/types.ts.
// The import above serves WorkspaceState.activeProvider; the re-export below
// keeps OnboardingModal's `import type { ProviderId } from '@/types/workspace'`
// (and any other '@/types/workspace' consumer) working — no second declaration.
export type { ProviderId } from '@/core/ai/types';

export type ActiveSurface = 'sidepanel' | 'standalone';

export interface WorkspaceState {
  workspaceId: string;
  conversationId: string;
  activeProvider?: ProviderId;
  selectedModel?: string;
  pinnedTabs: TabContext[];
  currentPageContext?: PageContext;
  selectedNotes: string[];
  activeAddonContext?: {
    addonId: string;
    contextKey: string;
    payload: unknown;
  };
  activeSkillRun?: {
    skillId: string;
    operationId: string;
    startedAt: number;
    status: 'running' | 'completed' | 'failed' | 'aborted';
  };
  activeSurface: ActiveSurface;
  openedStandaloneTabId?: number;
  version: number;
  updatedAt: number;
}
