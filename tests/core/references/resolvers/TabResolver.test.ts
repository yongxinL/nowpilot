import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPinnedTabs = [
  { tabId: 1, title: 'ServiceNow Dashboard', url: 'https://example.service-now.com/', favIconUrl: '' },
  { tabId: 2, title: 'GitHub PR', url: 'https://github.com/', favIconUrl: '' },
];

vi.mock('../../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: vi.fn(() => ({
      pinnedTabs: mockPinnedTabs,
    })),
  },
}));

import { tabResolver } from '../../../../src/core/references/resolvers/TabResolver';

describe('TabResolver', () => {
  it('getType returns "tab"', () => {
    expect(tabResolver.getType()).toBe('tab');
  });

  it('search returns matching pinned tabs', async () => {
    const results = await tabResolver.search('servicenow');
    expect(results).toHaveLength(1);
    expect(results[0].token.type).toBe('tab');
    expect(results[0].token.title).toBe('ServiceNow Dashboard');
    expect(results[0].icon).toBe('PushpinOutlined');
  });

  it('search returns empty array for no matches', async () => {
    const results = await tabResolver.search('nonexistent');
    expect(results).toHaveLength(0);
  });

  it('validate returns { valid: false } for unpinned tab', async () => {
    const result = await tabResolver.validate({ type: 'tab', id: '99', title: 'Unpinned', displayLabel: '@tab:Unpinned' });
    expect(result.valid).toBe(false);
  });

  it('validate returns { valid: true } for pinned tab', async () => {
    const result = await tabResolver.validate({ type: 'tab', id: '1', title: 'ServiceNow Dashboard', displayLabel: '@tab:ServiceNow Dashboard' });
    expect(result.valid).toBe(true);
  });

  it('resolve returns title + url for pinned tab', async () => {
    const result = await tabResolver.resolve({ type: 'tab', id: '1', title: 'ServiceNow Dashboard', displayLabel: '@tab:ServiceNow Dashboard' });
    expect(result).toEqual({ title: 'ServiceNow Dashboard', content: 'https://example.service-now.com/' });
  });

  it('resolve returns null for unpinned tab', async () => {
    const result = await tabResolver.resolve({ type: 'tab', id: '99', title: 'Unpinned', displayLabel: '@tab:Unpinned' });
    expect(result).toBeNull();
  });
});
