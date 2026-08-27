import { describe, it, expect } from 'vitest';
import { createChunkBuffer } from '../../../src/core/ai/ChunkBuffer';

/**
 * ChunkBuffer contract tests (plan 03-04, Task 1 — added under the Rule 2
 * deviation precedent from 03-02: the acceptance criteria are behavioral, so
 * a deterministic test proves them repeatably).
 *
 * Timing-based paths (rAF batching, the 8 kB/s → 33 ms setTimeout upgrade)
 * are exercised via the synchronous flushNow() — the rAF/33 ms window is
 * environment-dependent; the flush CONTRACT (enqueue → cumulative flush,
 * unsubscribe, reset) is deterministic.
 */

describe('createChunkBuffer (Appendix J)', () => {
  it('enqueue + flushNow delivers the cumulative text to subscribers', () => {
    const buffer = createChunkBuffer();
    const received: string[] = [];
    buffer.onFlush((text) => received.push(text));

    buffer.enqueue('Hello ');
    buffer.enqueue('world');
    buffer.flushNow();

    expect(received).toEqual(['Hello world']);
  });

  it('onFlush returns an unsubscribe function', () => {
    const buffer = createChunkBuffer();
    const received: string[] = [];
    const unsubscribe = buffer.onFlush((text) => received.push(text));

    buffer.enqueue('first');
    buffer.flushNow();
    expect(received).toEqual(['first']);

    unsubscribe();
    buffer.enqueue('second');
    buffer.flushNow();
    expect(received).toEqual(['first']); // no second delivery
  });

  it('multiple flushes accumulate (each flush carries the full text)', () => {
    const buffer = createChunkBuffer();
    const received: string[] = [];
    buffer.onFlush((text) => received.push(text));

    buffer.enqueue('ab');
    buffer.flushNow();
    buffer.enqueue('cd');
    buffer.flushNow();

    expect(received).toEqual(['ab', 'abcd']);
  });

  it('reset clears the pending + accumulated text', () => {
    const buffer = createChunkBuffer();
    const received: string[] = [];
    buffer.onFlush((text) => received.push(text));

    buffer.enqueue('stale');
    buffer.reset();
    buffer.enqueue('fresh');
    buffer.flushNow();

    expect(received).toEqual(['fresh']); // 'stale' never delivered
  });

  it('flushNow with no pending text still notifies subscribers (spec verbatim)', () => {
    const buffer = createChunkBuffer();
    const received: string[] = [];
    buffer.onFlush((text) => received.push(text));
    buffer.flushNow();
    expect(received).toEqual(['']);
  });
});