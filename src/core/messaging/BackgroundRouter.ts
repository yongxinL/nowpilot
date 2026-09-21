// src/core/messaging/BackgroundRouter.ts
//
// Thin typed wrapper around MessageBus. This is the SINGLE background message
// registration entry symbol (D-13 / D-14) — entrypoints/background.ts calls
// BackgroundRouter.register() and nothing else for message dispatch.
//
// Phase-1 handlers are advisory: console.debug only, bound to the canonical
// MessageType literals. State-mutating handlers added in later phases MUST
// keep MessageBus's `sender.id === chrome.runtime.id` guard before trusting
// envelope contents (T-1-25).
//
// The scaffold-local literals (CONTENT_SCRIPT_READY, SPA_NAVIGATION and the
// frozen extraction types) are deliberately left unhandled: no Phase-1
// requirement owns them, so no surface may claim a page-extraction or
// SPA-navigation capability the runtime does not implement (T-1-29). Phase 6
// and Phase 17 claim them and register their handlers there.
//
// Idempotent within one SW lifetime: a module-level flag prevents double
// registration when the SW wakes mid-session (Pitfall 1 in RESEARCH.md).
//
// Module-function style (no class, no default export) matches MessageBus.ts's
// own exported-function convention.

import {
  init as initMessageBus,
  register as registerHandler,
} from './MessageBus';
import { MessageType } from '../runtime/RuntimeEnvelope';
import type { RuntimeEnvelope } from '../runtime/RuntimeEnvelope';

let registered = false;

/**
 * Initialize the message bus (idempotent) and register the advisory
 * background-side handlers for the canonical open-request messages.
 *
 * Must be called from `entrypoints/background.ts` main() — synchronously, so
 * handlers attach before the first message on every SW wake.
 */
export function register(): void {
  if (registered) return;
  registered = true;

  initMessageBus();

  // No Phase-1 requirement gives the background an open behaviour: each
  // surface owns its own navigation (the palette's focus-side-panel command
  // opens the Side Panel from the Standalone surface). These handlers record
  // the request only — they claim no capability the runtime lacks.
  registerHandler(MessageType.OPEN_SIDE_PANEL, (envelope: RuntimeEnvelope) => {
    // eslint-disable-next-line no-console
    console.debug('[BG] Open side panel requested:', envelope.operationId);
  });

  registerHandler(MessageType.OPEN_STANDALONE, (envelope: RuntimeEnvelope) => {
    // eslint-disable-next-line no-console
    console.debug('[BG] Open standalone requested:', envelope.operationId);
  });
}

/**
 * Test-only escape hatch: lets unit tests reset the idempotency guard so a
 * subsequent register() in the same module instance re-attaches handlers.
 * Not exported from index barrels — direct import only.
 */
export function __resetForTests(): void {
  registered = false;
}
