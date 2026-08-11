---
phase: 03a-agent-reliability-and-evidence
plan: 05
type: verify
wave: 4
depends_on: ["03a-01", "03a-02", "03a-03", "03a-04"]
files_modified:
- package.json
- .planning/REQUIREMENTS.md
- .planning/ROADMAP.md
autonomous: true
requirements: [AGT-01, AGT-02, AGT-03, AGT-04, AGT-05]

<!-- 03a-05 (2026-08-11): the phase gate. verify:phase-3a script (§24 pattern), the
     REQUIREMENTS.md AGT re-map notes (D-3a-01 — CheckpointRecorder folds into AGT-02;
     AGT-05 commit-confirm re-maps to Phase 8), the ROADMAP criterion #5 reduction, and the
     full-suite green seal. A phase is not done until verify:phase-3a passes (Golden Rule 10). -->

must_haves:
truths:
- "package.json gains `verify:phase-3a` = the §24 pattern chain: `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs` (mirrors verify:phase-1/2/3, L19-21)."
- ".planning/REQUIREMENTS.md AGT rows updated per D-3a-01 with an AI-07-style note: AGT-02's description gains 'CheckpointRecorder enables one-step rollback'; AGT-05's row carries a Phase-8 re-map note (commit-confirm barrier → TOL-03 PermissionDialog / ToolCapabilityManifest, 03a ships only the waiting-for-permission state + pause seam). Traceability row maps AGT-01..05 to Phase 3a."
- ".planning/ROADMAP.md Phase 3a criterion #5 is reduced per D-3a-01: 'User confirms before irreversible actions via the commit-confirm barrier' → 'evidence/false-completion tests pass' (the commit-confirm UI is Phase 8; 3a proves the seam + the false-completion guard)."
- "verify:phase-3a passes green: eslint, prettier --check, tsc --noEmit, wxt build, the full vitest suite (tests/core/ai/** incl. trajectory/** + OutcomeVerifier.test.ts, tests/components/**, tests/fixtures/**), and the content-bundle isolation check (R-3: no AI/vault tokens in the background/content bundles beyond the narrow allowed set)."
- "The R-3 isolation scan still passes: the rewire adds NO new imports to the background SW or content scripts (AI runtime stays in Side Panel/Standalone)."
- "Every new error code shipped in 3a (AGENT_STATE_INVALID, TOOL_POSTCONDITION_FAILED, COMPLETION_EVIDENCE_MISSING) is present in src/core/error/errorCodes.ts AND canonical in spec Appendix C.2 (GR-9) — the C.2 canonicalization was part of 03a-01; this plan re-verifies."
- "§18 'DONE when' for Phase 3a is satisfied: transitions, evidence, partial/cap behaviour, abort, and false-completion tests all pass (spec L2674)."
artifacts:
- package.json
- .planning/REQUIREMENTS.md
- .planning/ROADMAP.md
key_links:
- "verify:phase-3a mirrors verify:phase-3 (package.json L21) + the isolation check (tests/isolation/check-content-bundle.mjs)."
- "The AGT-02/AGT-05 re-map notes follow the AI-07 precedent (REQUIREMENTS.md, D-06 in Phase 3) — §18 remains authoritative over the REQUIREMENTS.md rows."
- "ROADMAP Phase 3a block (L175-189) carries the criterion list; the §18 master phase order (L418) is untouched."
flagged_assumptions:
- "AGT-01..05 [manual review — gate]: all six spec-less probe edges are surfaced across 03a-01..04 and proven by the shipped suites; this plan's verify:phase-3a run is the aggregate seal."
- "Open Q4 [research]: trajectory observability via the onTransition callback (03a-03) is final."
- "A5 [research]: the zod-3 API surface is used throughout (tsc --noEmit + vitest green prove it)."
- "P-5 [Phase-3 precedent]: verify:phase-3a runs the FULL suite — no exact test-count assertion (documentation subset markers only)."
prohibitions:
- "No verify:phase-3a without the isolation check (R-3 — the rewire must not leak AI/vault into background/content bundles)."
- "No new REQUIREMENTS.md AGT id (D-3a-02 — CheckpointRecorder folds into AGT-02; AGT-05 stays the requirement, re-mapped to Phase 8)."
- "No §18 master phase-order change (line 418 — canonical order untouched)."
- "No exact test-count assertions in the gate (P-5)."
- "No skip of eslint/prettier/tsc/wxt-build/vitest/isolation in the chain (§24 pattern)."

Purpose: A phase is not done until its gate passes (Golden Rule 10). This plan seals Phase 3a: the verify:phase-3a script is the §24 gate every executor task reports into; the REQUIREMENTS.md/ROADMAP.md updates record the scope reconciliation (D-3a-01/02) so the planning record matches what was built; the full-suite green run proves the rewire (03a-03) plus the migrations (03a-04) left zero regressions and the reliability machinery is isolated to the Side Panel/Standalone AI runtime (R-3).
Output: verify:phase-3a script, REQUIREMENTS.md/ROADMAP.md reconciliation notes, and a green full-suite gate seal — Phase 3a DONE per §18.
<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

### Tasks (ordered — do not reorder; each maps to a truth/artifact)
1. **Add the verify:phase-3a script.** Read package.json scripts (L14-23). Add `"verify:phase-3a": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs"`.
2. **Update .planning/REQUIREMENTS.md AGT rows (D-3a-01/02).** Read REQUIREMENTS.md AGT-01..05 rows (L50-54) + the AI-07 re-map precedent. Amend AGT-02's description to include 'CheckpointRecorder enables one-step rollback'; add the AGT-05 Phase-8 re-map note (commit-confirm barrier → Phase 8 TOL-03; 3a ships the waiting-for-permission state + pause seam); update the traceability row (L189) — AGT-01..05 → Phase 3a.
3. **Reduce ROADMAP Phase 3a criterion #5 (D-3a-01).** Read ROADMAP.md L175-189. Replace criterion #5 with 'evidence/false-completion tests pass' (commit-confirm UI defers to Phase 8). Leave the §18 master phase order (L418) untouched.
4. **Run verify:phase-3a.** Run `pnpm run verify:phase-3a`. Fix any lint/format/type/build/test/isolation failure surfaced by the rewire until the full chain is green.
5. **Re-verify the C.2 canonicalization + isolation scope.** Grep spec Appendix C.2 for the three 3a codes; grep the background/content bundles for R-3 AI/vault tokens (the isolation check already covers this — assert it passed in step 4); confirm no new imports leaked into background/content source.
6. **Seal the phase.** Confirm §18 'DONE when' (transitions, evidence, partial/cap, abort, false-completion tests) is covered by the green suite; summarize the pass in the plan's verify output.

**Decision-coverage citations (tasks above implement):** D-3a-02 — CheckpointRecorder is delivered as part of AGT-02 (rollback machinery); no new AGT id invented (REQUIREMENTS.md AGT-02 note reflects this).

### Edge Coverage Assumptions (specless probe fallback — 6 edges, ALL unresolved, surfaced not dropped)

This is the aggregate gate: the six unresolved probe items were surfaced and proven across 03a-01 (transition table + schemas), 03a-02 (evidence + partial-on-cap), 03a-03 (loop transitions/replan/pause/abort), and 03a-04 (hook mapping). This plan runs the full-suite proof. None were dropped.

### Artifacts This Phase Produces
- package.json: `verify:phase-3a` script.
- .planning/REQUIREMENTS.md: AGT-02/AGT-05 re-map notes (D-3a-01/02).
- .planning/ROADMAP.md: Phase 3a criterion #5 reduced to evidence/false-completion tests.
<threat_model>

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| verify:phase-3a gate → phase completion | The gate is the sole seal authority (Golden Rule 10); a green chain proves the rewire + migrations left no regression |
| REQUIREMENTS.md/ROADMAP.md → planning truth | The reconciliation notes make the record match the implementation (D-3a-01/02); §18 stays authoritative |

### STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-05-01 | Tampering | verify:phase-3a completeness | high | mitigate | Full §24 chain (eslint + prettier + tsc + wxt build + vitest + isolation check) — no skipped stages; no exact-count assertions (P-5) |
| T-03a-05-02 | Tampering | REQUIREMENTS/ROADMAP reconciliation | medium | mitigate | D-3a-01/02 notes recorded; §18 master phase order untouched; verify greps assert the notes exist |
| T-03a-05-03 | Information Disclosure | isolation check | high | mitigate | check-content-bundle.mjs proves no AI/vault tokens leaked into background/content bundles (R-3) |
</threat_model>
<success_criteria>
- `pnpm run verify:phase-3a` exits 0 (eslint + prettier + tsc + wxt build + vitest run + isolation check).
- REQUIREMENTS.md contains the AGT-02 CheckpointRecorder note + AGT-05 Phase-8 re-map note; ROADMAP criterion #5 reduced.
- §18 'DONE when' satisfied by the green suite (transitions, evidence, partial/cap, abort, false-completion tests).
- R-3 isolation intact: no AI/vault imports leaked into background/content bundles.
- Phase 3a sealed — Golden Rule 10 (every phase ends green).
</success_criteria>
