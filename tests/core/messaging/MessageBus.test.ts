// tests/core/messaging/MessageBus.test.ts — MessageBus transport tests (RUNTIME-04).
// Drives the runtime-event path via wxt/testing fakeBrowser (sendMessage/onMessage
// are implemented in-memory) and the port path via a spied chrome.runtime.connect
// returning a controllable fake port. Pure messaging logic — node env avoids the
// jsdom 30 TextEncoder/esbuild invariant break (01-01 Rule 3 precedent).
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { MessageBus, NP_PORT_NAME } from '@/core/messaging/MessageBus';
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

/** Minimal controllable fake chrome.runtime.Port. */
function fakePort(name = NP_PORT_NAME) {
  const onMessageListeners: Array<(message: unknown, port: unknown) => void> = [];
  const onDisconnectListeners: Array<(port: unknown) => void> = [];
  const port: {
    name: string;
    postMessage: ReturnType<typeof vi.fn>;
    disconnect: () => void;
    onMessage: {
      addListener: (cb: (message: unknown, port: unknown) => void) => void;
      removeListener: (cb: (message: unknown, port: unknown) => void) => void;
      hasListener: (cb: (message: unknown, port: unknown) => void) => boolean;
      hasListeners: () => boolean;
      removeAllListeners: () => void;
    };
    onDisconnect: {
      addListener: (cb: (port: unknown) => void) => void;
      removeListener: (cb: (port: unknown) => void) => void;
      hasListener: (cb: (port: unknown) => void) => boolean;
      hasListeners: () => boolean;
      removeAllListeners: () => void;
    };
    triggerInbound: (message: unknown) => void;
    _onMessageListeners: Array<(message: unknown, port: unknown) => void>;
  } = {
    name,
    postMessage: vi.fn(),
    disconnect: vi.fn(() => {
      onMessageListeners.length = 0;
      for (const cb of [...onDisconnectListeners]) cb(port);
    }),
    onMessage: {
      addListener: (cb: (message: unknown, port: unknown) => void) => onMessageListeners.push(cb),
      removeListener: (cb: (message: unknown, port: unknown) => void) => {
        const idx = onMessageListeners.indexOf(cb);
        if (idx >= 0) onMessageListeners.splice(idx, 1);
      },
      hasListener: (cb: (message: unknown, port: unknown) => void) =>
        onMessageListeners.includes(cb),
      hasListeners: () => onMessageListeners.length > 0,
      removeAllListeners: () => (onMessageListeners.length = 0),
    },
    onDisconnect: {
      addListener: (cb: (port: unknown) => void) => onDisconnectListeners.push(cb),
      removeListener: (cb: (port: unknown) => void) => {
        const idx = onDisconnectListeners.indexOf(cb);
        if (idx >= 0) onDisconnectListeners.splice(idx, 1);
      },
      hasListener: (cb: (port: unknown) => void) => onDisconnectListeners.includes(cb),
      hasListeners: () => onDisconnectListeners.length > 0,
      removeAllListeners: () => (onDisconnectListeners.length = 0),
    },
    triggerInbound: (message: unknown) => {
      for (const cb of [...onMessageListeners]) cb(message, port);
    },
    _onMessageListeners: onMessageListeners,
  };
  return port;
}

function connectSpiedPort(name = NP_PORT_NAME) {
  const port = fakePort(name);
  const spy = vi
    .spyOn(fakeBrowser.runtime, 'connect')
    .mockReturnValue(port as unknown as chrome.runtime.Port);
  return { port, spy };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MessageBus runtime events', () => {
  it('sendMessage delivers a RuntimeEnvelope-shaped message to a subscribed listener', async () => {
    const bus = new MessageBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    const msg = envelope('PING', { pong: false });
    await fakeBrowser.runtime.sendMessage(msg);

    expect(listener).toHaveBeenCalledWith(msg);
  });

  it('publish() sends a whitelisted message over the runtime channel', async () => {
    const bus = new MessageBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    const msg = envelope('WORKSPACE_UPDATED', { version: 3 });
    bus.publish(msg);
    // fakeBrowser sendMessage triggers onMessage listeners asynchronously
    await Promise.resolve();
    await Promise.resolve();

    expect(listener).toHaveBeenCalledWith(msg);
  });

  it('publish() rejects messages with non-whitelist types (MSG_UNKNOWN_TYPE)', () => {
    const bus = new MessageBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    const spoofed = envelope('NOT_A_CANONICAL_TYPE');
    expect(() => bus.publish(spoofed)).toThrow(/MSG_UNKNOWN_TYPE/);
    expect(listener).not.toHaveBeenCalled();
  });

  it('inbound messages with unknown types are dropped before dispatch', async () => {
    const bus = new MessageBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    const spoofed = envelope('NOT_A_CANONICAL_TYPE');
    await fakeBrowser.runtime.sendMessage(spoofed);

    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe returns an unsubscribe function that stops delivery', async () => {
    const bus = new MessageBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);
    unsubscribe();

    await fakeBrowser.runtime.sendMessage(envelope('PING'));

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('MessageBus port broadcasts', () => {
  it('connect() registers the named port and broadcastToPorts posts to it', () => {
    const { port } = connectSpiedPort();
    const bus = new MessageBus();
    bus.connect(NP_PORT_NAME);

    const msg = envelope('PORT_STREAM_START', { operationId: 'op-1', kind: 'session-tokens' });
    bus.broadcastToPorts(msg);

    expect(fakeBrowser.runtime.connect).toHaveBeenCalledWith({ name: NP_PORT_NAME });
    expect(port.postMessage).toHaveBeenCalledWith(msg);
  });

  it('port broadcast delivers inbound port messages to subscribers', () => {
    const { port } = connectSpiedPort();
    const bus = new MessageBus();
    const listener = vi.fn();
    bus.subscribe(listener);
    bus.connect(NP_PORT_NAME);

    const msg = envelope('PORT_STREAM_CHUNK', { operationId: 'op-1', data: { x: 1 } });
    port.triggerInbound(msg);

    expect(listener).toHaveBeenCalledWith(msg);
  });

  it('disconnect() drops ports and clears listeners', () => {
    const { port } = connectSpiedPort();
    const bus = new MessageBus();
    const listener = vi.fn();
    bus.subscribe(listener);
    bus.connect(NP_PORT_NAME);

    bus.disconnect();
    expect(port.disconnect).toHaveBeenCalled();

    bus.broadcastToPorts(envelope('WORKSPACE_UPDATED'));
    expect(port.postMessage).not.toHaveBeenCalled();
  });
});
