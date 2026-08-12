---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 09
type: execute
wave: 5
depends_on: ["04a-06", "04a-07"]
files_modified:
  - tests/isolation/no-content-script-ui.test.ts
  - tests/isolation/check-content-bundle.mjs
  - package.json
autonomous: true
requirements: [CAT-04, CAT-05, CAT-03]
must_haves:
  truths:
    - "`tests/isolation/no-content-script-ui.test.ts` (EXTENDED per D-4a-23 — the §18/§24-named canonical test) now carries the FULL isolation gate: forbidden-token scan over the built content bundles (FORBIDDEN_TOKENS extended with `turndown`, `minisearch`, `readability` — RESEARCH Pitfall 6: bundle stays dependency-free; `defuddle`/`yaml` already listed) AND the **< 50 KB assertion with the inline sourcemap STRIPPED** (RESEARCH Pitfall 3: wxt sets sourcemap:'inline' → a 21 KB payload reads 174 KB raw; the assertion strips the `//# sourceMappingURL=data:...` comment before measuring — payload < 50 KB, §22.1/ROADMAP criterion 3)."
    - "The `.mjs` helper (`tests/isolation/check-content-bundle.mjs`) is RETIRED per D-4a-23 — its walker + token-scan logic folds INTO the canonical vitest test (exact mechanics = agent discretion: inline the scan as a helper function inside the .ts test, or rename the helper — the canonical test file is the single enforcement point)."
    - "`verify:phase-1..4` package.json scripts drop their trailing `node tests/isolation/check-content-bundle.mjs` call (the retired helper) — the isolation gate now runs inside `vitest run` via the extended test; `verify:phase-4a` keeps the same chain shape (isolation included in vitest run)."
    - "The isolation test ALSO asserts the D-4a-20 password-omission INVARIANT at the schema level (P4a-4: the invariant test lives in tests/isolation/): `FormControlSchema.safeParse({isPassword:true, value:'x'}).success === false` and `safeParse({isPassword:true}).success === true` — the boundary gate never loosened."
    - "The content-bundle scan still passes with the Phase-1/2/3 token sets intact (antd/React/defuddle/yaml/idb/fflate/KeyVault/AI tokens + the new turndown/minisearch/readability) — CAT-04 (ISOLATED world, no UI code) + CAT-05 (< 50 KB, dependency-free bundle) proven."
  artifacts:
    - "tests/isolation/no-content-script-ui.test.ts"
    - "tests/isolation/check-content-bundle.mjs (deleted)"
    - "package.json"
  key_links:
    - "The < 50 KB assertion is ROADMAP criterion 3 / §22.1 — the payload measured is the sourcemap-stripped bundle (21 KB today + the new content-side code from 04a-06/07 must stay under 50 KB)."
    - "The scan covers .output/**/content-scripts/** + content-named chunks (existing isContentBundle logic) AND the background SW with the narrower R-3 token set (existing BACKGROUND_FORBIDDEN_TOKENS) — both carried into the new form."
    - "D-4a-23: the canonical filename is no-content-script-ui.test.ts — the `.mjs` name is retired; the §18/§24-named test is the single gate."
  flagged_assumptions:
    - "CAT-05 [unresolved — spec-less probe, unclassified]: 50 KB is the PAYLOAD cap (sourcemap-stripped) — RESEARCH Pitfall 3 measured 174 KB raw / 21 KB payload; the assertion documents the strip and pins < 50 KB on the payload."
    - "CAT-04 [unresolved — spec-less probe, unclassified]: 'MAIN world only for domain-specific globals' — 4a has NO domain-specific globals (ServiceNow globals are Phase 8); core.content.ts stays ISOLATED (already L18); the isolation scan + entrypoint grep prove no world change."
    - "D-4a-23 [discretion]: folding mechanics — inline the walker into the vitest test body (recommended — single enforcement point, no dual-maintenance); the exact rename-vs-inline choice is executor discretion per CONTEXT."
  prohibitions:
    - "No `//# sourceMappingURL` measurement — the size assertion MUST strip the inline sourcemap before measuring (Pitfall 3) or the gate fails on a clean bundle."
    - "No FORBIDDEN_TOKEN removal — the Phase-1/2/3 sets stay intact; turndown/minisearch/readability are ADDED (bundle must stay dependency-free)."
    - "No silent skip when no content bundle exists — the test must still run and, when the bundle exists, enforce tokens + size (meaningful enforcement per §24)."
    - "No new UI code in the bundle (CAT-04 — the scan proves it)."
    - "No change to the D-4a-20 refine — the invariant assertion is read-only against the verbatim schema from 04a-03."
---

<!-- 04a-09 (2026-08-12): Wave-5 isolation + hygiene. Extends the canonical
     no-content-script-ui.test.ts (D-4a-23): folds in the retired check-content-bundle.mjs
     walker, extends FORBIDDEN_TOKENS (turndown/minisearch/readability), adds the
     sourcemap-stripped < 50 KB payload assertion (Pitfall 3), adds the D-4a-20 password
     invariant at the schema level (P4a-4), and updates verify:phase-1..4 to drop the
     retired .mjs call. -->

<objective>
Extend the content-bundle isolation suite (D-4a-23): fold the retired `check-content-bundle.mjs` walker into the canonical `no-content-script-ui.test.ts`, extend FORBIDDEN_TOKENS (turndown/minisearch/readability), add the **sourcemap-stripped < 50 KB payload assertion** (RESEARCH Pitfall 3), add the D-4a-20 password-omission invariant at the schema level (P4a-4), and update the verify:phase-1..4 scripts to drop the retired `.mjs` call.

Purpose: CAT-04 (ISOLATED, no UI code) + CAT-05 (< 50 KB, dependency-free bundle) are PROVEN by this gate — the phase's only hard size/isolation proof. Retiring the `.mjs` name honors D-4a-23 (one canonical test file).

Output: the extended isolation test, the deleted `.mjs`, updated verify scripts.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md
@tests/isolation/no-content-script-ui.test.ts
@tests/isolation/check-content-bundle.mjs
@src/core/extraction/apcLite.types.ts
@package.json
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend no-content-script-ui.test.ts — tokens + size + password invariant (D-4a-23, Pitfall 3, P4a-4)</name>
  <files>tests/isolation/no-content-script-ui.test.ts, tests/isolation/check-content-bundle.mjs</files>
  <read_first>
    - tests/isolation/no-content-script-ui.test.ts (current thin wrapper L1-15)
    - tests/isolation/check-content-bundle.mjs (L27-168 — the walker + token sets to fold in; L36-62 FORBIDDEN_TOKENS, L72-85 BACKGROUND_FORBIDDEN_TOKENS, L87-123 walk/isContentBundle)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md Pitfall 3 (sourcemap strip) + Pitfall 6 (bundle growth via shared chunks)
    - src/core/extraction/apcLite.types.ts (FormControlSchema — the D-4a-20 invariant import)
  </read_first>
  <behavior>
    - Test 1 (tokens): after `wxt build`, every .output/**/content-scripts/** bundle (plus content-named chunks) contains NO forbidden token — the Phase-1/2/3 set PLUS turndown/minisearch/readability; the background SW still passes the narrower R-3 set.
    - Test 2 (size): the content bundle payload — with the `//# sourceMappingURL=data:...` comment stripped — is < 50 KB (RESEARCH Pitfall 3: raw file inflates ~8×; the assertion measures the payload).
    - Test 3 (password invariant, P4a-4): `FormControlSchema.safeParse({isPassword:true, value:'x'}).success === false` AND `safeParse({isPassword:true, value:undefined}).success === true` — the D-4a-20 refine holds at the schema boundary (D-4a-20 invariant test lives in tests/isolation/).
  </behavior>
  <action>
    Extend `tests/isolation/no-content-script-ui.test.ts` per D-4a-23: fold the `.mjs` walker in (inline the FORBIDDEN_TOKENS/BACKGROUND_FORBIDDEN_TOKENS arrays + the recursive walk + isContentBundle logic into the test file as local helpers, or rename the helper — the canonical .ts test is the single enforcement point). Extend FORBIDDEN_TOKENS with `turndown`, `minisearch`, `readability` (RESEARCH Pitfall 6 — new content-side code must stay dependency-free; do NOT remove existing tokens). Add the sourcemap-stripped < 50 KB payload assertion: strip `//# sourceMappingURL=data:...` (regex or indexOf) from each content bundle's text BEFORE measuring bytes — assert Buffer.byteLength(payload) < 50 * 1024 (Pitfall 3 — never measure the raw file). Add the D-4a-20 invariant tests (Test 3) importing FormControlSchema from '@/core/extraction/apcLite.types'.
    Then DELETE `tests/isolation/check-content-bundle.mjs` (the name is retired per D-4a-23) and update package.json verify:phase-1..4 to remove the trailing `&& node tests/isolation/check-content-bundle.mjs` (the isolation gate now runs inside `vitest run` via this test).
  </action>
  <acceptance_criteria>
    - All three behavior tests pass via `pnpm vitest run tests/isolation -x` (after `pnpm wxt build`).
    - FORBIDDEN_TOKENS contains turndown, minisearch, readability AND the original Phase-1/2/3 tokens.
    - The size assertion strips the sourcemap comment before measuring (grep the test for sourceMappingURL).
    - check-content-bundle.mjs no longer exists (git rm); no package.json script references it.
    - verify:phase-1..4 chains end at `vitest run` (isolation covered by the suite).
  </acceptance_criteria>
  <verify>
    <automated>pnpm wxt build && pnpm vitest run tests/isolation -x</automated>
  </verify>
  <done>Isolation suite green (tokens + stripped-size + password invariant); .mjs retired; verify scripts updated.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| built bundle → isolation scan | the compiled content bundle is the hard isolation boundary (R-3/R-5/R-9) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-06 | Tampering / Spoofing | bundle smuggling (React/AntD/defuddle/yaml/turndown/minisearch in content bundle) | high | mitigate | FORBIDDEN_TOKENS extended + scanned on every build; R-3/R-9 enforcement; the token test is part of verify:phase-4a (§24) |
| T-4a-26 | Tampering | size-gate evasion via inline sourcemap inflation | medium | mitigate | The < 50 KB assertion strips the `//# sourceMappingURL` comment before measuring (Pitfall 3) — a sourcemap-inflated 174 KB file must not pass as 'clean' |
| T-4a-01 | Information Disclosure | password invariant regression at the schema boundary | high | mitigate | The D-4a-20 refine assertion lives in the isolation suite (P4a-4) — a loosened refine fails the build gate |
</threat_model>

<verification>
- `pnpm wxt build && pnpm vitest run tests/isolation -x` green.
- grep: no remaining `check-content-bundle` reference in package.json or scripts.
- The size test strips sourceMappingURL (grep).
- FormControlSchema invariant tests pass.
</verification>

<success_criteria>
- The canonical isolation test enforces tokens (extended set) + payload size (< 50 KB, sourcemap-stripped) + the password invariant (D-4a-23/20, Pitfall 3, P4a-4).
- The `.mjs` name is retired; verify:phase-1..4 updated.
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-09-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- tests/isolation/no-content-script-ui.test.ts — extended: folded walker + extended FORBIDDEN_TOKENS (turndown/minisearch/readability) + sourcemap-stripped < 50 KB payload assertion + FormControlSchema password-invariant tests
- tests/isolation/check-content-bundle.mjs — DELETED (D-4a-23)
- package.json — verify:phase-1..4 trailing `.mjs` calls removed
