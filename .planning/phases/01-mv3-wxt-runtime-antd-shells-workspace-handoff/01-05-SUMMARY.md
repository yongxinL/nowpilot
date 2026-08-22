---
phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
plan: 05
subsystem: isolation + envelope-contract + workspace-predicate
tags: [isolation-test, runtime-envelope, workspace-store, type-contract, phase-1-closure]
requires: [01-01, 01-02, 01-04]
provides:
  - "tests/isolation/cross-entrypoint-imports.test.ts — real (non-vacuous) gate covering chat/, standalone/, options/ + content-script fetch() guard + regex self-test"
  - "RuntimeEnvelope.ts frozen extraction types (PAGE_LIVE_CONTEXT, PAGE_EXTRACTION_REQUESTED, PAGE_HTML_PAYLOAD) + PageHtmlPayload interface — Phase 6/17 contract"
  - "WorkspaceStore.isPrimaryWriter(): boolean — Phase-1 always-true stub with documented Phase-2 swap point"
  - "ActiveSurface union canonicalized: 'sidepanel' | 'standalone' (D-07)"
affects: [06-page-content-service, 17-context-menu-strategy, 02-workspace-persistence]
tech-stack:
  added: []
  patterns: ["regex-self-test for static-analysis gates (Pitfall 6 mitigation)", "type-only MessageType reservations with documented Phase-N consumers", "module-level always-true predicate + Phase-2 swap-point comment for interface freeze"]
key-files:
  created: []
  modified:
    - tests/isolation/cross-entrypoint-imports.test.ts (rewritten; 11 tests; +regex self-test)
    - src/core/runtime/RuntimeEnvelope.ts (+3 MessageTypeValues; +PageHtmlPayload interface)
    - tests/core/runtime/RuntimeEnvelope.test.ts (+6 frozen-types tests)
    - src/core/workspace/WorkspaceStore.ts (+isPrimaryWriter; ActiveSurface value rename)
    - tests/core/workspace/WorkspaceStore.test.ts (+isPrimaryWriter tests; +ActiveSurface type-level rejection)
decisions:
  - "ActiveSurface union value rename ('full-app' → 'standalone') is the scope of this plan only; the openFullApp/FullAppPageRegistry/openedFullAppTabId identifier renames and the RuntimeEnvelope 'source' enum rewrite are deferred to Plan 01-06 (M11 split-rename safety — coupling the union rename with the identifier rename would touch a larger blast radius than this plan's scope warrants)"
  - "Cross-surface import grep pattern is scoped to 'components/(chat|standalone|options)/' rather than a bare substring match so a legitimate shared-infra import (src/core/, src/types/, src/services/, src/components/common/) is never flagged as a violation — the test punishes real cross-bundle leaks, not legitimate shared modules"
  - "Content-script fetch() guard filters out the existing instructional comment 'Do NOT add a fetch(.)' in core.content.ts by stripping the grep -n 'path:line:' prefix before the comment-strip — avoids a false positive on a comment that the comment itself documents as a guardrail"
  - "isPrimaryWriter() is a module-level export, not a zustand action — it has no set() side effect and doesn't belong on the store's action map (matches the file's existing module-export style for ActiveSurface/TabContext)"
  - "isPrimaryWriter() always-true stub is an intentional Phase-1 interface freeze, not a deferred feature — the code comment at the call site is the threat-mitigation (T-01-15) preventing a future consumer from silently assuming it is a real gate"
metrics:
  duration: "~8 min wall"
  completed_date: 2026-08-22
  tasks: 3
  commits: 3
  tests_added: 17 (11 isolation + 6 envelope)
status: complete
actuals:
  tokens: 19200
  tasks: 3
  commits: 3
---

# Phase 1 Plan 5: Isolation gate + frozen envelope types + workspace predicate

Three additive, low-risk declarations closing out the "prove it's real, not vacuous" and "reserve the type contract" work: a real isolation test, frozen extraction-envelope types Phase 6 will implement against, and the `isPrimaryWriter()` predicate + `ActiveSurface` rename WorkspaceRouter's next-plan fix depends on.

## What landed

### Task 1 — Real (non-vacuous) isolation test (D-17, REQ-R02)

`tests/isolation/cross-entrypoint-imports.test.ts` rewritten (was 41 lines / 3 tests, now 119 lines / 11 tests).

Before: greps `src/components/sidepanel/` and `src/components/app/` — neither directory exists, so all three assertions pass vacuously (Pitfall 6, RESEARCH.md).

After: greps the three real surface directories (`chat/`, `standalone/`, `options/`) for cross-imports in both directions, plus a zero-`fetch()` guard under `entrypoints/content/**`, plus a regex self-test proving `CROSS_IMPORT_RE` catches synthetic violations and ignores shared-infra imports.

Pattern scope: `from\s+['"][^'"]*components\/(chat|standalone|options)\/` — a `from`-statement that points into another SURFACE directory. Shared-infra imports (`src/core/*`, `src/types/*`, `src/services/*`, `src/components/common/*`) are NOT flagged.

**Verification:** `pnpm vitest run tests/isolation/cross-entrypoint-imports.test.ts` → 11/11 pass; `grep -c "components/app\|components/sidepanel" tests/isolation/cross-entrypoint-imports.test.ts` → 0 (old vacuous paths gone).

### Task 2 — Frozen extraction envelope types (D-15, REQ-R04)

`src/core/runtime/RuntimeEnvelope.ts` gains:
- `PAGE_LIVE_CONTEXT`, `PAGE_EXTRACTION_REQUESTED`, `PAGE_HTML_PAYLOAD` added to `MessageTypeValues`
- `PageHtmlPayload` interface exported with `html: string`, `baseUrl: string`, `truncated: boolean`, and reserved optional `strategyId?: string` for Phase 17 ServiceNow strategy registration
- Doc comment names the Phase 6/17 consumers and finding M8 (the shape is frozen here so Phase 6 `PageContentService` and Phase 17 strategy can import by name)

No `BackgroundRouter` / `MessageBus` handler registered for these types in Phase 1 — type-only reservations per the plan's prohibition (REQ-R04).

**Verification:** `pnpm vitest run tests/core/runtime/RuntimeEnvelope.test.ts` → 10/10 pass (4 pre-existing + 6 new); `grep -c "PAGE_LIVE_CONTEXT\|PAGE_EXTRACTION_REQUESTED\|PAGE_HTML_PAYLOAD" src/core/runtime/RuntimeEnvelope.ts` → 4 (3 MessageTypeValues + 1 in PageHtmlPayload doc comment); `tsc --noEmit` clean.

### Task 3 — `isPrimaryWriter()` predicate + `ActiveSurface` rename (D-16, D-07, REQ-R05)

`src/core/workspace/WorkspaceStore.ts` gains:
- Module-level `export function isPrimaryWriter(): boolean { return true; }` with a Phase-2 swap-point comment naming the threat (memory-engine write-path gating depends on the documented Phase-1 contract)
- `ActiveSurface` union value renamed `'full-app'` → `'standalone'` (D-07 canonicalization)

The `openFullApp` / `FullAppPageRegistry` / `openedFullAppTabId` identifier renames and the `RuntimeEnvelope.source` enum rewrite are **intentionally deferred to Plan 01-06** (M11 split-rename safety — coupling the union rename with the identifier rename would touch a larger blast radius than this plan's scope warrants).

**Verification:** `pnpm vitest run tests/core/workspace/WorkspaceStore.test.ts` → 12/12 pass; `grep -n "export function isPrimaryWriter" src/core/workspace/WorkspaceStore.ts` → matches line 18; `grep -c "'full-app'" src/core/workspace/WorkspaceStore.ts` → 0; `tsc --noEmit` clean.

## Cross-cutting verification

| Gate | Result |
| --- | --- |
| `pnpm lint` (`tsc --noEmit`) | clean |
| `pnpm verify:phase-1` | 8 test files / 62 tests pass |
| `pnpm test:isolation` | 11/11 pass |
| `pnpm test` (full suite) | 15 test files / 120 tests pass |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Comment false-positive on content-script fetch() guard]**
- **Found during:** Task 1 first-run verification
- **Issue:** `grepForViolations` filtered lines whose string-trimmed form did NOT start with `//`, but the `grep -n` output prefixes each match with `path:line:` — so the existing instructional comment in `core.content.ts` ("Do NOT add a fetch(.)") appeared as `entrypoints/content/core.content.ts:14:    // the build), ...` and slipped past the comment filter as a violation
- **Fix:** strip the leading `path:line:` prefix inside `grepForViolations` before applying the comment-strip filter
- **Files modified:** `tests/isolation/cross-entrypoint-imports.test.ts`
- **Commit:** `df2a232` (initial Task 1 commit; the fix landed before the test went green)

**2. [Rule 3 - Literal `@ts-expect-error` in test comment parsed as a directive]**
- **Found during:** Task 3 first-run `pnpm lint`
- **Issue:** A test-comment block contained the literal substring `@ts-expect-error` ("the @ts-expect-error directive above would itself error..."); TypeScript parsed it as a second directive on the following comment line and reported `TS2578: Unused '@ts-expect-error' directive`
- **Fix:** rephrase the comment to use "ts-expect-error directive" (no leading `@`) — keeps the human-readable reference without TypeScript picking it up as a directive
- **Files modified:** `tests/core/workspace/WorkspaceStore.test.ts`
- **Commit:** `abe1976` (Task 3 commit; the fix landed before the test file went green)

None of these deviations expanded plan scope — both were the expected first-run fixes the plan's TDD-style "write the test → verify → fix the false positives" flow surfaces.

## Auth gates

None.

## Known Stubs (Phase-2 swap points)

| Stub | File | Phase-2 swap |
| --- | --- | --- |
| `isPrimaryWriter(): boolean { return true; }` | `src/core/workspace/WorkspaceStore.ts:18` | Replace with leader-election over `np_workspace_primary` channel (CAS + heartbeat, background-SW authoritative vs. tabs.query highest-id vs. BroadcastBus subscriber) before any MemoryEngine write path gates on this predicate |

This stub is explicitly sanctioned by the plan (REQ-R05) as the Phase-1 interface freeze pattern — the documented swap-point comment is the threat mitigation preventing a future consumer from assuming a real gate.

## Threat Flags

None added beyond what the plan's threat model already covers (T-01-13, T-01-14, T-01-15). No new network endpoints, auth paths, file-access patterns, or trust boundaries were introduced.

## Self-Check: PASSED

- All three task commits exist: `df2a232`, `8ef7678`, `abe1976`
- `pnpm verify:phase-1` green
- `pnpm test:isolation` green
- `pnpm test` full suite green (120/120)
- Plan acceptance criteria for each task verified individually
