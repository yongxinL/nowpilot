// src/core/messaging/BackgroundRouter.ts
//
// Thin typed wrapper around MessageBus. This is the SINGLE background message
// registration entry symbol (D-13 / D-14) — entrypoints/background.ts calls
// BackgroundRouter.register() and nothing else for message dispatch.
//
// Phase-1 handlers are advisory: console.debug only. State-mutating handlers
// added in later phases MUST verify `sender.id === chrome.runtime.id` before
// trusting envelope contents (T-01-04).
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
import type { RuntimeEnvelope } from '../runtime/RuntimeEnvelope';

let registered = false;

/**
 * Initialize the message bus (idempotent) and pre-register the advisory
 * background-side handlers for the content-script lifecycle messages.
 *
 * Must be called from `entrypoints/background.ts` main() — synchronously, so
 * handlers attach before the first message on every SW wake.
 */
export function register(): void {
  if (registered) return;
  registered = true;

  initMessageBus();

  registerHandler(
    'CONTENT_SCRIPT_READY',
    (envelope: RuntimeEnvelope, sender) => {
      const tabId = sender.tab?.id;
      const url = (envelope.payload as { url?: string } | undefined)?.url;
      // eslint-disable-next-line no-console
      console.debug('[BG] Content script ready:', tabId, url);
    },
  );

  registerHandler('SPA_NAVIGATION', (envelope: RuntimeEnvelope) => {
    const url = (envelope.payload as { url?: string } | undefined)?.url;
    // eslint-disable-next-line no-console
    console.debug('[BG] SPA navigation:', url);
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
