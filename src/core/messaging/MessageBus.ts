import type { EnvelopeType, RuntimeEnvelope } from '../runtime/RuntimeEnvelope';
import { validateEnvelope } from '../runtime/RuntimeEnvelopeValidation';

type MessageHandler<T = unknown> = (
  envelope: RuntimeEnvelope<T>,
  sender: chrome.runtime.MessageSender,
) => void | Promise<void>;

const handlers = new Map<EnvelopeType, Set<MessageHandler>>();

export function register<T = unknown>(
  type: EnvelopeType,
  handler: MessageHandler<T>,
): () => void {
  if (!handlers.has(type)) {
    handlers.set(type, new Set());
  }
  handlers.get(type)!.add(handler as MessageHandler);
  return () => {
    const set = handlers.get(type);
    if (set) {
      set.delete(handler as MessageHandler);
      if (set.size === 0) handlers.delete(type);
    }
  };
}

/**
 * Dispatch an already-validated envelope to every handler registered for its
 * type. Module-private: the listener validates once and calls this directly,
 * while the exported `dispatch` validates for any other caller.
 */
async function dispatchEnvelope(
  envelope: RuntimeEnvelope,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  const set = handlers.get(envelope.type);
  if (!set || set.size === 0) return;

  // Wrap each handler invocation in try/catch so a synchronous throw from
  // one handler cannot escape the .map() callback and abort the dispatch
  // for the others. allSettled isolates rejections that surface as Promise
  // rejections; without this try/catch, a handler that throws synchronously
  // propagates the throw out of .map() BEFORE allSettled can see it, and the
  // dispatch promise itself rejects. With it, the synchronous throw is
  // converted to a Promise rejection and allSettled handles it correctly.
  const results = await Promise.allSettled(
    Array.from(set).map((handler) => {
      try {
        return handler(envelope, sender);
      } catch (error) {
        return Promise.reject(error);
      }
    }),
  );

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason);

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error('[MessageBus] handler errors:', errors);
  }
}

/**
 * Validate, then dispatch. An envelope that fails `validateEnvelope` — wrong
 * type, missing field, extra field, wrong payload shape or oversized payload —
 * is rejected before any handler runs, so no handler can observe unvalidated
 * attacker-controlled data (T-1-26).
 */
export async function dispatch(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  const validation = validateEnvelope(message);
  if (!validation.ok) return;
  return dispatchEnvelope(validation.envelope, sender);
}

let initialized = false;

export function init(): void {
  if (initialized) return;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // T-1-25: `sender.id` is the only trustworthy identity field on this
    // boundary — any context that can call sendMessage reaches this listener.
    // A foreign id, an absent sender and an absent sender.id are all
    // rejections; the envelope's declared `source` is never consulted as
    // identity (T-1-27). Fail closed with no response.
    if (
      !sender ||
      typeof sender.id !== 'string' ||
      sender.id.length === 0 ||
      sender.id !== chrome.runtime.id
    ) {
      return false;
    }

    // Reject an invalid envelope before dispatch so a malformed message is
    // never half-applied and never answered as if it were accepted.
    const validation = validateEnvelope(message);
    if (!validation.ok) return false;

    dispatchEnvelope(validation.envelope, sender)
      .then((result) => {
        sendResponse(result ?? { ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: String(error) });
      });
    return true;
  });
  initialized = true;
}

export function isInitialized(): boolean {
  return initialized;
}
