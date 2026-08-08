// tests/core/runtime/BroadcastBus.test.ts — BroadcastBus (Appendix M.3) transport
// tests: emit→on roundtrip through the fakeBrowser runtime channel, non-whitelist
// inbound types ignored (Pitfall 5, T-1-04), malformed envelopes ignored, and the
// WORKSPACE_HEARTBEAT emitted every 3000ms and stopped by stopHeartbeat
// (vi.useFakeTimers). Pure runtime logic — node env avoids the jsdom 30
// TextEncoder/esbuild invariant break (01-01 Rule 3 precedent).
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { BroadcastBus } from '@/core/runtime/BroadcastBus';
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

function envelope(type: string, payload: unknown = {}): RuntimeEnvelope {
  return {
    id: 'op-1',
    type: type as RuntimeEnvelope['type'],
    createdAt: 1710000000000,
    source: 'standalone',
    payload,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BroadcastBus', () => {
  it('emit delivers the payload to an on() handler for the same type', async () => {
    const bus = new BroadcastBus('sidepanel');
    const handler = vi.fn();
    bus.on(MessageType.WORKSPACE_UPDATED, handler);

    bus.emit(MessageType.WORKSPACE_UPDATED, { state: { version: 1 }, from: 'sidepanel' });
    await flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ state: { version: 1 }, from: 'sidepanel' });
  });

  it('does not deliver to handlers registered for other types', async () => {
    const bus = new BroadcastBus('sidepanel');
    const handler = vi.fn();
    bus.on(MessageType.WORKSPACE_UPDATED, handler);

    bus.emit(MessageType.WORKSPACE_HEARTBEAT, { workspaceId: 'w-1' });
    await flush();

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores inbound messages with non-whitelist types (Pitfall 5)', async () => {
    const bus = new BroadcastBus('sidepanel');
    const handler = vi.fn();
    bus.on(MessageType.WORKSPACE_UPDATED, handler);

    await fakeBrowser.runtime.sendMessage(envelope('NOT_A_CANONICAL_TYPE', { evil: true }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores inbound messages that are not RuntimeEnvelope-shaped', async () => {
    const bus = new BroadcastBus('sidepanel');
    const handler = vi.fn();
    bus.on(MessageType.WORKSPACE_UPDATED, handler);

    await fakeBrowser.runtime.sendMessage({ type: MessageType.WORKSPACE_UPDATED, payload: {} });

    expect(handler).not.toHaveBeenCalled();
  });

  it('emit rejects non-whitelist types with MSG_UNKNOWN_TYPE', () => {
    const bus = new BroadcastBus('sidepanel');

    expect(() => bus.emit('NOT_A_CANONICAL_TYPE' as never, {})).toThrow(/MSG_UNKNOWN_TYPE/);
  });

  it('unsubscribe stops delivery', async () => {
    const bus = new BroadcastBus('sidepanel');
    const handler = vi.fn();
    const unsubscribe = bus.on(MessageType.WORKSPACE_UPDATED, handler);
    unsubscribe();

    bus.emit(MessageType.WORKSPACE_UPDATED, { state: { version: 1 }, from: 'sidepanel' });
    await flush();

    expect(handler).not.toHaveBeenCalled();
  });

  describe('heartbeat', () => {
    it('startHeartbeat emits WORKSPACE_HEARTBEAT every 3000ms with workspaceId/version', async () => {
      vi.useFakeTimers();
      const bus = new BroadcastBus('standalone');
      const handler = vi.fn();
      bus.on(MessageType.WORKSPACE_HEARTBEAT, handler);
      bus.startHeartbeat(() => ({ workspaceId: 'ws-1', version: 3 }));

      vi.advanceTimersByTime(3000);
      await flush();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', version: 3 }),
      );

      vi.advanceTimersByTime(3000);
      await flush();
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('stopHeartbeat stops emitting', async () => {
      vi.useFakeTimers();
      const bus = new BroadcastBus('sidepanel');
      const handler = vi.fn();
      bus.on(MessageType.WORKSPACE_HEARTBEAT, handler);
      bus.startHeartbeat(() => ({ workspaceId: 'ws-1', version: 1 }));

      bus.stopHeartbeat();
      vi.advanceTimersByTime(9000);
      await flush();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
