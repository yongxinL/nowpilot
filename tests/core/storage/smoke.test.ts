import { describe, it, expect, vi } from 'vitest';

describe('Phase 2 Storage Test Infrastructure', () => {
  it('chrome.storage.local.get can be called and returns a mock value', async () => {
    const result = await chrome.storage.local.get('key');
    expect(result).toEqual({});
    expect(chrome.storage.local.get).toHaveBeenCalledWith('key');
  });

  it('crypto.getRandomValues can be called and fills a Uint8Array', () => {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    expect(arr.length).toBe(16);
  });

  it('crypto.subtle.encrypt is available as a callable function', () => {
    expect(crypto.subtle).toBeDefined();
    expect(typeof crypto.subtle.encrypt).toBe('function');
  });
});
