import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createEnvelope, MessageType } from '../../src/core/runtime/RuntimeEnvelope';

// These tests pin the public surface of BackgroundRouter:
//   1) register() initializes MessageBus (attaches the chrome.runtime listener);
//   2) register() is idempotent across multiple calls in the same module instance;
//   3) register() pre-registers advisory handlers bound to the canonical
//      MessageType literals (OPEN_SIDE_PANEL / OPEN_STANDALONE) — never a
//      prototype spelling and never a scaffold-local capability no Phase-1
//      requirement owns;
//   4) registration is synchronous, so a service-worker wake that has no
//      prior module state still has its handlers before any async work;
//   5) a foreign sender cannot reach a registered handler.
//
// We use vi.resetModules + dynamic re-import so each test gets a fresh
// BackgroundRouter module instance with its own `registered` flag reset.

const EXTENSION_ID = 'np-test-extension-id';

type CapturedListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender | undefined,
  sendResponse: (response?: unknown) => void,
) => boolean;

function installChromeMock(): void {
  const g = globalThis as any;
  if (!g.chrome) g.chrome = {};
  if (!g.chrome.runtime) g.chrome.runtime = {};
  g.chrome.runtime.id = EXTENSION_ID;
  if (!g.chrome.runtime.onMessage) g.chrome.runtime.onMessage = {};
  g.chrome.runtime.onMessage.addListener = vi.fn();
  g.chrome.runtime.onMessage.removeListener = vi.fn();
}

function addListenerMock(): ReturnType<typeof vi.fn> {
  return (globalThis as any).chrome.runtime.onMessage.addListener;
}

function capturedListener(): CapturedListener {
  const calls = addListenerMock().mock.calls;
  expect(calls).toHaveLength(1);
  return calls[0][0] as CapturedListener;
}

function ownSender(): chrome.runtime.MessageSender {
  return { id: EXTENSION_ID } as chrome.runtime.MessageSender;
}

async function freshModules() {
  vi.resetModules();
  installChromeMock();
  const [router, bus, runtime] = await Promise.all([
    import('../../src/core/messaging/BackgroundRouter'),
    import('../../src/core/messaging/MessageBus'),
    import('../../src/core/runtime/RuntimeEnvelope'),
  ]);
  return { router, bus, runtime };
}

describe('BackgroundRouter', () => {
  beforeEach(() => {
    installChromeMock();
  });

  it('register() attaches exactly one chrome.runtime.onMessage listener (initializes MessageBus)', async () => {
    const { router, bus } = await freshModules();
    expect(bus.isInitialized()).toBe(false);
    router.register();
    expect(bus.isInitialized()).toBe(true);
    expect(addListenerMock()).toHaveBeenCalledTimes(1);
  });

  it('register() called twice in a row does NOT re-attach the chrome.runtime.onMessage listener', async () => {
    const { router, bus } = await freshModules();
    router.register();
    router.register();
    router.register();
    expect(addListenerMock()).toHaveBeenCalledTimes(1);
    expect(bus.isInitialized()).toBe(true);
  });

  it('register() attaches its listeners synchronously, before any asynchronous work', async () => {
    const { router, bus } = await freshModules();
    expect(bus.isInitialized()).toBe(false);
    router.register();
    // No await between register() and these assertions: a service-worker wake
    // must have its handlers attached in the same tick.
    expect(bus.isInitialized()).toBe(true);
    expect(addListenerMock()).toHaveBeenCalledTimes(1);
  });

  it('register() pre-registers the OPEN_SIDE_PANEL handler (dispatch invokes it)', async () => {
    const { router, runtime } = await freshModules();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      router.register();
      const envelope = runtime.createEnvelope(
        MessageType.OPEN_SIDE_PANEL,
        { workspaceId: 'w1' },
        'standalone',
      );
      const sender = ownSender();
      const { dispatch } = await import('../../src/core/messaging/MessageBus');
      await dispatch(envelope, sender);
      expect(debugSpy).toHaveBeenCalledWith(
        '[BG] Open side panel requested:',
        envelope.operationId,
      );
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('register() pre-registers the OPEN_STANDALONE handler (dispatch invokes it)', async () => {
    const { router, runtime } = await freshModules();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      router.register();
      const envelope = runtime.createEnvelope(
        MessageType.OPEN_STANDALONE,
        { workspaceId: 'w1' },
        'sidepanel',
      );
      const { dispatch } = await import('../../src/core/messaging/MessageBus');
      await dispatch(envelope, ownSender());
      expect(debugSpy).toHaveBeenCalledWith(
        '[BG] Open standalone requested:',
        envelope.operationId,
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
        MessageType.OPEN_SIDE_PANEL,
        { workspaceId: 'w1' },
        'standalone',
      );
      await dispatch(envelope, ownSender());
      const openSidePanelCalls = debugSpy.mock.calls.filter(
        (call) => call[0] === '[BG] Open side panel requested:',
      );
      expect(openSidePanelCalls).toHaveLength(1);
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('a handler for OPEN_SIDE_PANEL is not invoked by an OPEN_STANDALONE message', async () => {
    const { router, runtime } = await freshModules();
    const probe = vi.fn();
    router.register();
    const { register, dispatch } = await import('../../src/core/messaging/MessageBus');
    register(MessageType.OPEN_SIDE_PANEL, probe);

    await dispatch(
      runtime.createEnvelope(MessageType.OPEN_STANDALONE, { workspaceId: 'w1' }, 'sidepanel'),
      ownSender(),
    );
    expect(probe).not.toHaveBeenCalled();

    const sidePanel = runtime.createEnvelope(
      MessageType.OPEN_SIDE_PANEL,
      { workspaceId: 'w1' },
      'standalone',
    );
    await dispatch(sidePanel, ownSender());
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(sidePanel, ownSender());
  });

  it('register() leaves the scaffold-local literals unhandled (no Phase-1 capability claim)', async () => {
    const { router, runtime } = await freshModules();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      router.register();
      const { dispatch } = await import('../../src/core/messaging/MessageBus');
      const ready = runtime.createEnvelope(
        'CONTENT_SCRIPT_READY',
        { url: 'https://example.com' },
        'content',
      );
      const navigation = runtime.createEnvelope(
        'SPA_NAVIGATION',
        { url: 'https://example.com/next' },
        'content',
      );
      await dispatch(ready, ownSender());
      await dispatch(navigation, ownSender());
      expect(debugSpy).not.toHaveBeenCalledWith(
        '[BG] Content script ready:',
        expect.anything(),
        expect.anything(),
      );
      expect(debugSpy).not.toHaveBeenCalledWith(
        '[BG] SPA navigation:',
        expect.anything(),
      );
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('a foreign sender cannot reach a registered handler through the listener', async () => {
    const { router, runtime } = await freshModules();
    const probe = vi.fn();
    router.register();
    const { register } = await import('../../src/core/messaging/MessageBus');
    register(MessageType.OPEN_SIDE_PANEL, probe);
    const listener = capturedListener();
    const sendResponse = vi.fn();
    const envelope = createEnvelope(
      MessageType.OPEN_SIDE_PANEL,
      { workspaceId: 'w1' },
      'standalone',
    );

    const handled = listener(
      envelope,
      { id: 'foreign-extension' } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(handled).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(probe).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
