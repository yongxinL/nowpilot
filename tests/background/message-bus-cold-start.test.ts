import { describe, it, expect, beforeEach, vi } from 'vitest';

// The MessageBus module owns the chrome.runtime.onMessage listener and the
// handlers Map as module-level singletons. Tests MUST reset that state via
// the bus's exported `init()` idempotency guard (or by isolating dynamic
// imports) — otherwise one test's handlers leak into the next.
//
// We use vi.resetModules + dynamic re-import so each test gets a fresh
// MessageBus module instance. The runtime envelope helpers are pure and can
// be imported statically.
import { createEnvelope, MessageType } from '../../src/core/runtime/RuntimeEnvelope';

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
  // The sender guard compares against the extension's own runtime id; the
  // real API always defines it, the test env has to as well.
  g.chrome.runtime.id = EXTENSION_ID;
  if (!g.chrome.runtime.onMessage) g.chrome.runtime.onMessage = {};
  g.chrome.runtime.onMessage.addListener = vi.fn();
  g.chrome.runtime.onMessage.removeListener = vi.fn();
}

async function freshMessageBus() {
  vi.resetModules();
  installChromeMock();
  return await import('../../src/core/messaging/MessageBus');
}

function ownSender(): chrome.runtime.MessageSender {
  return { id: EXTENSION_ID } as chrome.runtime.MessageSender;
}

function addListenerMock(): ReturnType<typeof vi.fn> {
  return (globalThis as any).chrome.runtime.onMessage.addListener;
}

/** The listener MessageBus.init() handed to chrome.runtime.onMessage. */
function capturedListener(): CapturedListener {
  const calls = addListenerMock().mock.calls;
  expect(calls).toHaveLength(1);
  return calls[0][0] as CapturedListener;
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('MessageBus cold-start contract', () => {
  beforeEach(() => {
    installChromeMock();
  });

  it('is uninitialized on fresh module load', async () => {
    const bus = await freshMessageBus();
    expect(bus.isInitialized()).toBe(false);
  });

  it('init() attaches exactly one chrome.runtime.onMessage listener', async () => {
    const bus = await freshMessageBus();
    bus.init();
    expect(addListenerMock()).toHaveBeenCalledTimes(1);
    expect(bus.isInitialized()).toBe(true);
  });

  it('calling init() twice does NOT re-attach the chrome.runtime.onMessage listener', async () => {
    const bus = await freshMessageBus();
    bus.init();
    bus.init();
    bus.init();
    expect(addListenerMock()).toHaveBeenCalledTimes(1);
    expect(bus.isInitialized()).toBe(true);
  });

  it('a message dispatched immediately after init() (cold start) invokes the registered handler', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    // Handler registration BEFORE init (the same order BackgroundRouter uses).
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    // Dispatch in the same tick — simulates the SW receiving its very first
    // message the moment the listener attaches (Pitfall 1).
    const envelope = createEnvelope(
      MessageType.OPEN_SIDE_PANEL,
      { workspaceId: 'w1' },
      'standalone',
    );
    const sender = ownSender();
    await bus.dispatch(envelope, sender);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(envelope, sender);
  });

  it('two back-to-back envelopes each invoke the handler independently (adjacency)', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const sender = ownSender();
    const env1 = createEnvelope(MessageType.OPEN_SIDE_PANEL, { workspaceId: 'w1' }, 'standalone');
    const env2 = createEnvelope(MessageType.OPEN_SIDE_PANEL, { workspaceId: 'w2' }, 'standalone');
    await bus.dispatch(env1, sender);
    await bus.dispatch(env2, sender);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, env1, sender);
    expect(handler).toHaveBeenNthCalledWith(2, env2, sender);
  });

  it('dispatching an unknown envelope type is a safe no-op (no throw, no handler invocation)', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const unknown = {
      type: 'NOT_A_TYPE',
      operationId: 'op-1',
      timestamp: 1,
      source: 'standalone',
      payload: {},
    };
    await expect(bus.dispatch(unknown, ownSender())).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('dispatching a non-envelope object (raw legacy message) is rejected without invoking handlers', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    // This is the exact shape the OLD raw listener in background.ts received —
    // dispatch must reject it because it lacks the envelope contract.
    const legacyRaw = { type: 'CONTENT_SCRIPT_READY', url: 'https://x' };
    await bus.dispatch(legacyRaw, ownSender());
    expect(handler).not.toHaveBeenCalled();
  });

  it('a handler that throws does not block other handlers (allSettled isolation)', async () => {
    const bus = await freshMessageBus();
    const ok = vi.fn();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    bus.register(MessageType.OPEN_SIDE_PANEL, ok);
    bus.register(MessageType.OPEN_SIDE_PANEL, bad);
    bus.init();
    const env = createEnvelope(MessageType.OPEN_SIDE_PANEL, { workspaceId: 'w1' }, 'standalone');
    await expect(bus.dispatch(env, ownSender())).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(bad).toHaveBeenCalledTimes(1);
  });

  it('a synchronous throw inside a handler is caught rather than escaping the dispatch', async () => {
    const bus = await freshMessageBus();
    const throwing = vi.fn(() => {
      throw new Error('sync boom');
    });
    bus.register(MessageType.OPEN_SIDE_PANEL, throwing);
    bus.init();
    const env = createEnvelope(MessageType.OPEN_SIDE_PANEL, { workspaceId: 'w1' }, 'standalone');
    // The dispatch promise must resolve (not reject) even though the handler
    // threw synchronously.
    await expect(bus.dispatch(env, ownSender())).resolves.toBeUndefined();
    expect(throwing).toHaveBeenCalledTimes(1);
  });

  it('dispatch validates the payload before invoking a handler', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const invalidPayload = {
      type: MessageType.OPEN_SIDE_PANEL,
      operationId: 'op-1',
      timestamp: 1,
      source: 'standalone',
      payload: { workspaceId: 42 },
    };
    await bus.dispatch(invalidPayload, ownSender());
    expect(handler).not.toHaveBeenCalled();
  });

  it('calling init() twice keeps one listener and preserves handler ordering', async () => {
    const bus = await freshMessageBus();
    const order: string[] = [];
    bus.register(MessageType.OPEN_SIDE_PANEL, () => {
      order.push('first');
    });
    bus.register(MessageType.OPEN_SIDE_PANEL, () => {
      order.push('second');
    });
    bus.init();
    bus.init();
    expect(addListenerMock()).toHaveBeenCalledTimes(1);
    await bus.dispatch(
      createEnvelope(MessageType.OPEN_SIDE_PANEL, { workspaceId: 'w1' }, 'standalone'),
      ownSender(),
    );
    expect(order).toEqual(['first', 'second']);
  });

  it('the listener admits a message whose sender.id is the extension runtime id', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const listener = capturedListener();
    const sendResponse = vi.fn();
    const envelope = createEnvelope(
      MessageType.OPEN_SIDE_PANEL,
      { workspaceId: 'w1' },
      'standalone',
    );
    const sender = ownSender();

    const handled = listener(envelope, sender, sendResponse);

    expect(handled).toBe(true);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(handler).toHaveBeenCalledWith(envelope, sender);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
  });

  it('the listener rejects a message from a foreign extension id and runs no handler', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const listener = capturedListener();
    const sendResponse = vi.fn();
    const envelope = createEnvelope(
      MessageType.OPEN_SIDE_PANEL,
      { workspaceId: 'w1' },
      'standalone',
    );

    const handled = listener(
      envelope,
      { id: 'some-other-extension' } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(handled).toBe(false);
    await flushAsync();
    expect(handler).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('the listener rejects a message with an absent sender and runs no handler', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const listener = capturedListener();
    const sendResponse = vi.fn();
    const envelope = createEnvelope(
      MessageType.OPEN_SIDE_PANEL,
      { workspaceId: 'w1' },
      'standalone',
    );

    const handled = listener(envelope, undefined, sendResponse);

    expect(handled).toBe(false);
    await flushAsync();
    expect(handler).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('the listener rejects a message with an absent sender.id and runs no handler', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const listener = capturedListener();
    const sendResponse = vi.fn();
    const envelope = createEnvelope(
      MessageType.OPEN_SIDE_PANEL,
      { workspaceId: 'w1' },
      'standalone',
    );

    const handled = listener(
      envelope,
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(handled).toBe(false);
    await flushAsync();
    expect(handler).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('the listener rejects an envelope that fails validation and runs no handler', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const listener = capturedListener();
    const sendResponse = vi.fn();
    const invalid = {
      type: MessageType.OPEN_SIDE_PANEL,
      operationId: 'op-1',
      timestamp: 1,
      source: 'standalone',
      payload: { notInSchema: true },
    };

    const handled = listener(invalid, ownSender(), sendResponse);

    expect(handled).toBe(false);
    await flushAsync();
    expect(handler).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('a scaffold-local envelope is validated but has no Phase-1 handler', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);
    bus.init();
    const envelope = createEnvelope(
      'CONTENT_SCRIPT_READY',
      { url: 'https://example.com' },
      'content',
    );
    await expect(bus.dispatch(envelope, ownSender())).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('cold start: the listener is attached synchronously and both a valid and an invalid envelope are handled', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register(MessageType.OPEN_SIDE_PANEL, handler);

    bus.init();
    // No await between init() and the listener capture: attachment is
    // synchronous, so a wake with no prior state already has its handlers.
    const listener = capturedListener();
    const sendResponse = vi.fn();
    const valid = createEnvelope(
      MessageType.OPEN_SIDE_PANEL,
      { workspaceId: 'w1' },
      'standalone',
    );

    expect(listener(valid, ownSender(), sendResponse)).toBe(true);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));

    const invalid = {
      type: MessageType.OPEN_SIDE_PANEL,
      operationId: 'op-1',
      timestamp: 1,
      source: 'standalone',
      payload: { unexpected: true },
    };
    expect(listener(invalid, ownSender(), sendResponse)).toBe(false);

    await flushAsync();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
