import { describe, it, expect, beforeEach, vi } from 'vitest';

// These tests pin the public surface of BackgroundRouter:
//   1) register() initializes MessageBus (attaches the chrome.runtime listener);
//   2) register() is idempotent across multiple calls in the same module instance;
//   3) register() pre-registers advisory handlers for CONTENT_SCRIPT_READY
//      and SPA_NAVIGATION that delegate to MessageBus.dispatch.
//
// We use vi.resetModules + dynamic re-import so each test gets a fresh
// BackgroundRouter module instance with its own `registered` flag reset.

async function freshModules() {
  vi.resetModules();
  // setup.ts has chrome.runtime stubbed at globalThis; ensure addListener is a vi.fn.
  const g = globalThis as any;
  if (!g.chrome) g.chrome = {};
  if (!g.chrome.runtime) g.chrome.runtime = {};
  if (!g.chrome.runtime.onMessage) g.chrome.runtime.onMessage = {};
  g.chrome.runtime.onMessage.addListener = vi.fn();
  g.chrome.runtime.onMessage.removeListener = vi.fn();
  const [router, bus, runtime] = await Promise.all([
    import('../../src/core/messaging/BackgroundRouter'),
    import('../../src/core/messaging/MessageBus'),
    import('../../src/core/runtime/RuntimeEnvelope'),
  ]);
  return { router, bus, runtime };
}

describe('BackgroundRouter', () => {
  beforeEach(() => {
    const g = globalThis as any;
    if (!g.chrome) g.chrome = {};
    if (!g.chrome.runtime) g.chrome.runtime = {};
    if (!g.chrome.runtime.onMessage) g.chrome.runtime.onMessage = {};
    g.chrome.runtime.onMessage.addListener = vi.fn();
    g.chrome.runtime.onMessage.removeListener = vi.fn();
  });

  it('register() attaches exactly one chrome.runtime.onMessage listener (initializes MessageBus)', async () => {
    const { router, bus } = await freshModules();
    expect(bus.isInitialized()).toBe(false);
    router.register();
    expect(bus.isInitialized()).toBe(true);
    expect((globalThis as any).chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it('register() called twice in a row does NOT re-attach the chrome.runtime.onMessage listener', async () => {
    const { router, bus } = await freshModules();
    router.register();
    router.register();
    router.register();
    expect((globalThis as any).chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(bus.isInitialized()).toBe(true);
  });

  it('register() pre-registers the CONTENT_SCRIPT_READY handler (dispatch invokes it)', async () => {
    const { router, runtime } = await freshModules();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      router.register();
      const envelope = runtime.createEnvelope(
        'CONTENT_SCRIPT_READY',
        { url: 'https://example.com' },
        'content',
      );
      const sender = { id: 'self', tab: { id: 11 } } as chrome.runtime.MessageSender;
      // Use bus.dispatch via a fresh import path so we test the public surface.
      const { dispatch } = await import('../../src/core/messaging/MessageBus');
      await dispatch(envelope, sender);
      expect(debugSpy).toHaveBeenCalledWith(
        '[BG] Content script ready:',
        11,
        'https://example.com',
      );
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('register() pre-registers the SPA_NAVIGATION handler (dispatch invokes it)', async () => {
    const { router, runtime } = await freshModules();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      router.register();
      const { dispatch } = await import('../../src/core/messaging/MessageBus');
      const envelope = runtime.createEnvelope(
        'SPA_NAVIGATION',
        { url: 'https://example.com/new' },
        'content',
      );
      await dispatch(envelope, {} as chrome.runtime.MessageSender);
      expect(debugSpy).toHaveBeenCalledWith(
        '[BG] SPA navigation:',
        'https://example.com/new',
      );
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('double-register does not double-invoke the advisory handlers (one envelope → one console.debug call)', async () => {
    const { router, runtime } = await freshModules();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      router.register();
      router.register(); // should be a no-op for handler attachment
      const { dispatch } = await import('../../src/core/messaging/MessageBus');
      const envelope = runtime.createEnvelope(
        'CONTENT_SCRIPT_READY',
        { url: 'https://example.com' },
        'content',
      );
      await dispatch(envelope, {} as chrome.runtime.MessageSender);
      const contentReadyCalls = debugSpy.mock.calls.filter(
        (call) => call[0] === '[BG] Content script ready:',
      );
      expect(contentReadyCalls).toHaveLength(1);
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('handler resolves `url` from envelope.payload (not from a raw message.url field)', async () => {
    const { router, runtime } = await freshModules();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      router.register();
      const { dispatch } = await import('../../src/core/messaging/MessageBus');
      // envelope.payload.url is the only source the new handler reads from.
      const envelope = runtime.createEnvelope(
        'SPA_NAVIGATION',
        { url: 'https://payload-only.example/path' },
        'content',
      );
      await dispatch(envelope, {} as chrome.runtime.MessageSender);
      const navCalls = debugSpy.mock.calls.filter(
        (call) => call[0] === '[BG] SPA navigation:',
      );
      expect(navCalls).toHaveLength(1);
      expect(navCalls[0]?.[1]).toBe('https://payload-only.example/path');
    } finally {
      debugSpy.mockRestore();
    }
  });
});
