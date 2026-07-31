---
phase: 04
slug: context-optimization-pipeline
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-31
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| AgentTurnInput → ContextOptimizer | Untrusted user input (userInput field) crosses into the optimization pipeline — validated and size-bounded | user prompt text, model config |
| ContextOptimizer → PlannerService/RendererService | OptimizedContext carries token estimates and provenance — downstream services trust these for output capping and citations | token counts, section metadata, provenance entries |
| ContextCompressor → AI summarization | When local degradation fails, ContextCompressor may call an AI model for summarization — untrusted compression model output validated before use | compressed summary text |
| Degraded sections → ContextProvenanceManifest | Degradation decisions feed into provenance — must be accurate for auditability | truncation/compression markers |
| Stable sections → cacheKeyHash | Stable section text hashed via FNV-1a for cache keys | system prompt, tool schemas (not user data) |
| Cache health state → AgentOrchestrator | Per-provider cache health (missStreak, disabledUntil) in-memory only | provider usage pattern indicators |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | TokenBudget.estimateTokens() | low | mitigate | Non-string/empty guard returns 0 (TokenBudget.ts:31) | closed |
| T-04-02 | Tampering | ContextOptimizerInput validation | medium | mitigate | Zod schema: modelContextWindow `z.number().int().positive()`, userInput `.max(100000)`, IDs `min(1)` (ContextOptimizer.ts:34-38) | closed |
| T-04-03 | Tampering | sourceId format | medium | mitigate | `isValidSourceId` SOURCE_ID_PATTERN check; throw on invalid (ContextProvenanceManifest.ts:12-13, 30-31) | closed |
| T-04-04 | Denial of Service | Unbounded userInput | medium | mitigate | Zod `.max(100000)` bounds worst-case estimation runtime (ContextOptimizer.ts:37) | closed |
| T-04-05 | Tampering | Token count integer overflow | low | mitigate | JS IEEE-754 doubles safe to 2^53; max real window ~2M tokens — no realistic overflow | closed |
| T-04-06 | Tampering | Malformed budget thresholds | medium | mitigate | `VALID_TIERS.includes(tier)` + non-positive window → all-zero budget (TokenBudget.ts:60) | closed |
| T-04-SC | Tampering | npm installs (js-tiktoken) | high | mitigate | Avoided — js-tiktoken NOT installed; character-based estimation (D-10) used instead | closed |
| T-04-07 | Tampering | Degradation step order manipulation | medium | mitigate | `private static readonly STEPS` immutable policy; stepsApplied append-only (ContextCompressor.ts:37, 54, 63) | closed |
| T-04-08 | Denial of Service | AI summarization infinite loop | medium | mitigate | Single `generateText` call, no retry loop; one final budget check after (ContextCompressor.ts:72, 108) | closed |
| T-04-09 | Tampering | Malformed AI summarization output | low | mitigate | Non-string/empty output → log + keep pre-summarization sections (ContextCompressor.ts:110-112) | closed |
| T-04-10 | Information Disclosure | Debug sections not fully dropped | low | accept | Documented in Accepted Risks Log (extra tokens only, no user data) | closed |
| T-04-11 | Tampering | Budget recalculation after compression | medium | mitigate | Same `tokenBudget.estimateTokens()` used for pre/post compression (ContextCompressor.ts:173, 183) | closed |
| T-04-12 | Tampering | cacheKeyHash collision | low | accept | Documented in Accepted Risks Log (FNV-1a non-cryptographic; consequence = cache miss) | closed |
| T-04-13 | Denial of Service | Cache disabled state prevents re-enable | low | mitigate | Cooldown via Date.now() + CACHE_COOLDOWN_MS; worst case 60s disabled (PromptCacheManager.ts:70) | closed |
| T-04-14 | Information Disclosure | Cache health leaks provider usage patterns | low | accept | Documented in Accepted Risks Log (in-memory only, never persisted/sent) | closed |
| T-04-15 | Tampering | Malformed CacheResponseMetadata | low | mitigate | `isValidMetadata` boolean-field validation; malformed input logged + discarded (PromptCacheManager.ts:54-55, 157-161) | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04-01 | T-04-10 | If drop-debug fails, consequence is slightly larger context (extra tokens) — debug sections contain no user data | plan (T-04-10 disposition) | 2026-07-31 |
| R-04-02 | T-04-12 | FNV-1a collisions possible (~1/2^32) but consequence is a cache miss, not a security breach; hashed content is system prompts/tool schemas, not user data | plan (T-04-12 disposition) | 2026-07-31 |
| R-04-03 | T-04-14 | missStreak/disabledUntil reveal provider cache-miss patterns — in-memory only, never persisted nor sent externally | plan (T-04-14 disposition) | 2026-07-31 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-31 | 16 | 16 | 0 | gsd-security-auditor (L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-31
