/**
 * Parent + child AbortSignal model for staged timeout and user cancellation.
 *
 * Per D-17: Single root AbortController per operation. Each stage gets a child
 * signal via createStageTimeout. AI SDK v4 natively accepts abortSignal in
 * generateText/streamText — child signals are passed directly.
 *
 * No singleton — one instance per AgentOrchestrator operation.
 */

// Stub: will be implemented in GREEN phase
export class AbortManager {
  readonly rootController = new AbortController();

  createStageTimeout(_ms: number): AbortSignal {
    // Stub — returns root signal (no proper child management)
    return this.rootController.signal;
  }

  cancel(_reason?: string): void {
    // Stub — no-op
  }

  get isAborted(): boolean {
    return false;
  }
}
