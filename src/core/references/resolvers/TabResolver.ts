import { useWorkspaceStore } from '../../stores/workspaceStore';
import type { ReferenceToken } from '../ReferenceToken';
import type { AutocompleteResult, ReferenceResolver } from '../ReferenceResolver';

export class TabResolver implements ReferenceResolver {
  getType(): string {
    return 'tab';
  }

  async search(query: string): Promise<AutocompleteResult[]> {
    const pinnedTabs = useWorkspaceStore.getState().pinnedTabs;
    const lower = query.toLowerCase();
    const filtered = pinnedTabs.filter(
      (tab) => tab.title?.toLowerCase().includes(lower) || tab.url?.toLowerCase().includes(lower),
    );
    return filtered.slice(0, 10).map((tab) => ({
      token: {
        type: 'tab',
        id: String(tab.tabId ?? tab.url),
        title: tab.title ?? tab.url ?? '',
        displayLabel: `@tab:${tab.title ?? 'Untitled'}`,
      },
      icon: 'PushpinOutlined',
      color: 'colorInfo',
      subtitle: tab.url ? tab.url.slice(0, 60) : undefined,
    }));
  }

  async validate(token: ReferenceToken): Promise<{ valid: boolean; reason?: string }> {
    const pinnedTabs = useWorkspaceStore.getState().pinnedTabs;
    const exists = pinnedTabs.some((tab) => String(tab.tabId ?? tab.url) === token.id);
    if (!exists) return { valid: false, reason: 'Tab is no longer pinned' };
    return { valid: true };
  }

  async resolve(token: ReferenceToken): Promise<{ title: string; content: string } | null> {
    const pinnedTabs = useWorkspaceStore.getState().pinnedTabs;
    const tab = pinnedTabs.find((t) => String(t.tabId ?? t.url) === token.id);
    if (!tab) return null;
    return { title: tab.title ?? 'Untitled', content: tab.url ?? '' };
  }
}

export const tabResolver = new TabResolver();
