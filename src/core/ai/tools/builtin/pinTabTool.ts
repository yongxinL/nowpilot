/**
 * pinTabTool — MCP tool #5.
 *
 * Pins or unpins a browser tab for context reference.
 * Maximum 10 pinned tabs enforced by workspaceStore.addPinnedTab (D-30).
 *
 * ## Key invariants
 * - action='unpin' → removePinnedTab(tabId) — immediate, no validation
 * - action='pin' → max-10 check, chrome.tabs.get for metadata,
 *   constructs TabContext, calls addPinnedTab
 * - AbortSignal check before execution (ExecutorService pattern)
 * - WorkspaceStore accessed via getState() (one-shot, no subscription)
 *
 * Pattern: fixture tool pattern (PATTERNS.md §8)
 */
import { z } from 'zod';
import type { ToolDefinition } from '../ToolDefinition';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import type { TabContext, PageContext } from '../../../content/PageContext';

export const pinTabTool: ToolDefinition = {
  name: 'pin-tab',
  description:
    'Pin or unpin a tab for context reference. Maximum 10 pinned tabs.',
  inputSchema: z.object({
    tabId: z.number().describe('The browser tab ID to pin or unpin'),
    action: z
      .enum(['pin', 'unpin'])
      .default('pin')
      .describe('Pin or unpin the tab'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    pinnedCount: z.number().optional(),
    error: z.string().optional(),
  }),
  category: 'safe',
  requiresPermission: false,

  async execute(input, context) {
    // Abort check (mandatory — all fixture tools pattern)
    if (context.abortSignal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const { tabId, action } = input as {
      tabId: number;
      action: 'pin' | 'unpin';
    };
    const store = useWorkspaceStore.getState();

    // Unpin: immediate removal, no validation needed
    if (action === 'unpin') {
      store.removePinnedTab(tabId);
      const updatedStore = useWorkspaceStore.getState();
      return { success: true, pinnedCount: updatedStore.pinnedTabs.length };
    }

    // D-30: Max 10, reject at limit
    if (store.pinnedTabs.length >= 10) {
      return {
        success: false,
        error:
          'Maximum 10 pinned tabs reached. Unpin a tab before pinning a new one.',
      };
    }

    // Get tab metadata via chrome.tabs (requires SW context)
    try {
      const tab = await chrome.tabs.get(tabId);

      // Build TabContext with tab metadata + current page context (or minimal fallback)
      const currentPage: PageContext = store.currentPageContext
        ? store.currentPageContext
        : {
            url: tab.url || '',
            origin: '',
            hostname: '',
            title: tab.title || '',
            meta: {},
            extractedAt: Date.now(),
            extractionType: 'metadata-only' as const,
            extractionQuality: 'minimal' as const,
          };

      const tabContext: TabContext = {
        tabId: tab.id!,
        windowId: tab.windowId,
        page: currentPage,
        pinnedAt: Date.now(),
        active: true,
        url: tab.url,
        title: tab.title,
      };

      store.addPinnedTab(tabContext);
      const updatedStore = useWorkspaceStore.getState();
      return { success: true, pinnedCount: updatedStore.pinnedTabs.length };
    } catch (err) {
      return {
        success: false,
        error: `Could not pin tab: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
