import { useWorkspaceStore } from '../core/stores/workspaceStore';
import type { Surface } from '../core/navigation/navigationTypes';

export type { Surface } from '../core/navigation/navigationTypes';

export interface UseWorkspaceReturn {
  workspaceId: string | null;
  conversationId: string | null;
  activeProvider: string | null;
  activeSurface: Surface;
  setActiveProvider: (id: string) => void;
  setConversationId: (id: string) => void;
  drafts: Record<string, string>;
  setDraft: (conversationId: string, text: string) => void;
  clearDraft: (conversationId: string) => void;
}

/**
 * Convenience hook that extracts workspace state from useWorkspaceStore
 * using individual selector functions to prevent unnecessary re-renders
 * from unrelated workspace state changes.
 */
export function useWorkspace(): UseWorkspaceReturn {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const conversationId = useWorkspaceStore((s) => s.conversationId);
  const activeProvider = useWorkspaceStore((s) => s.activeProvider);
  const activeSurface = useWorkspaceStore((s) => s.activeSurface);
  const setActiveProvider = useWorkspaceStore((s) => s.setActiveProvider);
  const setConversationId = useWorkspaceStore((s) => s.setConversationId);
  const drafts = useWorkspaceStore((s) => s.drafts);
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const clearDraft = useWorkspaceStore((s) => s.clearDraft);

  return {
    workspaceId,
    conversationId,
    activeProvider,
    activeSurface,
    setActiveProvider,
    setConversationId,
    drafts,
    setDraft,
    clearDraft,
  };
}
