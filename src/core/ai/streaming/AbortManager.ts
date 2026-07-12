/**
 * Parent + child AbortSignal model for staged timeout and user cancellation.
 *
 * Per D-17: Single root AbortController per operation. Each stage gets a child
 * signal via createStageTimeout. AI SDK v4 natively accepts abortSignal in
 * generateText/streamText — child signals are passed directly.
 *
 * Per D-18 staged recovery: Planner timeout → one-shot repair (by PlannerService).
 * Executor timeout → structured error result (by ExecutorService).
 * Renderer timeout → partial text or error (by RendererService).
 * AbortManager provides the signal infrastructure — each service handles its own recovery.
 *
 * No singleton — one instance per AgentOrchestrator operation.
 */
export class AbortManager {
  readonly rootController = new AbortController();

  /**
   * Creates a child AbortSignal that aborts when either:
   * 1. Root controller aborts (user cancellation) — clears timeout, propagates root reason.
   * 2. Timeout fires after `ms` milliseconds — aborts with TimeoutError.
   */
  createStageTimeout(ms: number): AbortSignal {
    const stageController = new AbortController();
    const timeoutId = setTimeout(
      () => stageController.abort(new DOMException('Stage timeout', 'TimeoutError')),
      ms,
    );

    this.rootController.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        stageController.abort(this.rootController.signal.reason);
      },
      { once: true },
    );

    return stageController.signal;
  }

  /** Abort the root controller with the given reason (user cancellation). */
  cancel(reason?: string): void {
    this.rootController.abort(new DOMException(reason ?? 'User cancelled', 'AbortError'));
  }

  /** True if the root controller has been aborted. */
  get isAborted(): boolean {
    return this.rootController.signal.aborted;
  }
}
