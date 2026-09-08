import { describe, expect, it, vi } from 'vitest';
import { MessageType } from '@/core/runtime/MessageType';
import { BroadcastBus } from '@/core/runtime/BroadcastBus';

describe('BroadcastBus', () => {
  it('delivers an emitted message to registered handlers', () => {
    const handler = vi.fn();
    const off = BroadcastBus.on(MessageType.WORKSPACE_UPDATED, handler);
    BroadcastBus.emit(MessageType.WORKSPACE_UPDATED, { foo: 'bar' });
    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0]).toEqual({ foo: 'bar' });
    off();
  });

  it('does not deliver after the handler is unsubscribed', () => {
    const handler = vi.fn();
    const off = BroadcastBus.on(MessageType.WORKSPACE_UPDATED, handler);
    off();
    BroadcastBus.emit(MessageType.WORKSPACE_UPDATED, {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes the envelope source through', () => {
    const handler = vi.fn();
    const off = BroadcastBus.on(MessageType.WORKSPACE_UPDATED, handler);
    BroadcastBus.setSource('sidepanel');
    BroadcastBus.emit(MessageType.WORKSPACE_UPDATED, {});
    const envelope = handler.mock.calls[0][1];
    expect(envelope.source).toBe('sidepanel');
    off();
    BroadcastBus.setSource('standalone');
  });
});
