# NowPilot

## What This Is

NowPilot is a privacy-first Chrome MV3 AI assistant and personal knowledge platform for ServiceNow Support Engineers. It runs entirely against user-configured AI providers (OpenAI, Anthropic, Gemini, Ollama) — no data leaves the machine unless the user opts into a cloud provider. Two extension-owned surfaces (Side Panel + Standalone view) share one WorkspaceStore, delivering Copilot + Obsidian + NotebookLM for support engineering: AI chat, atomic notes with wikilinks, LLM-Wiki (auto-tagging/summaries/RAG "Ask notes"), layered page extraction, and a ServiceNow add-on.

## Core Value

AI chat and a personal knowledge base that work together, locally-first, so a support engineer can capture knowledge once and retrieve it with citations — without any data leaving their machine unless they opt in.

## Requirements

### Validated

- ✓ Extension entry points (background SW, content script, sidepanel, standalone, options) — existing
- ✓ Side Panel compact chat UI + command palette + theme wiring — existing
- ✓ Standalone full-tab workspace shell (sidebar nav to Chat/Tools/Note/Write/Teams) — existing
- ✓ Options settings surface (AI providers, theme, translate, prompts) — existing
- ✓ Core runtime: RuntimeEnvelope, MessageBus, EventBus, BroadcastBus, OperationId, PortReader, workerState — existing
- ✓ State layer: Zustand + immer stores (useExtensionStore, WorkspaceStore, ThemeStore) with chrome.storage persistence — existing
- ✓ AI provider service: SSE streaming, model discovery, simulated fallback — existing
- ✓ Registries: commands, keymaps, addons, sidepanel/full-app pages — existing
- ✓ Theme system: Ant Design light/dark tokens + ThemeSync broadcast — existing
- ✓ MV3/WXT runtime + AntD shells + workspace handoff (Phase 1) — verified 2026-08-22 (incl. Phase 1b Tailwind-className restoration, 2026-08-23)
- ✓ Storage, security, WriteJournal, workspace persistence (Phase 2) — encrypt-at-rest (KeyVault + EncryptedStorage AES-GCM-256), IndexedDB foundation (5 DBs + migrator + unlimitedStorage), WriteJournal + journaled election-gated persist, WorkspaceElection single-writer with published heartbeats, crash-safe boot recovery, NP-STRICT ceiling reduced to 0
- ✓ Cost-effective AI runtime with persona (Phase 3) — Appendix I Planner → Executor → Renderer pipeline (AgentOrchestrator), StreamAdapter 4-wire conformance (OpenAI/Anthropic/Gemini/Ollama), StructuredOutput one-shot repair, persona seed + injector (Appendix N), ProviderRegistry/TierResolver/ProviderRouter (D-50/D-52/D-54/D-56), PromptCacheAdapter/Manager, ChunkBuffer, renderer 512-token cap, zero-tool ExecutorService (TOOL_REJECTED), journaled append-chat-turn persist, useChatStreaming re-pointed, Options endpoint-override + tier fields — verified 2026-08-28 (UAT 29/29, security 25 threats closed)
- ✓ Agent reliability and evidence (Phase 4) — Appendix C.1 canonical types in `@/types/harness` (AgentTrajectoryState/CompletionEvidence/AgentTurnOutcome), TrajectoryTracker closed state machine (AGT-01), O.2 OutcomeVerifier + CompletionEvidence framework (AGT-02, zero registered verifiers), AgentTurnOutcome return contract (AGT-03, cap→partial), AGT-04 deterministic replan/terminal policy (≤1 replan per failed tool, repeated→failed, abort→aborted), renderer completion guard (no "Done" without evidence), `verify:phase-4` re-pointed — verified 2026-08-29 (4/4 truths, 183 tests green)
- ✓ PageContentService layered extraction (Phase 6) — DefuddleStrategy (panel-side, useAsync:false, Readability provenance-only) + ApcLiteStrategy/AxDomWalker actionable path (password omission, zero-import boundary), PageContentSerializer, PageContentService (typed CONTENT_EXTRACT_FAILED union, 5 s AbortController, D-90 redaction), §26.4a PageContentCache lifecycle, PageIndexBuilder (ephemeral MiniSearch heading-chunked, selectRelevant topk), content-script producer shells (ContentScriptHost/SPANavigationWatcher/PageContextBridge) + valid WXT entrypoint, non-vacuous §24 isolation gate + D-92 gate re-point + ADR-P6-01 Accepted — verified 2026-08-30 (14/14 truths, verify:phase-6 94/94, full suite 559/559)
- ✓ Trust-aware context and receipts (Phase 7) — C.1 trust types (TrustLevel/ContextItem/ContextReceiptEntry) verbatim in `src/types/harness.ts`, O.3-verbatim `TrustPolicy` (AUTHORITY_BY_TRUST, `<untrusted_data>` wrap + force-strip + post-wrap recount, structural guard raising `CONTEXT_INSTRUCTION_INJECTION_BLOCKED`), D-93 item pipeline in `assemble` (D-94 tags, D-96 originalTokens, D-97 rungs 1-2), D-95 derived `ContextReceipt` + `untrustedDataPresent` L6 signal, CTX-04 golden stable-prefix snapshots + FNV-1a cross-check, CTX-06 `ContextQualityMetrics` aggregates (no raw text), CTX-05 `SkillDisclosure` zero-token progressive disclosure, `verify:phase-7` re-pointed to §18 dirs — verified 2026-08-30 (18/18 truths, verify:phase-7 64/64, full suite 621/621, code review 0 critical)
- ✓ Knowledge base: memory + MiniSearch + notes (Phase 8) — canonical Note spine (notes.ts + NotesDB), memory type homes (memory/types.ts + harness WorkingMemory), PreferenceMemoryStore np_persona (RICH-R-05), memory subsystem (UserMemoryStore LRU≤500, MemoryScorer §3.4 scores∈[0,1], ConversationMemoryStore §15.3 compactor, WorkingMemory O.10, MemoryExtractor schema seam, MemoryEngine create-only producers + buildPreferenceProfile), MiniSearchIndex (lazy/memoized, <50ms/1k notes), LinkParser (WIKI-ID-02 tie-break, never getNoteByTitle), save.ts seam, NoteGraph (§22.3 verbatim cosine, STOP_WORDS=50), BacklinksPanel + WikilinkAutocomplete (no LLM, D-04) + NoteGraphView, E2E notes-search proof, `verify:phase-8` re-pointed to §18 canonical string (D-114) — verified 2026-09-01 (5/5 must-haves, verify:phase-8 72/72, full suite 747/747)

### Active

All Active requirements are hypotheses until shipped and validated. Full atomic requirement set lives in `.planning/REQUIREMENTS.md` (anchored to spec-native IDs); this list is the summary view.

- [ ] Context-adaptive execution (Phase 5)
- [x] PageContentService layered extraction (Phase 6)
- [x] Trust-aware context and receipts (Phase 7)
- [x] Knowledge base: memory + MiniSearch + notes (Phase 8)
- [ ] LLM-Wiki & filesystem sync (Phase 9)
- [ ] Memory governance and experience candidates (Phase 10)
- [ ] Transaction logging and diagnostics (Phase 11)
- [ ] Agent evaluation (Phase 12)
- [ ] Verified continual evolution (Phase 13)
- [ ] Bounded multi-role collaboration (Phase 14)
- [ ] Workspace experience (UI/UX) + RICH (Phase 15)
- [ ] Multimodal input foundation (Phase 16)
- [ ] Add-ons and content-script runtime, extraction-only (Phase 17)
- [ ] Tool governance and active discovery (Phase 18)
- [ ] Hardening and release (Phase 19)

### Out of Scope

- Page injection / host-page UI (CaseInsightBox, serviceNowInjection.ts, Shadow DOM mount) — deferred to v0.2+ (§0.2, §25, R1)
- Host-page write-back ("Fill this field", "Insert into page" = clipboard-only in v0.1) — reconciliation R1, §25
- Strict OKF markdown-link edges + path-as-identity + `sources`/`verified` families — OKF-WIKI-04, deferred to v0.2+ behind a dedicated ADR
- Browser automation (APC-lite ≠ browser automation) — MM-07 P0 boundary, §26.7
- ServiceNow value outside side panel / Standalone view — §9.7 out of scope
- Voice output (TTS) — input (RICH-H-17) in scope, output deferred
- Real-time collaboration, webhooks, insights, TTS — P2 feature flags (§9.3)
- Multi-modal animated 3D avatar, separate sentiment pipeline, full NLP intent parsing, drag-and-drop GUI macro builder, cross-session conversation resumption with full replay — §17.7.7

## Context

- **Authoritative spec:** `.planning/PRODUCT_SPEC_v0_1.md` (rev 2026-08-12) is the single source of truth. Planning artifacts must not invent scope, paths, or types beyond it. §18 is the sole source of implementation sequencing; Appendix C/E/F/G/I/J/K/L are canonical type/implementation references.
- **Existing codebase:** extension scaffold already implements Phase 1-adjacent surfaces (UI shells, stores, runtime, registries, AI service). Phase 1 builds on the scaffold rather than rebuilding it.
- **Codebase map:** `.planning/codebase/` (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, TESTING, CONCERNS, INTEGRATIONS) refreshed 2026-08-18.
- **Design system:** `.planning/DESIGN_SYSTEM.md` + annotated mockups in `.planning/mockup/`; visual layout intent defers to mockups, functional rules defer to spec (Phase 15 precedence rule).
- **Model-agnostic runtime:** spec names no vendor model. Runtime resolves capability tiers `fast` | `balanced` (Appendix D) to operator-configured `(providerId, model)`; user picks concrete models in Options. Build-agent model is a GSD/OpenCode operator choice, never a spec mandate (§0.3a).
- **Cost-effective-model implementability:** plans must be explicit and self-contained — fixed file paths (§8.5), canonical types (Appendix C / `@/types/harness`), closed tool enums, one-phase-per-response, no merge cognition.
- **Architecture fences:** content scripts extraction-only (no host-page UI/write-back in v0.1); core never imports add-ons; AI/IndexedDB never run in the background SW; every boundary has a Zod schema + fixture test; every catch calls `debugLog(code, …)`.
- **Phase gates:** a phase is DONE only when `verify:phase-N` passes (§24); acceptance recorded in VERIFICATION.md. One phase per response.

## Constraints

- **Tech stack**: WXT + React 19 + TypeScript + Ant Design v6 + Ant Design X 2.x + Zustand/immer + vitest — mandated by spec §7; no tailwind/shadcn/@radix-ui/framer-motion (spec §0.2)
- **Verification**: `verify:phase-N` scripts already defined in package.json (§24); phase done = gate passes
- **Implementation order**: §18 canonical order 1→19, one phase per response, never reordered
- **Privacy**: no data leaves machine unless user opts into cloud provider; secrets AES-GCM encrypted in chrome.storage.local, tokens in chrome.storage.session; no raw bodies/logs by default (TraceRedactor)
- **MV3 boundaries**: no AI providers/MCP/EventSource/IndexedDB/setInterval in background SW (§0.2)
- **Timeline**: v0.1 single milestone; all 19 phases under it

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GSD roadmap mirrors spec §18 1:1 (19 phases) | Spec §18 is the sole authoritative implementation sequence; verify:phase-N gates exist for every phase | — Pending |
| REQUIREMENTS.md anchors to spec-native IDs verbatim (RICH-*, AGT-*, CTX-*, MEM-*, KNW-*, TOL-*, EVAL-*, EVO-*, PROP-*, COLLAB-*, MM-*, CAT-*, LLM-WIKI-*, SYNC-*, NMEM-*, WIKI-ID-*, OKF-WIKI-*, APPR-*, NOTES-COL-*); REQ-* minted only for §9 features lacking native IDs | Never paraphrase the spec; preserve priority (P0/P1/P2), effort (S/M/L), and dependencies exactly | — Pending |
| D-* records (§23, §27.8) are constraints/ADRs, not requirements | They record decisions, not user-facing capabilities | — Pending |
| §12 component-state strings attach as acceptance criteria on feature requirements, not standalone requirements | Keeps requirement set atomic and user-centric | — Pending |
| One v0.1 milestone for all 19 phases | Single release target; PROJECT.md evolves as phases validate | — Pending |
| Product spec is the single source of truth; planning artifacts never invent scope/paths/types | Prevents drift between planning docs and implementation reference | — Pending |
| Phase 1 builds on existing scaffold, not rebuild | UI shells, stores, runtime, registries already exist and are mapped | — Pending |
| Secrets at rest: AES-GCM-256 via WebCrypto (KeyVault + EncryptedStorage); `np_providers` ciphertext-only, `np_store` partialized | Closes the scaffold's "API keys stored plaintext" concern | Validated Phase 2 (2026-08-24) |
| Single-writer workspace: `isPrimaryWriter()` delegates to WorkspaceElection CAS/heartbeat; journaled election-gated persist | Prevents cross-surface write conflicts and SW-suspension data loss | Validated Phase 2 (2026-08-24) |
| Crash-safe boot recovery: `recoverWorkspaceJournal` re-applies current `np_workspace`; journal steps registered at boot | Boot replay must never reconstruct an empty placeholder (CR-01) | Validated Phase 2 (2026-08-24) |
| Election heartbeat published for primary/solo surfaces (D-24 closed) | Zero-call-site defect made standalone-wins tie-break dead (CR-02) | Validated Phase 2 (2026-08-24) |
| NP-STRICT ceiling reduced to 0 in Phase 2 | Type safety debt eliminated at the planned point | Validated Phase 2 (2026-08-24) |
| Phase 3 cost-effective AI runtime shipped on client-side fetch, no provider SDKs; D-54a no-model-guessing enforced in-code (TierResolver null → configuration_required, zero provider requests) | INTEGRATIONS.md lock + MV3 bundle constraint + cost discipline | Validated Phase 3 (2026-08-28) |
| §1.4 tier caps are the ONLY cap-enforcement point; single PlannerService call site in src/ (grep == 1) | Appendix I bounded-loop rule | Validated Phase 3 (2026-08-28) |
| Turn-end persist seam (D-45): persistTurn once per completed turn via journaled append-chat-turn; abort drops partial with nothing persisted | Write-rate boundary + crash-safety | Validated Phase 3 (2026-08-28) |
| Phase 4 reliability framing: canonical Appendix C.1 types in `@/types/harness`; closed trajectory state machine; OutcomeVerifier framework (zero registered verifiers); AGT-04 replan/terminal policy; abort → returned `aborted` outcome | §28.2 AGT-01..04 "never silently claims success" + D-46 zero-tools parity | Validated Phase 4 (2026-08-29) |
| Phase 6 D-79/D-92/D-83/D-84: Defuddle panel-side on detached doc, ADR-P6-01 Accepted; verify:phase-6 re-pointed to §18 dirs; PageContext canonical at src/core/content/PageContext.ts with types.ts re-export; content-script producer shells keep a zero-import bundle (no zod/panel deps) | Appendix D/§26.4a/§18 scope fences + Pitfall-8 import boundary | Validated Phase 6 (2026-08-30) |
| WXT content-script entrypoint must use a recognized shape (`content/index.ts` or `content.core.content.ts`) — the D-07a directory-form `content/core.content.ts` matches no WXT 0.20.27 glob, so the content script was never built; fixed via `entrypoints/content/index.ts` re-export (9.51 kB) | `pnpm build:ext` manifest had no content_scripts; picomatch check against WXT find-entrypoints PATH_GLOB_TO_TYPE_MAP | Validated Phase 6 (2026-08-30) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-01 after Phase 8 (moved validated Phase 8 entry to Validated)*