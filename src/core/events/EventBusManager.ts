// src/core/events/EventBusManager.ts — singleton wrapper around the shared
// EventBus instance. Every surface (sidepanel / standalone / background)
// subscribes here (01-05/01-06) and dispatches events per surface scope through
// the SAME EventBus instance, so in-panel events stay coordinated across the
// phase without cross-context chrome.* traffic.
import { EventBus, EVENT_TYPES } from './EventBus';

let shared: EventBus | null = null;

/** Lazy-initialized shared EventBus instance. */
export function getEventBus(): EventBus {
  if (!shared) shared = new EventBus(EVENT_TYPES);
  return shared;
}
