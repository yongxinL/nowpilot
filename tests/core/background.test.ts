import { describe, it, expect, vi, beforeEach } from 'vitest';
import backgroundEntry from '../../src/entrypoints/background';
import type { BackgroundDefinition } from 'wxt';

describe('Background SW', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a valid BackgroundDefinition', () => {
    expect(backgroundEntry).toBeDefined();
    expect(typeof (backgroundEntry as BackgroundDefinition).main).toBe('function');
  });

  it('main() callback is NOT an async function', () => {
    const result = (backgroundEntry as BackgroundDefinition).main();
    expect(result).toBeUndefined();
  });

  it('registers chrome.runtime.onInstalled.addListener when main() runs', () => {
    (backgroundEntry as BackgroundDefinition).main();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
  });

  it('registers all three chrome listeners when main() runs', () => {
    (backgroundEntry as BackgroundDefinition).main();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    expect(chrome.commands.onCommand.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('onMessage handler returns true to keep channel open', () => {
    (backgroundEntry as BackgroundDefinition).main();
    const onMessageHandler = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const result = onMessageHandler({ type: 'test' }, { tab: { id: 1 } }, () => {});
    expect(result).toBe(true);
  });
});
