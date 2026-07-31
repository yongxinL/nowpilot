# Phase 04a: Page Content Extraction - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 21 (13 source, 8 test)
**Analogs found:** 13 / 13

## File Classification

### Source Files (to create/modify)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/extraction/types.ts` | types | n/a (type definitions) | `src/core/ai/types.ts` | exact |
| `src/core/extraction/apcLite.types.ts` | types/schema | n/a (Zod schemas) | `src/core/ai/types.ts` + PlannerService (Zod) | exact |
| `src/core/extraction/strategies/IExtractionStrategy.ts` | interface | strategy pattern | `src/core/ai/providers/ProviderAdapter.ts` | exact |
| `src/core/extraction/strategies/DefuddleStrategy.ts` | strategy impl | transform (HTML→markdown) | `src/core/ai/providers/openai.ts` | role-match |
| `src/core/extraction/strategies/ReadabilityFallback.ts` | strategy impl | transform (HTML→text) | `src/core/ai/providers/openai.ts` | role-match |
| `src/core/extraction/strategies/ApcLiteStrategy.ts` | strategy impl | transform (HTML→tree) | `src/core/ai/providers/openai.ts` | role-match |
| `src/core/extraction/PageContentService.ts` | service/orchestrator | request-response + fallback chain | `src/core/context/ContextOptimizer.ts` | exact |
| `src/core/extraction/PageContentSerializer.ts` | utility | transform (results→PageContext) | `src/core/ai/PlannerService.ts` | partial |
| `src/core/extraction/PageIndexBuilder.ts` | service | indexing/retrieval (build→search) | `src/core/context/PromptCacheManager.ts` | partial |
| `src/core/extraction/PageContentCache.ts` | cache | in-memory key-value | `src/core/context/PromptCacheManager.ts` | exact |
| `src/core/content/DomSerializer.ts` | utility | transform (DOM→string) | `src/core/security/redactSensitive.ts` | partial |
| `src/core/content/PageContextBridge.ts` | middleware/bridge | messaging (req/resp via MessageBus) | `src/core/messaging/MessageBus.ts` | exact |
| `entrypoints/content.core.ts` | entry point (modify) | event-driven + request-response | existing `entrypoints/content.core.ts` | exact (self) |

### Test Files (to create)

| New Test File | Role | Closest Analog | Match Quality |
|---------------|------|----------------|---------------|
| `tests/core/extraction/DefuddleStrategy.test.ts` | test | `tests/core/ai/PlannerService.test.ts` | strategy test pattern |
| `tests/core/extraction/ApcLiteStrategy.test.ts` | test | `tests/core/ai/PlannerService.test.ts` | strategy test pattern |
| `tests/core/extraction/PageIndexBuilder.test.ts` | test | `tests/core/context/PromptCacheManager.test.ts` | in-memory service test |
| `tests/core/extraction/PageContentService.test.ts` | test | `tests/core/context/PromptCacheManager.test.ts` | orchestrator test |
| `tests/core/content/DomSerializer.test.ts` | test | `tests/core/security/redactSensitive.test.ts` | utility function test |
| `tests/isolation/no-content-script-ui.test.ts` | test | `tests/isolation/cross-entrypoint-imports.test.ts` | exact |
| `tests/core/content/PageContextBridge.test.ts` | test | `tests/core/runtime/RuntimeEnvelope.test.ts` | messaging test |
| `tests/core/extraction/strategies/ReadabilityFallback.test.ts` | test | `tests/core/ai/PlannerService.test.ts` | strategy test pattern |

---

## Pattern Assignments

### `src/core/extraction/types.ts` (types, discriminated unions + error types)

**Analog:** `src/core/ai/types.ts` (lines 1–183)

**Imports pattern** (lines 1-1):
```typescript
// src/core/ai/types.ts:1 — barrel re-export is typical for types modules;
// types.ts is the canonical location for core domain types.
```

**Discriminated union pattern** (lines 24-26):
```typescript
// src/core/ai/types.ts:24-26 — discriminated union by string literal
export type PlannerDecision =
  | { action: 'answer'; reasonCode: string }
  | { action: 'run_tool'; toolName: string; input: unknown }
  | { action: 'ask_clarification'; question: string };
```

**Union string literal type pattern** (lines 5-19):
```typescript
// src/core/ai/types.ts:5-19 — string literal union for error codes
export type PipelineErrorCode =
  | 'PROVIDER_AUTH'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_5XX'
  | 'NETWORK'
  // ... more codes
  | 'UNKNOWN';
```

**Interface pattern** (lines 49-54):
```typescript
// src/core/ai/types.ts:49-54 — interface with literal union kind discriminator
export interface PromptSection {
  kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
}
```

**Error class companion pattern:** `src/core/ai/PipelineError.ts` (lines 27-49) — every domain error type has a companion `Error` subclass:
```typescript
// src/core/ai/PipelineError.ts:27-49
export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly category: PipelineErrorCategory;
  readonly retryable: boolean;
  readonly userFacingMessage: string;
  readonly diagnostic?: Record<string, unknown>;
  readonly timestamp: number;

  constructor(code: PipelineErrorCode, userFacingMessage: string, diagnostic?: Record<string, unknown>) {
    super(`[${code}] ${userFacingMessage}`);
    this.name = 'PipelineError';
    this.code = code;
    this.category = CODE_CATEGORY[code];
    this.retryable = this.category === 'retryable';
    this.userFacingMessage = userFacingMessage;
    this.diagnostic = diagnostic;
    this.timestamp = Date.now();
  }
}
```

**Key takeaway for `types.ts`:** Copy the discriminated union pattern from `src/core/ai/types.ts` for `ExtractionResult` and `PageContext`. Copy the error class pattern from `src/core/ai/PipelineError.ts` for `ExtractionError`.

---

### `src/core/extraction/apcLite.types.ts` (Zod schemas, APCLiteNode)

**Analog:** `src/core/ai/PlannerService.ts` (lines 1-30) for Zod discriminant pattern

**Zod discriminated union pattern** (lines 10-30):
```typescript
// src/core/ai/PlannerService.ts:10-30
import { z } from 'zod';

const AnswerSchema = z.strictObject({
  action: z.literal('answer'),
  reasonCode: z.string().max(64),
});

const RunToolSchema = z.strictObject({
  action: z.literal('run_tool'),
  toolName: z.string().max(64),
  input: z.record(z.string(), z.unknown()),
});

export const PlannerDecisionSchema = z.discriminatedUnion('action', [
  AnswerSchema,
  RunToolSchema,
  AskClarificationSchema,
]);
```

**Key takeaway for `apcLite.types.ts`:** Use `z.strictObject()` for individual node types (per the spec Appendix C), then compose with `z.discriminatedUnion()`. Export both the inferred TypeScript types and the Zod schemas.

---

### `src/core/extraction/strategies/IExtractionStrategy.ts` (strategy contract interface)

**Analog:** `src/core/ai/providers/ProviderAdapter.ts` (lines 1-18)

**Interface pattern with readonly props and async methods:**
```typescript
// src/core/ai/providers/ProviderAdapter.ts:4-18
export interface ProviderAdapter {
  providerId: PipelineProviderId;
  createLanguageModel(modelId: string): LanguageModel;
  validateConnection(): Promise<{ ok: boolean; models: string[] }>;
  supportsStructuredOutput: boolean;
  getDefaultModelForTier(tier: ModelTier): string;
  getCacheStrategy(): 'anthropic-ephemeral' | 'gemini-cachedContent' | 'prefix-only';
  getTelemetryMetadata(): Record<string, unknown>;
  countTokens?(text: string): Promise<number>;
}
```

**Key takeaway for `IExtractionStrategy`:** Define as a clean interface with an `id` discriminator property, a `canHandle()` predicate, and an async `run()` method returning a typed result. Use `'defuddle' | 'readability' | 'apc-lite'` as the `id` literal union.

---

### `src/core/extraction/strategies/DefuddleStrategy.ts` (PRIMARY: defuddle parser → markdown)

**Analog:** `src/core/ai/providers/openai.ts` (lines 1-53) — strategy implementation pattern

**Strategy implementation structure** (entire file):
```typescript
// src/core/ai/providers/openai.ts:1-53
import { createOpenAI } from '@ai-sdk/openai';           // third-party import
import type { LanguageModel } from 'ai';                    // framework import
import type { ProviderAdapter } from './ProviderAdapter';   // interface import
import type { PipelineProviderId, ModelTier } from '../types'; // domain types

export function createOpenAIAdapter(apiKey: string, baseURL?: string): ProviderAdapter {
  // Factory function returning an object literal implementing the interface
  const client = createOpenAI({ apiKey, baseURL });

  return {
    providerId: 'openai' as PipelineProviderId,  // literal type assertion for discriminator

    createLanguageModel(modelId: string): LanguageModel {
      return client.chat(modelId);
    },

    get supportsStructuredOutput(): boolean {    // getter for readonly properties
      return true;
    },

    async validateConnection(): Promise<{ ok: boolean; models: string[] }> {
      try {
        // ... implementation
      } catch {
        return { ok: false, models: [] };
      }
    },

    getDefaultModelForTier(tier: ModelTier): string {
      const mapping: Record<ModelTier, string> = {
        FAST: 'gpt-4o-mini',
        BALANCED: 'gpt-4o',
        ADVANCED: 'o3-mini',
      };
      return mapping[tier];
    },

    getCacheStrategy(): 'prefix-only' { return 'prefix-only'; },

    getTelemetryMetadata(): Record<string, unknown> {
      return { provider: 'openai' };
    },
  };
}
```

**Key takeaway for `DefuddleStrategy`:** Implement as a class (not factory) per the research pattern. Place in `strategies/` subfolder. Import `defuddle` from `'defuddle'`. Use `DOMParser` to construct a document from the serialized HTML string, then call `Defuddle(doc).parse()`.

---

### `src/core/extraction/strategies/ReadabilityFallback.ts` (fallback: readability → textContent)

**Analog:** Same as DefuddleStrategy — `src/core/ai/providers/openai.ts` (lines 1-53)

Same class-implements-interface pattern.

**Key takeaway:** Clone the document before passing to Readability (avoiding DOM mutation per RESEARCH.md Pitfall 3). Use a static class constant for `LOW_CONFIDENCE_CHAR_THRESHOLD = 500` (D-07).

---

### `src/core/extraction/strategies/ApcLiteStrategy.ts` (actionable: DOM+ARIA → APCLiteNode tree)

**Analog:** Same as DefuddleStrategy — `src/core/ai/providers/openai.ts` (lines 1-53)

Same class-implements-interface pattern.

**Key takeaway:** Use `DOMParser().parseFromString(html, 'text/html')` to construct the DOM, then walk the tree building `APCLiteNode` objects. Validate output with Zod schema from `apcLite.types.ts`.

---

### `src/core/extraction/PageContentService.ts` (orchestrator: extract + reExtract + cache + timeout)

**Analog:** `src/core/context/ContextOptimizer.ts` (lines 1-287) — exact match for orchestrator role

**Import pattern** (lines 1-18):
```typescript
// src/core/context/ContextOptimizer.ts:1-18
import { z } from 'zod';
import type {
  ContextOptimizerInput,
  ContextProvenanceEntry,
  OptimizedContext,
  PromptSection,
} from '../ai/types';
import { PipelineError } from '../ai/PipelineError';
import { providerRouter } from '../ai/ProviderRouter';
import { hashStableSections } from '../ai/PromptCacheAdapter';
import { classifyModelContext } from './ModelContextTier';
import { tokenBudget } from './TokenBudget';
import { contextCompressor } from './ContextCompressor';
import {
  createProvenanceManifest,
  markCompression,
  recordSection,
} from './ContextProvenanceManifest';
```

**Class/service pattern** (lines 69-287):
```typescript
// src/core/context/ContextOptimizer.ts:69-287
export class ContextOptimizer {
  async optimize(input: ContextOptimizerInput): Promise<OptimizedContext> {
    // 1. Validate input with Zod schema
    const validation = ContextOptimizerInputSchema.safeParse(input);
    if (!validation.success) {
      throw new PipelineError('SCHEMA_INVALID', '...', { issues: ... });
    }

    // 2. Core orchestration logic
    const tier = classifyModelContext(input.modelContextWindow);
    const budget = tokenBudget.allocateBudget(tier, input.modelContextWindow);

    // 3. Multi-step pipeline with try/catch + PipelineError propagation
    try {
      // ...
    } catch (err) {
      // ...
    }

    // 4. Return typed result
    return { tier, inputBudget, outputBudget, sections, provenance, minimalMode, cacheMetadata };
  }

  // Private helper methods
  private buildSystemSection(): PromptSection { ... }
  private buildToolSchemasSection(...): PromptSection { ... }
  // ...
}

// Module-level singleton
export const contextOptimizer = new ContextOptimizer();  // line 287
```

**Module-level singleton export** (line 287):
```typescript
export const contextOptimizer = new ContextOptimizer();
```

**Key takeaway for `PageContentService`:** Export as a class + module-level singleton. Use `Map<string, Promise<ExtractionResult>>` for in-flight concurrency coalescing (D-18). Implement the timeout budget loop per D-10 using `Promise.race()`. Return `ExtractionResult` discriminated union — never throw for operational failures (D-11).

---

### `src/core/extraction/PageContentSerializer.ts` (transform StrategyResult → PageContext)

**Analog:** `src/core/ai/PlannerService.ts` (lines 1-30) for Zod validation approach

**Zod validation at boundary pattern** (lines 1-30):
```typescript
// src/core/ai/PlannerService.ts:1-30
import { z } from 'zod';

const AnswerSchema = z.strictObject({
  action: z.literal('answer'),
  reasonCode: z.string().max(64),
});

export const PlannerDecisionSchema = z.discriminatedUnion('action', [
  AnswerSchema,
  RunToolSchema,
  AskClarificationSchema,
]);
```

**Key takeaway for `PageContentSerializer`:** Validate the `StrategyResult` against the `PageContext` Zod schema before returning. This ensures the discriminated union is correct and consumers get type-safe results. Copy the `z.strictObject` + `z.discriminatedUnion` pattern.

---

### `src/core/extraction/PageIndexBuilder.ts` (MiniSearch ephemeral index)

**Analog:** `src/core/context/PromptCacheManager.ts` (lines 1-167) — in-memory service with Map state

**In-memory state + class pattern** (lines 36-44):
```typescript
// src/core/context/PromptCacheManager.ts:36-44
export class PromptCacheManager {
  private health: Map<PipelineProviderId, ProviderCacheHealth> = new Map();

  constructor() {
    // Initialize state
    for (const pid of VALID_PROVIDERS) {
      this.health.set(pid, { missStreak: 0, lastHit: 0, disabledUntil: null });
    }
  }
```

**Module-level singleton** (line 167):
```typescript
export const promptCacheManager = new PromptCacheManager();
```

**Key takeaway for `PageIndexBuilder`:** Manage an internal `MiniSearch` instance. Initialize in constructor with field boosting config (D-15). Provide `buildFromText()`, `selectRelevant(query, budget)`, and `removeTab(tabId)` public methods. Export as class + singleton.

---

### `src/core/extraction/PageContentCache.ts` (per-tab in-memory Map cache)

**Analog:** `src/core/context/PromptCacheManager.ts` (lines 36-167) — exact match for Map-based in-memory cache

**Map-based cache pattern** (lines 36-44, plus get/set/invalidation methods):
```typescript
// src/core/context/PromptCacheManager.ts:36-44
export class PromptCacheManager {
  private health: Map<PipelineProviderId, ProviderCacheHealth> = new Map();
  // ... getOrCreateHealth(), isCacheDisabled() for invalidation logic
```

**Key takeaway for `PageContentCache`:** Use `Map<number, { url: string; result: ExtractionResult; indexedAt: number }>` keyed by `tabId`. Implement `get(tabId, url)`, `set(tabId, url, result)`, `invalidate(tabId)`. Invalidation checks: URL mismatch + `indexedAt` timestamp. Lazy re-extraction policy — cache returns null on mismatch, caller triggers re-extract (D-17).

---

### `src/core/content/DomSerializer.ts` (content-script-safe DOM serializer with password redaction)

**Analog:** `src/core/security/redactSensitive.ts` (lines 1-39) — single-purpose pure utility

**Utility function pattern with constants** (entire file, lines 1-39):
```typescript
// src/core/security/redactSensitive.ts:1-39
// Regex-based patterns for secret redaction.
// Patterns are ordered from most-specific to least-specific to avoid collisions.

const JWT_PATTERN = /eyJ[a-zA-Z0-9._-]{20,}/g;
const BARE_SK_PATTERN = /\bsk-[a-zA-Z0-9_-]+/g;
const API_KEY_VALUE_PATTERN = /(?:api[_-]?key)[=:]\s*[a-zA-Z0-9_-]+/gi;

/**
 * Redacts sensitive information from a string.
 * @param input - The string potentially containing secrets
 * @returns The string with secrets replaced by ***REDACTED*** placeholders
 */
export function redactSensitive(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return '';
  }

  return input
    .replace(JWT_PATTERN, '***REDACTED_JWT***')
    .replace(BARE_SK_PATTERN, '***REDACTED***')
    .replace(API_KEY_VALUE_PATTERN, 'api_key=***REDACTED***')
    // ... chained .replace() calls in order of specificity
}

// Also export a named interface for the return type
export interface SerializedPage { /* ... */ }
```

**Key takeaway for `DomSerializer`:** Export a pure function `serializePage(doc: Document): SerializedPage` with constant declarations at the top (`SIZE_CAP`, `PASSWORD_INPUT_SELECTOR`, `PASSWORD_NAME_PATTERN`). No dependencies on third-party libraries — pure DOM API only. Must never import from React, AntD, defuddle, yaml, or use File System Access APIs (D-20).

---

### `src/core/content/PageContextBridge.ts` (MessageBus handler for EXTRACT_PAGE_CONTENT)

**Analog:** `src/core/messaging/MessageBus.ts` (lines 1-66) — registration pattern + init

**Generic handler type** (lines 3-6):
```typescript
// src/core/messaging/MessageBus.ts:3-6
type MessageHandler<T = unknown> = (
  envelope: RuntimeEnvelope<T>,
  sender: chrome.runtime.MessageSender,
) => void | Promise<void>;
```

**register() function** (lines 10-22):
```typescript
// src/core/messaging/MessageBus.ts:10-22
export function register<T = unknown>(type: string, handler: MessageHandler<T>): () => void {
  if (!handlers.has(type)) {
    handlers.set(type, new Set());
  }
  handlers.get(type)!.add(handler as MessageHandler);
  return () => {
    const set = handlers.get(type);
    if (set) {
      set.delete(handler as MessageHandler);
      if (set.size === 0) handlers.delete(type);
    }
  };
}
```

**init() pattern** (lines 49-62):
```typescript
// src/core/messaging/MessageBus.ts:49-62
let initialized = false;

export function init(): void {
  if (initialized) return;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    dispatch(message, sender)
      .then((result) => {
        sendResponse(result ?? { ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: String(error) });
      });
    return true; // keep sendResponse callback alive
  });
  initialized = true;
}
```

**Key takeaway for `PageContextBridge`:** This module exports a `register()` call that connects `DomSerializer` output to the MessageBus. The handler receives `EXTRACT_PAGE_CONTENT` envelopes, calls `serializePage(document)` synchronously, and returns the `SerializedPage` via `sendResponse` (D-04). It's a thin glue layer between MessageBus and DomSerializer.

---

### `entrypoints/content.core.ts` (MODIFY — RuntimeEnvelope migration, DomSerializer integration)

**Analog:** existing `entrypoints/content.core.ts` (lines 1-50) + `entrypoints/background.ts` (lines 1-34)

**WXT entry point shell** (lines 1-49):
```typescript
// entrypoints/content.core.ts:1-49
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    if (!document.body) return;

    let lastUrl = location.href;

    function detectNavigation(): void {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        chrome.runtime.sendMessage({
          type: 'SPA_NAVIGATION',
          url: location.href,
          timestamp: Date.now(),
        }).catch(() => {});
      }
    }

    const observer = new MutationObserver(() => { detectNavigation(); });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('wxt:locationchange', () => { detectNavigation(); });

    // Cleanup on content script unload
    return () => { observer.disconnect(); document.removeEventListener('wxt:locationchange', onLocationChange); };
  },
});
```

**Key changes to `content.core.ts`:**
- Replace raw `chrome.runtime.sendMessage({ type: '...' })` with `createEnvelope('...', payload, 'content')` (D-03)
- Register `EXTRACT_PAGE_CONTENT` handler via `MessageBus.register()` calling `serializePage(document)` (D-04, D-06)
- Remove `CONTENT_SCRIPT_READY` message entirely (D-03)
- Initialize MessageBus: call `init()` before `register()` (D-03)
- SPA_NAVIGATION uses `createEnvelope()` from `RuntimeEnvelope`

**Import pattern from MessageBus usage:**
```typescript
import { createEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { register, init } from '@/core/messaging/MessageBus';
import { serializePage } from '@/core/content/DomSerializer';
```

---

## Test File Patterns

### `tests/core/extraction/DefuddleStrategy.test.ts` (strategy test)

**Analog:** `tests/core/ai/PlannerService.test.ts` (lines 1-155)

**Test pattern** (lines 1-82):
```typescript
// tests/core/ai/PlannerService.test.ts:1-82
import { describe, it, expect, vi } from 'vitest';
import type { OptimizedContext } from '../../../src/core/ai/types';
import type { ProviderAdapter } from '../../../src/core/ai/providers/ProviderAdapter';
import { PipelineError } from '../../../src/core/ai/PipelineError';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn() },
  isStepCount: vi.fn(() => vi.fn()),
}));

function createMockAdapter(overrides?: Partial<ProviderAdapter>): ProviderAdapter {
  return {
    providerId: 'openai',
    createLanguageModel: vi.fn(() => ({}) as any),
    validateConnection: vi.fn(),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn(() => 'gpt-4o-mini'),
    getCacheStrategy: vi.fn((): 'prefix-only' => 'prefix-only'),
    getTelemetryMetadata: vi.fn(() => ({ provider: 'openai' })),
    ...overrides,
  };
}

function buildMockOptimizedContext(overrides?: Partial<OptimizedContext>): OptimizedContext {
  return {
    tier: 'medium',
    inputBudget: 89600,
    outputBudget: 25600,
    sections: [ /* ... */ ],
    provenance: { sections: [], totalTokens: 26, minimalMode: false, workspaceId: 'ws-test', activeSurface: 'sidepanel' },
    minimalMode: false,
    ...overrides,
  };
}

describe('PlannerService', () => {
  it('returns answer decision when supportsStructuredOutput is true', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { action: 'answer', reasonCode: 'direct_answer' },
    });

    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const adapter = createMockAdapter({ supportsStructuredOutput: true });
    const result = await plannerService.plan(adapter, 'FAST', buildMockOptimizedContext());

    expect(result.action).toBe('answer');
    if (result.action === 'answer') {
      expect(result.reasonCode).toBe('direct_answer');
    }
  });
```

**Key takeaway for strategy tests:** Use dynamic `import()` for the module under test to enable proper Vitest mocking. Create mock HTML fixtures (use jsdom `document`). Verify `canHandle()` predicate, `run()` output shape, and low-confidence fallback behavior. Import path: `'../../../src/core/extraction/strategies/DefuddleStrategy'`.

---

### `tests/core/content/DomSerializer.test.ts` (utility test)

**Analog:** `tests/core/security/redactSensitive.test.ts` (lines 1-53)

**Pure utility test pattern** (entire file, lines 1-53):
```typescript
// tests/core/security/redactSensitive.test.ts:1-53
import { describe, it, expect } from 'vitest';
import { redactSensitive } from '../../../src/core/security/redactSensitive';

describe('redactSensitive', () => {
  it('redacts sk- API key patterns', () => {
    const result = redactSensitive('sk-abc123def456');
    expect(result).not.toContain('sk-abc123def456');
    expect(result).toContain('REDACTED');
  });

  it('preserves non-sensitive content unchanged', () => {
    const input = 'Hello world, this is a normal message';
    expect(redactSensitive(input)).toBe(input);
  });

  it('handles empty string gracefully', () => {
    expect(redactSensitive('')).toBe('');
  });

  it('handles undefined gracefully', () => {
    expect(redactSensitive(undefined as unknown as string)).toBe('');
  });
```

**Key takeaway for `DomSerializer.test.ts`:** Static import (no mocks needed — pure function). Use jsdom to create test fixtures: `new DOMParser().parseFromString('<html>...</html>', 'text/html')`. Test password redaction (type=password, isPassword, autocomplete=current-password, name patterns), size cap (~2MB), truncated flag, and edge cases (empty doc, no body, `<template>` elements).

---

### `tests/core/extraction/PageContentService.test.ts` (orchestrator test)

**Analog:** `tests/core/context/PromptCacheManager.test.ts` (lines 1-427) — integration-level test with fake timers

**Fake timers pattern** (lines 230-237):
```typescript
// tests/core/context/PromptCacheManager.test.ts:230-237
describe('PromptCacheManager recordResponse (D-15)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
```

**Key takeaway for `PageContentService.test.ts`:** Use `vi.useFakeTimers()` for timeout tests (D-10: 5s global budget). Mock `DOMParser` if needed. Mock `MessageBus` to simulate content script responses. Test: cache hit/miss, SPA navigation invalidation, concurrency coalescing (D-18), fallback chain (Defuddle→Readability), timeout enforcement, redaction integration (D-19), and error code propagation.

---

### `tests/isolation/no-content-script-ui.test.ts` (import graph isolation test)

**Analog:** `tests/isolation/cross-entrypoint-imports.test.ts` (lines 1-56) — exact match

**Isolation test pattern with grep** (entire file, lines 1-56):
```typescript
// tests/isolation/cross-entrypoint-imports.test.ts:1-56
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('cross-entrypoint import isolation', () => {
  it('entrypoints do not import from other entrypoint directories', () => {
    const sidepanelImports = execSync(
      `grep -r "from.*entrypoints/standalone\\|from.*entrypoints/options" entrypoints/sidepanel/ 2>/dev/null || true`,
    ).toString();
    const lines = [sidepanelImports, standaloneImports, optionsImports]
      .join('')
      .split('\n')
      .filter(l => l.trim() && !/^\s*\/\//.test(l) && !l.includes('entrypoints/options/components'));
    expect(lines).toHaveLength(0);
  });
```

**Key takeaway for `no-content-script-ui.test.ts`:** Structure per the model: `execSync` grep assertions + comment-filtered line checks. Enforce D-20: verify `src/core/content/` files don't import `defuddle`, `@mozilla/readability`, `react`, `antd`, `yaml`, or `File System Access API`. Also grep the content bundle output in `.output/` for these packages. Add a bundle-size check (< 50KB) using `wc -c` or a build artifact check.

---

### `tests/core/content/PageContextBridge.test.ts` (messaging/bridge test)

**Analog:** `tests/core/runtime/RuntimeEnvelope.test.ts` (lines 1-34) — messaging contract test

**Messaging contract test pattern** (entire file, lines 1-34):
```typescript
// tests/core/runtime/RuntimeEnvelope.test.ts:1-34
import { describe, it, expect } from 'vitest';
import { createEnvelope, isEnvelope, MessageTypeValues } from '../../../src/core/runtime/RuntimeEnvelope';

describe('RuntimeEnvelope', () => {
  it('creates a valid envelope', () => {
    const envelope = createEnvelope('GET_ACTIVE_TAB_CONTEXT', { tabId: 1 }, 'background');
    expect(envelope.type).toBe('GET_ACTIVE_TAB_CONTEXT');
    expect(envelope.source).toBe('background');
    expect(envelope.payload).toEqual({ tabId: 1 });
    expect(envelope.operationId).toBeTruthy();
  });

  it('isEnvelope returns false for invalid objects', () => {
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope(undefined)).toBe(false);
    expect(isEnvelope({})).toBe(false);
  });
```

**Key takeaway for `PageContextBridge.test.ts`:** Set up jsdom with a test HTML document. Verify `EXTRACT_PAGE_CONTENT` handler returns a `SerializedPage` with correct shape (`html`, `url`, `title`, `capturedAt`, `size`, `truncated`). Verify password fields are redacted. Verify the handler is synchronous (no async delays). Test that `SPA_NAVIGATION` events fire as outbound-only.

---

## Shared Patterns

### Authentication (N/A for Phase 4a)

No auth required — extraction is a browser-internal operation. MessageBus provides cross-context identity via `RuntimeEnvelope.source` field.

### Error Handling

**Source:** `src/core/ai/PipelineError.ts` (lines 27-49)
**Apply to:** `src/core/extraction/types.ts` (define ExtractionError), `src/core/extraction/PageContentService.ts` (use in extraction flow)

```typescript
// Pattern: Error class with categorized codes + diagnostic payload
export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly retryable: boolean;
  readonly userFacingMessage: string;
  readonly diagnostic?: Record<string, unknown>;
  readonly timestamp: number;

  constructor(code: PipelineErrorCode, userFacingMessage: string, diagnostic?: Record<string, unknown>) {
    super(`[${code}] ${userFacingMessage}`);
    this.name = 'PipelineError';
    // ...
    this.timestamp = Date.now();
  }
}
```

**Phase 4a error codes:** `NO_CONTENT`, `TIMEOUT`, `PARSE_ERROR`, `CAPTURE_FAILED`. Plus `strategiesAttempted: string[]` field per D-11.

### Validation

**Source:** `src/core/context/ContextOptimizer.ts` (lines 33-58, 71-76) — Zod input validation
**Apply to:** `src/core/extraction/PageContentService.ts`, `src/core/extraction/PageContentSerializer.ts`

```typescript
// Pattern: Zod schema at module boundary → safeParse → throw PipelineError
const ContextOptimizerInputSchema = z.object({
  operationId: z.string().min(1),
  modelContextWindow: z.number().int().positive(),
  // ... fields with constraints
});

// In the method:
const validation = ContextOptimizerInputSchema.safeParse(input);
if (!validation.success) {
  throw new PipelineError('SCHEMA_INVALID', '...', {
    issues: validation.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
```

### Module-Level Singleton

**Source:** `src/core/context/ContextOptimizer.ts` (line 287), `src/core/context/PromptCacheManager.ts` (line 167), `src/core/context/TokenBudget.ts` (line 112)
**Apply to:** All extraction services that need shared state

```typescript
// Pattern: Class definition + module-level singleton export
export class PageContentService { /* ... */ }
export const pageContentService = new PageContentService();
```

### Cross-Context Messaging (RuntimeEnvelope + MessageBus)

**Source:** `src/core/runtime/RuntimeEnvelope.ts` (lines 1-46), `src/core/messaging/MessageBus.ts` (lines 1-66)
**Apply to:** `src/core/content/PageContextBridge.ts`, `entrypoints/content.core.ts`

```typescript
// Pattern: createEnvelope → chrome.runtime.sendMessage or MessageBus.register
// Outbound event (SPA_NAVIGATION):
const envelope = createEnvelope('SPA_NAVIGATION', { url: location.href, timestamp: Date.now() }, 'content');
chrome.runtime.sendMessage(envelope).catch(() => {});

// Inbound request/response (EXTRACT_PAGE_CONTENT):
register('EXTRACT_PAGE_CONTENT', (_envelope, _sender) => {
  const serialized = serializePage(document);
  return serialized; // returned to sendResponse by MessageBus.init()
});
```

`MessageTypeValues` already includes `EXTRACT_PAGE_CONTENT` and `SPA_NAVIGATION` — no schema changes needed.

### TraceRedactor-Style Redaction

**Source:** `src/core/security/redactSensitive.ts` (lines 1-39)
**Apply to:** `src/core/extraction/PageContentService.ts` (post-extraction, pre-indexing per D-19)

```typescript
import { redactSensitive } from '@/core/security/redactSensitive';

// After extraction, before MiniSearch indexing:
result.markdown = redactSensitive(result.markdown);  // D-19
```

### DOM Cloning for Readability

**Source:** RESEARCH.md Pitfall 3
**Apply to:** `src/core/extraction/strategies/ReadabilityFallback.ts`

```typescript
// Always clone before passing to Readability to prevent DOM mutation:
const doc = new DOMParser().parseFromString(html, 'text/html');
const clone = doc.cloneNode(true) as Document;
const reader = new Readability(clone);
const article = reader.parse();
```

### Import Path Convention

**Source:** Entire codebase — project uses path aliases
- Internal core imports: `from '@/core/...'` or relative `from '../ai/types'`
- Third-party imports at top, framework/toolkit below, project modules last

### Test File Convention

**Source:** All existing test files
- Import path: `'../../../src/core/<module>/<file>'` relative to `tests/core/<module>/`
- Use `vi.mock()` for third-party dependencies and external APIs
- Use `vi.useFakeTimers()` + `vi.setSystemTime()` for time-sensitive tests
- Dynamic `import()` pattern for modules that need mocking isolation
- Helper factory functions: `createMockAdapter()` / `buildMockOptimizedContext()`
- `describe()` blocks per test domain, `it()` with descriptive assertion descriptions

---

## No Analog Found

All 13 source files and 8 test files have at least a partial analog match in the existing codebase. The codebase's Phase 1-4 patterns (ProviderAdapter for interfaces, ContextOptimizer for orchestrators, PromptCacheManager for caches, MessageBus for messaging) provide comprehensive coverage for every file in Phase 4a.

**Files with partial match (planner should also reference RESEARCH.md patterns):**

| File | Role | Gap |
|------|------|-----|
| `src/core/extraction/PageIndexBuilder.ts` | MiniSearch indexing | No existing MiniSearch usage — use RESEARCH.md Code Examples for constructor config with field boosting |
| `src/core/extraction/PageContentSerializer.ts` | Tree→PageContext transform | No existing APCLiteNode serialization — use RESEARCH.md type definitions |
| `src/core/content/DomSerializer.ts` | DOM serialization with redaction | No existing DOM walker — use RESEARCH.md code example for password selectors and size cap |

---

## Metadata

**Analog search scope:** `src/core/`, `entrypoints/`, `tests/`
**Files scanned:** 60+ files globbed, 12 files read in detail
**Pattern extraction date:** 2026-07-31
**Early stopping:** Applied — 5 strong analogs found (ProviderAdapter, ContextOptimizer, PromptCacheManager, redactSensitive, MessageBus) covering all 13 source files
**Codebase knowledge graph used:** MCP `get_architecture` + `search_graph` for structural discovery; direct reads for pattern extraction
