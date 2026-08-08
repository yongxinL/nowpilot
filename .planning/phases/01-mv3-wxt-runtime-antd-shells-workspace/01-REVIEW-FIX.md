---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
fixed_at: 2026-08-08T23:20:00Z
review_path: .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-08-08T23:20:00Z
**Source review:** `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-10, WR-11, WR-12, WR-13 — all WARNING)
- Fixed: 4
- Skipped: 0

All four WARNING findings from the 01-10/01-11 gap-closure review were fixed and verified. REVIEW.md entries WR-10..WR-13 are marked `RESOLVED` with per-finding status blocks; frontmatter now carries `resolved: [WR-10, WR-11, WR-12, WR-13]`. The deferred WR-05/WR-06/WR-07 records and Info findings were NOT touched.

## Fixed Issues

### WR-10: M.3 workspaceId scope gate in the store's own `handleChanged` adoption path

**Files modified:** `src/core/workspace/WorkspaceStore.ts`, `tests/core/workspace/WorkspaceStore.test.ts`
**Commit:** `84509ba`

**Applied fix:** `handleChanged` now runs the identical inbound ordering as `WorkspaceSync.handleRemoteUpdate` — shape-check (`sanitizeStored`) → M.3 workspaceId gate (a snapshot with a different `workspaceId` is ignored with a `STORE_SYNC` debugLog, matching WorkspaceSync's `'…ignored (foreign workspace)'` message) → version-LWW adoption. The two inbound paths (broadcast and storage) now agree on foreign-workspace rejection. Header comments updated to document the shared gate.

**Required test updates (in the same commit):** the existing test `'chrome.storage.onChanged foreign write merges into state (version-LWW)'` wrote `workspaceId: 'ws-foreign'` and asserted adoption — the new gate makes that expectation wrong, so it now writes the local workspaceId (preserving the same-workspace foreign-surface LWW-adoption coverage); a new negative test `'onChanged write from a foreign workspaceId is ignored (M.3 scope gate)'` asserts a higher-version foreign snapshot is rejected BEFORE the LWW check; the equal-version LWW test now uses the local workspaceId so its branch is genuinely exercised (same vacuity WR-13 flagged on the sync path, fixed here for the store path).

### WR-11: Mount chain rejection observability (Golden Rule 9)

**Files modified:** `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/standalone/main.tsx`
**Commit:** `fa9c781`

**Applied fix:** Both entrypoints wrap the mount chain per the review's snippet: the inner `start()` promise is `void`-ed with its own `.catch` calling `debugLog(ERROR_CODES.WORKSPACE_START, 'workspace start failed at mount', { error: err instanceof Error ? err : undefined, module: 'WorkspaceStore' })`, and the outer chain gets a `.catch` for init rejection with the canonical `WORKSPACE_INIT` code and the same extra shape. Both codes exist verbatim in `src/core/error/errorCodes.ts` (WORKSPACE_INIT/WORKSPACE_START). `debugLog` and `ERROR_CODES` imports added to both entrypoints.

### WR-12: Hoisted sync ref + pagehide teardown (HMR leak)

**Files modified:** `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/standalone/main.tsx`
**Commit:** `ff952b7`

**Applied fix:** The ref is hoisted to true module scope (`let workspaceSync: WorkspaceSync | null = null` OUTSIDE the `typeof document !== 'undefined'` guard), assigned inside the guard, and started via `workspaceSync?.start()` (optional-chaining is required for the closure under TS strict). A `pagehide` listener calls `workspaceSync.stop()` (which stops the heartbeat via `broadcastBus.stopHeartbeat()` and unsubscribes the bus/store/bridge), nulls the ref, and calls `useWorkspaceStore.getState().stop()` to detach the store's onChanged listener — so HMR re-evaluation cannot stack a second live instance. **Deviations:** (a) the listener is registered INSIDE the guard rather than outside as in the review's sketch — semantically identical everywhere `document` exists and strictly safer if the entrypoint is ever imported in a node env (`window` would be undefined at module scope there); (b) this commit was amended to include the prettier normalization of the WR-11/WR-12 regions discovered by `verify:phase-1` (line-wrapping only, no semantic change).

### WR-13: LWW test fixture passes the M.3 scope gate

**File modified:** `tests/core/workspace/WorkspaceSync.test.ts`
**Commit:** `5881dce`

**Applied fix:** The `'a lower/equal remote version is ignored (LWW)'` fixture changed from `workspaceId: 'ws-stale'` to `workspaceId: 'ws-local'` (the local workspaceId set in `beforeEach`), so the payload passes the scope gate and the `version <= local.version` branch is what rejects it — a regression making equal-or-lower same-workspace versions adopt would now be caught. Assertions unchanged. **Note:** this commit was recreated as a fixture-only commit after the prettier fix was reassigned to WR-12 (the intermediate commit attribution was corrected with `git reset --soft` + re-commit; no content lost).

## Skipped Issues

None — all four in-scope findings were fixed.

---

## Verification

`verify:phase-1` steps (executed individually — see deviations): **all green, exit 0**:

- `eslint .` → exit 0
- `prettier --check .` → exit 0 (after normalizing the two entrypoint files)
- `tsc --noEmit` (root `tsconfig.json`, strict) → exit 0, 0 errors
- `wxt build` → exit 0 (5.39 MB output)
- `vitest run` → 26 files / 170 tests passed (includes `tests/core/workspace`: WorkspaceStore 10 + WorkspaceSync 9; `tests/entrypoints`: sidepanel 6 + standalone 5)
- `node tests/isolation/check-content-bundle.mjs` → "1 content bundle(s) clean", exit 0

Scoped runs as requested: `vitest run tests/core/workspace` (19 passed) and `tests/entrypoints` (11 passed) are both contained in the full-suite green run.

## Deviations from the standard workflow

1. **Worktree location** — `/tmp` is a quota-limited tmpfs (the first `git worktree add` failed with "Disk quota exceeded"); the isolated worktree was created under `~/.cache/gsd-reviewfix/` on the home filesystem instead, and the recovery sentinel reflects that path. The failed attempt was fully cleaned up (orphan branch + stale sentinel removed).
2. **`pnpm` wrapper unusable in the worktree** — `pnpm vitest run …` aborts because pnpm's deps-status check wants to purge the symlinked `node_modules` (worktree convention) and refuses without a TTY. All `verify:phase-1` commands were therefore run with the exact same binaries (`node_modules/.bin/*`) and script body as `package.json`'s `verify:phase-1` (`eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs`). Results are identical to what the pnpm script would produce.
3. **Generated `.wxt/` directory** — gitignored, so the fresh worktree lacked `.wxt/tsconfig.json` (vitest/tsc fail without it). Regenerated in the worktree via `wxt prepare` (0 absolute paths).
4. **WorkspaceStore.test.ts changes** — not flagged as a finding, but WR-10's gate made the existing foreign-adoption test fail; updating it (plus adding the storage-path negative test) was required to keep the suite green and to keep the store path's LWW branches covered. Documented in the WR-10 entry above.
5. **REVIEW.md frontmatter `status`** kept as `issues_found` rather than `clean` — WR-05/WR-06/WR-07 remain deferred and Info findings remain carried; a `resolved` list was added for the four closed warnings.

---

_Fixed: 2026-08-08T23:20:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
