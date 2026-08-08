// tests/core/messaging/MessageBusBridge.test.ts — the phase-owned bridge contract
// (W3): connect/disconnect/publish/subscribe/addMessageListener/removeMessageListener/
// getNetworkStatus. Node env (avoids jsdom 30 TextEncoder/esbuild invariant break,
// 01-01 Rule 3 precedent) with navigator.onLine stubbed for getNetworkStatus.
// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { MessageBusBridge } from '@/core/messaging/MessageBusBridge';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { MessageTypeValue } from '@/core/runtime/MessageType';

function envelope(type: string, payload: unknown = {}): RuntimeEnvelope<unknown> {
  return {
    id: 'op-1',
    type: type as MessageTypeValue,
    createdAt: 1710000000000,
    source: 'sidepanel',
    payload,
  };
}

/** Minimal controllable fake chrome.runtime.Port for the connect delegation test. */
function fakePort() {
  return {
    name: 'np-port',
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
      hasListeners: vi.fn(() => false),
      removeAllListeners: vi.fn(),
    },
    onDisconnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false),
      hasListeners: vi.fn(() => false),
      removeAllListeners: vi.fn(),
    },
  };
}

beforeAll(() => {
  // node has no navigator.onLine — stub it so getNetworkStatus is testable.
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Flush the fakeBrowser sendMessage promise chain (async trigger). */
async function flushRuntime(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('MessageBusBridge contract', () => {
  it('publish→subscribe roundtrip delivers the RuntimeEnvelope', async () => {
    const bridge = new MessageBusBridge();
    const listener = vi.fn();
    bridge.subscribe(listener);

    const msg = envelope('WORKSPACE_UPDATED', { version: 2 });
    bridge.publish(msg);
    await flushRuntime();

    expect(listener).toHaveBeenCalledWith(msg);
  });

  it('addMessageListener registers a persistent listener', async () => {
    const bridge = new MessageBusBridge();
    const listener = vi.fn();
    bridge.addMessageListener(listener);

    bridge.publish(envelope('WORKSPACE_HEARTBEAT', { ts: 1 }));
    await flushRuntime();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('removeMessageListener stops delivery', async () => {
    const bridge = new MessageBusBridge();
    const listener = vi.fn();
    bridge.addMessageListener(listener);

    bridge.publish(envelope('WORKSPACE_HEARTBEAT', { ts: 1 }));
    await flushRuntime();
    expect(listener).toHaveBeenCalledTimes(1);

    bridge.removeMessageListener(listener);
    bridge.publish(envelope('WORKSPACE_HEARTBEAT', { ts: 2 }));
    await flushRuntime();
    expect(listener).toHaveBeenCalledTimes(1); // no additional delivery
  });

  it('publish rejects non-whitelist message types (MSG_UNKNOWN_TYPE)', () => {
    const bridge = new MessageBusBridge();
    const listener = vi.fn();
    bridge.subscribe(listener);

    const spoofed = envelope('NOT_A_CANONICAL_TYPE');
    expect(() => bridge.publish(spoofed)).toThrow(/MSG_UNKNOWN_TYPE/);
    expect(listener).not.toHaveBeenCalled();
  });

  it('getNetworkStatus resolves to navigator.onLine', async () => {
    const bridge = new MessageBusBridge();
    await expect(bridge.getNetworkStatus()).resolves.toBe(navigator.onLine);
  });

  it('connect() and disconnect() delegate to the underlying transport', () => {
    vi.spyOn(fakeBrowser.runtime, 'connect').mockReturnValue(
      fakePort() as unknown as chrome.runtime.Port,
    );
    const bridge = new MessageBusBridge();
    expect(() => bridge.connect()).not.toThrow();
    expect(() => bridge.disconnect()).not.toThrow();
    expect(fakeBrowser.runtime.connect).toHaveBeenCalledWith({ name: 'np-port' });
  });

  it('subscribe returns an unsubscribe function', async () => {
    const bridge = new MessageBusBridge();
    const listener = vi.fn();
    const unsubscribe = bridge.subscribe(listener);
    unsubscribe();

    bridge.publish(envelope('WORKSPACE_UPDATED'));
    await flushRuntime();

    expect(listener).not.toHaveBeenCalled();
  });
});
