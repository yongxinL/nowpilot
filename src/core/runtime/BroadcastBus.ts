import type { RuntimeEnvelope, RuntimeSource } from './RuntimeEnvelope';
import type { MessageTypeValue } from './MessageType';

type BroadcastHandler = (payload: unknown, envelope: RuntimeEnvelope<unknown>) => void;

const localHandlers = new Map<MessageTypeValue, Set<BroadcastHandler>>();
const recentlyEmitted = new Set<string>();
let runtimeListenerInstalled = false;
let currentSource: RuntimeSource = 'standalone';

function installRuntimeListener(): void {
  if (runtimeListenerInstalled) return;
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
  runtimeListenerInstalled = true;
  chrome.runtime.onMessage.addListener((message: unknown) => {
    const env = message as RuntimeEnvelope<unknown> & { __broadcast?: boolean };
    if (!env || env.__broadcast !== true) return;
    if (recentlyEmitted.has(env.id)) {
      recentlyEmitted.delete(env.id);
      return;
    }
    deliver(env);
  });
}

function deliver(env: RuntimeEnvelope<unknown>): void {
  const set = localHandlers.get(env.type);
  if (!set) return;
  for (const handler of [...set]) {
    try {
      handler(env.payload, env);
    } catch {
      // Broadcast handlers must never let errors escape (§13 EventBus rule).
    }
  }
}

export const BroadcastBus = {
  setSource(source: RuntimeSource): void {
    currentSource = source;
  },
  on(type: MessageTypeValue, handler: BroadcastHandler): () => void {
    installRuntimeListener();
    let set = localHandlers.get(type);
    if (!set) {
      set = new Set();
      localHandlers.set(type, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  },
  emit(type: MessageTypeValue, payload: unknown): void {
    const id = crypto.randomUUID();
    const env: RuntimeEnvelope<unknown> = {
      id,
      type,
      createdAt: Date.now(),
      source: currentSource,
      payload,
    };
    deliver(env);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      recentlyEmitted.add(id);
      void chrome.runtime.sendMessage({ __broadcast: true, ...env });
    }
  },
};
