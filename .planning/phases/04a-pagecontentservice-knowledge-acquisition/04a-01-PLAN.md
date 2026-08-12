---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
autonomous: false
requirements: [CAT-01]
must_haves:
  truths:
    - "package.json gains `defuddle@^0.6.6`, `@mozilla/readability@^0.5.0`, `turndown@^7.2.4`, `minisearch@^7.2.0` under dependencies and `@types/turndown@^5.0.6` under devDependencies — the four spec-§7-approved-but-uninstalled libs (R-9) plus the turndown type declarations (RESEARCH: turndown 7 ships no bundled .d.ts — strict tsc fails without them)."
    - "`package.json` gains `verify:phase-4a` = the §24 chain: `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs` (mirrors verify:phase-1..4, L19-23 — five existing scripts incl. verify:phase-3a at L22) — the isolation step keeps the `.mjs` call until the 04a-09 isolation plan retires it from ALL SIX verify scripts incl. this one (D-4a-23)."
    - "The §24 chain is the SAME shape as verify:phase-4 (L23) — eslint, prettier --check, tsc --noEmit, wxt build, full vitest run, isolation check; no exact test-count assertions (P-5)."
    - "defuddle resolves to exactly 0.6.6 (spec ^0.6 pin — RESEARCH: latest is 0.19.2; the pinned version is the privacy-safe one with NO useAsync, zero network calls)."
  artifacts:
    - "package.json"
    - "pnpm-lock.yaml"
  key_links:
    - "defuddle@0.6.6's browser-bundle markdown no-op (RESEARCH finding) means the panel pipeline is DOMParser → defuddle core (clean HTML) → turndown (markdown) — the install task pins the versions that make the later strategy tasks deterministic."
    - "verify:phase-4a is the phase gate every later plan's final wave seals against (04a-10); the isolation step is meaningful only after the content-side plans add real bundle content."
  flagged_assumptions:
    - "A1 [research, ASSUMED]: turndown@7.2.4 API matches @types/turndown@5.0.6 types (TurndownService/options/addRule/keep/remove/use) — verified stable across v7 releases; the 04a-03 typecheck gate proves it."
    - "A5 [research, ASSUMED]: defuddle@0.6.6 site-specific extractors perform zero network calls (no useAsync at this version) — privacy-safe (R-10); any future upgrade MUST set useAsync:false (documented in DefuddleStrategy)."
    - "CAT-01 [unresolved — spec-less probe]: empty/single-element/null input → all strategies produce no usable content → extractLayered throws typed CONTENT_EXTRACT_FAILED with fallbacksTried (D-4a-19) — the service plan (04a-08) pins this with an empty-fixture test."
    - "CAT-01 [unresolved — spec-less probe]: length/equality semantics = JavaScript string length (UTF-16 code units) for PAGE_HTML_MAX_BYTES truncation; token counts via the canonical estimateTokens heuristic (CJK ratio) — no byte-level custom counting (04a-03/04a-08)."
  prohibitions:
    - "No version drift: install the pinned ranges exactly (`@^0.6`, `@^0.5`, `@^7`, `@^7`, `@types/turndown@^5`) — never latest (RESEARCH: defuddle latest 0.19.2 adds useAsync network behavior, breaking R-10)."
    - "No import of the new libs into content-side code — defuddle/readability/turndown/minisearch live panel-side only (R-3, Appendix G isolation — enforced by the 04a-09 isolation scan)."
    - "No package outside the approved stack §7 (R-9) and no `@types/turndown@^6`/`^7` — only ^5 exists (RESEARCH verified)."
    - "No modification of the existing verify:phase-1..4 keys in this plan — only the new verify:phase-4a key is added (the `.mjs` retirement in 04a-09 touches ALL SIX verify keys incl. this new one)."
---

<!-- 04a-01 (2026-08-12): Wave-1 foundation. The four spec-§7-approved-but-uninstalled
     libraries (defuddle/readability/turndown/minisearch — R-9, first phase to install
     them) with a blocking human-verify checkpoint for defuddle's [SUS] verdict, plus the
     verify:phase-4a gate script (§24 chain). The shared golden fixtures (D-4a-24) live in
     plan 04a-02 (this plan owns package.json exclusively — no Wave-1 file conflict).
     The assumption-delta decision (no-change — layered strategy is the locked primary
     model, D-4a-17) is recorded in 04a-04 where the strategy union is introduced. -->

<objective>
Install the four approved-but-uninstalled extraction libraries (defuddle, @mozilla/readability, turndown, minisearch — spec §7 / R-9) with the turndown type declarations, and add the `verify:phase-4a` script (§24 chain) to package.json.

Purpose: Phase 4a cannot build without these four libraries (the extraction pipeline is dependency-blocked on them), and every later plan seals against the verify:phase-4a gate.

Output: package.json + pnpm-lock.yaml with the pinned four libraries + @types/turndown + the verify:phase-4a script.
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
@tests/fixtures/index.ts
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Human verify — defuddle package legitimacy ([SUS] verdict)</name>
  <action>Hold the defuddle install until a human confirms the package is legitimate. Verify against the npm registry and the upstream repository, then gate-approve the install task (protocol: [SUS] verdicts are never auto-approvable — workflow.auto_advance is ignored for this checkpoint).</action>
  <what-built>Nothing yet — this gate precedes the install. The package-legitimacy seam flagged defuddle [SUS] (its latest publish 0.19.2, 2026-07-22, is too-new), but the project pins ^0.6 → 0.6.6 (published 2025-08-14, ~1 year old, 411 K/wk, kepano's repo — Obsidian Web Clipper engine, spec §7 pre-approves ^0.6). Research confirmed 0.6.6 is privacy-safe (no useAsync / zero network calls).</what-built>
  <how-to-verify>
    1. Open https://www.npmjs.com/package/defuddle and confirm: (a) the maintainer/author is kepano (Obsidian's Stephan Ango), (b) the latest version is NOT required — we install ^0.6 → 0.6.6, (c) there is no install/postinstall script of concern (research verified: clean).
    2. Open https://github.com/kepano/defuddle and confirm the repository matches the npm package (same name/author) and has material usage (Obsidian Web Clipper).
    3. Reply "approved" to proceed with Task 2, or describe concerns to pause the install.
  </how-to-verify>
  <resume-signal>Type "approved" to install, or describe what looks wrong.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Install the four approved extraction libraries + @types/turndown</name>
  <files>package.json, pnpm-lock.yaml</files>
  <read_first>
    - package.json (current dependencies — the four libs are absent; zod/dompurify already present)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md (Standard Stack + Package Legitimacy Audit rows)
  </read_first>
  <action>
    Run exactly (R-9 approved stack, spec §7 pins): `pnpm add defuddle@^0.6 @mozilla/readability@^0.5 turndown@^7 minisearch@^7` then `pnpm add -D @types/turndown@^5`.

    After install, verify resolution with `pnpm why defuddle` / `node -p "require('defuddle/package.json').version"` — assert defuddle resolves to 0.6.6 (NOT 0.19.2 — RESEARCH: newer versions add useAsync network behavior that breaks R-10 privacy), readability 0.5.0, turndown 7.2.4, minisearch 7.2.0, @types/turndown 5.x.

    Do NOT import any of them yet — this plan only installs. Do NOT touch wxt.config.ts (manualChunks already lists defuddle/yaml for HTML groups; content-bundle isolation is enforced by the import restriction + the 04a-09 scan, per the Phase-1 deviation note). Do NOT run a full build here.
  </action>
  <acceptance_criteria>
    - `pnpm why defuddle` reports defuddle@0.6.6 (exactly, not 0.19.2) under dependencies.
    - package.json lists: dependencies += { defuddle: ^0.6, @mozilla/readability: ^0.5, turndown: ^7, minisearch: ^7 }, devDependencies += { @types/turndown: ^5 }.
    - `pnpm ls @mozilla/readability turndown minisearch @types/turndown` lists all four with the expected majors.
    - pnpm-lock.yaml is updated and committed with package.json.
  </acceptance_criteria>
  <verify>
    <automated>node -p "require('defuddle/package.json').version" | grep -x "0.6.6"</automated>
  </verify>
  <done>All four libraries + @types/turndown installed at the pinned majors; defuddle verified at exactly 0.6.6; package.json + pnpm-lock.yaml committed.</done>
</task>

<task type="auto">
  <name>Task 3: Add verify:phase-4a script (§24 chain)</name>
  <files>package.json</files>
  <read_first>
    - package.json scripts block (verify:phase-1..4 at L19-23 — the five §24-chain scripts to mirror)
  </read_first>
  <action>
    Add to package.json scripts: `"verify:phase-4a": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs"` — byte-identical chain shape to verify:phase-4 (L23). Do NOT add test-count assertions. Do NOT modify the existing verify:phase-1..4 keys (the `.mjs` retirement in 04a-09 will adjust all six verify keys incl. this one).
  </action>
  <acceptance_criteria>
    - `node -e "const p=require('./package.json'); console.log(p.scripts['verify:phase-4a'])"` prints the full §24 chain including `eslint .`, `prettier --check .`, `tsc --noEmit`, `wxt build`, `vitest run`, and `node tests/isolation/check-content-bundle.mjs`.
    - verify:phase-1..4 keys unchanged.
  </acceptance_criteria>
  <verify>
    <automated>node -e "const p=require('./package.json'); const s=p.scripts['verify:phase-4a']; if(!s||!s.includes('wxt build')||!s.includes('check-content-bundle.mjs')) process.exit(1)"</automated>
  </verify>
  <done>verify:phase-4a added mirroring the §24 chain; existing verify scripts untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → node_modules | untrusted third-party code crosses here at install time |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-SC | Tampering | npm/pip installs (defuddle) | high | mitigate | Blocking human checkpoint (Task 1) verified defuddle@0.6.6 legitimacy before install — spec §7 pre-approves ^0.6; research verified no postinstall script, kepano repo, 411 K/wk; the pinned 0.6.6 (not 0.19.2) is privacy-safe (no useAsync network calls, R-10) |
| T-4a-05 | Information Disclosure | defuddle@0.6.6 extraction engine | high | mitigate | At the pinned version defuddle performs zero network calls (no useAsync — verified in dist source); any future upgrade MUST set `useAsync: false` (A5) — documented in the DefuddleStrategy task (04a-04) |
| T-4a-06 | Tampering / Spoofing | content-bundle smuggling via new deps | high | mitigate | New libs are panel-side only (R-3); the 04a-09 isolation scan extends FORBIDDEN_TOKENS (turndown/minisearch/readability) + keeps the < 50 KB sourcemap-stripped assertion (Pitfall 3) |
</threat_model>

<verification>
- `pnpm ls defuddle @mozilla/readability turndown minisearch @types/turndown` shows the four pinned majors + the type declarations.
- `node -p "require('defuddle/package.json').version"` == 0.6.6 exactly.
- `pnpm vitest run tests/fixtures -x` green — fixture determinism smoke; **owned by 04a-02** (the same-wave fixture plan), listed here as the shared-fixture dependency note, not a 04a-01 gate.
</verification>

<success_criteria>
- The four approved libraries are installed at the spec-pinned majors (R-9); defuddle is verified at exactly 0.6.6 (privacy-safe).
- tests/fixtures/pageContent.ts provides the D-4a-24 shared golden fixtures with deterministic builders — **owned by 04a-02** (same-wave); listed here for the phase view, not produced here.
- The checkpoint gate ran before the install (blocking, not auto-approvable — workflow.auto_advance ignored per protocol).
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-01-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- package.json deps: `defuddle@^0.6`, `@mozilla/readability@^0.5`, `turndown@^7`, `minisearch@^7`
- package.json devDeps: `@types/turndown@^5`
- pnpm-lock.yaml (updated)
- tests/fixtures/pageContent.ts — `buildArticleFixture`, `buildBoilerplateFixture`, `buildNoHeadingFixture`, `buildLargeArticleFixture`, `buildRawNodeFixture` + fixed constants (FIXED_URL, FIXED_TITLE, FIXED_TIMESTAMP) — **owned by 04a-02** (same-wave plan; this plan owns package.json only)
- tests/fixtures/fixtures.test.ts (extended — pageContent determinism smoke block) — **owned by 04a-02**
