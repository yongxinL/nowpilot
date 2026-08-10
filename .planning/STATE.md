---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
current_phase: 03
current_phase_name: cost-effective-ai-runtime-persona-seed
status: executing
stopped_at: Completed 03-08-PLAN.md (useStreamingLLM + ChatPage + shell gates)
last_updated: "2026-08-10T21:46:22.608Z"
last_activity: 2026-08-10
last_activity_desc: Phase 03 execution started
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 31
  completed_plans: 30
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-09)

**Core value:** A privacy-first, local-first AI assistant where chat, extracted page content, and a linked notes/knowledge layer combine into a persistent personal workspace — no data leaves the machine unless the user deliberately configures a cloud provider.

**Current focus:** Phase 03 — cost-effective-ai-runtime-persona-seed

## Current Position

Phase: 03 (cost-effective-ai-runtime-persona-seed) — EXECUTING
Plan: 9 of 9
Status: Ready to execute
Last activity: 2026-08-10 — Phase 03 execution started

Progress: [██████████] 97%

## Performance Metrics

**Velocity:**

- Total plans completed: 22
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| —     | —     | —     | —        |
| 01 | 11 | - | - |
| 2 | 11 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 174min | 4 tasks | 27 files |
| Phase 01-mv3-wxt-runtime-antd-shells-workspace P02 | 22min | 4 tasks | 11 files |
| Phase 01-mv3-wxt-runtime-antd-shells-workspace P01-03 | 38 min | 3 tasks | 7 files |
| Phase 01 P04 | 48 | 3 tasks | 18 files |
| Phase 01-mv3-wxt-runtime-antd-shells-workspace P05 | 9min | 3 tasks | 6 files |
| Phase 01-mv3-wxt-runtime-antd-shells-workspace P06 | 31min | 3 tasks | 10 files |
| Phase 01-mv3-wxt-runtime-antd-shells-workspace P07 | 14min | 4 tasks | 18 files |
| Phase 01-mv3-wxt-runtime-antd-shells-workspace P08 | 20 min | 3 tasks | 20 files |
| Phase 01-mv3-wxt-runtime-antd-shells-workspace P09 | 20min | 5 tasks | 16 files |
| Phase 01 P10 | 10min | 3 tasks | 5 files |
| Phase 01-mv3-wxt-runtime-antd-shells-workspace P11 | 9 | 3 tasks | 8 files |
| Phase 03-cost-effective-ai-runtime-persona-seed P01 | 38min | 11 tasks | 9 files |
| Phase 03 P02 | 17min | 10 tasks | 9 files |
| Phase 03-cost-effective-ai-runtime-persona-seed P03 | 18min | 8 tasks | 9 files |
| Phase 03 P04 | 17min | 8 tasks | 6 files |
| Phase 03 P05 | 88 | 10 tasks | 2 files |
| Phase 03-cost-effective-ai-runtime-persona-seed P06 | 12 min | 8 tasks | 4 files |
| Phase 03-cost-effective-ai-runtime-persona-seed P07 | 12min | 7 tasks | 6 files |
| Phase 03-cost-effective-ai-runtime-persona-seed P08 | 34min | 8 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- [Roadmap]: Spec §18 is the single authoritative roadmap — its canonical phase order (1 → 2 → 3 → 3a → 4 → 4a → 4b → 5 → 5a → 5b → 6 → 6a → 6b → 6c → 7 → 7a → 8 → 8a → 9) is preserved verbatim; never re-derive or renumber phases
- [Phase 1]: AI + IndexedDB live only in Side Panel/Standalone, never in the background SW; content scripts are extraction-only
- [Phase 3]: Planner→Executor→Renderer orchestration (never maxSteps loops); cost guardrails (tier caps, monthly budget) are first-class
- [Phase 4b]: Retrieved data is never instructions (`instructionAuthority: false`); every OptimizedContext carries a ContextProvenanceManifest
- [Phase 5]: MiniSearch for retrieval (no embeddings); local-FS sync is one-way export-first (never bidirectional)
- [All phases]: Human-verified continual evolution (never autonomous); every phase ends green via `verify:phase-N`; every catch uses a canonical §C.2 error code
- [Phase 2]: Vault = at-rest AES-GCM obfuscation (PBKDF2 installSecret+extensionId, per-key salt/IV); secrets never exported; PROVIDER_KEY_UNREADABLE is the ONE shared state for restore-on-new-install / installSecret-cleared / tampered-ciphertext; wipe user-initiated only, never auto-regenerate
- [Phase 2]: VaultEnvelope uses base64 serializeEnvelope/deserializeEnvelope wire form — raw Uint8Array/ArrayBuffer degrade under chrome.storage JSON round-trip (proven by fakeBrowser mock)
- [Phase 2]: WriteJournal framework + update-workspace only; WorkspaceStore journaled; journal entry persists the workspace payload (replay restores it, not a version-only fabrication); workspace-scoped replay (WR-10); unknown-op skip-and-log
- [Phase 2]: IndexedDBMigrator MUST use raw indexedDB.open + sync dispatch + idb wrap() — idb openDB with a throwing upgrade leaks an unhandled rejection in fake-indexeddb → vitest exit 1; run full migration chain oldVersion→newVersion
- [Phase 2]: np_providers storage model = per-provider envelope keys (np_providers.<id>, encrypted) — aligns registry, Setting gate, and KeyVault; spec §15.1 note updated
- [Phase 2]: D-15 sync-quota shadow — cosmetic sync keys fall back to local shadow (SYNC_QUOTA_EXCEEDED), sync-first reads, shadow wins + reconcile back; ThemeStore rewired sync-first through Setting.ts; APPR-03 reworded "sync is canonical, local is transient shadow"
- [Phase 2]: ImportExport core at src/core/storage/ImportExport.ts (+1 documented to §18); JSON+ZIP fflate, scoped groups, manifest, merge/upsert, journaled full-vault restore (restore-notes-batch user-confirmed live consumer); UI panel deferred to Phase 7
- [Phase 2]: Redaction real in Phase 2 — TraceRedactor O.13 body + redactSensitive field-level (suffix-match sensitive keys, password DROP not mask, base64 envelope passthrough); debugLog extra redacted
- [Phase 01]: manualChunks applied via vite:build:extendConfig hook scoped to HTML multi-page groups (WXT 0.19 lib-mode IIFE builds reject top-level manualChunks); Appendix G isolation intent preserved via import restriction + isolation grep — Plan's verbatim-config and build-exit-0 acceptance criteria were mutually exclusive under WXT 0.19
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: Phase-1 debugLog error codes canonicalized into PRODUCT_SPEC Appendix C.2 (38-code Phase-1 block) — they were absent from the spec despite the plan's acceptance criteria; Golden Rule 9 codes are now spec-canonical for 01-04 errorCodes.ts — Plan acceptance criterion greps the spec for SIDEPANEL_BEHAVIOR/REGISTRY_INIT/THEME_WRITE/MSG_UNKNOWN_TYPE; 0 matches found before fix
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: STR Phase-1 additions sourced verbatim from the UI-SPEC Copywriting Contract (historyEmpty, onboarding.heading/body/configureProvider/configureLater, handoffFailed, cmdk.placeholder, newNote, options.noProvider, theme.saveFailed) — Plan claimed additions were already reconciled in Appendix B but they were absent; UI-SPEC Copywriting Contract is the canonical verbatim source the plan names
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: MessageBus/EventBus are the messaging layer; MessageBusBridge (7-method phase-owned contract, W3) is the single choke point surfaces import — surfaces never import MessageBus directly (R-4 module-level). Bridge consumes RuntimeEnvelope + MessageType whitelist from 01-02 (Pitfall 5: unknown types throw MSG_UNKNOWN_TYPE before dispatch). port.enableEmitter is a wxt 0.21+ API absent from pinned 0.19.29 — base chrome.runtime.Port API provides the same transport (Rule 1). EventBus handlers run in try/catch (debugLog EVT_HANDLER, deferred typeof-guarded until 01-04). jsdom 30/esbuild invariant break forces node env + navigator stub for bridge tests (Rule 3).
- [Phase 01]: debugLog + errorCodes.ts home at src/core/error/ (co-located contract, W-7 path reconciliation; §18's src/core/log/ split is non-load-bearing in Phase 1) — Canonical codes are the Golden Rule 9 vocabulary
- [Phase 01]: PortableMarkdown wraps XMarkdown (escapeRawHtml) + unconditional DOMPurify.sanitize — x-markdown 2.9.0 has no PortableMarkdown/skipHtml export — Same T-1-07 sanitization capability via the package's actual API
- [Phase 01]: Component tests run in custom jsdom-align environment (realm-aligned codecs) + threads pool + explicit RTL cleanup — vitest jsdom setup splits TextEncoder (Node realm) / Uint8Array (jsdom realm), breaking esbuild 0.25 invariant
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: PACK_TOKEN_OVERLAY co-located in themePacks.ts (single source); antdConfig imports it rather than re-declaring the Appendix F.2 constant
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: antdConfig reads pack seed tokens from the registry pack def (fallback THEME_PACKS.default.tokens + REGISTRY_INIT silent) - the plan contract implies tokens flow from pack definitions
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: onChanged + matchMedia listeners use remove-then-add (exactly one active listener, T-1-11) instead of a boolean flag - survives fakeBrowser.reset() which wipes chrome listeners between tests
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: Registry singleton pre-registration uses a register() loop (not registerAll) to hold the plan grep fixture (registerAll|getThemePackRegistry == 2)
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: ERROR_CODES.* property access - 01-04 exports codes as ERROR_CODES.THEME_INIT etc, not named exports; all theme files use ERROR_CODES.* (Golden Rule 9)
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: sidePanel.open options are a discriminated union (tabId XOR windowId) — the plan prose's {tabId, windowId} would throw in Chrome and fail tsc; WorkspaceRouter computes tabId-or-windowId (Rule 1). Handoff state machine lives in WorkspaceSync (getHandoffState) + EventBus SHOW_HANDOFF_*/ELECTION_FAILED events — WorkspaceState has no handoff field and D-18 forbids type widening. BroadcastBus.startHeartbeat takes an injected state provider so the dependency-free runtime core never imports zustand (Pitfall 4). WORKSPACE_MIRROR is not a canonical MessageType — mirror snapshots ride WORKSPACE_UPDATED with a mirror payload marker (Pitfall 5). WORKSPACE_SYNC canonical code added to errorCodes.ts + spec Appendix C.2 (Rule 2). WorkspaceRouter uses the raw chrome global (callback-typed) not the promise-only wxt/browser polyfill — the callback chain is the Pitfall 1 guard. — Chrome API contract correctness (OpenOptions union), D-18 type-drift boundary (no store widening), Pitfall 4 content-bundle safety (no zustand in runtime core), Pitfall 5 no-new-message-contract, Golden Rule 9 canonical codes, Pitfall 1 gesture preservation.
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: Content entry at src/entrypoints/core.content.ts (not the §18 content/ subdirectory) — wxt 0.19.29 entrypoint globs do not match content/core.content.ts; empirically verified the spec path builds no content bundle. Flat path resolves name 'core' + content-scripts/core.js output exactly as the plan's W-7 note promises. Rule 3. — Rule 3 blocking: wxt 0.19.29 glob set (content.ts | content/index.ts | *.content.ts | *.content/index.ts) cannot discover the §18 canonical path; verified with a real build (no content_scripts emitted). Plan's own W-7 note promises name 'core' + content-scripts output — only the flat path delivers that.
- [Phase ?]: Onboarding-done lives in AddonSettingsStore (np_addon_settings onboarding.done) not WorkspaceStore — D-18 forbids type widening; SidePanelRouter gates on ProviderRegistry presence (W-10) + this onboarding flag
- [Phase ?]: ProviderRegistry is push-reactive (subscribe + useSyncExternalStore in router+shell, T-1-18 — no cached UI flag) with clear() for test isolation; canonical home src/core/ai/ for Phase 3 extension
- [Phase ?]: navigateToPage (StandaloneRouter action) implemented in co-located standaloneNav.ts and re-exported — avoids CmdKPicker<->StandaloneRouter<->StandaloneShell circular import
- [Phase ?]: Cmd+K palette Modal conditionally mounted ({open && <Modal open>}) — rc-motion leave animations never complete in jsdom; deterministic close
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: CmdKPicker gained an optional controlled interface (open/onOpenChange): entrypoints lift the mod+k capture and own visibility (plan: 'state lifted here, passed to SidePanelShell'); when controlled the picker stops self-capturing (single capture source) - uncontrolled 01-08 behavior byte-identical — CmdKPicker gained an optional controlled interface (open/onOpenChange): entrypoints lift the mod+k capture and own visibility (plan: 'state lifted here, passed to SidePanelShell'); when controlled the picker stops self-capturing (single capture source) - uncontrolled 01-08 behavior byte-identical
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: workerState.ok/fail thread an optional request id (default fresh operationId): the 01-02 ResponseEnvelope REQUIRES id so the plan's no-id sketch could not compile - replies stay correlatable and traceable — workerState.ok/fail thread an optional request id (default fresh operationId): the 01-02 ResponseEnvelope REQUIRES id so the plan's no-id sketch could not compile - replies stay correlatable and traceable
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: BackgroundRouter splits §16.2 validation: foreign senders (sender.id !== chrome.runtime.id) get return false (Appendix E canonical - never respond to foreign senders); valid sender + non-whitelisted type gets workerState.fail(MSG_UNKNOWN_TYPE) reply — BackgroundRouter splits §16.2 validation: foreign senders (sender.id !== chrome.runtime.id) get return false (Appendix E canonical - never respond to foreign senders); valid sender + non-whitelisted type gets workerState.fail(MSG_UNKNOWN_TYPE) reply
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: BackgroundRouter dispatch to MessageBus: the 01-03 MessageBus is subscribed in the background (its own whitelist-guarded runtime listener) so valid envelopes reach background subscribers; Phase 1 has no background consumers (R-3) so dispatch() acknowledges valid envelopes - per-type handlers extend dispatch() when they land — BackgroundRouter dispatch to MessageBus: the 01-03 MessageBus is subscribed in the background (its own whitelist-guarded runtime listener) so valid envelopes reach background subscribers; Phase 1 has no background consumers (R-3) so dispatch() acknowledges valid envelopes - per-type handlers extend dispatch() when they land
- [Phase 01]: Split init().then chain into a named const so the mandated per-file grep fixture survives prettier chain-breaking — same semantics, prettier-stable call-site literal — Prettier --check (part of verify:phase-1) failed on the chained call; acceptance criteria require useWorkspaceStore.getState().init == 1 per entrypoint file
- [Phase 01]: Fresh-module persistence tests import the entrypoint module (not just the store) so the module-scope init() fires against seeded storage — Standalone hydration test initially imported only the store module; the init() wiring lives in the entrypoint, so seeding was never read
- [Phase 01-mv3-wxt-runtime-antd-shells-workspace]: Adopted the err instanceof Error ? err : undefined narrowing in rewired catch bodies — the plan's literal { error: err } fails tsc under strict catch-variable typing (unknown vs Error); matches WorkspaceStore/ProviderRegistry precedent — Rule 1 type-correctness adaptation required for gate-green; identical runtime behavior
- [Phase 03]: Phase 3 canonical type homes seeded at §8.5/Appendix-C paths (P-3b): ModelContextTier+classifyModelContext at src/core/context/ModelContextTier.ts, ContextProvenanceManifest at src/core/context/ContextProvenanceManifest.ts, UserPreferences+RetrievedMemory at src/core/memory/types.ts (C.1 note line 4775); src/core/ai/types.ts imports them (never re-declares). ToolSchemaRef canonical home is src/core/ai/toolSchemas.ts (Appendix C line 4571) — NOT types.ts; ai/types.ts imports it (R-1). provider_unconfigured stays a terminal reasonCode string (03-05 typed marker), NOT an error-code constant.
- [Phase 03]: Adapter factories keep @ai-sdk/* imports OUT: each create*Provider({apiKey,baseURL,fetch}) binds its config into the shared getAISDKModel seam (Seam 1 holds, A6 fetch forwarded) — the plan's "createOpenAIProvider(config) via createOpenAI" semantics live in the switch, not per-adapter imports
- [Phase 03]: ILLMProvider.chat/getModels ship as throwing @implementation-tier stubs (Golden Rule 10): streamText ownership is StreamAdapter's (03-03, Seam 3); the factories' real deliverable is getAISDKModel + structural validateConfig
- [Phase 03]: Registry snapshots (RegistryProviderInfo) strip apiKey (R-10) and compute resolvedBaseURL = customBaseURL ?? baseURL once at registration (§10.2)
- [Phase 03]: AI-01 checkbox stays PENDING — the requirement also names ProviderRouter (03-05); marking complete now would repeat the 03-01 mark-complete mistake
- [Phase 03]: F-5 pass-through boundary: StreamAdapter accepts providerOptions and applies them to the CoreSystemMessage UNCHANGED — it never computes cache strategy (applyCacheHints owns strategy, Router owns application); this is what lets the byte-stable [SYSTEM] persona block actually cache on anthropic
- [Phase 03]: applyCacheHints extends Appendix K's CacheAdaptedPrompt with a providerOptions field — emitted only when ≥1 stable breakpoint is marked (anthropic); gemini/openai/ollama never emit an anthropic payload
- [Phase 03]: PromptCacheManager implements §19.13 verbatim with an injectable clock (deterministic tests): 5 consecutive misses → hints disabled 60s; hit resets the counter; cascade re-arms
- [Phase 03]: buildToolNameEnum returns null for an empty tool list (D-05) — the PlannerDecisionSchema builder omits run_tool rather than calling z.enum([])
- [Phase 03]: No cache-specific C.2 code added for PromptCacheManager cascade observability — the 13-code Phase-3 block stays closed (03-01 decision); observability via hintsEnabled()/consecutiveMissCount() accessors
- [Phase 03]: F-4 sections-in applied at both ends: requestJson + the Seam-2 callback take PromptSection[]; the one repair appends a user_input section (never a joined-string rebuild), so the cached [SYSTEM] is byte-identical attempt-1 vs repair — hash-equality proven via hashStableSections (prompt-cache stability, T-03-04-02) — F-4 sections-in applied at both ends: requestJson + the Seam-2 callback take PromptSection[]; the one repair appends a user_input section (never a joined-string rebuild), so the cached [SYSTEM] is byte-identical attempt-1 vs repair — hash-equality proven via hashStableSections (prompt-cache stability, T-03-04-02)
- [Phase 03]: D-05 closed boundary in BOTH planner and executor: buildPlannerDecisionSchema omits run_tool when zero tools (stray run_tool fails the schema at the planner gate) and ExecutorService TOOL_REJECTs any unvalidated toolName — double-gated, deterministic (R-4) — D-05 closed boundary in BOTH planner and executor: buildPlannerDecisionSchema omits run_tool when zero tools (stray run_tool fails the schema at the planner gate) and ExecutorService TOOL_REJECTs any unvalidated toolName — double-gated, deterministic (R-4)
- [Phase 03]: Executor input-schema gate kept minimal (T-03-04-03): Phase-3's single tool declares an empty-object schema so a structural check suffices; richer per-tool Zod validation ships with the Phase-8 tool suite (ToolCapabilityManifest §28.5) — no JSON-schema engine invented — Executor input-schema gate kept minimal (T-03-04-03): Phase-3's single tool declares an empty-object schema so a structural check suffices; richer per-tool Zod validation ships with the Phase-8 tool suite (ToolCapabilityManifest §28.5) — no JSON-schema engine invented
- [Phase 03]: ask_clarification .default([]) kept spec-verbatim: the input/output shape asymmetry forces a one-line cast in plan() to PlannerDecision — the same boundary cast Appendix I performs ((decision as any)), now typed — ask_clarification .default([]) kept spec-verbatim: the input/output shape asymmetry forces a one-line cast in plan() to PlannerDecision — the same boundary cast Appendix I performs ((decision as any)), now typed
- [Phase 03]: AI-02 stays PENDING in REQUIREMENTS.md — 03-04 ships Planner+Executor services; the requirement names the full Planner→Executor→Renderer loop (Renderer 03-06, Orchestrator 03-08) — AI-02 stays PENDING in REQUIREMENTS.md — 03-04 ships Planner+Executor services; the requirement names the full Planner→Executor→Renderer loop (Renderer 03-06, Orchestrator 03-08)
- [Phase ?]: RendererService IS the second Seam-3 streamText consumer (direct construction, not a streamTextToLLMChunks call): the plan's verify grep 'RendererService streamText construction' + the AI-SPEC rule 'streamText is consumed ONLY inside RendererService/StreamAdapter' + the finishReason !== 'stop' honesty requirement jointly mandate direct construction; the renderer threads buildStageMessages' messages[]+providerOptions shape into streamText
- [Phase ?]: The orchestrator's plan() call omits toolResults: 03-04's PlanInput never declared it (the D-19-pure PlannerService never joins tool results into the prompt — F-4 sections-in is the prompt source); the loop still accumulates toolResults and threads them into render() verbatim
- [Phase ?]: planner_failed fallback covers NON-provider plan() rejections only: a ProviderUnavailableError (no_candidate/budget_blocked) or an AbortError propagates as the visible provider-failure state / AbortError — never converted to planner_failed (which would waste a re-resolution + re-render and mislabel a provider failure)
- [Phase ?]: StageResolver is defined in AgentOrchestrator over the 03-05 StageInvocation type: 03-05 exported the invocation bundle but no resolver type; the exported (stage: 'planner' | 'renderer') => StageInvocation seam is what the 03-08 hook builds over getProviderRouter().createStageInvocation
- [Phase ?]: isAbortError matches by name ('AbortError'), not instanceof Error — DOMException does not extend Error in every runtime; an abort surfacing inside the planner must propagate as AbortError, never become planner_failed
- [Phase 03-cost-effective-ai-runtime-persona-seed]: Persona pipeline ships as Appendix N.1/N.2 verbatim: PersonaProfileSchema + DEFAULT_PERSONA, the D-09 np_persona Setting-backed accessor (readPersona/readPersonaPrefs; empty/invalid → PERSONA_LOAD_FAILED → DEFAULT_PERSONA, never a crash), and PersonaInjector (resolvePersona deterministic personaOverrides merge, buildPersonaBlock fixed-template ordered joins → byte-stable per persona, inject() across all 4 stages incl. memoryExtractor D-11). contextHelper (D-02, Phase-4 deletion target) builds the §2.3 OptimizedContext emitting PromptSection[] per '@/core/ai/types' — persona block = stable:true system-kind (cache-eligible for 03-05's F-5 path), user input = stable:false user_input-kind; Golden Rule 3: only prompt builder on the UI path. 30 tests: byte-stability hash-equality across stages/turns, DEFAULT_PERSONA fallback, T-03-07-01 injection changes only [USER INPUT], §2.3 determinism. — Persona pipeline ships as Appendix N.1/N.2 verbatim: PersonaProfileSchema + DEFAULT_PERSONA, the D-09 np_persona Setting-backed accessor (readPersona/readPersonaPrefs; empty/invalid → PERSONA_LOAD_FAILED → DEFAULT_PERSONA, never a crash), and PersonaInjector (resolvePersona deterministic personaOverrides merge, buildPersonaBlock fixed-template ordered joins → byte-stable per persona, inject() across all 4 stages incl. memoryExtractor D-11). contextHelper (D-02, Phase-4 deletion target) builds the §2.3 OptimizedContext emitting PromptSection[] per '@/core/ai/types' — persona block = stable:true system-kind (cache-eligible for 03-05's F-5 path), user input = stable:false user_input-kind; Golden Rule 3: only prompt builder on the UI path. 30 tests: byte-stability hash-equality across stages/turns, DEFAULT_PERSONA fallback, T-03-07-01 injection changes only [USER INPUT], §2.3 determinism.
- [Phase 03]: Phase-3 ChatPage FAILED_PREFIX derives 'Provider error.' as the verbatim errorRetry prefix (split on ' [') — the canonical errorRetry string stays untouched (Golden Rule 2); [Retry]/[Switch Provider] tokens are actions/Phase-7 — Failed-bubble copy must match the UI-SPEC error row without touching the canonical string (T-03-08-03)
- [Phase 03]: The streaming caret is a static colorPrimary @60% indicator appended via Bubble contentRender — Bubble's own typing animation is motion-driven (forbidden §12.6); ChunkBuffer rAF is the only text animation — UI-SPEC streaming row requires a caret marking the streaming state; the library caret requires the forbidden typing animation
- [Phase 03]: useStreamingLLM sets the streaming state synchronously BEFORE the first await so the assistant bubble appears immediately (UI-SPEC streaming row); a new send aborts the previous AbortController (one stream per session §17.5) — Immediate bubble append is the UI-SPEC contract; no orphaned request bills tokens
- [Phase 03]: BubbleList's role prop is its RoleType item-mapping config (library API) — role='log' aria-live='polite' (spec §17.6) land on the message-list wrapper div — The streaming content must live in a polite live region per §17.6; the library consumes role for item mapping
- [Phase 03]: AI-03 marked complete by 03-08 (the React-UI end of 'Streaming works end-to-end'); AI-06 stays pending — its full text names Prompts/Welcome etc fenced to Phase 7 (D-03); the minimal Bubble/Sender subset ships here — 03-01 mark-complete mistake precedent: a checkbox opens only when the FULL requirement text is realized

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- [REQUIREMENTS.md] Coverage count corrected: the doc previously claimed 80 v1 requirements; verified count is 81 (LLM-WIKI-01..03 were missed). All 81 map to exactly one phase. ROADMAP.md and traceability reflect 81.

## Deferred Items

Items acknowledged and carried forward (v2 scope, tracked in REQUIREMENTS.md):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| PGINJ-01 | Page injection / host-page automation | Deferred to v2 | 2026-08-04 |
| PDF-01 | PDF chat / extraction | Deferred to v2 | 2026-08-04 |
| EMB-01 | Embedding-based semantic search | Deferred to v2 | 2026-08-04 |
| SYNC-03 | Bidirectional filesystem sync / live watch | Deferred to v2 | 2026-08-04 |
| TTS-01 | Voice/TTS audio output | Deferred to v2 | 2026-08-04 |
| A2UI-01 | Computer-use / autonomous UI interaction | Deferred to v2 | 2026-08-04 |

## Session Continuity

Last session: 2026-08-10T21:46:22.571Z
Stopped at: Completed 03-08-PLAN.md (useStreamingLLM + ChatPage + shell gates)
Resume file: None
