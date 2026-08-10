// src/core/ai/ChunkBuffer.ts — Source: PRODUCT_SPEC Appendix J.1 (lines 5625-5674,
// VERBATIM). rAF-batched streaming UI buffer: enqueued deltas accumulate and flush
// to listeners on the next animation frame (≤16 ms cadence), degrading to a 33 ms
// setTimeout cadence when the enqueue rate exceeds the 8_000 B/s default (spec
// §12.6 forbids motion-driven text reveals — rAF flushing is the ONLY text
// animation). Total text is never dropped: order is preserved via `full += pending`
// and the tail is preserved via flushNow()'s final drain. Byte-rate counts JS
// string length (UTF-16 code units) per the AI-03 [encoding] flagged assumption.
export interface ChunkBuffer {
  enqueue(delta: string): void;
  onFlush(cb: (text: string) => void): () => void;
  flushNow(): void;
  reset(): void;
}
export function createChunkBuffer(): ChunkBuffer {
  let pending = '';
  let full = '';
  let rafId: number | null = null;
  const listeners = new Set<(t: string) => void>();
  let byteRate = 0;
  let lastMeasure = performance.now();
  function schedule() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      full += pending;
      pending = '';
      for (const cb of listeners) cb(full);
    });
  }
  return {
    enqueue(delta) {
      pending += delta;
      byteRate += delta.length;
      const now = performance.now();
      if (now - lastMeasure > 1000) {
        byteRate = delta.length;
        lastMeasure = now;
      }
      if (byteRate > 8_000 && rafId === null) {
        rafId = setTimeout(() => {
          rafId = null;
          full += pending;
          pending = '';
          listeners.forEach((cb) => cb(full));
        }, 33) as unknown as number;
      } else {
        schedule();
      }
    },
    onFlush(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    flushNow() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId as number);
        rafId = null;
      }
      full += pending;
      pending = '';
      listeners.forEach((cb) => cb(full));
    },
    reset() {
      pending = '';
      full = '';
      if (rafId !== null) {
        cancelAnimationFrame(rafId as number);
        rafId = null;
      }
    },
  };
}
