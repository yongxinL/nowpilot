import type { ExtractionMode, StrategyInput, StrategyResult } from '../types';

/**
 * Generalized extraction strategy interface (D-09, promoted abstraction).
 *
 * Each strategy is a first-class citizen with a readonly discriminator id,
 * a `canHandle` predicate for mode/applicability filtering, and an async
 * `run` that produces a typed StrategyResult. The orchestrator
 * (PageContentService) drives the fallback chain — strategies never decide
 * confidence or fallback themselves.
 */
export interface IExtractionStrategy {
  readonly id: 'defuddle' | 'readability' | 'apc-lite';

  canHandle(input: { url: string; mode: ExtractionMode }): boolean;

  run(input: StrategyInput): Promise<StrategyResult>;
}
