// Appendix J.1 (PRODUCT_SPEC_v0_1.md:5626-5678) — verbatim semantics.
//
// ChunkBuffer batches STREAM_DELTA text for React rendering (D-47): rAF
// batching by default, upgraded to a 33 ms setTimeout when the byte rate
// exceeds 8 kB/s (§22.1 — bounds render churn during fast streams).
//
// P2 write-rate prohibition (D-45): this module has NO chrome.storage access
// of any kind — mid-stream chunks live in memory only. Grep-assertable:
// `grep -n "chrome.storage" src/core/ai/ChunkBuffer.ts` must be empty.
//
// Quirk kept verbatim from the spec: `flushNow`/`reset` call
// cancelAnimationFrame even when the pending id came from the 33 ms
// setTimeout upgrade path (the spec does not distinguish the two id
// spaces). The late timeout fires once more with the (now empty) pending
// buffer — an idempotent duplicate flush for subscribers.
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