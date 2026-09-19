import { describe, expect, it, vi } from 'vitest';
import { createBroadcastBus } from '@/core/runtime/BroadcastBus';
import { createOperationId } from '@/core/runtime/OperationId';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

function envelope(overrides: Partial<RuntimeEnvelope> = {}): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'standalone.open',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: { destination: 'chat' },
    ...overrides,
  } as RuntimeEnvelope;
}

const EXTENSION_ID = 'test-extension-id';
const TRUSTED_SENDER = {
  id: EXTENSION_ID,
  url: `chrome-extension://${EXTENSION_ID}/sidepanel.html`,
};

function createDeps() {
  const listeners = new Set<(message: unknown, sender: unknown) => void>();
  return {
    listeners,
    deps: {
      extensionId: EXTENSION_ID,
      sendMessage: vi.fn(async () => undefined),
      addMessageListener(listener: (message: unknown, sender: unknown) => void) {
        listeners.add(listener);
      },
      removeMessageListener(listener: (message: unknown, sender: unknown) => void) {
        listeners.delete(listener);
      },
    },
  };
}

describe('BroadcastBus', () => {
  it('sends envelopes through the injected transport', async () => {
    const { deps } = createDeps();
    const bus = createBroadcastBus(deps);
    const message = envelope();
    await bus.send(message);
    expect(deps.sendMessage).toHaveBeenCalledWith(message);
  });

  it('delivers only envelopes of the subscribed type', () => {
    const { deps, listeners } = createDeps();
    const bus = createBroadcastBus(deps);
    const handler = vi.fn();
    bus.on('standalone.open', handler);
    for (const listener of listeners) {
      listener(envelope(), TRUSTED_SENDER);
      listener(
        envelope({ type: 'standalone.focus', payload: { destination: 'chat' } }),
        TRUSTED_SENDER,
      );
    }
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].type).toBe('standalone.open');
  });

  it('ignores messages from an untrusted sender', () => {
    const { deps, listeners } = createDeps();
    const bus = createBroadcastBus(deps);
    const handler = vi.fn();
    bus.on('standalone.open', handler);
    for (const listener of listeners) {
      listener(envelope(), {
        id: 'someoneelse',
        url: 'chrome-extension://someoneelse/sidepanel.html',
      });
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores malformed incoming messages without throwing', () => {
    const { deps, listeners } = createDeps();
    const bus = createBroadcastBus(deps);
    const handler = vi.fn();
    bus.on('standalone.open', handler);
    for (const listener of listeners) listener({ nope: true }, undefined);
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe', () => {
    const { deps, listeners } = createDeps();
    const bus = createBroadcastBus(deps);
    const handler = vi.fn();
    const off = bus.on('standalone.open', handler);
    off();
    for (const listener of listeners) listener(envelope(), TRUSTED_SENDER);
    expect(handler).not.toHaveBeenCalled();
  });
});
