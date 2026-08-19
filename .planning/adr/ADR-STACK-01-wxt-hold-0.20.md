# ADR-STACK-01 — Hold WXT at 0.20.27 for v0.1

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** George Li (product owner / architect)
- **Decides:** RESEARCH-RECONCILIATION.md §A-1 / §F
- **Related:** STACK.md (WXT row), spec §7.1

## Context

Spec §7.1 pins `wxt@^0.21` (≥0.21.4) as the target. The existing scaffold builds on `wxt@0.20.27`. `STACK.md` recommends holding 0.20.27 for v0.1 because WXT is pre-1.0 (a `0.x` minor bump is a breaking major), and 0.21 ships breaking changes that churn every phase's verify gate — most notably the generated `.wxt/tsconfig.json` flips to `strict: true` + `verbatimModuleSyntax` + `noUncheckedIndexedAccess`, which this codebase (`strict: false`) would need a large type-fix pass to satisfy mid-milestone. Other 0.21 changes: `wxt/testing` barrel removed (submodule imports), `globalName` default flips to `false` for value-returning content scripts, `fake-browser` v2 drops promise-returning `onMessage` mocks, CWS v2 submit flow.

This is a **deviation from the locked spec**, so it is recorded here rather than left as an implicit STACK.md preference.

## Decision

**Hold `wxt@^0.20.27` for all of v0.1.** `^0.20.27` intentionally does not auto-jump to 0.21 (pre-1.0 caret semantics). The WXT 0.21 upgrade is scheduled as a **dedicated post-v0.1 chore** with the migration checklist in STACK.md, gated by `verify:all`.

`REQUIREMENTS.md` and all phase plans cite **`wxt@^0.20.27`** as the authoritative v0.1 version. Spec §7.1's `^0.21` pin is treated as the *post-v0.1 target*, not the v0.1 build version, per this ADR.

## Consequences

- **Positive:** no mid-milestone strict-tsconfig churn; verify gates stay stable across Phases 1–19; scaffold keeps building as-is.
- **Negative:** v0.1 ships on a version below the spec pin; the eventual 0.21 migration (strict-tsconfig type-fix pass, submodule imports, `globalName` flags, shadow-root UI changes, CWS v2) is deferred debt.
- **Follow-up:** create a post-v0.1 chore ticket "WXT 0.21 upgrade" referencing STACK.md's migration checklist. Re-confirm Vite/Node/TS peers at that time (VAI-04).

## Verification

- `package.json` shows `wxt@^0.20.27`; `pnpm why wxt` resolves within 0.20.x.
- No phase plan references 0.21-only APIs (e.g. `wxt/testing/vitest-plugin` submodule, `globalName: true` requirement) during v0.1.
