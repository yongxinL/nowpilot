# Phase 4b: Trust-Aware Context & Receipts - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform every context source from raw `PromptSection` text into structured `ContextItem` contracts carrying trust, sensitivity, provenance, and authority metadata. Isolate prompt-injection at data boundaries via `instructionAuthority` gating + structural delimiters. Generate context receipts (`ContextReceiptEntry`) embedded in the existing `ContextProvenanceManifest` that explain inclusion, compression, and omission per source without exposing sensitive text. Enforce a stable-prefix contract (FNV-1a hash of concatenated stable sections + per-section hashes) with snapshot tests. Implement progressive skill disclosure (P1). Add a standalone `ToolResultShaper` for TOL-04 tool result validation/redaction/provenance before context re-entry. Establish a `ContextTrustPolicy` that centrally assigns trust, sensitivity, and instruction authority while source adapters own relevance/freshness scoring.

This is a core infrastructure phase — no UI changes. New modules in `src/core/context/` (trust policy, ContextItem, receipt extension) and `src/core/ai/` (ToolResultShaper). Builds on the Phase 4 `ContextOptimizer` pipeline and Phase 4a `TraceRedactor` redaction rules.
</domain>

<decisions>
## Implementation Decisions

### ContextItem Contract & Wrapping
- **D-01:** `ContextItem` is a **separate wrapper** around `PromptSection`. `PromptSection` stays as-is for text assembly (`kind`, `text`, `tokens`, `stable`, `sourceId`). `ContextItem` carries PromptSection fields + metadata (`relevance`, `freshness`, `trust`, `sensitivity`, `instructionAuthority`, `createdAt`, `expiresAt`). `ContextOptimizer` works with `ContextItem[]` and assembles `PromptSection[]` at the final step before the provider call. This keeps the existing assembly pipeline intact and adds metadata as a separate concern. — **Reversibility:** costly — `PromptSection` is consumed by every section builder, the optimizer pipeline, the cache manager, and ProviderAdapter; changing it to carry metadata in-place would touch all consumers and would need a migration from the wrapper pattern.

### Prompt-Injection Isolation
- **D-02:** Isolation uses **`instructionAuthority` gating + structural delimiters**. Stable system instructions always occupy the first prompt sections. User intent follows. All `instructionAuthority: 'data'` items (page content, notes, memory text, tool results) are wrapped in unambiguous structural delimiters (e.g., `<data-source id="...">...</data-source>`) and appended after instruction-bearing sections. The `instructionAuthority` field is the enforcement mechanism — data items with `data` authority cannot carry system-instruction weight regardless of their text content. The raw malicious string may remain available as quoted data when relevant to the user's query, but never as an instruction. — **Reversibility:** one-way — the structural delimiter format becomes the runtime contract for all data sections; changing it would require updating every injection test fixture and any downstream parser that depends on delimiter boundaries.

### Context Receipt
- **D-03:** `ContextReceiptEntry` is **embedded in `ContextProvenanceManifest`**. The existing provenance manifest already records per-section metadata. `ContextReceiptEntry` extends each entry with `originalTokens`, `finalTokens`, `included`, `truncated`, `compressionApplied`, `omissionReason` (`budget` | `irrelevant` | `stale` | `sensitive` | `policy`), and `cacheEligible`. This becomes the single source of truth per section — consumed by Phase 6 diagnostics/PromptInspector for display without raw sensitive text, by telemetry for utilization metrics, and by evaluation for omission auditing. Receipt totals must equal packed section totals. — **Reversibility:** one-way — provenance manifest entries appear in every `OptimizedContext` produced by the pipeline; changing the receipt schema would require migrating historical diagnostics records.

### Stable-Prefix Contract
- **D-04:** Stable-prefix uses a **concatenated FNV-1a hash** of all stable sections concatenated in canonical order, plus **per-section individual FNV-1a hashes** for diagnostics. The combined hash is the authoritative stable-prefix contract — snapshot tests assert it against a golden value. Per-section hashes are diagnostic metadata that identify which section drifted when the combined hash changes. Hash input must use the exact final bytes of stable `PromptSection` text values, including canonical separators, whitespace, and sorted tool schemas. Volatile sections are excluded from hash computation: user input, memory text, page content, tool results, timestamps, operation IDs, relevance scores, and lifecycle fields. This reuses the Phase 4 FNV-1a cache key approach. — **Reversibility:** one-way — the hash is the versioned contract for every snapshot test; changing the hash algorithm, canonical ordering, or inclusion criteria would invalidate all golden snapshots.

### Tool Result Shaping (TOL-04)
- **D-05:** `ToolResultShaper` is a **standalone service**. Pipeline flow: `ExecutorService` → validated `ToolExecutionResult` → `ToolResultShaper` → `ContextItem` → planner continuation / `ContextOptimizer`. `ToolResultShaper` owns: secret redaction (reusing `TraceRedactor` from Phase 4a), maximum-size enforcement, deterministic summarisation or relevant-field selection, sensitivity and trust assignment, `instructionAuthority: 'data'`, source-level provenance, and token estimation. It must not modify the original validated `ToolExecutionResult` — it returns a new immutable `ContextItem`. `ExecutorService` remains responsible for tool execution and output-schema validation. `ContextOptimizer` remains responsible for selecting, compressing, and packing already-normalised `ContextItem` values. — **Reversibility:** costly — adding a new pipeline stage between `ExecutorService` and `ContextOptimizer` touches every tool execution path; removing it would require relocating shaping logic into both services.

### Context Scoring & Policy Ownership
- **D-06:** **Split ownership** by score type. Source adapters (`MemoryEngine`, `PageContentService`, `ToolResultShaper`) compute `relevance` and `freshness` using their domain-specific mechanisms. A centralized `ContextTrustPolicy` assigns `trust`, `sensitivity`, and `instructionAuthority` based on source type and provenance. `ContextOptimizer` validates scores and applies selection, degradation, and packing — it must never invent missing scores or allow source content to set its own trust or authority. — **Reversibility:** one-way — the split between source-owner scores and central trust/enforcement is a security boundary; collapsing it would let untrusted data sources self-assign trust.

- **D-07:** `ContextTrustPolicy` uses a **static source-type table** for trust assignment. System/persona → 1.0, verified tool result → 0.9, explicit user input → 0.9, explicit user memory → 0.8, known-domain page content → 0.5, unknown-domain page content → 0.3. Values are initial policy defaults validated with fixtures. Trust assignment is deterministic, auditable, and independent of the LLM. Phase 4b: no add-on overrides — add-on sources may declare their source type, but `ContextTrustPolicy` remains the authority. — **Reversibility:** reversible — trust values are local constants in `ContextTrustPolicy`; tuning them doesn't change the interface.

- **D-08:** Relevance is **query-aware** and recomputed per turn. Each source adapter receives the current user query/intent and computes `relevance` using its existing local retrieval mechanism: `MemoryEngine` uses its memory retrieval score, `PageContentService` uses `MiniSearch` BM25 + heading-aware ranking, `ToolResultShaper` uses deterministic keyword/field matching. Sources required by policy (system instructions) bypass relevance filtering. Scores must not be persisted as permanent source attributes — they are turn-scoped. `ContextOptimizer` validates and consumes scores but does not recompute them; if a required score is missing, the item must fail validation or follow an explicit fallback policy. — **Reversibility:** costly — changing scoring from query-aware to static would require every adapter to change its ContextItem creation interface and would break the per-turn recomputation guarantee.

- **D-09:** Sensitivity is **source-type driven** with mandatory content detection for secrets. System/non-sensitive config → `public`. User input and page content → `private`. Memory records inherit `MemoryRecord.sensitivity`. Tool results inherit the registered tool's sensitivity policy. API keys, passwords, session tokens → `secret` → redact immediately via `TraceRedactor` → never create a `ContextItem`. `ContextTrustPolicy` owns the final classification; source content cannot lower its own classification. Conflicts apply the most restrictive value: `secret` > `confidential` > `private` > `public`. — **Reversibility:** one-way — sensitivity levels are a privacy contract; relaxing a source classification would require re-auditing cloud-exclusion and logging behavior.

- **D-10:** Freshness uses **exponential decay** with per-source policy TTLs: `freshness = Math.exp(-ageMs / ttlMs)`. Source-specific TTLs are defined in a `ContextFreshnessPolicy`, not user settings. Initial policy: system/persona → 1.0 (no decay), memory → type-specific TTL, page content → short TTL based on `capturedAt`, tool results → very short TTL based on execution time. If `expiresAt` has passed, the item is omitted as stale rather than relying solely on a low freshness score. TTLs are centrally defined, deterministic, and fixture-tested with no LLM dependency. — **Reversibility:** reversible — TTL values are local constants in `ContextFreshnessPolicy`.

### the agent's Discretion
- Progressive skill disclosure (CTX-T05, P1): the planner selects which skills to load. Planner/executor determines the implementation approach for skill summarization, loading triggers, and receipt tracking of loaded/unloaded skills.
- Context quality telemetry (CTX-T06, P1): Phase 6a owns this — Phase 4b only ensures the receipt data is structured and available for future telemetry consumption. No telemetry recording or aggregation in this phase.
- Exact structural delimiter format for prompt-injection isolation (D-02): planner selects the delimiter syntax based on prompt engineering best practices.
- Per-source TTL values for freshness decay (D-10): planner may tune the exact millisecond values within the exponential decay formula based on testing against real-world freshness requirements.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §28.3 — Trust-Aware Context Engineering: ContextItem contracts, prompt-injection isolation, context receipts, stable-prefix, progressive skill disclosure
- `.planning/PRODUCT_SPEC_v0_1.md` §28.5 — Tool Governance: TOL-04 tool result shaping, TOL-06 active tool discovery (CTX-T05 spans both 4b and 8a)
- `.planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md` §4 (lines 182-293) — CTX-01 through CTX-06 detailed stubs with TypeScript interfaces, acceptance criteria, and rules
- `.planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md` §6 TOL-04 (lines 455-466) — Tool result shaping pipeline steps

### Project & Roadmap
- `.planning/PROJECT.md` — Constraints (MV3 rules, cost-effective runtime, NOT @ant-design/x-sdk), Key Decisions, Trust-Aware Context requirements (CTX-T01 through CTX-T06, TOL-04)
- `.planning/ROADMAP.md` Phase 4b — Goal, success criteria (5 items), depends on Phase 4, requirements CTX-T01 through CTX-T06 + TOL-04
- `.planning/REQUIREMENTS.md` — CTX-T01 (ContextItem metadata), CTX-T02 (injection isolation), CTX-T03 (context receipts), CTX-T04 (stable-prefix), CTX-T05 (progressive disclosure, shared with 8a), CTX-T06 (quality telemetry, Phase 6a), TOL-04 (tool shaping, shared with 8a)

### Prior Phase Context
- `.planning/phases/04-context-optimization-pipeline/04-CONTEXT.md` — D-01 (ContextOptimizer as first-class pipeline stage), D-02 (once per turn), D-05 (optional fields for missing sources), D-07 (degradation step recording), D-14 (stable flag on PromptSection), D-17 (source-level provenance), D-18 (sourceId dot-separated format), D-16 (FNV-1a cache key hash — reused for stable-prefix)
- `.planning/phases/04a-page-content-extraction/04a-CONTEXT.md` — D-19 (TraceRedactor-style redaction — reused for TOL-04 and secret detection in ContextTrustPolicy)
- `.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md` — D-03 (trajectory state machine), D-08 (RegisteredTool evidence fields), D-11 (RenderingOutcomePolicy — gating pattern reused by ContextTrustPolicy)
- `.planning/phases/03-ai-core-pipeline/03-CONTEXT.md` — PersonaInjector byte-stability tests (Phase 3 D-byte-stability) — pattern to extend for stable-prefix snapshot tests

### Existing Code — Phase 4 Context Pipeline
- `src/core/ai/types.ts` — `PromptSection` (lines 53-59): kind/text/tokens/stable/sourceId — stays as-is, ContextItem wraps it. `ContextOptimizerInput` (lines 135-164): input contract with optional fields. `OptimizedContext` (lines 85-102): output with provenance.
- `src/core/context/ContextOptimizer.ts` — `optimize()` (lines 70-186): the pipeline that will operate on ContextItem[] and assemble final PromptSection[]. All `build*Section` methods (lines 224-302).
- `src/core/context/ContextCompressor.ts` — Degradation steps and AI summarization overflow — shapes how omission reasons populate receipts.
- `src/core/context/ContextProvenanceManifest.ts` — Existing per-section provenance entries — extended with `ContextReceiptEntry` fields (D-03).
- `src/core/context/TokenBudget.ts` — CJK-aware token estimation — used by receipt entries for originalTokens/finalTokens calculation.
- `src/core/context/PromptCacheManager.ts` — FNV-1a hash pattern (D-16) — reused for stable-prefix contract hashing (D-04).
- `src/core/ai/ExecutorService.ts` — Tool validation and execution — upstream of ToolResultShaper.
- `src/core/content/TraceRedactor.ts` — Secret redaction rules — reused by ToolResultShaper and ContextTrustPolicy.
- `src/core/ai/PersonaInjector.ts` — Existing byte-stability tests for persona injection — pattern to extend for stable-prefix snapshot tests.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/context/ContextOptimizer.ts` — `optimize()` and `build*Section()` methods handle section assembly. Phase 4b wraps inputs in `ContextItem[]` and extends the assembly logic with trust-aware gating, structural delimiters for data sections, and receipt generation.
- `src/core/context/ContextProvenanceManifest.ts` — Records per-section provenance. `ContextReceiptEntry` extends these entries with inclusion/compression/omission fields (D-03). Same source-level granularity.
- `src/core/context/ContextCompressor.ts` — Degradation steps already produce `compressionApplied` values. Receipt entries extend this to `omissionReason` (budget/irrelevant/stale/sensitive/policy).
- `src/core/context/PromptCacheManager.ts` — FNV-1a hash approach (Phase 4 D-16) — directly reusable for stable-prefix contract hashing. Same hash function, same pattern of computing hash over concatenated stable text.
- `src/core/content/TraceRedactor.ts` — Secret pattern detection and redaction — reused by `ToolResultShaper` for TOL-04 and by `ContextTrustPolicy` for sensitivity=secret classification.
- `src/core/ai/ExecutorService.ts` — Validates tool output schemas, returns `ToolExecutionResult` — `ToolResultShaper` sits downstream, consuming validated results without modifying the originals.
- `src/core/ai/types.ts` — `PromptSection` interface (stable flag, sourceId, kind) — `ContextItem` wraps this, adding metadata fields without changing the assembly contract.
- `src/core/ai/PersonaInjector.ts` — Existing byte-stability snapshot tests — pattern to follow for stable-prefix contract snapshot tests.

### Established Patterns
- **Module-level singletons**: `ContextOptimizer`, `PromptCacheManager`, `TokenBudget` are module-level singletons. `ContextTrustPolicy` and `ToolResultShaper` follow this pattern.
- **Core module isolation**: `src/core/context/` does not import from `src/components/`. New trust/receipt modules follow the same boundary.
- **Zod validation**: ContextOptimizerInput uses Zod. `ContextItem` and `ContextReceiptEntry` should follow this pattern.
- **FNV-1a hashing**: Phase 4 uses FNV-1a for cache keys. Stable-prefix reuses the same algorithm.
- **SourceId dot-separated format**: Phase 4 D-18 — `persona.injector.default`, `core.instructions.system`, `tools.builtin.search`, `memory.user.fact.abc123`, `context.page.current-url`. ReceiptEntry and ContextItem use the same convention.
- **Discriminated unions**: Phase 3/4/4a pattern for result types. `sensitivity` and `instructionAuthority` are string literal unions.

### Integration Points
- **ContextOptimizer.optimize()** — Primary integration. Accepts `ContextItem[]` (wrapping raw sections from all sources), applies `ContextTrustPolicy` validation, structural delimiter wrapping for data sections, receipt generation into provenance manifest, and delegates stable-prefix hashing as the final step.
- **ContextProvenanceManifest** — Extended with `ContextReceiptEntry` fields. Every section gets inclusion/compression/omission accounting.
- **ToolResultShaper** — Sits between `ExecutorService.execute()` return and planner continuation / context assembly. `AgentOrchestrator` invokes it after tool execution, before passing results to the next planner call or ContextOptimizer.
- **ContextAssembler** — Currently gathers sources into `ContextOptimizerInput`. Phase 4b extends it to produce `ContextItem[]` with source-owner relevance/freshness scores.
- **Phase 5 MemoryEngine** — Will produce `ContextItem[]` with relevance/freshness when it wires into the assembler. Phase 4b defines the contract; Phase 5 implements it.
- **Phase 6 Diagnostics** — `PromptInspector` consumes `ContextProvenanceManifest` receipt entries for display. Phase 6a quality telemetry consumes receipt data for omission reasons, utilization %, and compression ratio.
- **Phase 8a Tool Governance** — `ToolResultShaper` feeds provenance/trust metadata into the context pipeline. Full `ToolCapabilityManifest` sensitivity policies in Phase 8a extend the tool-based sensitivity classification.

</code_context>

<specifics>
## Specific Ideas

- Stable system instructions always precede user intent and data sections in the final prompt assembly — the ordering is a product policy, not an optimization.
- Structural delimiters for data sections should be unambiguous and not naturally occurring in user content (e.g., XML-style tags with deterministic IDs).
- `ContextTrustPolicy` is the sole authority for trust, sensitivity, and instructionAuthority — no source content may self-assign these values, and `ContextOptimizer` enforces this at validation time.
- Sensitivity `secret` items are redacted at the boundary and never become `ContextItem` instances — they never reach `ContextOptimizer`, provider prompts, receipts, or diagnostics.
- FNV-1a stable-prefix hash computation includes canonical separators, whitespace, and sorted tool schemas. Volatile content (user input, memory, page, timestamps, operation IDs, scores, lifecycle fields) is excluded.
- The `ToolResultShaper` creates a new immutable `ContextItem` — it never mutates the original `ToolExecutionResult` from `ExecutorService`.
- All score computation is deterministic and independent of the LLM. No AI model is used to assign trust, relevance, freshness, or sensitivity.
</specifics>

<deferred>
## Deferred Ideas

- **Progressive skill disclosure (CTX-T05):** Core mechanics (skill summaries, selection triggers, receipt tracking of loaded/unloaded) live in Phase 4b. Active tool discovery integration (TOL-06) lives in Phase 8a. Planner/executor defines the implementation approach.
- **Context quality telemetry (CTX-T06):** Phase 6a owns telemetry recording and aggregation. Phase 4b ensures receipt data is structured and available; no telemetry recording happens here.
- **Add-on trust score overrides:** Deferred — Phase 4b uses a static trust table only. Add-ons may declare source types but cannot override trust scores. Future phases may add pluggable trust modifiers with appropriate security review.
- **General PII scanning beyond secrets:** Defense in depth only — the primary sensitivity classifier is source-type. Broad PII scanning is deferred to avoid false positives blocking legitimate context.
- **User-facing sensitivity controls:** UI for viewing/controlling sensitivity classifications per source — Phase 7 diagnostics scope.

None — discussion stayed within phase scope. No scope creep was raised.
</deferred>

---

*Phase: 4b-Trust-Aware Context & Receipts*
*Context gathered: 2026-08-01*
