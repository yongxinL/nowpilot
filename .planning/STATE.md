---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
current_phase: 8
current_phase_name: Knowledge Base (Memory + MiniSearch + Notes)
status: executing
stopped_at: Completed 08-04-PLAN.md
last_updated: "2026-09-01T05:51:25.479Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 44
  completed_plans: 42
state_head: 9b50aca
---

# NowPilot — Project State

**Project:** NowPilot
**Milestone:** v0.1
**Defined:** 2026-08-19
**Single source of truth:** `.planning/PROJECT.md` (project context) · `.planning/PRODUCT_SPEC_v0_1.md` §18 (implementation sequence)

---

## Project Reference

- **What this is:** Privacy-first Chrome MV3 AI assistant + personal knowledge platform for ServiceNow Support Engineers (Copilot + Obsidian + NotebookLM in one extension). See `.planning/PROJECT.md` §What This Is.
- **Core value:** *AI chat and a personal knowledge base that work together, locally-first, so a support engineer can capture knowledge once and retrieve it with citations — without any data leaving their machine unless they opt in.*
- **Current focus:** Phase 8 — Knowledge Base (Memory + MiniSearch + Notes)
- **Companion files:**
  - `.planning/PROJECT.md` — project context, Active/Out of Scope, Key Decisions
  - `.planning/REQUIREMENTS.md` — 220 v1 requirements (spec-native IDs + `REQ-F*` for §9 gaps)
  - `.planning/ROADMAP.md` — 19 phases mirroring spec §18 1:1
  - `.planning/PRODUCT_SPEC_v0_1.md` — spec, §18 canonical phase ordering
  - `.planning/RESEARCH-RECONCILIATION.md` — authority for stack/version/research-derived decisions
  - `.planning/SUMMARY.md` — recommended per-phase research pack for cost-effective models (path must match the precedence banners in the research docs; pick ONE canonical location and use it everywhere)
  - `.planning/adr/` — ADR-STACK-01 (WXT hold), ADR-STACK-02 (`unlimitedStorage`), ADR-P6-01 (Defuddle panel-side, Accepted 2026-08-29), ADR-SEC-01 (dual-LLM quarantine v0.2), ADR-NOTE-01 (WIKI-ID UUID identity)
  - `.planning/DESIGN_SYSTEM.md` + `.planning/mockup/` — visual reference for Phase 15

---

## Current Position

- **Phase:** 8 (Knowledge Base (Memory + MiniSearch + Notes)) — EXECUTING
- **Plan:** 5 of 5
- **Status:** Ready to execute
- **Progress:** 6/19 phases complete · 35/74 plans done · 220/220 requirements mapped ([██████████] 95% coverage).

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 19 (canonical spec §18 order) |
| v1 requirements | 220 |
| Mapped requirements | 220 |
| Unmapped requirements | 0 |
| Coverage | 100% |
| Sub-waves preserved | Phase 15.1 / 15.2 / 15.3 (P0) / 15.4 (P1) / 15.5 (P2) |
| Verification gates | `pnpm run verify:phase-1` … `verify:phase-19` (defined in §24) |
| Open questions | 0 |
| Blockers | 0 |

---
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P01 | 3m | 2 tasks | 4 files |
| Phase 2 P2 | 11 | 3 tasks | 7 files |
| Phase 02-storage-security-writejournal-workspace-persistence P03 | 3min | 2 tasks | 4 files |
| Phase 02-storage-security-writejournal-workspace-persistence P06 | 6min | 2 tasks | 6 files |
| Phase 2 P5 | 6 min | 2 tasks | 4 files |
| Phase 06 P01 | 23m | 4 tasks | 13 files |
| Phase 6 P02 | 6min | 2 tasks | 4 files |
| Phase 06 P03 | 15min | 2 tasks | 2 files |
| Phase 06 P04 | 17min | 3 tasks | 10 files |
| Phase 06-pagecontentservice-knowledge-acquisition P05 | 16min | 3 tasks | 4 files |
| Phase 08 P01 | 16min | 3 tasks | 14 files |
| Phase 08 P02 | 24min | 3 tasks | 13 files |
| Phase 08 P03 | 16min | 2 tasks | 5 files |
| Phase 08 P04 | 19min | 3 tasks | 8 files |

## Accumulated Context — Decisions (inherited from PROJECT.md Key Decisions)

All inherited decisions are **— Pending** (awaiting first implementation to validate). PROJECT.md "Out of Scope" section is authoritative for what is **not** in v0.1.

| # | Decision | Source | Status |
|---|----------|--------|--------|
| 1 | GSD roadmap mirrors spec §18 1:1 (19 phases) | PROJECT.md Key Decisions | — Pending |
| 2 | REQUIREMENTS.md anchors to spec-native IDs verbatim; `REQ-*` minted only for §9 features lacking native IDs | PROJECT.md Key Decisions | — Pending |
| 3 | `D-*` records (§23, §27.8) are constraints/ADRs, not requirements | PROJECT.md Key Decisions | — Pending |
| 4 | §12 component-state strings attach as acceptance criteria on feature requirements, not standalone requirements | PROJECT.md Key Decisions | — Pending |
| 5 | One v0.1 milestone for all 19 phases | PROJECT.md Key Decisions | — Pending |
| 6 | Product spec is the single source of truth; planning artifacts never invent scope/paths/types | PROJECT.md Key Decisions | — Pending |
| 7 | Phase 1 builds on existing scaffold, not rebuild | PROJECT.md Key Decisions | — Pending |
| 8 | WXT held at 0.20.27 for v0.1 (post-v0.1 chore: 0.21 migration) | `.planning/adr/ADR-STACK-01` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-19 |
| 9 | `unlimitedStorage` permission added at Phase 2 (IndexedDB ships) | `.planning/adr/ADR-STACK-02` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-19 |
| 10 | Dual-LLM quarantine deferred to v0.2 (six-layer injection defense ships in v0.1) | `.planning/adr/ADR-SEC-01` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-19 |
| 11 | WIKI-ID UUID is sole note identity; no parallel alias store | `.planning/adr/ADR-NOTE-01` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-19 |
| 12 | Defuddle panel-side extraction on detached doc | `.planning/adr/ADR-P6-01` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-29 (SPIKE-P6-01 outcome; ADR flipped during 06-05) |
| 13 | Selection → Ask AI promoted P1 → P0 | RESEARCH-RECONCILIATION §F (REQ-R24) | Accepted 2026-08-19; spec §9.1 updated |
| 14 | G-1 similar-cases result card = §9.7 acceptance criterion (v0.1) | RESEARCH-RECONCILIATION §F (REQ-R22) | Accepted 2026-08-19 |
| 15 | Phase-1 wxt.config.ts permissions DEVIATE from Appendix G: authoritative Phase-1 set = ['sidePanel','storage','tabs']; cookies/scripting/contextMenus→Phase 17, alarms/notifications→when used, unlimitedStorage→Phase 2, declarativeNetRequest→never (v0.1) | `01-CONTEXT.md` D-19a (REQ-R21 / §16.4 / ADR-STACK-02) | Accepted 2026-08-19 |
| 16 | Entrypoints KEPT at root `entrypoints/` (WXT default; no migration to src/entrypoints/); content-script path shape normalized to `entrypoints/content/core.content.ts` (directory form, ISOLATED); MAIN-world servicenow content script → Phase 17 | `01-CONTEXT.md` D-07a (§5.1 / §6.2 / Appendix G) | Accepted 2026-08-19; **shape corrected 2026-08-30** — `content/core.content.ts` matched no WXT 0.20.27 glob, fixed via `entrypoints/content/index.ts` re-export (commit 45250b5) |
| 17 | Phase-1 `strict:true` lands via `@ts-expect-error NP-STRICT` sweep; verify:phase-1 is `tsc --noEmit` (noEmitOnError is a no-op and NOT relied upon); NP-STRICT ceiling tracked → reduce to 0 in Phase 2-3 | `01-CONTEXT.md` D-21 (§7.8 / §24 / §0.5.1) | Accepted 2026-08-19 |
| 18 | NP-STRICT ceiling reduced to 0 in Phase 2 (no `@ts-expect-error NP-STRICT` markers remain) | Phase 2 execution | Validated 2026-08-24 |
| 19 | `isPrimaryWriter()` delegates to WorkspaceElection (Phase-1 stub removed); election-gated journaled persist is the production path (D-24/D-31) | 02-07/02-08/02-09 | Validated 2026-08-24 |
| 20 | `recoverWorkspaceJournal` re-applies current `np_workspace` at boot (never empty reconstruction); `update-workspace` journal steps registered at boot | 02-08 (CR-01) | Validated 2026-08-24 |
| 21 | Election heartbeat published for primary/solo surfaces via `notifyWorkspaceHeartbeat` (was zero call sites — tie-break dead); standalone-wins handoff verified by production-tick two-surface test | 02-09 (CR-02) | Validated 2026-08-24 |
---

## Accumulated Context — Open Questions / Blockers

- **Open questions:** 0.
- **Blockers:** 0.
- **Watch items (verify at phase, do not hard-code as fact):**
  - VAI-01: `CVE-2026-30830` (Defuddle XSS fix in 0.19.x) — RESOLVED at Phase 6 install: defuddle `^0.19.3` installed, runs panel-side on detached docs with `useAsync:false`; ADR-P6-01 Accepted (2026-08-29).
  - VAI-04: version numbers (TS 7.0.2, Vitest 4.1.11, Vite 8.2.1, antd 6.6.1, minisearch 7.2.0, idb 8.0.3) — re-query npm at each phase install. (defuddle confirmed 0.19.3 at Phase 6.)
  - VAI-05: CWS v1 publish API shutdown 2026-10-15 — confirm `wxt submit init` v2 flow at Phase 19.
  - VAI-08: `CONCERNS.md`-referenced scaffold defects (simulated-AI `localhost:12380`, per-chunk full-store persistence, dual messaging, 5 unused permissions, vacuous isolation tests) — verify each against `src/` in Phase 1 before treating as fact (per RECONCILIATION §F).
  - Phase-1 theme key: authoritative is chrome.storage.sync.np\_theme (§15.1 / §17.1a APPR-03) — NOT np\_theme\_mode (does not exist in spec) and NOT the scaffold's chrome.storage.local np\_theme\_store. ThemeStore declares mode + pack now; pack SELECTOR UI is Phase 15 (D-10 / A1).
  - Phase-1 endpoint default: §10.6 ENDPOINTS are authoritative; localhost:12380 is NOT a canonical default and is not pre-filled in onboarding — real endpoint wiring is Phase 3 (D-12 / A4).
  - Version axes: zustand-persist store `version` (D-22) is SEPARATE from IndexedDB DB_VERSION (§20.4, reaches v4 by Phase 9) — do not conflate when numbering later migrations (A5).

---

## Session Continuity

**Last session:** 2026-09-01T05:51:25.464Z
**Stopped at:** Completed 08-04-PLAN.md
**Resume file:** None

- **Last action:** Phase 7 completed end-to-end — all 3 plans (TrustPolicy + ContextReceipt spine, ContextQualityMetrics + stable-prefix snapshots, SkillDisclosure + verify:phase-7 re-point) executed, verified 18/18 truths, verify:phase-7 64/64 green, full suite 621/621, code review 0 critical. PROJECT.md evolved (commit 17e5dc0).
- **Last updated:** 2026-08-30 after Phase 7 completion.
- **Resume with:** Phase 8 (Knowledge Base — Memory + MiniSearch + Notes) planning — no phase dir / CONTEXT.md yet, discuss first.

---

## Next-up

Phase 7 is complete. Phase 8 (Knowledge Base) has no CONTEXT.md. Run:

```text
/gsd-discuss-phase 8
```

---

*Last updated: 2026-09-01 (resume session)*

## Decisions

- [Phase ?]: PBKDF2 material = base64(installSecret) + ':' + extensionId — deterministic encoding locked at planning time per 02-RESEARCH.md note on §15.2 concatenation input. Documented in code comment.
- [Phase ?]: D-28 decrypt-on-read: in-memory config keeps plaintext (A6) for Phase-1 consumers; only persisted blobs are encrypted. hydrateProviderSecrets populates ONLY where the in-memory field is empty (user input wins).
- [Phase ?]: No-false-success UI contract (UI-SPEC E1 error row): handleSaveProviderModal awaits persistProviderConfigEncrypted first; on throw, modal stays open, no success toast, error to console/ErrorStore only.
- [Phase ?]: RateLimiter.acquire() returns boolean per D-36 PLAN-LOCAL contract; Requester translates false to canonical RATE_LIMITED
- [Phase ?]: Single shared AbortController for caller signal + internal timeout; both abort paths classify as TIMEOUT (D-35)
- [Phase ?]: RequesterError carries typed code literal union 'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK' (matches §21.6 closed set, REQ-R07 — no invented codes)
- [Phase ?]: Per-instance election state with module-level getters: each ElectionInstance owns state, timer, subscription; module-level getState()/isPrimaryWriter() read from active instance (matches WorkspaceStore delegation contract, D-24)
- [Phase ?]: Adapter emits typed errors via setStorageErrorReporter hook; ErrorStore + debugLog registration is the boot wiring (plan 02-07), not an adapter import (D-39 ownership rule)
- [Phase ?]: Curried step factory (deps) => (name, value) => JournalStep[] — captures adapter deps while letting runJournaled see stable step names
- [Phase ?]: Adapter inlines the two update-workspace steps rather than calling the factory at setItem time — the factory exists for plan 02-07's boot recovery wiring
- [Phase ?]: recoverJournal is operation-agnostic — caller owns isSupportedOperation gating + WRITE_JOURNAL_UNSUPPORTED_OP instrumentation; journal itself never throws on unsupported ops
- [Phase ?]: Legacy-key lift via read → write → verify → delete inside getItem is one-time + idempotent (guarded by canonical-key read)
- [Phase 6]: Phase 6 P01: Defuddle runs panel-side on detached DOMParser docs (default import from defuddle/full — spec 3721's named import fails TS2305; explicit useAsync:false since the option defaults TRUE in 0.19.x and would allow third-party API fetches — T-P6-05)
- [Phase 6]: Phase 6 P01: D-83 supersession executed — PageContext/TabContext/SNowCaseData/FileContext/NoteContext are canonical at src/core/content/PageContext.ts (verbatim spec 4345-4391); src/core/context/types.ts re-exports them (D-72 precedent); zero NP-STRICT markers in all new Phase-6 modules
- [Phase 6]: Phase 6 P01: Readability is provenance-only inside DefuddleStrategy (DEFUDDLE_LOW_CONFIDENCE_WORD_COUNT=50, below defuddle's internal 200-word auto-retry); no ReadabilityStrategy file; servicenow-api reserved-unregistered (D-80); StrategyInput gains two documented additive fields baseUrl? (spec 3726-3740) and truncated? (PageHtmlPayload flag propagation)
- [Phase 6]: Phase 6 P01: PageContentService.extract uses a single AbortController (PAGE_EXTRACTION_TIMEOUT_MS=5_000 merged with caller signal — both abort paths classify as the typed CONTENT_EXTRACT_FAILED, D-91, Requester precedent); redaction seam lives inside extract() before the output leaves the service (D-90, RESEARCH Open Q4)
- [Phase 6]: Phase 6 P01: SPIKE-P6-01 evidence produced — defuddle 0.19.3 runs the full UMD bundle under jsdom (A2) and does not throw on detached DOMParser docs with base-href (A1); defuddle logs internal DOMException for jsdom's nwsapi :has() selector but degrades gracefully (T-P6-08 disposition proven); ADR-P6-01 flip to Accepted recorded in 06-05
- [Phase Phase 6]: Phase 6 P02: AxDomWalker is a zero-import module — RawNode declared locally (plain serializable interface, structurally identical to apcLite.types.ts), the strongest Pitfall 8 content-bundle boundary; the 06-04 bridge wires the envelope round-trip
- [Phase Phase 6]: Phase 6 P02: form.control.isPassword emitted deterministically for every control (boolean, not only when true) so the panel-side normalizer never guesses; form.control.value emitted only when non-empty for non-password controls
- [Phase Phase 6]: Phase 6 P02: ApcLiteStrategy propagates input.truncated into stats.truncated (fallback false) — matches DefuddleStrategy's additive truncated? semantics so the bridge's walker-truncation flag reaches the StrategyResult
- [Phase 6]: D-92 executed: verify:phase-6 re-pointed to §18 test dirs (tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts); stale verify:phase-4a deleted; verify:phase-7 mis-pointing left for Phase-7 (RESEARCH Open Question 3)
- [Phase 6]: D-79 executed: ADR-P6-01 flips to Accepted (2026-08-29) with SPIKE-P6-01 outcome recorded — defuddle guarded defaultView?.getComputedStyle + Readability inline-only _isProbablyVisible make detached-doc fidelity acceptable; no measurement pass (evidence = DefuddleStrategy.test.ts)
- [Phase 6]: 06-05: built-bundle isolation check reads manifest.json content_scripts[].js as authoritative artifact list; describe.skipIf when no build artifact — gate never depends on a build (Open Question 2)
- [Phase 6]: Entrypoint shape corrected (2026-08-30): `entrypoints/content/core.content.ts` matched no WXT 0.20.27 content-script glob — added `entrypoints/content/index.ts` re-export; manifest now registers `content-scripts/content.js` (9.51 kB, ISOLATED); built-bundle checks green (verify:phase-6 94/94)
- [Phase ?]: [Phase 8]: 08-01: Note.type?: string declaration-only (D-108) — zero consumers in Phase 8; identity stays immutable UUID id (WIKI-ID-01/ADR-NOTE-01)
- [Phase ?]: MemoryScorer keyword scoring matches query terms against tags; sub-scores independently normalized to [0,1]
- [Phase ?]: MemoryEngine.buildPreferenceProfile reads np_persona (PreferenceMemoryStore) — never the fact store (RICH-R-05 DONE-when)
- [Phase ?]: MiniSearch 7.2.0 lacks upsert — using add+replace
- [Phase ?]: demoteDangling takes idToTitle map for raw title recovery
- [Phase ?]: NoteGraph.topKSimilar returns ALL notes up to k (including score-0 ties); ref-mirror pattern for activeIndex in WikilinkAutocomplete
