/**
 * getPageContentTool — MCP tool #1.
 *
 * Returns the page content of the active tab or a pinned tab.
 * Fresh extraction for the active tab (via content script relay),
 * cached PageContext for pinned tabs (D-20).
 *
 * ## Key invariants
 * - tabId provided → looks up workspaceStore.pinnedTabs for cached context
 * - No tabId → queries active tab and sends GET_PAGE_CONTEXT_REQUEST
 * - AbortSignal check before execution (ExecutorService pattern)
 * - chrome.runtime.lastError checked after sendMessage
 * - useWorkspaceStore.getState() for one-shot reads (no subscriptions)
 *
 * Pattern: fixture tool pattern (PATTERNS.md §7)
 */
import { z } from 'zod';
import type { ToolDefinition } from '../ToolDefinition';
import { useWorkspaceStore } from '../../../stores/workspaceStore';

export const getPageContentTool: ToolDefinition = {
  name: 'get-page-content',
  description:
    'Get the page content of the active tab or a pinned tab. Fresh extraction for active tab, cached for pinned tabs.',
  inputSchema: z.object({
    tabId: z
      .number()
      .optional()
      .describe('Tab ID for pinned tab context. Omit for active page.'),
    url: z
      .string()
      .optional()
      .describe('URL to look up in pinned tabs. Ignored if tabId is provided.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    page: z
      .object({
        url: z.string(),
        title: z.string(),
        markdown: z.string().optional(),
        meta: z.record(z.string(), z.string()),
        extractedAt: z.number(),
        extractionType: z.string(),
      })
      .optional(),
    error: z.string().optional(),
  }),
  category: 'safe',
  requiresPermission: false,

  async execute(input, context) {
    // Abort check (mandatory — all fixture tools pattern)
    if (context.abortSignal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const { tabId, url } = input as { tabId?: number; url?: string };

    // D-20: Pinned tab → cached PageContext from workspaceStore
    if (tabId !== undefined) {
      const pinned = useWorkspaceStore
        .getState()
        .pinnedTabs.find((t) => t.tabId === tabId);
      if (!pinned) {
        return { success: false, error: `Pinned tab ${tabId} not found` };
      }
      return { success: true, page: pinned.page };
    }

    // URL lookup → check pinned tabs by URL match
    if (url) {
      const pinned = useWorkspaceStore
        .getState()
        .pinnedTabs.find((t) => (t.url || t.page?.url) === url);
      if (pinned) {
        return { success: true, page: pinned.page };
      }
    }

    // Active page → fresh extraction via content script relay
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) {
          resolve({ success: false, error: 'No active tab' });
          return;
        }

        chrome.tabs.sendMessage(
          tab.id,
          { type: 'GET_PAGE_CONTEXT_REQUEST' },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else if (response) {
              resolve(response);
            } else {
              resolve({
                success: false,
                error: 'No response from content script',
              });
            }
          },
        );
      });
    });
  },
};
