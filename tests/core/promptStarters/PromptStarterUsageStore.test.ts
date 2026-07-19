import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PromptStarterUsageStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordUsage increments usageCount and updates lastUsedAt', async () => {
    const { usePromptStarterUsageStore } = await import(
      '../../../src/core/promptStarters/PromptStarterUsageStore'
    );
    usePromptStarterUsageStore.getState().recordUsage('template-1', 'sender');
    const usage = usePromptStarterUsageStore.getState().usage['template-1'];
    expect(usage.usageCount).toBe(1);
    expect(usage.source).toBe('sender');
    expect(usage.firstUsedAt).toBeGreaterThan(0);

    usePromptStarterUsageStore.getState().recordUsage('template-1', 'sender');
    const updated = usePromptStarterUsageStore.getState().usage['template-1'];
    expect(updated.usageCount).toBe(2);
  });

  it('persists to chrome.storage.local key np_prompt_usage', async () => {
    const { usePromptStarterUsageStore } = await import(
      '../../../src/core/promptStarters/PromptStarterUsageStore'
    );
    usePromptStarterUsageStore.getState().recordUsage('template-2', 'sender');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});
