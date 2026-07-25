import { z } from 'zod';
import type { ToolDefinition } from '../ToolDefinition';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { onDemandExtractor } from '../../../content/OnDemandExtractor';
import { pageContentService } from '../../../extraction/PageContentService';

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
    if (context.abortSignal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const { tabId, url } = input as { tabId?: number; url?: string };

    const store = useWorkspaceStore.getState();

    if (tabId !== undefined) {
      const pinned = store.pinnedTabs.find((t) => t.tabId === tabId);
      if (pinned) {
        return { success: true, page: pinned.page };
      }

      const cached = store.pageContextByTab[tabId];
      if (cached) {
        return { success: true, page: cached.page };
      }

      try {
        const pageCtx = await pageContentService.getForTabAsPageContext(tabId);
        return { success: true, page: pageCtx };
      } catch {
      }

      const extracted = await onDemandExtractor.extractFromTab(tabId);
      if (extracted) {
        return { success: true, page: extracted };
      }

      return { success: false, error: `Could not extract content for tab ${tabId}` };
    }

    if (url) {
      const pinned = store.pinnedTabs.find((t) => (t.url || t.page?.url) === url);
      if (pinned) {
        return { success: true, page: pinned.page };
      }
    }

    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        if (!tab?.id) {
          resolve({ success: false, error: 'No active tab' });
          return;
        }

        try {
          const pageCtx = await pageContentService.getForTabAsPageContext(tab.id);
          resolve({ success: true, page: pageCtx });
        } catch {
          resolve({ success: false, error: 'Could not extract content for active tab' });
        }
      });
    });
  },
};
