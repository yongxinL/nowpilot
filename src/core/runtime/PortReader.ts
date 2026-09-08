import { MessageType } from './MessageType';
import type { RuntimeEnvelope } from './RuntimeEnvelope';

export function readPort<T>(port: chrome.runtime.Port): AsyncIterable<T> {
  const queue: T[] = [];
  let done = false;
  let err: unknown = null;
  let notify: (() => void) | null = null;
  port.onMessage.addListener((env: RuntimeEnvelope<any>) => {
    if (env.type === MessageType.PORT_STREAM_CHUNK) queue.push(env.payload.data as T);
    else if (env.type === MessageType.PORT_STREAM_END) {
      done = true;
      if (!env.payload.ok) err = env.payload.error;
    }
    notify?.();
  });
  port.onDisconnect.addListener(() => {
    done = true;
    err = err ?? new Error('PORT_DISCONNECTED');
    notify?.();
  });
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<T>> {
          while (queue.length === 0 && !done) await new Promise<void>((res) => { notify = res; });
          if (queue.length > 0) return { value: queue.shift()!, done: false };
          if (err) throw err;
          return { value: undefined as any, done: true };
        },
      };
    },
  };
}
