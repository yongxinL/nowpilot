# Phase 4b: Trust-Aware Context & Receipts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 4b - Trust-Aware Context & Receipts
**Areas discussed:** ContextItem wrapping, Prompt-injection isolation, Context receipt format, Stable-prefix scope, Tool result shaping, Context scoring & policy ownership

---

## ContextItem Wrapping

| Option | Description | Selected |
|--------|-------------|----------|
| Extend PromptSection in-place | Add ContextItem fields directly to PromptSection interface | |
| Separate ContextItem wrapper | Keep PromptSection as-is for text assembly; ContextItem wraps it with metadata | ✓ |
| Replace PromptSection entirely | Remove PromptSection, use ContextItem everywhere | |

**User's choice:** Separate ContextItem wrapper
**Notes:** PromptSection stays as-is for text assembly. ContextItem wraps PromptSection + metadata. ContextOptimizer works with ContextItem[], assembles PromptSection[] at the final step before the provider call. Keeps existing assembly intact, adds metadata as a separate concern.

---

## Prompt-Injection Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| instructionAuthority field gating | Data items structurally wrapped; stable instructions go first | ✓ |
| Structural boundaries + post-process validation | Delimiters + runtime scan for instruction-like patterns in data sections | |
| Character-level escaping | Escape characters that could be interpreted as instructions | |

**User's choice:** Authority Gating + Structural Boundaries
**Notes:** Use `instructionAuthority` as the primary enforcement mechanism and wrap every `data` item in fixed structural delimiters. Prompt layout: Stable system instructions → user intent → structurally wrapped untrusted data. The raw malicious string may remain as quoted data when relevant, but never as an instruction. Data items with `data` authority cannot carry system-instruction weight regardless of text content.

---

## Context Receipt Format

| Option | Description | Selected |
|--------|-------------|----------|
| Receipt in OptimizedContext + PromptInspector UI | ReceiptEntry[] in OptimizedContext, rendered by separate UI | |
| Standalone export only | Computed on-demand when user opens PromptInspector | |
| Embedded in ContextProvenanceManifest | Extend existing per-section provenance with receipt fields | ✓ |

**User's choice:** Receipt embedded in ContextProvenanceManifest
**Notes:** Extend existing per-section provenance entries with `originalTokens`, `finalTokens`, `included`, `truncated`, `compressionApplied`, `omissionReason`, `cacheEligible`. Single source of truth per section. Receipt totals must equal packed section totals. Consumed by Phase 6 diagnostics/PromptInspector and Phase 6a quality telemetry.

---

## Stable-Prefix Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Combined hash + per-section hashes | FNV-1a combined hash (authoritative) + per-section hashes (diagnostics) | ✓ |
| Full text snapshot per section | Store exact byte-content of every stable section | |
| Combined stable prefix text snapshot | One snapshot of concatenated stable sections | |

**User's choice:** Concatenated Stable-Section Hash + Per-Section Hashes
**Notes:** Combined FNV-1a hash of all stable sections concatenated in canonical order is the authoritative contract. Per-section individual hashes identify which section drifted. Snapshot tests assert combined hash against golden value. Exclude volatile sections: user input, memory, page content, tool results, timestamps, operation IDs, relevance scores, lifecycle fields. Hash input includes canonical separators, whitespace, and sorted tool schemas.

---

## Tool Result Shaping (TOL-04)

| Option | Description | Selected |
|--------|-------------|----------|
| ExecutorService post-execution | Add redaction/size/provenance to ExecutorService | |
| Standalone ToolResultShaper | New service between ExecutorService and ContextOptimizer | ✓ |
| ContextOptimizer during assembly | Shape tool results during section assembly | |

**User's choice:** Standalone ToolResultShaper Service
**Notes:** Pipeline: `ExecutorService` → validated `ToolExecutionResult` → `ToolResultShaper` → `ContextItem` → planner/ContextOptimizer. `ToolResultShaper` owns secret redaction (reusing `TraceRedactor`), max-size enforcement, deterministic summarisation, sensitivity/trust assignment, `instructionAuthority: 'data'`, source provenance, token estimation. Must not modify original `ToolExecutionResult`. Returns new immutable `ContextItem`. Keeps tool shaping independent of execution and context optimization.

---

## Context Scoring & Policy Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Data-source owners | Each source computes its own scores | ✓ (for relevance/freshness) |
| ContextOptimizer as centralized scorer | Unified scoring policy in optimizer | |

**User's choice:** Split Ownership by Score Type
**Notes:** Source adapters (MemoryEngine, PageContentService, ToolResultShaper) compute `relevance` and `freshness`. Centralized `ContextTrustPolicy` assigns `trust`, `sensitivity`, `instructionAuthority`. `ContextOptimizer` validates scores, never invents them. Source content cannot set its own trust or authority.

### Trust Assignment
Source-type table lookup: system/persona → 1.0, verified tool → 0.9, user input → 0.9, user memory → 0.8, known-domain page → 0.5, unknown page → 0.3. Deterministic, auditable, no LLM dependency. Phase 4b: no add-on overrides.

### Relevance Scoring
Query-aware, recomputed per turn. Each adapter uses its existing retrieval: `MemoryEngine` (memory score), `PageContentService` (MiniSearch BM25), `ToolResultShaper` (keyword matching). System sources bypass relevance filtering. Scores not persisted.

### Sensitivity Classification
Source-type driven + secret detection: system/config → public, user input/page → private, memory records inherit `MemoryRecord.sensitivity`, tool results inherit tool policy. Secrets (API keys, passwords, tokens) → redact immediately, never create ContextItem. Conflicts → most restrictive wins.

### Freshness Decay
Exponential: `freshness = Math.exp(-ageMs / ttlMs)`. Per-source TTLs in `ContextFreshnessPolicy`. System/persona → 1.0 (no decay), memory → type-specific, page → short (capturedAt), tool results → very short (execution time). Expired items omitted as stale.

---

## the agent's Discretion

- Progressive skill disclosure (CTX-T05, P1): planner selects which skills to load; planner/executor defines implementation approach for skill summaries, loading triggers, and receipt tracking.
- Context quality telemetry (CTX-T06, P1): Phase 6a owns this; Phase 4b ensures receipt data is structured and available.
- Structural delimiter format for injection isolation: planner selects syntax.
- Freshness TTL exact values: planner tunes within the exponential decay formula.

## Deferred Ideas

- Add-on trust score overrides: Phase 4b uses static table only. Future phases may add pluggable modifiers.
- General PII scanning beyond secrets: defense in depth only; primary classifier is source-type.
- User-facing sensitivity controls: Phase 7 diagnostics scope.
