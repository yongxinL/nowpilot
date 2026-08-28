---
phase: 03
slug: cost-effective-ai-runtime-persona-seed
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-28
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| provider wire → StreamAdapter | Untrusted provider network bytes cross into the pipeline — malformed/truncated streams must not wedge the planner | SSE/NDJSON bytes, unvalidated |
| provider JSON-mode response → StructuredOutput | Untrusted model output parsed as a decision | JSON decision, zod-validated |
| provider request URL (Gemini) | API key travels in the request — must never reach logs/errors | API key (x-goog-api-key header) |
| UserPreferences → PersonaInjector | Operator-controlled override values cross into every system prompt | name/tone/brevity strings, zod-validated |
| ExecutorService ← tool input | run_tool input crosses here — closed enum + zero tools → always rejected | tool call request |
| RendererService ← model output | Model text crosses into the UI — capped, relayed verbatim | streamed text (≤512 tokens) |
| routing decision → provider call | Wrong route (guessed model, switched mid-stream) is what the router prevents | providerId + model |
| np_endpoint_overrides → endpoint | Operator-provided endpoint strings reach the fetch layer | http(s) URL, zod-validated |
| AgentOrchestrator ← user input | Chat/agent user text enters the loop — carried into PlannerService | user text |
| AgentOrchestrator → persist seam | Completed turns cross into ChatHistoryDB via the journaled append | completed turn (user + assistant) |
| useChatStreaming → runAgentTurn | Chat user input crosses into the pipeline | user text |
| persistTurn → ChatHistoryDB | Completed turns cross into IndexedDB — write-rate + crash-safety boundary | completed turn, journaled |
| OptionsPage → np_endpoint_overrides / np_preferences | Operator config crosses into chrome.storage.local | URL strings, zod-validated |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-3-01 | DoS | StructuredOutput repair loop | medium | mitigate | Appendix L hard limit: EXACTLY ONE repair, then terminal STRUCTURED_OUTPUT_FAILED (retryable false); planner timeout 3s (§1.2) + Requester 25s default bound the call | closed |
| T-3-02 | Tampering | StreamAdapter SSE parse | medium | mitigate | Missing terminator = STREAM_ERROR (REQ-R09); incremental TextDecoder({stream:true}) line buffer handles CRLF/multi-byte boundaries; zod-validated canonical events | closed |
| T-3-03 | Information Disclosure | error surfaces (StructuredOutput/PlannerService) | medium | mitigate | Errors built from provider status + server body only, never the apiKey; Requester canonical codes RATE_LIMITED/TIMEOUT/NETWORK only (§21.6, no invented codes D-38) | closed |
| T-3-SC | Tampering | npm/pip/cargo installs (zod-to-json-schema) | high | mitigate | Package-legitimacy gate passed (RESEARCH audit); version pinned 3.25.2 in package.json; no other new packages | closed |
| T-3-04 | Tampering | personaOverrides → system prompt | low | mitigate | Overrides zod-validated against locked tone/brevity enums + non-empty string min(1); Phase 3 has no host-page data path into persona | closed |
| T-3-05 | Information Disclosure | np_preferences storage | low | accept | Non-secret preferences in chrome.storage.local per §15.2; API keys remain in encrypted np_providers (Phase 2) | closed |
| T-3-06 | Information Disclosure | Gemini key= query param | high | mitigate | Header auth (x-goog-api-key) preferred over key= query param; NEVER debugLog a URL containing the key; error strings from status + server body only | closed |
| T-3-07 | Tampering | StreamAdapter wire parsing | medium | mitigate | Incremental TextDecoder({stream:true}) line buffer (CRLF + multi-byte); missing terminator = STREAM_ERROR; zod-validated canonical events | closed |
| T-3-08 | Information Disclosure | error surfaces in providers | medium | mitigate | Requester canonical codes only; 401→AUTH, 5xx→PROVIDER_5XX, 400/404-model→MODEL_UNKNOWN; never raw bodies with keys | closed |
| T-3-09 | Tampering | SDK supply chain | low | accept | No SDKs imported (fetch-only, INTEGRATIONS.md) — the SDK attack surface is structurally absent | closed |
| T-3-10 | Spoofing | ExecutorService closed enum | low | mitigate | toolName narrowed to zod closed enum at request time; unknown → TOOL_REJECTED (§21.6); zero tools registered (D-46) | closed |
| T-3-11 | DoS | RendererService streaming | medium | mitigate | 512-token default cap (DEFAULT_MAX_OUTPUT_TOKENS) bounds output; abortSignal threaded; ChunkBuffer rAF/33ms batching bounds render churn | closed |
| T-3-12 | Tampering | PromptCacheManager section assembly | low | mitigate | Stage strings from canonical PROMPTS constants (persona-free); only variable input is operator-owned personaOverrides (zod-validated) | closed |
| T-3-13 | Information Disclosure | prompt cache key/hash | low | accept | hashStableSections is FNV-1a over stable section text — non-reversible 32-bit hash; no secrets reach [SYSTEM] | closed |
| T-3-14 | DoS | circuit breaker bypass | medium | mitigate | 3 votes within 60 s → open 5 min enforced in route() (CIRCUIT_BREAKER_*); AUTH = 3 votes opens immediately | closed |
| T-3-15 | Spoofing | TierResolver null → guessed model | high | mitigate | D-54a null contract: resolveTier returns null, ProviderRouter raises configuration-required, NO provider request starts | closed |
| T-3-16 | Tampering | endpoint override strings | low | mitigate | np_endpoint_overrides values zod-validated at hydrate (URL scheme http/https only); merged over §10.6 defaults | closed |
| T-3-17 | Information Disclosure | attempt logging | low | mitigate | debugLog records codes + providerId only, never request bodies or keys (TraceRedactor discipline) | closed |
| T-3-18 | DoS | unbounded loop | medium | mitigate | Appendix I loop hard-capped by §1.4 plannerCap/toolCap terminal states — the ONLY cap-enforcement point; test (b) asserts the cap | closed |
| T-3-19 | Tampering | config-required bypass | high | mitigate | D-54a enforced in-code: resolveTier null → configuration-required outcome, no provider request; test (h) | closed |
| T-3-20 | Information Disclosure | persist seam write-rate | medium | mitigate | persistTurn invoked once per completed turn at turn end (D-45); never in delta path; abort drops partial; journaled append is replay-safe | closed |
| T-3-21 | Tampering | abort handling | low | mitigate | AbortError propagation is first check in loop (Appendix I); renderer/persist both observe the signal — cancelled turn cannot persist a partial | closed |
| T-3-22 | DoS | per-chunk persistence regression | high | mitigate | Per-chunk store-update call REMOVED (grep-gated); mid-stream chunks in memory + ChunkBuffer only; persistTurn journaled once at turn end (D-45); asserted by chat-integration test (d) | closed |
| T-3-23 | Tampering | journaled turn-end persist | medium | mitigate | append-chat-turn runs through runJournaled (replay-safe, D-45); abort drops the partial; D-33 metadata-only entries keep bodies out of journal | closed |
| T-3-24 | Tampering | endpoint override injection | medium | mitigate | np_endpoint_overrides zod-validated (http/https only) at Options write AND registry hydrate (03-05) | closed |
| T-3-25 | Information Disclosure | legacy streamChatResponse | low | accept | Retained ONLY behind DEMO_MODE+DEV gate (D-12/D-44) — unreachable in production builds | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-3-05 | T-3-05 | Non-secret preferences (fastModel/balancedModel/personaOverrides) in chrome.storage.local per §15.2 partition rules; API keys remain in encrypted np_providers — no key can reach this store | Phase 3 planning | 2026-08-28 |
| AR-3-09 | T-3-09 | No SDKs imported (fetch-only per INTEGRATIONS.md); the SDK supply-chain attack surface is structurally absent | Phase 3 planning | 2026-08-28 |
| AR-3-13 | T-3-13 | FNV-1a 32-bit hash of operator-owned stable prompt text is non-reversible and carries no secrets | Phase 3 planning | 2026-08-28 |
| AR-3-25 | T-3-25 | Legacy streamChatResponse retained only behind DEMO_MODE+DEV gate — unreachable in production builds | Phase 3 planning | 2026-08-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-28 | 25 | 25 | 0 | opencode (gsd-secure-phase, L1 grep-depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-28