// src/core/background/BackgroundRouter.ts — the background request/response
// dispatcher (Appendix E BackgroundRouter Skeleton, spec lines 5189-5202 +
// §16.2 Message Security, spec lines 2005-2010; §8.1 "typed chrome.runtime.onMessage
// dispatcher"). Owns TWO responsibilities:
//
//   1. VALIDATE — §16.2: `sender.id !== chrome.runtime.id` → return false
//      (never respond to a foreign sender). Valid sender + non-canonical
//      message type → reply workerState.fail(MSG_UNKNOWN_TYPE, ...) (Pitfall 5:
//      the MessageType whitelist is the ONLY vocabulary; T-1-04).
//   2. DISPATCH — valid envelopes go to the in-context MessageBus (01-03) and
//      are acknowledged via workerState.ok/fail (Pitfall 5: replies are always
//      ResponseEnvelopes, never a mutated request).
//
// register() is called SYNCHRONOUSLY from defineBackground.main() (DONE-when,
// §18 line 2559: "Background router registers listeners synchronously" — no
// await before listener registration). Every path returns a value or calls
// sendResponse — dispatch errors are caught and logged (EVT_HANDLER, Golden
// Rule 9) then answered with a fail envelope. Dependency-free core (Pitfall 4):
// no React, no antd, no zustand.
import { MessageBus } from '@/core/messaging/MessageBus';
import { MessageTypeValues } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope, ResponseEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { workerState } from '@/core/runtime/workerState';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

// The background-side inbound dispatch target (01-03): the bus installs its own
// whitelist-guarded runtime listener, so valid envelopes reach any background
// subscriber independently of the request/response listener below.
const messageBus = new MessageBus();

export const BackgroundRouter = {
  register(): void {
    // Wire the bus as the background's inbound broadcast path (Pitfall 5 /
    // T-1-04: the bus whitelist is the single gate). Phase 1 registers no
    // background-side consumers (R-3 — no AI/IndexedDB work in the SW;
    // PROXY_FETCH handling lands with its phase), so inbound broadcasts are
    // logged silently.
    messageBus.subscribe((envelope) => {
      debugLog(ERROR_CODES.EVT_HANDLER, 'background inbound broadcast received', {
        silent: true,
        module: 'BackgroundRouter',
        extra: { type: envelope.type },
      });
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // §16.2: never respond to foreign senders (spoof guard).
      if (sender.id !== chrome.runtime.id) return false;

      const envelope = message as RuntimeEnvelope<unknown>;

      // Pitfall 5 / T-1-04: canonical MessageType whitelist — an unknown type
      // from a valid sender is answered with the canonical fail shape.
      if (!MessageTypeValues.includes(envelope.type)) {
        sendResponse(
          workerState.fail(ERROR_CODES.MSG_UNKNOWN_TYPE, 'unknown message type', envelope.id),
        );
        return true;
      }

      void dispatch(envelope)
        .then(sendResponse)
        .catch((err: unknown) => {
          // Golden Rule 9: never throw out of the listener — log the canonical
          // code and answer with a fail envelope so the sender never hangs.
          debugLog(ERROR_CODES.EVT_HANDLER, 'background dispatch failed', {
            error: err instanceof Error ? err : undefined,
            module: 'BackgroundRouter',
          });
          sendResponse(
            workerState.fail(ERROR_CODES.UNKNOWN, 'background dispatch failed', envelope.id),
          );
        });
      return true; // async sendResponse
    });
  },
};

/**
 * Resolve a validated envelope into a ResponseEnvelope. Phase 1 registers no
 * dedicated background request handlers (PROXY_FETCH, the session bridge and
 * the workspace mirror land with their phases) — the envelope has already been
 * delivered to the MessageBus subscribers, so a validated message is
 * acknowledged. Per-type handlers extend this function when they land.
 */
async function dispatch(message: RuntimeEnvelope<unknown>): Promise<ResponseEnvelope<unknown>> {
  return workerState.ok({ received: message.type }, message.id);
}
