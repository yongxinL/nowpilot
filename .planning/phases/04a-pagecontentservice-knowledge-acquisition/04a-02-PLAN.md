---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/error/errorCodes.ts
  - .planning/PRODUCT_SPEC_v0_1.md
  - tests/fixtures/pageContent.ts
  - tests/fixtures/fixtures.test.ts
autonomous: true
requirements: [CAT-03, CAT-01]
must_haves:
  truths:
    - "`src/core/error/errorCodes.ts` exports `CONTENT_EXTRACT_FAILED: 'CONTENT_EXTRACT_FAILED'` (D-4a-22 W-1 gate) — the canonical §16/§20.7 code (spec line ~3270/3510) — REPLACING the stale `CONTENT_EXTRACT` key in place (grep-verified: errorCodes.ts L15 is the only source reference; no src/ or tests/ consumer breaks)."
    - "PRODUCT_SPEC Appendix C.2 Phase-1 block (line ~5108) is reconciled in place: `CONTENT_EXTRACT` → `CONTENT_EXTRACT_FAILED` (W-1 gate — spec + source agree, GR-9). `CONTENT_EXTRACT_FAILED` stays canonical at spec line 3510; the non-canonical O.12 `EXTRACTION_FAILED` is NEVER added (D-4a-22)."
    - "`tests/fixtures/pageContent.ts` (NEW, D-4a-24) exports the shared golden HTML fixture set — one module consumed by DefuddleStrategy / ApcLiteStrategy / PageIndexBuilder tests (never duplicated per test): a realistic article page (headings + paragraphs + links + images + a form with a password input), a boilerplate-heavy nav+footer page (below the D-4a-18 threshold → triggers the Readability fallback), a no-heading paragraph page (paragraph-chunk fallback for PageIndexBuilder), a large multi-section article (over INDEX_CHUNK_MAX_TOKENS per section → sub-chunking), and a typed RawNode tree fixture for ApcLiteStrategy."
    - "Fixture determinism (tests/fixtures/index.ts D-20/D-21 precedent): fixed URLs/titles/timestamps only — no Date.now, no crypto, no randomness; typed builder functions with overrides (`buildArticleFixture(overrides?)` style)."
  artifacts:
    - "src/core/error/errorCodes.ts"
    - ".planning/PRODUCT_SPEC_v0_1.md"
    - "tests/fixtures/pageContent.ts"
    - "tests/fixtures/fixtures.test.ts"
  key_links:
    - "Every 4a catch/debugLog uses ERROR_CODES.CONTENT_EXTRACT_FAILED (GR-9) — the reconciliation lands BEFORE the strategies/service plans so they code against the canonical key from day one."
    - "The fixture HTML shapes are the regression contract every extraction test asserts against (D-4a-24 shared-guard) — strategies/index tests import from the fixtures module, never re-declare HTML."
  flagged_assumptions:
    - "CAT-03 [unresolved — spec-less probe, unclassified]: the reconciliation is the D-4a-22 disposition — CONTENT_EXTRACT_FAILED is the single canonical code; `TIMEOUT` is already a registered key (errorCodes.ts L80) and is not re-added, while `UNSUPPORTED_URL` is §20.7 TabExtractionState state-code vocabulary (spec L3262-3270), NOT an errorCodes.ts registry key."
    - "W-1 mechanics: the spec C.2 Phase-1 block edit is a scoped, line-anchored replace (Phase-1/03-01 precedent) — the 'CONTENT_EXTRACT' literal at spec L5108 is replaced; the canonical L3510 entry is untouched."
  prohibitions:
    - "No new error code invented for extraction beyond CONTENT_EXTRACT_FAILED (D-4a-22 — O.12's EXTRACTION_FAILED is non-canonical and must never appear)."
    - "No exact test-count assertions (P-5) and no package.json edits in this plan — the verify:phase-4a script lives in 04a-01 (this plan owns no package.json touch; no Wave-1 file conflict)."
    - "No bundling of the errorCode rename with unrelated edits — this plan is the reconcile + fixtures plan (CONTENT_EXTRACT_FAILED is used by every later plan's debugLog)."
---

<!-- 04a-02 (2026-08-12): Wave-1 canonical-code reconciliation + shared golden fixtures.
     The D-4a-22 W-1 gate renames CONTENT_EXTRACT → CONTENT_EXTRACT_FAILED in errorCodes.ts
     AND the spec C.2 Phase-1 block in one atomic commit, and the D-4a-24 shared fixture
     module is created here (package.json ownership is exclusively 04a-01's — no conflict).
     Both land before the strategies/service plans so every new debugLog call sites the
     canonical key (GR-9) and every test asserts the shared fixtures. -->

<objective>
Reconcile the extraction error code to its canonical form (D-4a-22 W-1 gate): rename `CONTENT_EXTRACT` → `CONTENT_EXTRACT_FAILED` in src/core/error/errorCodes.ts and the spec Appendix C.2 Phase-1 mirror, and create the shared golden HTML fixtures (D-4a-24) that DefuddleStrategy / ApcLiteStrategy / PageIndexBuilder tests all consume.

Purpose: Golden Rule 9 (every catch uses a canonical §C.2 code) requires the canonical `CONTENT_EXTRACT_FAILED` (§16/§20.7) to exist BEFORE any 4a strategy/service code logs it. The W-1 gate keeps spec + source single-sourced. Every extraction test asserts against the same golden fixture module — a single shared regression guard (D-4a-24).

Output: canonical code in errorCodes.ts + spec C.2, and tests/fixtures/pageContent.ts.
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
@src/core/error/errorCodes.ts
@src/core/error/debugLog.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reconcile CONTENT_EXTRACT → CONTENT_EXTRACT_FAILED (D-4a-22 W-1 gate)</name>
  <files>src/core/error/errorCodes.ts, .planning/PRODUCT_SPEC_v0_1.md</files>
  <read_first>
    - src/core/error/errorCodes.ts (L15 `CONTENT_EXTRACT: 'CONTENT_EXTRACT'` — the only source reference, grep-verified)
    - .planning/PRODUCT_SPEC_v0_1.md Appendix C.2 Phase-1 block (line ~5108 `CONTENT_EXTRACT`) + line ~3510 (canonical `CONTENT_EXTRACT_FAILED` already present in the runtime/context block)
  </read_first>
  <action>
    In `src/core/error/errorCodes.ts` replace the `CONTENT_EXTRACT: 'CONTENT_EXTRACT',` line with `CONTENT_EXTRACT_FAILED: 'CONTENT_EXTRACT_FAILED',` in place (keep alphabetical/group position within the Runtime/messaging block; update the group header comment to note the 4a W-1 reconciliation per the Phase-3/Phase-4 header-comment convention). Keep `CONTENT_CAPABILITIES` untouched.

    In `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.2 Phase-1 block (line ~5108) replace the bare `CONTENT_EXTRACT` code line with `CONTENT_EXTRACT_FAILED` (scoped Edit — do NOT rewrite the whole C.2 block; the canonical entry at line ~3510 is untouched).

    Then grep the whole repo (src/, tests/, scripts/, package.json) for any remaining `ERROR_CODES.CONTENT_EXTRACT` (non-FAILED) references — assert zero (the D-4a-22 rename is atomic; grep confirmed errorCodes.ts L15 was the only one, but re-verify after the edit).
  </action>
  <acceptance_criteria>
    - `grep -rn "CONTENT_EXTRACT_FAILED" src/core/error/errorCodes.ts` matches the new key.
    - `grep -c "CONTENT_EXTRACT'" src/ tests/ 2>/dev/null` returns 0 (no stale non-FAILED key references anywhere).
    - `.planning/PRODUCT_SPEC_v0_1.md` C.2 Phase-1 block contains `CONTENT_EXTRACT_FAILED` (line ~5108) and the canonical L3510 entry is unchanged.
    - `pnpm tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>grep -c "CONTENT_EXTRACT:" src/core/error/errorCodes.ts; pnpm tsc --noEmit</automated>
  </verify>
  <done>errorCodes.ts + spec C.2 both carry CONTENT_EXTRACT_FAILED; zero stale CONTENT_EXTRACT references; tsc green.</done>
</task>

<task type="auto">
  <name>Task 2: Shared golden HTML fixtures (D-4a-24)</name>
  <files>tests/fixtures/pageContent.ts, tests/fixtures/fixtures.test.ts</files>
  <read_first>
    - tests/fixtures/index.ts (D-20/D-21 determinism convention: fixed constants, typed builders with overrides, no Date.now/crypto/randomness; direction rule — fixtures live under tests/ only, never imported from src/)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md (Pattern 5 — the PageChunk doc shape the index fixtures must support)
    - tests/fixtures/fixtures.test.ts (the determinism smoke test block convention to extend)
  </read_first>
  <action>
    Create `tests/fixtures/pageContent.ts` exporting a typed, deterministic golden-HTML fixture module (D-4a-24) with builders following the index.ts convention (exported consts for FIXED_URL/FIXED_TITLE/FIXED_TIMESTAMP + builder functions with optional overrides). Content:

    1. `buildArticleFixture(overrides?)` — a realistic article page: `<title>`, h1 + h2/h3 sections with paragraphs, `<a href>` links (some relative, some absolute), an `<img>`, a `<ul>`, and a `<form>` containing one `<input type="password">` and one `<input type="text">`. This is the Defuddle-success + password-omission + base-URL-stamp fixture.
    2. `buildBoilerplateFixture(overrides?)` — a nav-bar + footer + minimal-main page whose extracted-text char count is below the D-4a-18 floor and whose density ratio fails — the Readability-fallback fixture.
    3. `buildNoHeadingFixture(overrides?)` — paragraph blocks (blank-line separated) with no h1-h6 anywhere — the PageIndexBuilder paragraph-chunk fallback fixture.
    4. `buildLargeArticleFixture(overrides?)` — multiple long sections each exceeding the ~500-token INDEX_CHUNK_MAX_TOKENS budget — the sub-chunking fixture.
    5. `buildRawNodeFixture(overrides?)` — a typed RawNode tree (roles, text, interaction flags, a form control with `isPassword: true` and NO value field, children) — the ApcLiteStrategy input fixture.

    Header comment: `// tests/fixtures/pageContent.ts — shared golden HTML fixtures (D-4a-24): one module consumed by DefuddleStrategy / ApcLiteStrategy / PageIndexBuilder tests — the shared extraction regression guard.` Use fixed constants only. Do NOT import from src/ (D-21 direction rule) — type-only imports are the sole exception.

    Extend `tests/fixtures/fixtures.test.ts` with a pageContent determinism smoke block: two calls with identical args deep-equal; the password fixture shape carries `isPassword: true` and no `value` key.
  </action>
  <acceptance_criteria>
    - File exists at tests/fixtures/pageContent.ts with all five builders exported.
    - The password input in buildArticleFixture has `type="password"` and the buildRawNodeFixture control object has `isPassword: true` and NO `value` key (the D-4a-20 invariant fixture shape).
    - Every builder is deterministic: two calls with identical args deep-equal (fixtures.test.ts smoke block).
    - `pnpm vitest run tests/fixtures -x` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/fixtures -x</automated>
  </verify>
  <done>tests/fixtures/pageContent.ts exists with five deterministic builders; fixtures.test.ts smoke block green; no src/ imports (type-only excepted).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| codebase ↔ spec | canonical error-code registry must stay single-sourced (W-1 gate) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-07 | Spoofing | error-code registry drift (stale CONTENT_EXTRACT vs canonical CONTENT_EXTRACT_FAILED) | medium | mitigate | W-1 gate: source + spec C.2 reconciled in one atomic commit; grep asserts zero stale references; the 04a-10 gate re-runs the scoped-regex verify |
| T-4a-08 | Tampering | verify:phase-4a chain weakened (isolation step dropped) | medium | mitigate | verify:phase-4a is created in 04a-01 mirroring verify:phase-4 byte-for-byte incl. the isolation check; 04a-09/04a-10 keep the isolation step alive after the `.mjs` retirement |
| T-4a-29 | Tampering | fixture HTML diverging from the D-4a-24 shared guard (per-test duplication) | medium | mitigate | All fixture HTML lives in ONE module with a determinism smoke block; strategies/index tests import it, never re-declare (D-4a-24) |
</threat_model>

<verification>
- tsc --noEmit green (rename did not break consumers).
- grep: zero `CONTENT_EXTRACT:` (non-FAILED) references in src/ and tests/.
- Spec C.2 Phase-1 block contains CONTENT_EXTRACT_FAILED; L3510 canonical entry unchanged.
- `pnpm vitest run tests/fixtures -x` green (pageContent determinism smoke).
</verification>

<success_criteria>
- `ERROR_CODES.CONTENT_EXTRACT_FAILED` is the single canonical extraction code in both source and spec (D-4a-22).
- tests/fixtures/pageContent.ts provides the D-4a-24 shared golden fixtures with deterministic builders.
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-02-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- src/core/error/errorCodes.ts — key `CONTENT_EXTRACT_FAILED: 'CONTENT_EXTRACT_FAILED'` (replaces `CONTENT_EXTRACT`)
- .planning/PRODUCT_SPEC_v0_1.md — Appendix C.2 Phase-1 block reconciled (W-1)
- tests/fixtures/pageContent.ts — `buildArticleFixture`, `buildBoilerplateFixture`, `buildNoHeadingFixture`, `buildLargeArticleFixture`, `buildRawNodeFixture` + fixed constants (FIXED_URL, FIXED_TITLE, FIXED_TIMESTAMP)
- tests/fixtures/fixtures.test.ts — extended pageContent determinism smoke block
