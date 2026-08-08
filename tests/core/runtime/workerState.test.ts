// tests/core/runtime/workerState.test.ts — RUNTIME-02 fixture tests for the
// workerState.ok/fail ResponseEnvelope helpers (§20.5 + RESEARCH Pitfall 5:
// every background/content handler replies via workerState, never a mutated
// request). Covers: ok wraps data with ok:true; fail produces the { code,
// message } error shape with ok:false; the fail envelope survives a JSON
// serialize/deserialize round-trip (the transport path chrome.runtime.sendMessage
// uses) with its shape intact; request-id threading.
import { describe, expect, it } from 'vitest';
import { workerState } from '@/core/runtime/workerState';
import type { ResponseEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { createOperationId } from '@/core/runtime/OperationId';

describe('workerState.ok', () => {
  it('wraps data with ok:true and a correlatable id', () => {
    const envelope = workerState.ok({ pong: true });
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data).toEqual({ pong: true });
    }
    expect(envelope.id).toBeTruthy();
  });

  it('threads the request id when provided', () => {
    const requestId = createOperationId();
    const envelope = workerState.ok({ accepted: true }, requestId);
    expect(envelope.id).toBe(requestId);
  });
});

describe('workerState.fail', () => {
  it('produces the { code, message } error shape with ok:false', () => {
    const envelope = workerState.fail('MSG_UNKNOWN_TYPE', 'unknown message type');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error).toEqual({
        code: 'MSG_UNKNOWN_TYPE',
        message: 'unknown message type',
        retryable: false,
      });
    }
    expect(envelope.id).toBeTruthy();
  });

  it('roundtrips through JSON serialization (transport path) to the same shape', () => {
    const requestId = createOperationId();
    const fail = workerState.fail('MSG_UNKNOWN_TYPE', 'unknown message type', requestId);
    // chrome.runtime.sendMessage serializes the reply; the deserialized value
    // must be structurally identical (the RuntimeEnvelope contract, Pitfall 5).
    const deserialized = JSON.parse(JSON.stringify(fail)) as ResponseEnvelope<never>;
    expect(deserialized).toEqual(fail);
    expect(deserialized.ok).toBe(false);
    if (!deserialized.ok) {
      expect(deserialized.error.code).toBe('MSG_UNKNOWN_TYPE');
    }
    expect(deserialized.id).toBe(requestId);
  });

  it('fail envelopes pair with a request RuntimeEnvelope (dispatch correlation)', () => {
    const request: RuntimeEnvelope<unknown> = {
      id: createOperationId(),
      type: MessageType.PING,
      createdAt: Date.now(),
      source: 'sidepanel',
      payload: {},
    };
    const reply = workerState.fail('MSG_UNKNOWN_TYPE', 'unknown message type', request.id);
    expect(reply.id).toBe(request.id);
  });
});
