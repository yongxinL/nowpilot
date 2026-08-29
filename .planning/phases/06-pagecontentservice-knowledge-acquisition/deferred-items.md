# Deferred Items — Phase 6

Out-of-scope discoveries logged during execution (per executor scope boundary:
only auto-fix issues directly caused by the current task's changes).

| Date | Plan | Item | Evidence | Owner |
|------|------|------|----------|-------|
| 2026-08-29 | 06-01 | `tests/core/workspace/journalingAdapter.test.ts` fails with ENOENT on `/Users/george.li/Documents/workspaces/nowpilot/src/core/workspace/journalingAdapter.ts` — the test hardcodes the original author's macOS path; unrelated to Phase 6 (pre-existing environment-specific failure, not caused by 06-01 changes). | Full-suite regression run at 06-01 Task 4: `1 failed \| 482 passed`; failure is `fs.readFileSync('/Users/george.li/...')` at journalingAdapter.test.ts:289. | Phase 2 owner / any phase touching workspace tests — replace the hardcoded path with a `path.join(__dirname, ...)` or `process.cwd()`-relative path. |