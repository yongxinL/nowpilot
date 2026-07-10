import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initBroadcastBus, onBroadcastMessage } from '../../src/core/messaging/broadcastBus';

describe('BroadcastBus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initBroadcastBus registers a chrome.storage.onChanged listener', () => {
    initBroadcastBus();
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
  });

  it('dispatches to all registered handlers when areaName is session', () => {
    initBroadcastBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    onBroadcastMessage(handler1);
    onBroadcastMessage(handler2);

    const listener = (chrome.storage.onChanged.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    listener({ key: { newValue: 'val' } }, 'session');

    expect(handler1).toHaveBeenCalledWith({ key: { newValue: 'val' } });
    expect(handler2).toHaveBeenCalledWith({ key: { newValue: 'val' } });
  });

  it('does NOT dispatch when areaName is not session', () => {
    initBroadcastBus();
    const handler = vi.fn();
    onBroadcastMessage(handler);

    const listener = (chrome.storage.onChanged.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    listener({ key: { newValue: 'val' } }, 'sync');

    expect(handler).not.toHaveBeenCalled();
  });

  it('returned unsubscribe function removes the handler', () => {
    initBroadcastBus();
    const handler = vi.fn();
    const unsubscribe = onBroadcastMessage(handler);
    unsubscribe();

    const listener = (chrome.storage.onChanged.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    listener({ key: { newValue: 'val' } }, 'session');

    expect(handler).not.toHaveBeenCalled();
  });
});
