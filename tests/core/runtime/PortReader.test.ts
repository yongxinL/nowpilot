import { describe, expect, it } from 'vitest';
import { MessageType } from '@/core/runtime/MessageType';
import { readPort } from '@/core/runtime/PortReader';

function createMockPort() {
  const messageListeners: Array<(env: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  const port = {
    onMessage: {
      addListener: (fn: (env: unknown) => void) => {
        messageListeners.push(fn);
      },
    },
    onDisconnect: {
      addListener: (fn: () => void) => {
        disconnectListeners.push(fn);
      },
    },
    emit: (env: unknown) => {
      for (const fn of messageListeners) fn(env);
    },
    disconnect: () => {
      for (const fn of disconnectListeners) fn();
    },
  };
  return port;
}

describe('readPort', () => {
  it('streams chunks and completes on end', async () => {
    const port = createMockPort();
    const iterator = readPort<string>(port as unknown as chrome.runtime.Port)[Symbol.asyncIterator]();

    port.emit({ type: MessageType.PORT_STREAM_CHUNK, payload: { data: 'a' } });
    const first = await iterator.next();
    expect(first.value).toBe('a');
    expect(first.done).toBe(false);

    port.emit({ type: MessageType.PORT_STREAM_CHUNK, payload: { data: 'b' } });
    const second = await iterator.next();
    expect(second.value).toBe('b');

    port.emit({ type: MessageType.PORT_STREAM_END, payload: { ok: true } });
    const done = await iterator.next();
    expect(done.done).toBe(true);
  });

  it('throws when the port disconnects before end', async () => {
    const port = createMockPort();
    const iterator = readPort<string>(port as unknown as chrome.runtime.Port)[Symbol.asyncIterator]();
    port.disconnect();
    await expect(iterator.next()).rejects.toThrow('PORT_DISCONNECTED');
  });
});
