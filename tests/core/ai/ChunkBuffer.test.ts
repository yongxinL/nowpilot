// tests/core/ai/ChunkBuffer.test.ts — Appendix J.1 contract (03-03): rAF-batched
// flushing delivers the ACCUMULATED full text on the next animation frame, the
// byte-rate throttle (>8_000 B/s) degrades to the 33 ms setTimeout cadence, and
// flushNow() drains the pending tail immediately. Total text is NEVER dropped:
// order + tail preserved (full accumulates; flushNow is the final drain). Runs in
// the default jsdom-align environment (rAF present via pretendToBeVisual).
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createChunkBuffer } from '@/core/ai/ChunkBuffer';

/** Resolve on the next animation frame — real rAF (deterministic in jsdom). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Resolve after real ms elapsed (used only for the 33 ms throttle cadence test). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChunkBuffer — rAF batching (Appendix J.1)', () => {
  it('flushes the accumulated full text on the next animation frame', async () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    buffer.onFlush((t) => flushes.push(t));

    buffer.enqueue('hel');
    buffer.enqueue('lo');
    await nextFrame();

    // rAF batches both deltas into ONE flush with the full text (never two).
    expect(flushes).toEqual(['hello']);
  });

  it('order is preserved across frames — full text accumulates', async () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    buffer.onFlush((t) => flushes.push(t));

    buffer.enqueue('a');
    await nextFrame();
    expect(flushes).toEqual(['a']);

    buffer.enqueue('b');
    buffer.enqueue('c');
    await nextFrame();
    // full text is never dropped: second flush carries 'abc', not just 'bc'.
    expect(flushes).toEqual(['a', 'abc']);
  });

  it('onFlush returns an unsubscribe that stops future flushes', async () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    const unsubscribe = buffer.onFlush((t) => flushes.push(t));

    buffer.enqueue('x');
    await nextFrame();
    expect(flushes).toEqual(['x']);

    unsubscribe();
    buffer.enqueue('y');
    await nextFrame();
    expect(flushes).toEqual(['x']); // no new flush after unsubscribe
  });
});

describe('ChunkBuffer — flushNow tail (Appendix J.1)', () => {
  it('flushNow drains the pending tail immediately without waiting for a frame', () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    buffer.onFlush((t) => flushes.push(t));

    buffer.enqueue('tail');
    buffer.flushNow();

    expect(flushes).toEqual(['tail']);
  });

  it('flushNow after frames preserves order + appends to the full text', async () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    buffer.onFlush((t) => flushes.push(t));

    buffer.enqueue('one');
    await nextFrame();
    buffer.enqueue('two');
    buffer.flushNow();

    // tail ('two') is appended after the accumulated full text ('one').
    expect(flushes).toEqual(['one', 'onetwo']);
  });

  it('flushNow with nothing pending re-emits the current full text (idempotent)', () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    buffer.onFlush((t) => flushes.push(t));

    buffer.enqueue('done');
    buffer.flushNow();
    buffer.flushNow();

    expect(flushes).toEqual(['done', 'done']);
  });
});

describe('ChunkBuffer — byte-rate throttle (8_000 B/s, J.1)', () => {
  it('degrades to the 33 ms setTimeout cadence above 8_000 B/s — text never dropped', async () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    buffer.onFlush((t) => flushes.push(t));

    // A single delta larger than 8_000 UTF-16 units trips the throttle branch.
    const big = 'x'.repeat(9_000);
    buffer.enqueue(big);

    // The rAF path is replaced by a 33 ms setTimeout; wait past it.
    await sleep(60);
    expect(flushes).toEqual([big]);

    // Tail is still preserved on the throttled path.
    buffer.enqueue('tail');
    buffer.flushNow();
    expect(flushes[flushes.length - 1]).toBe(big + 'tail');
  });

  it('small deltas below the threshold stay on the rAF cadence', async () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    buffer.onFlush((t) => flushes.push(t));

    buffer.enqueue('tiny');
    await nextFrame();
    expect(flushes).toEqual(['tiny']);
  });
});

describe('ChunkBuffer — reset', () => {
  it('reset clears pending text and cancels a scheduled flush', async () => {
    const buffer = createChunkBuffer();
    const flushes: string[] = [];
    buffer.onFlush((t) => flushes.push(t));

    buffer.enqueue('discard-me');
    buffer.reset();

    await nextFrame();
    expect(flushes).toEqual([]); // nothing scheduled survived reset

    buffer.enqueue('fresh');
    buffer.flushNow();
    expect(flushes).toEqual(['fresh']); // buffer usable after reset
  });
});
