---
phase: 04b-trust-aware-context-and-receipts
plan: 06
type: execute
wave: 5
depends_on: [04b-05]
files_modified:
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [TRUST-01, TRUST-02, TRUST-03]
must_haves:
  truths:
    - "REQUIREMENTS.md TRUST-01..03 rows (L79-83) gain the D-4b-00 re-map note in the AI-07 style (04-CONTEXT D-04-01 precedent): TRUST-01 = CTX-01/02, TRUST-02 = CTX-02 injection defences, TRUST-03 = CTX-03 controls; CTX-05/06 are P1 → structural (D-4b-13/14); §18 remains authoritative over the rows."
    - "The phase seals ONLY when `pnpm run verify:phase-4b` exits 0 — the §24 chain (eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run) covering the full suite INCLUDING the two required 4b test dirs (tests/core/context/trust/** + tests/security/prompt-injection/** — §18 L2746) and the extended legacy suites (ContextOptimizer, ContextProvenanceManifest, useStreamingLLM, OptionsPage)."
    - "No exact test-count assertions (P-5) — the gate is the chain passing, per the 04-RESEARCH precedent."
    - "Golden Rule 10 holds: the phase is DONE only when verify:phase-4b runs green end-to-end; any drift found during the gate run is fixed in this plan (executor owns drift fixes inside the gate task — 04a precedent T-4a-27)."
  artifacts:
    - ".planning/REQUIREMENTS.md (TRUST re-map note)"
  key_links:
    - "verify:phase-4b (added in 04b-01) is the single gate — every 4b plan's output must survive it together."
    - "The D-4b-00 re-map keeps REQUIREMENTS.md traceability honest: the TRUST-01..03 checkboxes close against the CTX-01..06 namespace the phase actually ships."
  flagged_assumptions:
    - "A8 [research, ASSUMED, re-confirmed]: verify:phase-4b's §24 chain (eslint + prettier + tsc + wxt build + vitest run) is the gate — the spec's scoped form (L3684) is a subset satisfied by the full run."
  prohibitions:
    - "No test-count assertions in the gate (P-5) and no weakening of the §24 chain — the gate is the chain passing, nothing narrower."
---

<!-- 04b-06 (2026-08-13): Wave-5 phase gate. The D-4b-00 TRUST→CTX re-map note
     lands in REQUIREMENTS.md (AI-07 precedent), and the phase seals ONLY when
     verify:phase-4b runs green end-to-end (Golden Rule 10). This plan owns no
     source files — it is the phase-completion checkpoint. -->

<objective>
Seal Phase 4b: record the D-4b-00 TRUST→CTX re-map note in REQUIREMENTS.md (AI-07 precedent) and run the full `verify:phase-4b` gate (§24 chain) green end-to-end.

Purpose: Golden Rule 10 — the phase is not done until its verify gate passes; the re-map note keeps REQUIREMENTS.md traceability honest for the 81-requirement map.

Output: REQUIREMENTS.md re-map note committed; verify:phase-4b green.
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
@.planning/phases/04b-trust-aware-context-and-receipts/04b-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: REQUIREMENTS.md D-4b-00 TRUST→CTX re-map note</name>
  <files>.planning/REQUIREMENTS.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (Trust-Aware Context section L79-83 — the TRUST-01..03 rows)
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-CONTEXT.md (D-4b-00 decision text)
    - .planning/REQUIREMENTS.md CAT re-map note precedent (L77 — the AI-07-style block to mirror)
  </read_first>
  <action>
    Add a re-map note block under the 'Trust-Aware Context (Phase 4b)' heading (after the three TRUST rows L81-83), styled after the CAT re-map note precedent (L77): a `>` blockquote stating — TRUST-01..03 map to the spec §28.3 CTX-01..06 namespace (Phase 4b owns those ids per D-04-01): TRUST-01 = CTX-01/02 (source trust/authority metadata; retrieved data can never redefine policy), TRUST-02 = CTX-02 injection defences (deterministic classifier + quarantine-not-drop), TRUST-03 = CTX-03/04 controls (per-source-type content-trust toggles; manifest → context receipt; stable-prefix snapshots); CTX-05 (progressive skill disclosure) and CTX-06 (context-quality diagnostics) are P1 → structural-only in 4b (D-4b-13/14); §18 remains authoritative over the rows.
    Do NOT modify the TRUST-01..03 checkbox rows themselves (they close via the phase verification, not by editing the text). Do NOT touch any other REQUIREMENTS section.
  </action>
  <acceptance_criteria>
    - REQUIREMENTS.md contains a blockquote under the Trust-Aware Context section naming 'TRUST-01 = CTX-01/02', 'TRUST-02 = CTX-02', 'TRUST-03 = CTX-03/04' and the '§18 remains authoritative' phrase.
    - The TRUST-01..03 checkbox lines are unchanged (git diff shows only the added note block).
  </acceptance_criteria>
  <verify>
    <automated>grep -c "TRUST-01 = CTX-01/02" .planning/REQUIREMENTS.md</automated>
  </verify>
  <done>D-4b-00 re-map note recorded in the AI-07 style; TRUST rows untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Run verify:phase-4b to green (phase gate)</name>
  <files></files>
  <read_first>
    - package.json (the verify:phase-4b script from 04b-01)
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-RESEARCH.md (Environment Availability — pnpm 11.18.0, tsc 5.9.3 via pnpm; vitest 4.1.10 `--bail=1` not `-x`)
  </read_first>
  <action>
    Run `pnpm run verify:phase-4b` (the §24 chain: eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run). The full vitest suite includes tests/core/context/trust/**, tests/security/prompt-injection/**, and the extended legacy suites (ContextOptimizer, ContextProvenanceManifest, useStreamingLLM, OptionsPage, plus all prior phases' suites).

    If the gate fails: fix the drift INSIDE this plan (executor owns drift fixes — 04a T-4a-27 precedent): run the failing check in isolation (e.g. `pnpm vitest run <file> --bail=1`), repair the source/test, re-run the full chain, and repeat until green. Do NOT weaken the chain, do NOT add test-count assertions (P-5), do NOT skip eslint/prettier/wxt-build steps.

    The gate is green when the chain exits 0 end-to-end. Golden Rule 10: the phase is DONE only when this command passes.
  </action>
  <acceptance_criteria>
    - `pnpm run verify:phase-4b` exits 0 (eslint, prettier --check, tsc --noEmit, wxt build, vitest run all pass).
    - The full vitest run includes the two required 4b dirs with their files present (TrustPolicy/TrustTypes/contextFeed/contextReceipt/stablePrefix/qualityCounters tests + injectionScreener/quarantine tests).
    - No test-count assertions added anywhere (P-5).
  </acceptance_criteria>
  <verify>
    <automated>pnpm run verify:phase-4b</automated>
  </verify>
  <done>verify:phase-4b green end-to-end — the §24 chain passes with the trust + security suites; any drift found was fixed in this plan.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| verify:phase-4b gate | the phase-seal seam — green here is the Golden-Rule-10 evidence that trust invariants hold across the whole suite |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4b-13 | Tampering | gate integrity (verify:phase-4b chain) | high | mitigate | The gate is the full §24 chain (eslint + prettier + tsc + wxt build + vitest run) — no scoped-only shortcut, no test-count relaxation (P-5); a drift fix must re-run the FULL chain, so a partial green can never seal the phase (Golden Rule 10; 04a T-4a-27 precedent). |
| T-4b-14 | Tampering | REQUIREMENTS.md traceability | low | accept | The re-map note is documentation; §18 remains authoritative over the rows (D-4b-00) — a doc drift here cannot alter runtime trust behavior (all runtime invariants are pinned by the gate's test suites). |
</threat_model>

<verification>
- `pnpm run verify:phase-4b` exits 0 (the gate itself).
- `grep -c "TRUST-01 = CTX-01/02" .planning/REQUIREMENTS.md` >= 1.
</verification>

<success_criteria>
- REQUIREMENTS.md carries the D-4b-00 re-map note (AI-07 style).
- verify:phase-4b green end-to-end — Phase 4b sealed per Golden Rule 10.
- No test-count assertions; the §24 chain is untouched.
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-and-receipts/04b-06-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- `.planning/REQUIREMENTS.md` — D-4b-00 TRUST→CTX re-map note blockquote (TRUST-01 = CTX-01/02, TRUST-02 = CTX-02, TRUST-03 = CTX-03/04; CTX-05/06 P1-structural; §18 authoritative)
- (no source files — the phase gate plan)
