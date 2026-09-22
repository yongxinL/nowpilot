---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
fixed_at: 2026-09-22T21:31:54Z
review_path: .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-REVIEW.md
iteration: 3
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-22T21:31:54Z
**Source review:** `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-REVIEW.md` (final re-review, iteration 3)
**Iteration:** 3

**Summary:** three fix passes in this review cycle — iteration 1 (`CR-01`…`CR-03`, `WR-01`…`WR-07`), iteration 2 (`WR-08`, `WR-09`), iteration 3 (`WR-10`). 13 findings in total, all fixed, none skipped; the frontmatter's `findings_in_scope: 3` / `fixed: 3` count the three passes, per the iteration-3 contract. The five carried-over Info items (`IN-01`…`IN-05`) stay out of scope for `fix_scope: critical_warning`. No gate was weakened: no test path narrowed or deleted, no assertion relaxed, `NP_STRICT_CEILING` still `0`, no dependency added.

## Iteration 3 — fixed

### WR-10: A class list made only of Tier-2 bare keywords is invisible inside a ternary (or a backtick literal)

**Files modified:** `scripts/verify-no-tailwind.sh`, `tests/isolation/no-tailwind-gate.test.ts`
**Commit:** `3ef63cc6`
**Status:** fixed
**Applied fix:** the class-toggle idiom is now read as a pair instead of being exempted branch-by-branch. A new `CLASS_TOGGLE` scan reports a same-line `?`/`:` pair whose branches are both class-like — a keyword literal (a quoted or backticked literal holding a bare keyword as a whitespace-separated token) or the empty literal, at least one of them a keyword — unless the line names a value context (`VALUE_CONTEXT` + `[=:]`, which keeps `visibility: isHovered ? 'visible' : 'hidden'` and `data-x={variant === 'block' ? 'inline' : 'block'}` quiet) or is a comment line. Tier 2 now also reads backtick literals; comment lines (`*`, `//`, `/*` at the start of the trimmed line) are exempt, because JSDoc prose quotes words in backticks (`DeferredNotice.tsx:56-57`) and no code line begins with a comment marker. The header contract now states the exemption's real limits: only the same-line pair is read (a ternary split across lines stays exempt), and a value-context *name* anywhere on the line quiets the pair. The per-occurrence guarantee is untouched: `{ display: 'flex', x: 'hidden', y: 'absolute' }` still reports `'hidden'` and `'absolute'` while dropping only `'flex'`.
**Verified against the pre-fix source:** the review's exact probe fixture (`done ? 'line-through' : ''`, `done ? 'hidden' : ''`, `className={active ? 'flex' : 'hidden'}`) reported `✓ 0 Tailwind utility strings … EXIT=0` before and now reports `EXIT=1` with all three lines; `` className={`hidden`} `` moved `EXIT=0` → `EXIT=1`; `cond ? 'np-thing hidden' : ''` moved `EXIT=0` → `EXIT=1`; the swapped shape `cond ? '' : 'hidden'` is reported too. `src` is still clean (`EXIT=0`). The self-test grew 31 → 40 cases (the three probed shapes, the swapped/class-list variants, the backtick shape, the mixed-object per-occurrence case, a pass case for the value contexts, and a pin for the header's same-line limit). Mutation checks: disabling the pair scan fails 5 cases; removing the backtick alternatives fails 1; removing the value-context line exemption fails 2. `src` had exactly two live pair matches (`PromptsOptionsTab.tsx:466,691`), both exempt by their `visibility:` property — no real utility string was deleted or allow-listed to make the gate pass.

## Iterations 1–2 — fixed (re-verified by the iteration-3 review)

| Finding | Fix | Commit |
|---|---|---|
| `CR-01` prototype-chain `type` in envelope validation | own-property `hasOwn` checks + total `schemaForType` + `isKnownEnvelopeType` gate | iteration 1 |
| `CR-02` `_sender` transport metadata broke handoffs | echo check first, `withoutTransportMetadata` strips before listeners | iteration 1 |
| `CR-03` Notes crashed on the last delete | nullable selection, guarded menu handler, explicit empty state | iteration 1 |
| `WR-01` gate blind to `className={variable}` | value scan on every quoted literal; the three live leaks removed | iteration 1 |
| `WR-02` malformed `np_store` blob | collections/`activeSessionId` normalised, `providers` falls back, `onRehydrateStorage` reports | iteration 1 |
| `WR-03` `themeMigrate` cast | `isThemeMode` / `typeof string` narrowing | iteration 1 |
| `WR-04` false credential claim | pinned fixture disclosure renders; old sentence survives only as a comment | iteration 1 |
| `WR-05` inert Back chevron | disabled + `data-np-backing="deferred"` + tooltip + aria-label | iteration 1 |
| `WR-06` `openOptions` query-in-pattern | queries `standalone.html*`, compares `searchParams.get('page')` in the callback | iteration 1 |
| `WR-07` dead `composerDraft` | producer → `openStandalone` → projection → target `apply` → composer consumes | iteration 1 |
| `WR-08` gate family-blind, line-wide exemptions | Tier-1 family widening + Tier-2 bare keywords with per-occurrence contexts (31 self-test cases) | `4408ce37`, `22b71a6f` |
| `WR-09` handoff draft never cleared | `consumeDraft` reads-and-clears at the page's choke point; `afterEach` reset deleted, real Sider round trip pinned | `f620285d` |

## Verification

Verification ran in the **isolated worktree** `/Users/george.li/Documents/workspaces/nowpilot/.claude/worktrees/rf-01-49170-1790112083` (branch `gsd-reviewfix/01-49170`), using the main checkout's `node_modules` binaries. Every number below is reproducible from the main checkout on the same commit after the cleanup fast-forward (the worktree carries no `node_modules` of its own).

| Check | Result |
|---|---|
| `bash scripts/verify-no-tailwind.sh` (src) | exit 0 — `✓ 0 Tailwind utility strings in src` |
| `bash scripts/verify-no-tailwind.sh <probe fixture>` | exit 1 — the review's three probed shapes reported |
| `vitest run tests/isolation/no-tailwind-gate.test.ts` | 40/40 passed (31 pre-existing cases preserved + 9 new) |
| Mutation: pair scan disabled / backticks removed / value-context line exemption removed | 5 / 1 / 2 cases fail — the new pins are load-bearing |
| `npx tsc --noEmit` | exit 0 |
| `bash -n scripts/verify-no-tailwind.sh` | OK |
| Working tree | only the two declared files changed by `3ef63cc6`; nothing uncommitted |

Not run in this retry (out of budget by instruction): the full test suite and `pnpm run verify:phase-1` — the iteration-3 review already records both green on the parent commit, and this pass changes only the gate script and its self-test.

## Out of scope

`IN-01`…`IN-05` (production `console.log`, fabricated success toasts, unused store bindings, fabricated timestamps, hardcoded strings outside `t()`) are Info findings and outside `fix_scope: critical_warning`.

---

_Fixed: 2026-09-22T21:31:54Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
