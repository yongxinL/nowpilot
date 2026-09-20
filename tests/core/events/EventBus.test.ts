import { describe, it, expect, vi, beforeEach } from 'vitest';
import { on, emit, off, hasListeners } from '../../../src/core/events/EventBus';

describe('EventBus', () => {
  beforeEach(() => {
    off('test:event');
  });

  it('calls registered handler on emit', () => {
    const handler = vi.fn();
    on('test:event', handler);
    emit('test:event', { data: 'hello' });
    expect(handler).toHaveBeenCalledWith({ data: 'hello' });
  });

  it('does not call handler after unsubscribe', () => {
    const handler = vi.fn();
    const unsubscribe = on('test:event', handler);
    unsubscribe();
    emit('test:event', { data: 'hello' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles multiple handlers for same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    on('test:event', handler1);
    on('test:event', handler2);
    emit('test:event', { data: 'hello' });
    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('hasListeners returns correct status', () => {
    expect(hasListeners('test:event')).toBe(false);
    const unsub = on('test:event', vi.fn());
    expect(hasListeners('test:event')).toBe(true);
    unsub();
    expect(hasListeners('test:event')).toBe(false);
  });

  it('swallows handler errors', () => {
    const badHandler = vi.fn(() => {
      throw new Error('test error');
    });
    const goodHandler = vi.fn();
    on('test:event', badHandler);
    on('test:event', goodHandler);
    expect(() => emit('test:event', {})).not.toThrow();
    expect(goodHandler).toHaveBeenCalled();
  });
});
