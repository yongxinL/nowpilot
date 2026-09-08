import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/events/EventBus';

describe('EventBus', () => {
  it('dispatches events to registered handlers', () => {
    const handler = vi.fn();
    const off = EventBus.on('test', handler);
    EventBus.emit('test', { a: 1 });
    expect(handler).toHaveBeenCalledWith({ a: 1 });
    off();
    EventBus.clear();
  });

  it('a throwing handler does not prevent other handlers from running', () => {
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    EventBus.on('test', throwing);
    EventBus.on('test', ok);
    EventBus.emit('test');
    expect(ok).toHaveBeenCalled();
    EventBus.clear();
  });

  it('does not call a handler after it is unsubscribed', () => {
    const handler = vi.fn();
    const off = EventBus.on('test', handler);
    off();
    EventBus.emit('test');
    expect(handler).not.toHaveBeenCalled();
    EventBus.clear();
  });
});
