// PageContentService — per-surface module singleton orchestrator for the
// layered page extraction read path (D-81: create-only — no pipeline wiring,
// no surface call-sites this phase).
//
// extract() selects a strategy by canHandle({url, mode}), runs it under a
// SINGLE AbortController (PAGE_EXTRACTION_TIMEOUT_MS = 5_000 internal deadline
// merged with the caller signal — the Requester single-controller pattern;
// both abort paths classify as the typed error, D-91), redacts the result
// panel-side before it leaves the service (D-90 seam), and NEVER returns a
// silent empty result: no handler / strategy throw / timeout / fallback
// exhaustion all surface the typed ok:false CONTENT_EXTRACT_FAILED variant
// (Appendix C.2 closed-set literal — no invented codes, D-38;
// StreamErrorCodeSchema is untouched).
import { debugLog } from '../log/debugLog';
import type { PageContext } from '../content/PageContext';
import { serializeToPageContext } from './PageContentSerializer';
import type { RawNode } from './apcLite.types';
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './strategies/IExtractionStrategy';
import { PAGE_EXTRACTION_TIMEOUT_MS } from './strategies/IExtractionStrategy';
import { defuddleStrategy } from './strategies/DefuddleStrategy';

/** D-90 seam semantics — same secret-key pattern as redactSensitive.ts:25. */
const SECRET_KEY_REGEX = /key|token|secret|authorization/i;

export interface ExtractionMetrics {
  durationMs: number;
  source: StrategyResult['source'];
  truncated: boolean;
  charCount: number;
}

/** Typed result union — never a silent empty result (D-91). The ok:false
 * code is the Appendix C.2 closed-set literal CONTENT_EXTRACT_FAILED. */
export type ExtractResult =
  | { ok: true; context: PageContext; metrics: ExtractionMetrics }
  | { ok: false; code: 'CONTENT_EXTRACT_FAILED'; message: string; cause?: unknown };

export interface ExtractInput {
  tabId: number;
  url: string;
  title: string;
  mode: 'default' | 'actionable';
  html?: string;
  baseUrl?: string;
  raw?: RawNode;
  /** Payload truncation flag (PageHtmlPayload.truncated) — propagated to the
   * strategy so the result records the 2 MB serializer cap. */
  truncated?: boolean;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Module state (single registry per surface — UI contexts only)
// ---------------------------------------------------------------------------

const strategies = new Map<StrategyResult['source'], IExtractionStrategy>();

/** Register an IExtractionStrategy (D-51 style). Tests register fixture
 * strategies; ApcLiteStrategy registers in 06-02. */
function registerStrategy(strategy: IExtractionStrategy): void {
  strategies.set(strategy.id, strategy);
}

// D-51: declarative registration at module load. Mode 'actionable' has no
// handler until 06-02 — the no-handler path surfaces the typed error, which
// is legitimate tracer behavior, not an architectural gap.
registerStrategy(defuddleStrategy);

function selectStrategy(input: { url: string; mode: 'default' | 'actionable' }): IExtractionStrategy | undefined {
  for (const strategy of strategies.values()) {
    if (strategy.canHandle(input)) return strategy;
  }
  return undefined;
}

/** D-90 panel-side redaction seam: deep-clones the PageContext and empties
 * meta/addonFields entries whose keys match the /key|token|secret|authorization/i
 * pattern (same semantics as redactSensitive.ts:25). Page content
 * (markdown/html/title/url) passes through UNCHANGED — page content is the
 * extraction's purpose; password values are already omitted at capture by
 * 06-02's walker. Superseded by the richer TraceRedactor (Phase 11). */
export function redactExtractedContent(context: PageContext): PageContext {
  const clone: PageContext = {
    ...context,
    meta: { ...context.meta },
    addonFields: context.addonFields ? { ...context.addonFields } : undefined,
  };
  for (const key of Object.keys(clone.meta)) {
    if (SECRET_KEY_REGEX.test(key)) clone.meta[key] = '';
  }
  if (clone.addonFields) {
    for (const key of Object.keys(clone.addonFields)) {
      if (SECRET_KEY_REGEX.test(key)) clone.addonFields[key] = '';
    }
  }
  return clone;
}

/** Defensive origin/hostname derivation — an unparseable url degrades to the
 * url string so the serializer still emits a well-formed PageContext. */
function deriveOrigin(url: string): { origin: string; hostname: string } {
  try {
    const parsed = new URL(url);
    return { origin: parsed.origin, hostname: parsed.hostname };
  } catch {
    return { origin: url, hostname: url };
  }
}

async function extract(input: ExtractInput): Promise<ExtractResult> {
  const startedAt = Date.now();
  // Single AbortController per extraction: the internal deadline merged with
  // the caller signal — both abort paths classify as the typed error (D-91).
  const controller = new AbortController();
  const internalTimer = setTimeout(() => controller.abort(), PAGE_EXTRACTION_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (input.signal?.aborted) {
    controller.abort();
  } else {
    input.signal?.addEventListener('abort', onCallerAbort);
  }
  const abortPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('extraction aborted')));
  });

  try {
    const strategy = selectStrategy({ url: input.url, mode: input.mode });
    if (!strategy) {
      return extractFailed(`no strategy registered for mode '${input.mode}'`, input);
    }
    const strategyInput: StrategyInput = {
      url: input.url,
      title: input.title,
      mode: input.mode,
      html: input.html,
      baseUrl: input.baseUrl,
      raw: input.raw,
      truncated: input.truncated,
    };
    const result = await Promise.race([strategy.run(strategyInput), abortPromise]);
    if (result.markdown === undefined && result.root === undefined) {
      // Fallback exhausted (DefuddleStrategy returns this shape) — never a
      // silent empty result (D-91).
      return extractFailed('strategy produced no content', input);
    }
    const { origin, hostname } = deriveOrigin(input.url);
    const context = serializeToPageContext({
      url: input.url,
      origin,
      hostname,
      title: input.title,
      extractedAt: Date.now(),
      strategyResult: result,
      mode: input.mode,
    });
    const redacted = redactExtractedContent(context);
    const metrics: ExtractionMetrics = {
      durationMs: Date.now() - startedAt,
      source: result.source,
      truncated: result.truncated,
      charCount: result.markdown?.length ?? 0,
    };
    // Redacted context only — metrics carry no page content.
    debugLog('EXTRACT_DONE', 'page content extracted', { metrics });
    return { ok: true, context: redacted, metrics };
  } catch (error) {
    if (controller.signal.aborted) {
      return extractFailed(`extraction timed out after ${PAGE_EXTRACTION_TIMEOUT_MS}ms`, input, error);
    }
    return extractFailed('strategy run failed', input, error);
  } finally {
    clearTimeout(internalTimer);
    input.signal?.removeEventListener('abort', onCallerAbort);
  }
}

function extractFailed(message: string, input: ExtractInput, cause?: unknown): ExtractResult {
  debugLog('EXTRACT_FAILED', message, { url: input.url, mode: input.mode });
  return { ok: false, code: 'CONTENT_EXTRACT_FAILED', message, cause };
}

/** Object-form namespace export for callers (ProviderRegistry precedent). */
export const PageContentService = { extract, registerStrategy };

export { extract, registerStrategy };

// ---------------------------------------------------------------------------
// Test seams — exported only for unit tests. `__test__` prefix matches the
// chromeStorageAdapter / ProviderRegistry convention. Production code must
// NOT use these.
// ---------------------------------------------------------------------------

export const __test__ = {
  reset(): void {
    strategies.clear();
    registerStrategy(defuddleStrategy);
  },
};