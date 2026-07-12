/**
 * rAF-batched text-delta buffer for smooth streaming UI updates.
 *
 * Per D-06: ChunkBuffer processes only renderer `text-delta` events.
 * Tool/planner events flow through immediately — they do NOT go through ChunkBuffer.
 * The AgentOrchestrator is responsible for routing events.
 *
 * No singleton — consumers (AgentOrchestrator) create instances.
 */
export class ChunkBuffer {
  private buffer: string[] = [];
  private rafId: number | null = null;

  constructor(private onFlush: (text: string) => void) {}

  push(text: string): void {
    this.buffer.push(text);
    this.scheduleFlush();
  }

  flush(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.buffer.length > 0) {
      const combined = this.buffer.join('');
      this.buffer = [];
      this.onFlush(combined);
    }
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.buffer = [];
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return; // already scheduled
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flush();
    });
  }
}
