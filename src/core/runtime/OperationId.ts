// src/core/runtime/OperationId.ts — Source: RESEARCH (lines 406-409)
// Never hand-roll Date.now+rand — use the native UUID generator: it is
// collision-safe and available in every extension context (MV3 secure contexts, A7).
export function createOperationId(): string {
  return crypto.randomUUID();
}
