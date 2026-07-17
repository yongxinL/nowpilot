/**
 * ContentChangeWatcher — dormant skeleton for Phase 8.
 *
 * Reserved for future dynamic-page content change detection.
 * No active observers in Phase 7.2.
 *
 * Pattern: minimal no-op class (PATTERNS.md §5)
 */
export class ContentChangeWatcher {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  /**
   * No-op watch — returns a no-op cleanup function.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watch(_callback: () => void): () => void {
    return () => {}; // no-op cleanup
  }

  /**
   * No-op destroy.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  destroy(): void {}
}
