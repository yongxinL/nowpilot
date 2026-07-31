import { isEnvelope, type RuntimeEnvelope } from '../runtime/RuntimeEnvelope';

type MessageHandler<T = unknown> = (
  envelope: RuntimeEnvelope<T>,
  sender: chrome.runtime.MessageSender,
) => unknown;

const handlers = new Map<string, Set<MessageHandler>>();

export function register<T = unknown>(type: string, handler: MessageHandler<T>): () => void {
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

export async function dispatch(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  if (!isEnvelope(message)) return;

  const set = handlers.get(message.type);
  if (!set || set.size === 0) return;

  const results = await Promise.allSettled(
    Array.from(set).map((handler) => handler(message as RuntimeEnvelope, sender)),
  );

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason);

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error('[MessageBus] handler errors:', errors);
  }

  // D-04: a single fulfilled handler forwards its return value so sendResponse
  // carries the actual result (e.g. SerializedPage from the content script's
  // EXTRACT_PAGE_CONTENT handler). Multi-handler sets keep the settled array.
  if (results.length === 1 && results[0].status === 'fulfilled') {
    return results[0].value;
  }
  return results;
}

let initialized = false;

export function init(): void {
  if (initialized) return;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    dispatch(message, sender)
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
