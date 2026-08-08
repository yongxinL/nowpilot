// tests/core/events/EventBus.test.ts — EventBus + EventBusManager unit tests.
// Pure in-panel logic (no chrome APIs) so it runs in the node environment,
// avoiding the jsdom 30 TextEncoder/esbuild invariant break (01-01 Rule 3
// precedent; same pattern as the 01-02 runtime fixture tests).
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { EventBus, EVENT_TYPES, type EventType } from '@/core/events/EventBus';
import { getEventBus } from '@/core/events/EventBusManager';

describe('EventBus', () => {
  it('delivers data to subscribed handlers on emit', () => {
    const bus = new EventBus(EVENT_TYPES);
    const handler = vi.fn();
    bus.subscribe('NOTE_SAVE', handler);
    const data = { noteId: 'n1' };
    const result = bus.emit('NOTE_SAVE', data);
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith(data);
  });

  it('returns false when no handler is registered for the event', () => {
    const bus = new EventBus(EVENT_TYPES);
    expect(bus.emit('NOTE_SAVE', {})).toBe(false);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus(EVENT_TYPES);
    const handler = vi.fn();
    bus.subscribe('THEME_CHANGED', handler);
    bus.unsubscribe('THEME_CHANGED', handler);
    expect(bus.emit('THEME_CHANGED', 'dark')).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers to every handler for the same event', () => {
    const bus = new EventBus(EVENT_TYPES);
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe('NETWORK_STATUS_CHANGED', a);
    bus.subscribe('NETWORK_STATUS_CHANGED', b);
    bus.emit('NETWORK_STATUS_CHANGED', { online: true });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('subscribeToScope delivers only events emitted for that scope', () => {
    const bus = new EventBus(EVENT_TYPES);
    const sidepanelHandler = vi.fn();
    const backgroundHandler = vi.fn();
    bus.subscribeToScope('sidepanel', sidepanelHandler);
    bus.subscribeToScope('background', backgroundHandler);

    bus.emit('WORKSPACE_SYNC_START', { workspaceId: 'w1' }, 'sidepanel');
    expect(sidepanelHandler).toHaveBeenCalledWith({ workspaceId: 'w1' });
    expect(backgroundHandler).not.toHaveBeenCalled();

    bus.emit('WORKSPACE_SYNC_START', { workspaceId: 'w1' }, 'background');
    expect(backgroundHandler).toHaveBeenCalledTimes(1);
    expect(sidepanelHandler).toHaveBeenCalledTimes(1);
  });

  it('returns an unsubscribe function from subscribeToScope', () => {
    const bus = new EventBus(EVENT_TYPES);
    const handler = vi.fn();
    const unsubscribe = bus.subscribeToScope('standalone', handler);
    unsubscribe();
    bus.emit('SIDEPANEL_OPENED', {}, 'standalone');
    expect(handler).not.toHaveBeenCalled();
  });

  it('one throwing handler does not break the next handler', () => {
    const bus = new EventBus(EVENT_TYPES);
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    bus.subscribe('NOTE_SAVE', throwing);
    bus.subscribe('NOTE_SAVE', ok);

    expect(() => bus.emit('NOTE_SAVE', { noteId: 'n2' })).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('unscoped emit does not reach scoped handlers', () => {
    const bus = new EventBus(EVENT_TYPES);
    const handler = vi.fn();
    bus.subscribeToScope('sidepanel', handler);
    bus.emit('WORKSPACE_SYNC_COMPLETE', {});
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('EventBusManager', () => {
  it('returns the same shared EventBus instance (lazy singleton)', () => {
    const first = getEventBus();
    const second = getEventBus();
    expect(first).toBe(second);
    expect(first).toBeInstanceOf(EventBus);
  });

  it('shared instance is pre-configured with the canonical event list', () => {
    const bus = getEventBus();
    const handler = vi.fn();
    bus.subscribe('THEME_CHANGED' as EventType, handler);
    bus.emit('THEME_CHANGED', 'dark');
    expect(handler).toHaveBeenCalledWith('dark');
  });
});
