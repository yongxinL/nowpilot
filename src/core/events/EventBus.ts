// src/core/events/EventBus.ts — typed in-panel event system (§13 line 1802:
// "EventBus handlers are synchronous. Handlers may spawn internal Promises but
// must never let errors escape."). One broken handler never breaks the loop —
// every handler runs in try/catch and errors route to debugLog EVT_HANDLER
// (Golden Rule 9). Dependency-free core (Pitfall 4): no surface imports.
//
// Event names match the Phase-1 in-panel events (§13 / Appendix E vocabulary).
// Deferred debugLog: lands in 01-04 as src/core/log/debugLog.ts. Until then this
// module compiles standalone — every catch calls the guarded hook (typeof check),
// so a missing logger never breaks the handler loop. 01-04 wires the real import.
export const EVENT_TYPES = [
  'SHOW_HANDOFF_PENDING',
  'SHOW_HANDOFF_COMPLETE',
  'WORKSPACE_SYNC_START',
  'WORKSPACE_SYNC_COMPLETE',
  'WORKSPACE_MIRRORING_START',
  'WORKSPACE_MIRRORING_STOP',
  'WORKSPACE_ELECTION_FAILED',
  'SIDEPANEL_OPENED',
  'STANDALONE_OPENED',
  'NOTE_SAVE',
  'THEME_CHANGED',
  'NETWORK_STATUS_CHANGED',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type EventScope = 'sidepanel' | 'standalone' | 'background';
export type EventHandler<T = unknown> = (data: T) => void;

type DebugLogFn = (
  code: string,
  message: string,
  options?: { error?: unknown; context?: string; extra?: Record<string, unknown> },
) => void;
declare const debugLog: DebugLogFn | undefined;

/**
 * Synchronous, typed event bus. Handlers registered per event name; emit
 * dispatches data to all handlers for the event and returns whether any
 * handler was invoked. A throwing handler is isolated (logged, loop continues).
 */
export class EventBus<E extends string = EventType> {
  private readonly handlers = new Map<E, Set<EventHandler<unknown>>>();
  private readonly scoped = new Map<EventScope, Set<EventHandler<unknown>>>();

  constructor(events: readonly string[]) {
    for (const event of events) this.handlers.set(event as E, new Set());
  }

  /** Register a handler for an event. */
  subscribe(event: E, handler: EventHandler<unknown>): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }

  /** Remove a previously-registered handler. */
  unsubscribe(event: E, handler: EventHandler<unknown>): void {
    this.handlers.get(event)?.delete(handler);
  }

  /**
   * Dispatch data to all handlers for the event. Returns true when at least one
   * handler was invoked. If a scope is given, scoped handlers registered for
   * that surface scope also receive the data.
   */
  emit(event: E, data?: unknown, scope?: EventScope): boolean {
    let delivered = false;
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      for (const handler of [...eventHandlers]) {
        delivered = true;
        try {
          handler(data);
        } catch (err) {
          if (typeof debugLog === 'function') {
            debugLog('EVT_HANDLER', `EventBus handler error for event "${event}"`, {
              error: err,
              context: 'EventBus.emit',
            });
          }
        }
      }
    }
    if (scope) {
      const scopedHandlers = this.scoped.get(scope);
      if (scopedHandlers) {
        for (const handler of [...scopedHandlers]) {
          delivered = true;
          try {
            handler(data);
          } catch (err) {
            if (typeof debugLog === 'function') {
              debugLog('EVT_HANDLER', `EventBus scoped handler error for scope "${scope}"`, {
                error: err,
                context: 'EventBus.emit.scope',
              });
            }
          }
        }
      }
    }
    return delivered;
  }

  /**
   * Register a handler that receives events emitted for a specific surface
   * scope ('sidepanel' | 'standalone' | 'background'). Returns an unsubscribe
   * function.
   */
  subscribeToScope(scope: EventScope, handler: EventHandler<unknown>): () => void {
    let set = this.scoped.get(scope);
    if (!set) {
      set = new Set();
      this.scoped.set(scope, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }
}
