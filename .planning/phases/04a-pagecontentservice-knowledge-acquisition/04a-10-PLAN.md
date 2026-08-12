---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 10
type: verify
wave: 6
depends_on: ["04a-01", "04a-02", "04a-03", "04a-04", "04a-05", "04a-06", "04a-07", "04a-08", "04a-09"]
files_modified:
  - package.json
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/PRODUCT_SPEC_v0_1.md
autonomous: true
requirements: [CAT-01, CAT-02, CAT-03, CAT-04, CAT-05]
must_haves:
  truths:
    - "`pnpm run verify:phase-4a` passes green: eslint, prettier --check, tsc --noEmit, wxt build, the full vitest suite (incl. tests/core/extraction/** + tests/core/content/** + tests/isolation/**), and the isolation gate (the no-content-script-ui test with the extended token set + sourcemap-stripped < 50 KB payload assertion)."
    - ".planning/REQUIREMENTS.md CAT-01..CAT-05 rows marked complete with an AI-07-style reconciliation note where the row text is narrower than the delivered scope: CAT-01 (defuddle/readability/turndown APC-lite + the RESEARCH-critical turndown-as-markdown correction for the Defuddle path), CAT-02 (SPANavigationWatcher + PageContextBridge + panel-side tabs.onUpdated — the background stays forward-only, R-3), CAT-03 (panel-side TraceRedactor before index/log + capture-time password omission, D-4a-20), CAT-04 (ISOLATED only in 4a — MAIN world is a Phase-8 ServiceNow concern), CAT-05 (< 50 KB sourcemap-stripped payload + non-blocking document_idle + 5 s cap)."
    - ".planning/ROADMAP.md Phase 4a 'Plans: TBD' replaced with the 04a-01..04a-10 plan list (04-07 precedent); the §18 master phase order and the success criteria untouched."
    - ".planning/PRODUCT_SPEC_v0_1.md W-1 canonicalizations verified: CONTENT_EXTRACT_FAILED present at C.2 (L3510 + Phase-1 block ~L5108 — the 04a-02 reconcile); the pinned constants (PAGE_CACHE_MAX_TABS=20, EXTRACTION_TIMEOUT_MS=5000, PAGE_HTML_MAX_BYTES≈2 MB, INDEX_CHUNK_MAX_TOKENS=500, MIN_EXTRACTED_CHARS=500, MIN_CONTENT_DENSITY=0.2) documented in Appendix C per the CONTEXT discretion ('planner pins + documents in Appendix C'); the O.12 non-canonical code is NOT added (D-4a-22)."
    - "§18 'DONE when' for Phase 4a all satisfied: Defuddle runs in the panel (not the bundle); content bundle has no React/AntD/defuddle/yaml + < 50 KB; layered fallback records the source used; PageIndexBuilder builds an ephemeral per-tab MiniSearch index (never persisted); SPA-nav (wxt:locationchange) + tabs.onUpdated invalidation works; passwords never captured; verify:phase-4a passes."
  artifacts:
    - "package.json"
    - ".planning/REQUIREMENTS.md"
    - ".planning/ROADMAP.md"
    - ".planning/PRODUCT_SPEC_v0_1.md"
  key_links:
    - "verify:phase-4a mirrors verify:phase-4 (package.json L22) with the isolation gate now INSIDE vitest run (04a-09 retirement of the .mjs — the chain shape is unchanged: eslint + prettier + tsc + wxt build + vitest run)."
    - "The CAT note follows the AI-07/AGT-02/CTX re-map precedents — §18 remains authoritative over REQUIREMENTS.md rows."
    - "The W-1 scoped-regex verify asserts the canonical code + constants inside the spec slices (03-01/04-07 precedent)."
  flagged_assumptions:
    - "CAT-01..CAT-05 [unresolved — spec-less probe #1110, all six edges surfaced]: empty/encoding (CAT-01), unclassified (CAT-02..05) — every probe edge was implemented + proven across 04a-01..09 (empty→typed failure 04a-08 Test 7; encoding/truncation 04a-07 + 04a-08; SPA-nav+delivery 04a-06/07/08; redaction 04a-08 Test 8; ISOLATED 04a-09; < 50 KB + non-blocking 04a-09); this plan's verify:phase-4a run is the aggregate seal. The rows stay unresolved in the probe ledger (never auto-dismissed — flagged-unverified disposition)."
    - "A1..A6 [research, ASSUMED]: turndown types compat (proven by 04a-03 tsc), baseURI resolution (04a-04 fixture test), truncation keeps Defuddle-able content, estimateTokens heuristic, defuddle no-useAsync privacy (pinned ^0.6), TURNDOWN_OPTIONS parity (04a-05 heading-boundary test)."
    - "Real-browser SPA-nav smoke (RESEARCH Environment): automated namespaced-event tests cover the logic; a manual `wxt dev` smoke is recommended but non-blocking (verify:e2e-phase-1 pattern)."
  prohibitions:
    - "No verify:phase-4a without the isolation gate (CAT-04/05 — the extended test is part of vitest run)."
    - "No new REQUIREMENTS.md CAT id and no §28.3 namespace collision (CAT ids are Phase-4a-owned per the traceability table)."
    - "No §18 master phase-order change."
    - "No exact test-count assertions in the gate (P-5)."
    - "No skip of eslint/prettier/tsc/wxt-build/vitest in the chain (§24 pattern)."
    - "No new codes/strings outside the spec (W-1 — every canonical addition mirrors a spec slice; the O.12 non-canonical string never appears)."
---

<!-- 04a-10 (2026-08-12): the phase gate (Golden Rule 10 — a phase is not done until
     verify:phase-4a passes). verify:phase-4a green (the §24 chain with the isolation
     gate inside vitest), REQUIREMENTS.md CAT-01..05 marks with the AI-07-style note,
     ROADMAP plan list fill, and the W-1 Appendix C constant documentation. -->

<objective>
Seal Phase 4a: run `verify:phase-4a` green (§24 chain — eslint + prettier + tsc + wxt build + full vitest incl. the isolation gate), mark CAT-01..05 in REQUIREMENTS.md (AI-07-style reconciliation note), fill the ROADMAP plan list, and document the pinned constants + canonical code in the spec Appendix C (W-1 gate).

Purpose: A phase is not done until its gate passes (Golden Rule 10). The doc updates keep the planning record honest (the RESEARCH-critical turndown-as-markdown correction, the R-3 forward-only background, the D-4a-20 capture-time invariant), the W-1 gate keeps canonical codes/constants single-sourced, and the full-suite green run proves the layered pipeline end-to-end.

Output: verify:phase-4a green + CAT marks + ROADMAP list + Appendix C constant documentation — Phase 4a DONE per §18.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-UI-SPEC.md
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Phase-4a gate + documentation seals (CAT marks, ROADMAP list, W-1 constants)</name>
  <files>package.json, .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PRODUCT_SPEC_v0_1.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (CAT-01..05 rows L69-75 + the AI-07/AGT-02/CTX note style L44-58/L67)
    - .planning/ROADMAP.md Phase 4a (L247-260 — 'Plans: TBD' to fill)
    - .planning/PRODUCT_SPEC_v0_1.md Appendix C (the pinned-constant documentation target) + C.2 (CONTENT_EXTRACT_FAILED mirror check)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-UI-SPEC.md (the 9 covered UI Considerations rows to reflect as satisfied-by-contract truths)
  </read_first>
  <action>
    1) Run `pnpm run verify:phase-4a` — it must pass green end-to-end. If any step fails, fix the drift (the executor owns the fix within this task — the gate is the deliverable), then re-run until green.
    2) Update .planning/REQUIREMENTS.md: mark CAT-01..CAT-05 `[x]` and append ONE AI-07-style note block per the must_haves truth (turndown-as-markdown correction for the Defuddle path per RESEARCH; R-3 forward-only background; D-4a-20 capture-time password omission; ISOLATED-only in 4a; < 50 KB sourcemap-stripped payload). §18 remains authoritative over the rows.
    3) Update .planning/ROADMAP.md Phase 4a: replace `**Plans**: TBD` with the 04a-01..04a-10 list (each line `- [x] 04a-NN-PLAN.md — <brief objective>`; keep the goal/success criteria untouched; the phase row stays `[ ]` in the master list until the milestone/next phase transition).
    4) Update .planning/PRODUCT_SPEC_v0_1.md (W-1): verify CONTENT_EXTRACT_FAILED is present at C.2 (L3510 + Phase-1 block ~L5108, scoped-regex per the 03-01/04-07 precedent); document the pinned constants (PAGE_CACHE_MAX_TABS=20, EXTRACTION_TIMEOUT_MS=5000, PAGE_HTML_MAX_BYTES≈2 MB, INDEX_CHUNK_MAX_TOKENS=500, MIN_EXTRACTED_CHARS=500, MIN_CONTENT_DENSITY=0.2) in Appendix C (the CONTEXT discretion 'researcher/planner pins + documents in Appendix C'); ensure the O.12 non-canonical string is NOT added (D-4a-22).
  </action>
  <acceptance_criteria>
    - `pnpm run verify:phase-4a` exits 0 (the full §24 chain green).
    - `grep -n "CAT-0[1-5]" .planning/REQUIREMENTS.md` shows all five rows `[x]` + the note block.
    - `.planning/ROADMAP.md` Phase 4a lists `**Plans**: 10/10 plans executed`-style count + all ten 04a-NN lines.
    - `grep -c "CONTENT_EXTRACT_FAILED" .planning/PRODUCT_SPEC_v0_1.md` >= 2 (canonical L3510 + reconciled Phase-1 block).
    - Appendix C documents the six pinned constants (grep each).
    - `grep -rn "check-content-bundle" package.json` returns nothing (the .mjs retirement from 04a-09 is stable in the gate).
  </acceptance_criteria>
  <verify>
    <automated>pnpm run verify:phase-4a</automated>
  </verify>
  <done>verify:phase-4a green; CAT rows marked with the note; ROADMAP list filled; W-1 constants + code documented; Phase 4a sealed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| phase artifacts → release gate | the sealed phase is the handoff contract for 4b/5/7 consumers |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-27 | Spoofing | gate green without the isolation check (CAT-04/05 evasion) | high | mitigate | verify:phase-4a runs the FULL chain incl. the isolation suite inside vitest run (04a-09) — no optional skip path; the gate command is the acceptance criterion |
| T-4a-28 | Tampering | doc/spec drift after the code ships (W-1 violations) | medium | mitigate | The gate re-verifies CONTENT_EXTRACT_FAILED in C.2 + the pinned constants in Appendix C (scoped-regex precedent); REQUIREMENTS/ROADMAP marks are in the same task as the green run |
</threat_model>

<verification>
- Full `pnpm run verify:phase-4a` chain green (eslint, prettier --check, tsc --noEmit, wxt build, full vitest incl. isolation).
- CAT-01..05 marked + note; ROADMAP Phase 4a list filled; spec W-1 verified.
- All six spec-less probe edges + the six research assumptions recorded as flagged (disposition: proven-by-plans / ASSUMED).
</verification>

<success_criteria>
- verify:phase-4a passes green end-to-end (Golden Rule 10).
- §18 DONE-when satisfied (Defuddle panel-side, < 50 KB bundle, layered fallback recorded, ephemeral index, SPA-nav + tabs invalidation, passwords never captured).
- REQUIREMENTS.md/ROADMAP.md/spec documentation sealed.
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-10-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- package.json — verify:phase-4a confirmed green (no script change unless drift fixes needed)
- .planning/REQUIREMENTS.md — CAT-01..05 `[x]` + reconciliation note
- .planning/ROADMAP.md — Phase 4a plan list (10 plans)
- .planning/PRODUCT_SPEC_v0_1.md — Appendix C pinned constants (6) + C.2 CONTENT_EXTRACT_FAILED verified
