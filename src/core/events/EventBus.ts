type EventHandler<T = unknown> = (payload: T) => void;

interface EventEntry {
  handlers: Set<EventHandler>;
}

const events = new Map<string, EventEntry>();

function getEvent(name: string): EventEntry {
  if (!events.has(name)) {
    events.set(name, { handlers: new Set() });
  }
  return events.get(name)!;
}

export function on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
  const entry = getEvent(event);
  entry.handlers.add(handler as EventHandler);
  return () => {
    entry.handlers.delete(handler as EventHandler);
    if (entry.handlers.size === 0) {
      events.delete(event);
    }
  };
}

export function emit<T = unknown>(event: string, payload: T): void {
  const entry = events.get(event);
  if (!entry) return;
  entry.handlers.forEach((handler) => {
    try {
      handler(payload);
    } catch {
      // handlers must not throw — swallow
    }
  });
}

export function off(event: string, handler?: EventHandler): void {
  if (handler) {
    const entry = events.get(event);
    if (entry) {
      entry.handlers.delete(handler);
      if (entry.handlers.size === 0) events.delete(event);
    }
  } else {
    events.delete(event);
  }
}

export function hasListeners(event: string): boolean {
  const entry = events.get(event);
  return entry ? entry.handlers.size > 0 : false;
}
