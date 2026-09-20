import { describe, it, expect, beforeEach, vi } from 'vitest';

// The MessageBus module owns the chrome.runtime.onMessage listener and the
// handlers Map as module-level singletons. Tests MUST reset that state via
// the bus's exported `init()` idempotency guard (or by isolating dynamic
// imports) — otherwise one test's handlers leak into the next.
//
// We use vi.resetModules + dynamic re-import so each test gets a fresh
// MessageBus module instance. The runtime envelope helpers are pure and can
// be imported statically.
import { createEnvelope } from '../../src/core/runtime/RuntimeEnvelope';

async function freshMessageBus() {
  vi.resetModules();
  // The setup.ts already stubs chrome.runtime; ensure onMessage.addListener
  // is a vi.fn so we can assert call counts.
  if (!vi.isMockFunction((globalThis as any).chrome.runtime.onMessage.addListener)) {
    (globalThis as any).chrome.runtime.onMessage.addListener = vi.fn();
  }
  return await import('../../src/core/messaging/MessageBus');
}

describe('MessageBus cold-start contract', () => {
  beforeEach(() => {
    // Setup has chrome.runtime stubbed at globalThis; ensure addListener exists.
    const g = globalThis as any;
    if (!g.chrome) g.chrome = {};
    if (!g.chrome.runtime) g.chrome.runtime = {};
    if (!g.chrome.runtime.onMessage) g.chrome.runtime.onMessage = {};
    g.chrome.runtime.onMessage.addListener = vi.fn();
    g.chrome.runtime.onMessage.removeListener = vi.fn();
  });

  it('is uninitialized on fresh module load', async () => {
    const bus = await freshMessageBus();
    expect(bus.isInitialized()).toBe(false);
  });

  it('init() attaches exactly one chrome.runtime.onMessage listener', async () => {
    const bus = await freshMessageBus();
    bus.init();
    expect((globalThis as any).chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(bus.isInitialized()).toBe(true);
  });

  it('calling init() twice does NOT re-attach the chrome.runtime.onMessage listener', async () => {
    const bus = await freshMessageBus();
    bus.init();
    bus.init();
    bus.init();
    expect((globalThis as any).chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(bus.isInitialized()).toBe(true);
  });

  it('a message dispatched immediately after init() (cold start) invokes the registered handler', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    // Handler registration BEFORE init (the same order BackgroundRouter uses).
    bus.register('CONTENT_SCRIPT_READY', handler);
    bus.init();
    // Dispatch in the same tick — simulates the SW receiving its very first
    // message the moment the listener attaches (Pitfall 1).
    const envelope = createEnvelope(
      'CONTENT_SCRIPT_READY',
      { url: 'https://example.com' },
      'content',
    );
    const sender = { id: 'self', tab: { id: 7 } } as chrome.runtime.MessageSender;
    await bus.dispatch(envelope, sender);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(envelope, sender);
  });

  it('two back-to-back CONTENT_SCRIPT_READY envelopes each invoke the handler independently (adjacency)', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register('CONTENT_SCRIPT_READY', handler);
    bus.init();
    const sender = { id: 'self' } as chrome.runtime.MessageSender;
    const env1 = createEnvelope('CONTENT_SCRIPT_READY', { url: 'https://a' }, 'content');
    const env2 = createEnvelope('CONTENT_SCRIPT_READY', { url: 'https://b' }, 'content');
    await bus.dispatch(env1, sender);
    await bus.dispatch(env2, sender);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, env1, sender);
    expect(handler).toHaveBeenNthCalledWith(2, env2, sender);
  });

  it('dispatching an unknown envelope type is a safe no-op (no throw, no handler invocation)', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register('CONTENT_SCRIPT_READY', handler);
    bus.init();
    const unknown = createEnvelope('SPA_NAVIGATION', { url: 'x' }, 'content');
    await expect(bus.dispatch(unknown, {} as chrome.runtime.MessageSender)).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('dispatching a non-envelope object (raw legacy message) is rejected without invoking handlers', async () => {
    const bus = await freshMessageBus();
    const handler = vi.fn();
    bus.register('CONTENT_SCRIPT_READY', handler);
    bus.init();
    // This is the exact shape the OLD raw listener in background.ts received —
    // dispatch must reject it because it lacks the envelope contract.
    const legacyRaw = { type: 'CONTENT_SCRIPT_READY', url: 'https://x' };
    await bus.dispatch(legacyRaw, {} as chrome.runtime.MessageSender);
    expect(handler).not.toHaveBeenCalled();
  });

  it('a handler that throws does not block other handlers (allSettled isolation)', async () => {
    const bus = await freshMessageBus();
    const ok = vi.fn();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    bus.register('CONTENT_SCRIPT_READY', ok);
    bus.register('CONTENT_SCRIPT_READY', bad);
    bus.init();
    const env = createEnvelope('CONTENT_SCRIPT_READY', {}, 'content');
    await expect(bus.dispatch(env, {} as chrome.runtime.MessageSender)).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(bad).toHaveBeenCalledTimes(1);
  });
});
