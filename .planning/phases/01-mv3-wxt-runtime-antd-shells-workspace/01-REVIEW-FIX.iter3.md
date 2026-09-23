---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
fixed_at: 2026-09-22T12:48:16Z
review_path: .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-22T12:48:16Z
**Source review:** `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-REVIEW.md` (re-review after the iteration-1 fix pass)
**Iteration:** 2

**Summary:**

- Findings in scope: 2 (0 critical + 2 warnings; `fix_scope: critical_warning`)
- Fixed: 2
- Skipped: 0
- Both fixes are committed atomically as `fix(01): …` on `aurora`; no source file is left modified or uncommitted.
- The five carried-over Info items (`IN-01`…`IN-05`) remain out of scope for `fix_scope: critical_warning` and are unchanged.
- No gate was weakened: `NP_STRICT_CEILING` is still `0`, no test path was narrowed or deleted, no isolation / ceiling / banned-import / generated-manifest / credential-cleanup case was relaxed, and no security assertion was softened. No dependency was added.

## Fixed Issues

### WR-08: The rebuilt no-tailwind gate still reports a false pass for common Tailwind utility families

**Files modified:** `scripts/verify-no-tailwind.sh`, `tests/isolation/no-tailwind-gate.test.ts`
**Commit:** 4408ce37, 22b71a6f (header alignment, documentation only)
**Status:** fixed
**Applied fix:** the instrument was widened, not worked around, and no real utility string was deleted to make it pass. The vocabulary now has two tiers. **Tier 1** keeps the value scan (every `'…'`, `"…"` and `` `…` `` literal in `src/**/*.{ts,tsx}`) and gains the families the re-review named as missing: `items-*`, `justify-*`, `content-*`, `self-*`, `place-*`, `grid-cols-*`, `grid-rows-*`, `col-span-*`, `row-span-*`, `overflow-*`, `overscroll-*`, `object-*`, `float-*`, `clear-*`, `grow-*`, `shrink-*`, `break-*`, `min-w-*`, `max-w-*`, `min-h-*`, `max-h-*`, `size-*`, `basis-*`, `inset-*`, `top/right/bottom/left-*`, `gap-x/y-*`, `aspect-*`, `duration-*`, `delay-*`, `whitespace-*`, `leading-*`, `tracking-*`, `list-*`, `align-*`, `cursor-*`, `select-*`, `pointer-events-*`, `touch-*`, `snap-*`, `resize-*`, `appearance-*`, `will-change-*`, `transition-*`, `animate-*`, `ease-*`, `blur/brightness/contrast/drop-shadow/grayscale/hue-rotate/invert/saturate/sepia/origin/perspective-*`, `scale/rotate/skew/translate-*`, `truncate`, `sr-only`, `not-sr-only`, `antialiased`, `no-underline`, `normal-case`, plus the extra variant prefixes (`first:`, `last:`, `odd:`, `even:`, `disabled:`, `checked:`, `focus-within:`, `focus-visible:`). **Tier 2** adds the bare keywords that are also ordinary CSS values, domain words or component props (`flex`, `grid`, `block`, `hidden`, `absolute`, `relative`, `fixed`, `sticky`, `inline*`, `contents`, `visible`, `invisible`, `italic`, `underline`, `uppercase`, `lowercase`, `capitalize`, `transition`, `shadow`, `ring`, `border`, `isolate`) and exempts them **per occurrence** in their non-class contexts — a CSS-property or prop value (`display: 'flex'`, `overflow: 'hidden'`, `variant="block"`, `variant = 'inline'`), a comparison operand (`gate === 'hidden'`), and a union/ternary alternative (`'a' | 'hidden'`, `cond ? 'a' : 'hidden'`). The exemption runs on `grep -o` matches (whose text carries the context the match was found in) and the literal body may only contain class-name characters, so `{ display: 'flex', x: 'hidden' }` still reports the `'hidden'` and `'var(--card)', border: '1px …'` cannot be mistaken for a literal. Two boundaries are documented in the script header: `table` is deliberately absent from the bare vocabulary (an ordinary English word that occurs in fixture prose) and Tier 2 scans quoted literals only (JSDoc prose quotes identifiers in backticks).
**Verified against the pre-fix source:** the exact WR-08 probe fixture (`const a = 'flex items-center justify-between'`, `'hidden'`, `'absolute inset-0'`, `'grid grid-cols-3'`, `'truncate whitespace-nowrap'`, `'leading-tight tracking-wide'`) reported `✓ 0 Tailwind utility strings … EXIT=0` before and now reports `EXIT=1` with all six strings — five through Tier 1 and `'hidden'` through Tier 2. `src` is unchanged and still clean (`EXIT=0`) across its 500+ lone-keyword occurrences, so the widened vocabulary adds no false positive on legitimate CSS values, AntD tokens, component props or domain comparisons. The self-test grew from 4 to 31 cases: each probed string alone in its own fixture, each Tier-1 family pinned by a **keyword-free** string (`items-center justify-between`, `grid-cols-3 col-span-2`, `min-w-0 max-w-md`, `overflow-hidden`, `whitespace-nowrap`, `truncate sr-only`, `cursor-pointer select-none`, `transition-colors duration-150 ease-in-out`, `animate-spin`, `pointer-events-none`, `rounded-lg font-semibold`, `p-4 gap-2`, `text-emerald-500`, `hover:bg-gray-100`, `aspect-square`), the class-attribute / class-attribute-expression / data-object / double-quoted leak shapes, and a pass case for every non-class context. Both halves of the instrument are load-bearing under mutation: removing `LAYOUT_FAMILY` from the vocabulary fails 3 cases, and removing `hidden` from the bare vocabulary fails 5.

### WR-09: The handoff draft slot is never cleared, so a consumed draft is re-applied on every remount

**Files modified:** `src/core/workspace/handoff/composerDraft.ts`, `src/components/standalone/StandaloneWritePage.tsx`, `tests/components/pages/write-page.test.tsx`
**Commit:** f620285d
**Status:** fixed: requires human verification
**Applied fix:** consume-and-clear semantics live at the shared choke point. The slot store gains `consumeDraft()` — it reads the pending value and clears the slot in the same step — so a draft that has already reached a composer cannot be applied again by a later mount. `StandaloneWritePage` consumes at its single choke point: the mount seed still reads the slot for the first paint and the existing effect now calls `consumeDraft()`, which covers both the draft that is already present at mount and the one that arrives afterwards (the reviewer's suggested shape, with the clear owned by the store instead of the page). A handoff with no draft still leaves the composer's own content untouched, and the stale "the Phase-1 Side Panel has no composer to type into" claim was corrected in both `composerDraft.ts` and the page (`SidePanelShell` has a live composer and WR-07 wired it). The `afterEach` slot reset in the write-page suite is **removed**, so the suite now fails if any case leaves a draft behind — the invariant is the test, not the hygiene — and a new regression case drives the **real** route round trip: render `StandaloneShell`, set the draft while the Chat route is showing, click the Sider `Write` item (the draft appears), edit the composer, click `Chat`, click `Write` again, and assert the composer shows its own fixture default rather than the handoff draft.
**Verified against the pre-fix source:** with the `consumeDraft()` call removed the suite fails 4 cases — including `does not resurrect a consumed draft across a real Sider route round trip` and the "handoff carried no draft" case, which fails precisely because the draft leaked out of the previous case (the failure the removed `afterEach` used to hide). With the fix, all 12 cases pass and the slot is asserted empty immediately after the composer takes the value.
**Why human verification:** the fix is state-handling logic, so the jsdom round trip through the real shell proves the lifecycle but not the browser: the acceptance re-observation below must now also confirm the draft does **not** resurface on a later route re-entry.

## Manual re-observation required (acceptance record)

The re-review's record-level note is carried forward with the WR-09 addendum. **Do not treat the existing row as evidence until re-observed:**

1. `01-VALIDATION.md:112` — the Standalone-handoff row states *"The composer draft typed in the panel arrived in Standalone"*. Note the shipped sequence: `src/entrypoints/sidepanel/main.tsx:77` calls `openStandalone(workspaceId, conversationId, undefined, …)` with no `page`, so the target lands on the Chat route and the draft becomes visible when the user opens the Write route (it is seeded at mount). Re-observe in real Chrome with that sequence, and — after WR-09 — additionally switch to another Sider route and back to Write and confirm the handoff draft does **not** reappear (the composer shows its own default).
2. The Windows/Linux control-chord gap (`01-VALIDATION.md:122`) is unchanged and remains correctly recorded as an environment-scoped open gap.

## Verification

Verification ran in the **main checkout** (the orchestrator's sequential main-tree execution mode; no isolated worktree was created), on the committed tree, in this order:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (after each fix and at the end) |
| `npm test` (`npx vitest run`) | 41 files / **560 tests** passed (iteration-1 baseline: 41 files / 532 tests) |
| `pnpm run verify:phase-1` | exit 0 — declared-path preflight, `tsc`, the full phase test set, and `bash scripts/verify-no-tailwind.sh` (`✓ 0 Tailwind utility strings in src`) |
| `NP_STRICT_CEILING` | still `0` (`package.json`) — no `@ts-expect-error NP-STRICT-*` marker was added |
| Working tree | only the review artifacts are untracked/modified; no source file is left uncommitted |

Per-fix evidence (beyond the always-required re-read):

- **WR-08** — probe fixture exits 1 with all six probed strings; `src` exits 0; the self-test's 31 cases pass; mutation checks fail 3 cases (drop `LAYOUT_FAMILY`) and 5 cases (drop bare `hidden`).
- **WR-09** — mutation check fails 4 cases (drop `consumeDraft()`), including the shell-driven route round trip; the removed `afterEach` reset is what makes the leak observable as a failure.

Test additions (all inside the phase's declared test paths, none weakening an existing case):

- `tests/isolation/no-tailwind-gate.test.ts` — 15 → 31 cases (WR-08 family coverage)
- `tests/components/pages/write-page.test.tsx` — 11 → 12 cases (WR-09 route round trip); the suite's `afterEach` slot reset was deleted, not replaced

---

_Fixed: 2026-09-22T12:48:16Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
