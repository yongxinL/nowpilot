> **⚠ PRECEDENCE NOTICE (added 2026-08-19).** This is the recommended per-phase "research pack" for cost-effective models (use this + the spec + the relevant phase row — **not** all five raw docs). Where any research doc conflicts with `.planning/PRODUCT_SPEC_v0_1.md`, **the spec wins** unless an ADR says otherwise. All conflicts, stack-version deviations, forward-dated facts, and research-derived (non-spec) requirements are reconciled in **`RESEARCH-RECONCILIATION.md`** — that doc is the single authoritative resolution surface.

# Project Research Summary

**Project:** NowPilot
**Domain:** Privacy-first Chrome MV3 AI assistant + personal knowledge platform for ServiceNow Support Engineers (Copilot + Obsidian + NotebookLM in one extension)
**Researched:** 2026-08-19
**Confidence:** MEDIUM-HIGH (stack/architecture verified against official docs + npm registry; features/pitfalls cross-checked across independent sources)

## Executive Summary

NowPilot is a privacy-first Chrome MV3 extension that combines an AI chat assistant, a local-first personal knowledge base (notes, wikilinks, graph, RAG), and ServiceNow-specific support skills — explicitly positioned as the individual-engineer complement to Now Assist, not a competitor to commodity AI extensions. The research **validated the locked spec** (`.planning/PRODUCT_SPEC_v0_1.md`, §18 19-phase sequence) against external evidence rather than redefining it: the locked architecture (stateless SW, AI streams in surfaces, storage partitioning, CAS-elected single-writer, panel-side extraction parsing, lexical RAG) matches known-good MV3 patterns, and the spec is often *stricter* than the platform requires — which is correct for the privacy-first brand. The competitive analysis confirms the differentiators are real (zero telemetry, trust receipts, memory-aware RAG, staleness detection, per-case ServiceNow context without admin rights) and the anti-features are right to refuse (browser automation, telemetry, cloud sync, embeddings).

The recommended approach: build the 19 phases in spec order, but fold five research-driven hard requirements into acceptance criteria. (1) **Phase 1 must carry MV3 discipline**: single MessageBus layer, `return true` messaging contract, synchronous listener registration, least-privilege manifest (remove the 5 unused permissions), no `fetch()` in content scripts, frozen extraction envelope types, coalesced `chrome.storage.local` writes, and removal of the spec-violating Tailwind scaffold leftover. (2) **Phase 2 adds `unlimitedStorage` + idb ^8** and a storage adapter that surfaces quota/rate-limit errors instead of swallowing them. (3) **Phase 3 must rebuild the SSE layer against real provider wire formats** (the current parser is coupled to a private proxy and returns empty on real providers — a confirmed production bug) and remove the default-on simulated AI path. (4) **Phases 6–9 must bake in the injection/identity/search defenses**: six-layer prompt-injection defense (not labels), stable note IDs + alias index, conflict-aware filesystem sync (never auto-merge), ServiceNow-aware MiniSearch tokenizer, and claim-level citations with abstain-when-unsupported. (5) **Phase 19 must include CWS review-readiness**: the v1 publish API shuts down **2026-10-15** (use `wxt submit init` v2 flow), plus permission audit, privacy policy, red-team, and review slack.

Key risks: (a) `chrome.storage.local` ~120 writes/min silent data loss — the current scaffold ships the canonical victim pattern (per-chunk full-store persistence); (b) SW suspension silently killing streams — mitigated by the spec's surface-owned streams + `np_active_stream` recovery, but only if Phase 1-3 build the cold-start/messaging discipline; (c) WXT 0.21 / TypeScript 7 / Vitest 4 / Immer 11 major upgrades mid-milestone — all four must be **held** (dedicated post-v0.1 chore for WXT 0.21); (d) the biggest *functional* gaps vs market norms are G-1 (structured similar-cases results) and G-3 (handoff-targeted summary) — cheap acceptance-criterion fixes in Phase 17; and (e) agent-loop cost runaway and permission fatigue — mitigated by reserve-before-call budgets (Phase 4/11/18) and risk-tiered approval targeting ≤15% escalation (Phase 18).

## Key Findings

### Recommended Stack

Stack is LOCKED by spec §7 (WXT + React 19 + antd v6 + @ant-design/x 2.x + Zustand/immer + Vitest; no tailwind/shadcn/radix/framer-motion). Research verified currency of every pinned version against npm on 2026-08-19 and found the version pins are sound — **hold all majors**: WXT 0.20.27 (v0.21 is a breaking pre-1.0 bump; upgrade only as a dedicated post-v0.1 chore), TypeScript ~5.8 (TS 7.0.2 is the Go rewrite), Vitest ^3.2.7 (v4 compat with WXT 0.20 unverified), Immer 10.2.0 (v11 no v0.1 benefit). Safe same-major bumps: antd 6.6.1, zustand 5.0.15. New spec-pinned libs install at their phases: idb ^8 (Phase 2), defuddle ^0.19 full bundle + readability ^0.6 + turndown ^7 (Phase 6), minisearch ^7 (Phases 5/8).

**Core technologies:**
- **WXT 0.20.27** — MV3 build framework; hold — 0.21 migration flips generated tsconfig to `strict: true` + `verbatimModuleSyntax` (biggest migration cost) and removes `wxt/testing` barrel
- **React 19.2.8 + antd 6.5.2→6.6.1** — UI; antd v6 = pure CSS-variable theming; no v5-patch package needed
- **@ant-design/x 2.9.0** — AI chat/markdown components; never 1.x (antd-internal APIs, incompatible with v6)
- **Zustand 5.0.14→15 + Immer 10.2.0** — state; async hydration with `hasHydrated` gate; Zod for rehydration validation (createJSONStorage does zero runtime checks)
- **Vitest 3.2.7 + jsdom 25 + @testing-library/react 16** — tests; do NOT adopt `WxtVitest()` yet (historically broke under jsdom)
- **idb ^8** (Phase 2) — typed IndexedDB wrapper for MemoryDB/WriteJournal/AITransactionLogDB (not Dexie — too heavy)
- **defuddle ^0.19 full + @mozilla/readability ^0.6 + turndown ^7** (Phase 6) — layered extraction; `parse()` sync with `useAsync:false` is **mandatory** (blocks third-party API extractors; privacy posture)
- **minisearch ^7** (Phases 5/8) — in-memory full-text; `loadJSONAsync`/`addAllAsync`; versioned serialization + rebuild-on-major path
- **Zod ^3.24** — runtime validation at every boundary (envelopes, structured output for Ollama)

**Stack gotchas to fold into acceptance criteria:**
- ⚠ **Tailwind SPEC CONFLICT**: scaffold wires `tailwindcss()` into `wxt.config.ts` + `src/index.css`; spec §0.2 forbids it. Remove in Phase 1 or record explicit ADR exemption.
- ⚠ **CSP/optional_host_permissions gap**: manifest `host_permissions` lists only service-now.com hosts and `connect-src` hard-codes localhost/3 providers — user-configured custom endpoints (remote Ollama, custom OpenAI-compatible base URLs) are CORS- AND CSP-blocked. Use `optional_host_permissions` + `chrome.permissions.request()` on provider-add.
- ⚠ **`chrome.storage.local` write throttle (~120 writes/min)**: current scaffold persists whole store per chunk (CONCERNS.md) — the canonical silent-data-loss vector. Coalesce (250–500 ms trailing debounce + flush-on-beforeunload) and assert write rate in tests (Phase 1/2).
- ⚠ **`unlimitedStorage` not declared**: must be added in Phase 2 when IndexedDB ships (exempts extension origin from quota/eviction; `navigator.storage.persist()` is not a reliable substitute).
- `EventSource` banned in SW (unavailable in Chrome SWs; spec §0.2); `setInterval`/`setTimeout` die with the worker — use `chrome.alarms`.
- `chrome.storage.session`: 10 MB hard cap, silent write failures, wiped on update, `unlimitedStorage` does NOT apply — tokens/transient state only, never a database.
- Content scripts are per-entrypoint IIFEs — no shared chunks; extraction code stays self-contained; content-script payloads go over RuntimeEnvelope.
- `cssVar: { key: '_,:root' }` hack breaks component styles (antd#57325) — use `theme={{ cssVar: true, hashed: false }}`.
- Defuddle 0.19.x includes CVE-2026-30830 XSS fix — pin `^0.19` (caret does not auto-jump pre-1.0), keep DOMPurify defense-in-depth.
- WXT 0.21 upgrade checklist (post-v0.1 chore): strict tsconfig flip, `globalName: true` for value-returning content scripts, submodule imports, fake-browser v2 `sendResponse`, shadow-root UI changes, CWS v2 submit flow.
- **CWS v1 publish API shuts down 2026-10-15** — Phase 19 release must use `wxt submit init` v2 service-account flow.

### Expected Features

Feature set is LOCKED by spec (§9, §17.7 RICH, §27 LLM-Wiki, §28-30 agent harness); research mapped the competitive ecosystem onto it. NowPilot exceeds market norms on depth (verified agent, knowledge compounding, zero telemetry, ServiceNow domain) and must NOT fight commodity extensions on surface features.

**Must have (table stakes):** chat with streaming+abort (Phase 3, scaffolded ✓) · provider/model selector + cost-tiered routing (Phase 3) · page summarization/chat-with-page (Phase 6) · write/rewrite/summarize actions (Phases 17-18) · conversation history + search (Phase 15) · regenerate/retry/per-message actions (Phase 15) · wikilinks + backlinks + graph with **immutable-ID edges** (Phase 8 — exceeds Obsidian) · full-text search (Phase 8) · tags + categoryPath hierarchy (Phase 8) · RAG "ask your notes" with per-statement citations (Phases 7-9) · grounded "not in sources" honesty (Phase 9.8 everywhere) · case/chat summarization (Phase 17) · first-run onboarding (Phase 15) · diagnostics + error surfacing with transaction traces (Phase 11) · export/import (Phase 2/9) · attach/screenshot input (Phases 15-16).

**Should have (competitive / differentiators):** zero-telemetry local-first posture (brand-defining, all phases) · trust-aware context receipts CTX-03 (Phase 7 — transparency no competitor offers) · AI-native note enrichment with accept/reject + 0.60 confidence gate (Phase 9) · staleness detection LLM-WIKI-08 (Phase 9 — Obsidian/Logseq gap) · orphan detection + "Find context" (Phase 9) · structured note drafts with wikilink suggestions (Phase 9 — exceeds NotebookLM pinning) · memory-aware RAG (Phases 8-9) · OKF-compatible one-way filesystem backup + restore preview (Phase 9) · per-case ServiceNow context without admin rights (Phases 17-18 — Now Assist structurally cannot) · persona + RICH conversational UX (Phases 3, 15) · "Meet NowPilot" onboarding (Phase 15) · ResearchSkill with graceful failure + permission gate (Phases 17-18) · bounded multi-role collaboration (Phase 14) · verified human-approved evolution (Phase 13).

**Flagged feature gaps (fold into requirements/acceptance):** **G-1** structured "similar cases" results surface — market norm (SearchUnify/Groove/Pluno/Now Assist GAF); spec has only a quick-action entry point → acceptance criterion on §9.7 ServiceNow add-on (Table API query → ranked card list) or explicit v0.2. **G-3** handoff/transfer-targeted case summary — CatchUpSkill is close but not transfer-targeted → cheap acceptance criterion (CatchUpSkill or Write "Draft internal note"). **G-2** real-time auto-suggested replies (all support copilots) — correctly deferred to v0.2 (needs host-page integration, §25). Also: Selection → Ask AI is **P1 but is the #1 habit-forming entry point in the category — promote to P0 or at minimum assert in Phase 17 acceptance**.

**Defer (v2+):** page injection (CaseInsightBox etc., §25) · PDF chat (correct deferral — case data lives in ServiceNow) · bidirectional filesystem sync (document loudly — #1 Obsidian-parity ask) · embeddings/vector search (only if rerank quality fails; additive via RRF, not a rebuild) · browser automation (**anti-feature**, v2 §26.7) · telemetry (**anti-feature, never** — anythingllm's PostHog default-on is the cautionary tale) · cloud account/sync (**anti-feature**) · GAF-style case clustering (structurally wrong for a personal tool) · deep-research crawling · audio/video overviews · RPA-style monitoring · multi-model comparison chats · real-time collaboration.

### Architecture Approach

The locked architecture (§8/§13/§15/§20/§26/§27) was validated against Chrome platform docs and ecosystem practice — **verdict: matches known-good patterns** (verdict table in ARCHITECTURE.md). One real risk found (storage write-rate throttle) and three build-order flags. The architecture's spine: an **ephemeral stateless SW** (router, alarms, cookies, PROXY_FETCH with 25 s race — no AI, no IndexedDB, no EventSource) + **side panel / standalone surfaces** (all AI streaming, IndexedDB, Defuddle parsing, LLM-Wiki) + **extraction-only content scripts** (<50 KB, ISOLATED world, no UI, no fetch) + **shared storage partitioning** (session = tokens/election/active-stream; local = workspace metadata with coalesced writes; sync = theme/language only; IndexedDB = all bodies) + **BroadcastBus primary election** (CAS on `np_workspace_primary` in storage.session + 3 s heartbeat, standalone wins ties, version-gated last-write-wins).

**Major components:**
1. **Background SW** — BackgroundRouter (typed envelope dispatcher), LifecycleManager, KeepAliveManager (alarms), CookieSessionStore, CORSProxy (PROXY_FETCH, 25 s race) — stateless, cold-start-safe
2. **Side Panel / Standalone** — AI runtime (ProviderRouter → Planner → Executor → Renderer, fetch-SSE), MemoryEngine + IndexedDB stores, AITransactionLog + TraceRedactor, WorkspaceStore (election peer), PageContentService (panel-side Defuddle), LLM-Wiki (NoteTagger/QA/FileSync), Options/Diagnostics
3. **Content scripts** — ContentScriptHost, SPANavigationWatcher, PageContextBridge — strip DOM, stamp base URL, send payload envelopes (2 MB cap, no chunking)
4. **Shared primitives** — RuntimeEnvelope/MessageBus/EventBus/BroadcastBus (typed routing), storage partitioning, BroadcastChannel (np_theme/np_workspace)

**Build-order flags (fold into plans):** **Flag A** — Phase 1 must freeze the content-script envelope types (`PAGE_LIVE_CONTEXT` always-on; `PAGE_EXTRACTION_REQUESTED`/`PAGE_HTML_PAYLOAD` with `baseUrl`/`truncated` reserved) so Phase 6 fills in strategy logic, not payload shape. **Flag B** — Phase 1 ships election + `isPrimaryWriter()` predicate on WorkspaceStore; Phase 2 wires enforcement into MemoryEngine write paths (additive, predicate interface stays stable). **Flag C** — Phase 3 stream correlation reuses Phase 1 `OperationId` (no new id scheme). Also: Phase 1 must converge the scaffold's raw `CONTENT_SCRIPT_READY`/`SPA_NAVIGATION` listeners onto the typed BackgroundRouter envelope dispatch.

### Critical Pitfalls

Top 5 of 15 researched (full set with phase mappings in PITFALLS.md):

1. **SW suspension silently kills AI streams; every wake is a cold start** (Pitfall 1) — DevTools-open hides it in dev. Avoid: streams live in surfaces only (spec already mandates), synchronous top-level listener registration, `chrome.alarms` not timers, checkpoint to storage before yielding, test with DevTools closed + forced idle. Phases 1/3, verify Phase 19.
2. **`chrome.storage` write-rate limits/quota = silent data loss** (Pitfall 2) — ~120 writes/min silently drops; session 10 MB hard cap; the scaffold already ships per-chunk full-store persistence (CONCERNS.md). Avoid: flush-on-stream-end, per-entity keys or IndexedDB for bodies, adapter that surfaces `lastError`/`STORAGE_QUOTA`/`STORAGE_RATE_LIMIT`. Phases 2/3, verify Phase 19 soak.
3. **Content-script CORS/CSP cage — the relay requirement** (Pitfall 3) — content scripts are subject to page CORS/CSP; AI fetches from them fail in production. Avoid: hard rule content scripts never fetch (arch-test it), provider hosts in `host_permissions`, `optional_host_permissions` for user-configured endpoints, validate content-script messages as untrusted (no open-proxy). Phases 1/6/17.
4. **Message-channel races** (Pitfall 4) — async listeners without `return true` → silent `undefined`; cold-start drops. Avoid: ONE messaging layer (MessageBus wired or deleted), every handler returns `true` + `sendResponse` once, idempotent `ensureInitialized()`, cold-start test. Phase 1.
5. **SSE parsing breaks only in production** (Pitfall 5) — chunk boundaries, CRLF, keep-alive comments, `[DONE]` non-JSON, missing terminator, proxy buffering; the current parser is coupled to a private proxy envelope and returns empty on real providers (CONCERNS.md). Avoid: incremental `TextDecoder({stream:true})` line-buffer parser, per-provider conformance fixtures (OpenAI `[DONE]`, Anthropic event types, Gemini inline data, Ollama NDJSON), missing-terminator = error. Phase 3, CI throttle-proxy gate.

Also critical for roadmap: **Pitfall 7** indirect prompt injection (six-layer defense, not labels; screen memory writes on ingest; HashJack URL fragments; red-team Phase 19), **Pitfall 8** structured-output failure (constrained decoding, idempotency keys, one-retry-then-ask, no-auto-repair of state changes), **Pitfall 13** unbounded agent loops (reserve-before-call budgets — alerts don't stop loops; 68 confirmed infinite loops in a 2026 audit; $47k/11-day incident), **Pitfall 15** CWS rejections (9 manifest permissions with 5 unused today; privacy policy; no remote code; extended-review trigger).

## Implications for Roadmap

The roadmap mirrors spec §18's 19-phase sequence **1:1** — research does not reorder it (dependency analysis confirmed the acquire→store→understand→display→extend→harden order is consistent). What research adds is **acceptance criteria, gotchas, and flags per phase**.

| Phase | Research-driven implications (fold into acceptance criteria) |
|-------|--------------------------------------------------------------|
| **1. MV3/WXT runtime + AntD shells + workspace handoff** | Remove Tailwind scaffold leftover (spec conflict) or ADR. Manifest least-privilege gate: drop 5 unused permissions, baseline `host_permissions` + `connect-src`, plan `optional_host_permissions`. Single messaging layer (MessageBus wired or deleted), `return true` contract, `ensureInitialized()`, synchronous listener registration, alarms-not-timers. Freeze extraction envelope types (Flag A). Election + `isPrimaryWriter()` predicate (Flag B). Coalesce `np_workspace` persists (250–500 ms debounce + flush-on-beforeunload) + write-rate assertion test. Arch tests: no `fetch()` in content scripts; real isolation tests (currently vacuous — CONCERNS.md). Avoid P1, P3, P4, P15; resolve Flags A/B. |
| **2. Storage/security/WriteJournal/persistence** | Install idb ^8; **add `unlimitedStorage` permission now** (IndexedDB ships). Storage adapter surfacing `lastError`/quota/rate-limit errors (never swallow). Per-entity keys; chat-history batch ≤5 s/10 msgs. Enforce single-writer via `isPrimaryWriter()`. Consent/approval storage model (P14 groundwork). Avoid P2; P14 groundwork. |
| **3. Cost-effective AI runtime with persona** | **Rebuild SSE against real provider wire formats** (conformance fixtures: OpenAI/Anthropic/Gemini/Ollama; CI throttle-proxy test with 1-byte chunks + CRLF). Flush-on-end persistence (never per-chunk). `np_active_stream` recovery reusing OperationId (Flag C). Constrained decoding per provider (Zod gate for Ollama). Token budget: count serialized prompt, reserve output. Cost tiers fast/balanced (differentiator). Persona runtime (RICH-R-01/02/10). **Remove default-on simulated AI + `localhost:12380` default (CONCERNS.md) — dev-flag only.** Avoid P1, P2, P5, P8 (part). |
| **4. Agent reliability + evidence** | Idempotency keys on state-changing calls; validate-then-execute; one-retry-then-ask; `stop_reason`-aware handling (max_tokens vs context-overflow); no-auto-repair. Step counters + circuit breaker + no-delta detection + **reserve-before-call budgets** (P13). Executor tool-call screening (P7 layer 2). AGT-02 evidence. Avoid P8, P13, P7 (part). |
| **5. Context-adaptive execution** | Token-budget allocator: final serialized prompt counting, output reservation + 2–3% margin, two-stage compaction (preemptive ~70%, ceiling ~95%), anchored summaries, never split tool-call pairs across compaction. Avoid P6. |
| **6. PageContentService layered extraction** | Install defuddle ^0.19 full + readability ^0.6 + turndown ^7. `parse()` sync `{markdown:true, useAsync:false}` (privacy — blocks FxTwitter API extractors). Payload protocol: pre-stripped clone, base-URL stamp, 2 MB cap, `truncated:true` (Flag A resolves). Per-tab LRU 20 + subscription model (§26.4a); mark-stale only for unsubscribed. Extraction hygiene: sanitize at boundary (P7 layer 1), URL-fragment handling. Reserve `servicenow-api` strategy id (§26.2). Avoid P3 (relay contract), P7 (part). |
| **7. Trust-aware context + receipts** | **Six-layer injection defense** (sanitize → action screening → dual-LLM quarantine → output screening → containment → disclosure) — single "from web" labels were bypassed in real incidents (Comet/Deep Research). CTX-03 provenance receipts + AGT-02 evidence pairing (differentiator). Avoid P7. |
| **8. Knowledge base: memory + MiniSearch + notes** | Install minisearch ^7. **Custom `tokenize`/`processTerm` for ServiceNow identifiers** (INC/CHG/KB/RITM prefixes, case normalization, stopwords). Async hydration (`addAllAsync`/`loadJSONAsync`), reconcile-by-manifest, versioned serialization + rebuild path. **Stable immutable note IDs + alias index** (P10; ID-based edges exceed Obsidian). Semantic-boundary chunking + provenance at ingest; claim-level citation foundation (P11). Avoid P10, P11, P12. |
| **9. LLM-Wiki + filesystem sync** | One-way backup; **conflict-aware writes**: CAS by base hash, atomic tmp+rename, conflict copies (never auto-merge — duplication is how corruption happens), watcher self-suppression + ~500 ms debounce, case-only rename via intermediate. Index lifecycle wired to write path + watcher (P12). Rename policy = alias pattern, no bulk link rewrites. Accept/reject enrichment gated 0.60; staleness detection LLM-WIKI-08; restore preview. Avoid P9, P10, P11 (stale sources), P12. |
| **10. Memory governance** | Two-stage compaction (P6). **Screen memory writes on ingest** for instruction-like patterns (P7 — poisoned memory re-infects future sessions). Memory↔note mapping keyed on **ID, not title** (P10). Avoid P6, P7, P10. |
| **11. Transaction logging + diagnostics** | Transaction log gains **live budget authority** (P13 — log rows written as the loop runs). Retrieval debug data (chunks/scores/cited) for mis-citation audits (P11). Estimate-vs-actual token drift logging, >10% = bug (P6). Index staleness signal (P12). Approval receipts feed (P14). Avoid P6, P11, P12, P13, P14. |
| **12. Agent evaluation** | Build the gates research says the market fails at: injection benchmark (P7), citation-accuracy ≥80% + mis-citation audit (P11), stream-truncation + schema-drift + duplicate-call fixtures (P5/P8), escalation-rate ≤15% (P14), looping-tool fixture (P13). Requires Phase 3's real-wire-format fixtures. Avoid P5/P7/P8/P11/P13/P14 verification. |
| **13. Verified continual evolution** | Standard eval-driven loop: typed candidate → sandbox eval → human approval, deterministic proposer, cost-capped (50k token budget). Depends on Phases 11/12. Standard patterns — no extra research. |
| **14. Bounded multi-role collaboration** | Round-trip caps between roles then escalate; single-agent baseline gate (COLLAB-11). Standard orchestration patterns — no extra research. |
| **15. Workspace experience + RICH** | Conflict-resolution UX (P9 recovery: conflict copies + merge decision flow). Source excerpts next to claims (makes mis-citation user-visible — P11). Search-as-you-type <50 ms warm at 50 MB vault (P12). Deny-path-first-class + approval batching/diffs (P14). RICH persona/chips/welcome cards (depends on Phase 3 persona runtime). Avoid P9/P11/P12/P14 UX failures. |
| **16. Multimodal input foundation** | Image paste/voice input; graceful `MULTIMODAL_MODEL_UNAVAILABLE` when no vision model configured (MM-03). Standard patterns — no extra research. |
| **17. Add-ons + content-script runtime (extraction-only)** | **G-1: similar-cases result card → acceptance criterion on §9.7** (Table API query + ranked list w/ resolution previews). **G-3: handoff-targeted summary → acceptance criterion on CatchUpSkill.** **Selection → Ask AI: promote to P0 or assert in acceptance** (#1 habit-forming entry). Add-on content scripts inherit no-fetch rule + per-instance `optional_host_permissions` (P3/P15). `servicenow-api` strategy into Phase 6 registry (clean extension point). PROXY_FETCH 25 s race, CookieSessionStore, RateLimiter. Avoid P3, P15. |
| **18. Tool governance + active discovery** | **Risk-tiered approval targeting ≤15% escalation** (research: rubber-stamping makes approval worse than none; UK AI Security Committee T10 pattern), expiring approval leases, batch reviews with diffs, deny-by-default UX. Per-tool budgets (P13). ResearchSkill graceful failure + permission gate. Avoid P13, P14. |
| **19. Hardening + release** | Forced-idle kill test (DevTools closed; 60 s+ stream survives — P1). >10 MB / high-write-rate soak (P2). Adversarial red-team corpus incl. fragment injection (P7). Looping-fixture chaos test halts within budget (P13). **CWS review-readiness: permission audit (zero unused), secrets scan, privacy policy (covers page-content extraction + LLM transmission), `wxt submit init` v2 flow (v1 API shuts down 2026-10-15), 1–2 weeks review slack** (P15). WXT 0.21 upgrade is **post-v0.1** — NOT here. |

### Phase Ordering Rationale

- **§18 order is dependency-correct and research-validated** (acquire → store → understand → display → extend → harden): AI runtime (3) before agent reliability (4) before context adaptation (5); extraction (6) before trust (7) because receipts cite what extraction produced; evidence model (7) before RAG (8/9) because per-statement citations depend on receipts infrastructure — market citation expectations (NotebookLM-style) are satisfied by LLM-WIKI-06, which requires Phase 7 first.
- **Phase 1 is the pivot phase** — it must carry the MV3 discipline (messaging contract, envelope types, election predicate, coalesced persistence, permission baseline) that every later phase builds on. The scaffold already implements Phase 1-adjacent surfaces — Phase 1 builds on it, but must converge the dual messaging paths and remove the simulated-AI/`localhost:12380` production defaults (CONCERNS.md).
- **ServiceNow skills cluster at 17/18, not earlier** — they need content-script runtime + tool governance + CORSProxy; the add-on shell exists from Phase 1 but skills must not precede runtime dependencies.
- **RICH (15) depends on Phase 3 persona runtime** — building UI before the persona contract risks rework; spec ordering is correct.
- **Pitfall prevention is front-loaded**: P1–P8 all have their primary prevention in Phases 1–9 (runtime, storage, streaming, extraction, trust), while Phases 11–19 are mostly *verification* of those defenses (soak tests, benchmarks, red-team, review audit) plus governance (P13/P14).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** provider SSE wire formats (OpenAI/Anthropic/Gemini/Ollama) — current parser is coupled to a private proxy envelope; needs conformance fixtures from provider docs/live capture; also tokenizer/usage-field differences (Ollama lacks usage on some paths)
- **Phase 6:** defuddle 0.19.x extraction fidelity on real ServiceNow portal DOM (community benchmarks exist: Readability F-score 0.875 — but validate on target pages); Readability-vs-Defuddle confidence threshold tuning
- **Phase 8:** MiniSearch tokenizer contract for ServiceNow identifiers (INC/CHG/KB/RITM handling) — needs a sample corpus to validate prefix/case rules; chunking strategy validation against E1–E6 error classes
- **Phase 12:** citation-accuracy benchmark is single-source research (arXiv 2601.05866, ~74%/80% figures) — calibrate on own eval set; escalation-rate ≤15% target is directional
- **Phase 17:** ServiceNow Table API specifics (endpoints, field schemas, rate limits, JSESSIONID/sysparmCK extraction) — needs per-instance validation; G-1/G-3 acceptance criteria need requirement-level definition
- **Phase 18:** permission-fatigue evidence is LOW-MEDIUM confidence (UK AI Security Committee T10; SOC alert-ignore studies) — treat as directional, validate escalation targets during design
- **Phase 19:** current CWS review requirements (2026) + v2 publish API (`wxt submit init` service-account flow) — confirm before release planning

Phases with standard patterns (skip research-phase):
- **Phase 13** (eval-driven evolution loop — well-documented, spec §28.7a detailed) · **Phase 14** (bounded multi-role orchestration — spec §30 closed registry; standard patterns) · **Phase 15** (UI/UX — DESIGN_SYSTEM.md + annotated mockups + §17.7 60 requirements already exist) · **Phase 16** (multimodal input — standard attach/vision patterns, MM-01…06 specified)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Version currency verified against npm registry + official docs on 2026-08-19 (HIGH); WXT 0.21 migration-cost claims and community MV3 patterns MEDIUM. Spec §7 pins are ground truth. |
| Features | MEDIUM | Competitive landscape via websearch cross-checked across independent sources; all spec-grounded statements HIGH. G-1/G-3 gap severity well-evidenced across 6+ support-copilot sources. |
| Architecture | HIGH | Platform-behavior claims cross-checked against Chrome official docs; verdict table validated every locked decision; storage-rate-limit flag and build-order flags are the honest caveats. |
| Pitfalls | MEDIUM | Cross-checked official docs + community post-mortems; a few single-source claims (arXiv citation-accuracy and infinite-loop audits; permission-fatigue studies) flagged LOW and mapped to Phase 12/18 validation points. |

**Overall confidence:** MEDIUM-HIGH — enough to plan requirements with certainty on stack/architecture; feature prioritization and pitfall severity should be validated by the eval gates (Phase 12) and acceptance criteria (Phases 17–19).

### Gaps to Address

- **Tailwind scaffold leftover**: spec forbids it, scaffold wires it — Phase 1 must remove or record an explicit ADR exemption. Decision needed at requirements time.
- **Simulated-AI production defaults** (`simulateStreamResponse`, demo data, `localhost:12380`): CONCERNS.md-flagged; Phase 3 must remove and gate behind an explicit dev flag.
- **Dual messaging paths** (raw background `onMessage` + never-initialized MessageBus): Phase 1 converges or deletes; doubles the Pitfall 4 surface.
- **5 unused manifest permissions** (of 9): Phase 1 cleanup item; drives both CWS risk (P15) and attack surface.
- **G-1 / G-3 feature gaps**: decide at requirements time whether they become §9.7/CatchUpSkill acceptance criteria (recommended — cheap) or explicit v0.2 scope.
- **Selection → Ask AI priority**: P1 today; market evidence says P0 — promote or at minimum assert in Phase 17 acceptance.
- **`unlimitedStorage` timing**: must be added with IndexedDB in Phase 2 — easy to forget since the manifest already exists.
- **WXT 0.21 / TS 7 / Vitest 4 / Immer 11**: hold all through v0.1; schedule WXT 0.21 as a dedicated post-v0.1 chore with the documented migration checklist (strict-tsconfig type-fix pass is the big cost).
- **CWS v1 publish API shutdown 2026-10-15**: release tooling in Phase 19 must use the v2 service-account flow — verify `wxt submit init` support before release planning.

## Sources

### Primary (HIGH confidence)
- `.planning/PRODUCT_SPEC_v0_1.md` rev 2026-08-12 — §0.2/§5/§7/§8/§9/§13/§15/§17/§19/§20/§22/§26/§27/§28-30, Appendices D/M/N.3 (locked stack, architecture, features, phases) — ground truth
- Chrome for Developers — service worker lifecycle, storage reference (quotas/rate limits/session), message passing, content scripts, network requests (CORS/CSP), Web Store troubleshooting — official docs
- npm registry queries 2026-08-19 (wxt 0.21.4, antd 6.6.1, @ant-design/x 2.9.0, react 19.2.8, zustand 5.0.15, immer 11.1.17, vitest 4.1.11, minisearch 7.2.0, defuddle 0.19.2, idb 8.0.3, turndown 7.2.4, readability 0.6.0, typescript 7.0.2)
- Official docs: WXT changelog/upgrading guide, antd migration-v6 + css-variables, @ant-design/x migration-v2, defuddle GitHub/npm, MiniSearch design doc + API, zustand persist docs
- `.planning/codebase/ARCHITECTURE.md` + `.planning/codebase/CONCERNS.md` — scaffold capabilities and confirmed defects

### Secondary (MEDIUM confidence)
- Competitive landscape: dassi.ai (20-extension test), analyticsinsight.net, Sider/Monica/MaxAI store listings, support.google.com (Gemini in Chrome), NotebookLM docs + dev story, ServiceNow community docs (Now Assist), Intercom/Pluno/Groove/SearchUnify/Kore.ai/Sprinklr docs, Jan/AnythingLLM/Ollama Client GitHub (telemetry disclosures)
- Community MV3 patterns: w3c/webextensions#1014 (silent SW truncation), pubkey/broadcast-channel leader election, sse-coordinator, dev.to/notearthian (storage comparisons), kepano/defuddle usage threads, content-extractor-benchmark
- ArXiv: 2601.05866 (RAG mis-citation ~74% accuracy, E1–E6 chunking errors), 2607.01641 (IAL-SCAN infinite-loop audit, $47k incident) — single-source, flag for Phase 12/4 validation
- OWASP LLM Prompt Injection Prevention Cheat Sheet; multigrid.ai streaming/context-budget guides; Obsidian help + Smart Rename repo (sync conflicts, alias pattern)

### Tertiary (LOW confidence — needs validation)
- UK AI Security Committee T10 "Overwhelming Human-in-the-Loop" + SOC alert-ignore studies (permission fatigue) — validate escalation targets in Phase 18 design
- HashJack URL-fragment injection technique (2025–2026 incident coverage) — red-team corpus design in Phase 19

---

*Research completed: 2026-08-19*
*Ready for roadmap: yes*