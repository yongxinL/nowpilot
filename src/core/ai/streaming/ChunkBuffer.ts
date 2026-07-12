/**
 * rAF-batched text-delta buffer for smooth streaming UI updates.
 *
 * Per D-06: ChunkBuffer processes only renderer `text-delta` events.
 * Tool/planner events flow through immediately — they do NOT go through ChunkBuffer.
 * The AgentOrchestrator is responsible for routing events.
 *
 * No singleton — consumers (AgentOrchestrator) create instances.
 */

// Stub: will be implemented in GREEN phase
export class ChunkBuffer {
  constructor(private onFlush: (text: string) => void) {}

  push(_text: string): void {
    // Stub — no-op
  }

  flush(): void {
    // Stub — no-op
  }

  destroy(): void {
    // Stub — no-op
  }
}
