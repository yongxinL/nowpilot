# NowPilot Decision Index

This file is an append-only index of accepted decisions. It links to accepted
ADRs and records decision identifiers and status; it does not duplicate complete
ADR content.

## Accepted ADRs

- ADR directory: [architecture/decisions/](architecture/decisions/)
- Currently no accepted ADRs are recorded.

## Locked repository decisions

Locked repository decisions are defined in `AGENTS.md` Section 4 and are not
duplicated here. They may be changed only by an approved ADR.

- [AGENTS.md — Locked repository decisions](../AGENTS.md#4-locked-repository-decisions)

## Phase 01 decision index

The authoritative content of these decisions is
[DESIGN.md — Resolved decisions](phases/01-runtime-shells-workspace/DESIGN.md#resolved-decisions).
This index records identifiers and status only.

| # | Decision (title) | Status |
|---|---|---|
| 1 | Fresh bootstrap on `phoenix`; prior branches read-only reference | Approved |
| 2 | pnpm 12.4.2; remove `package-lock.json`; no workspace file; `.npmrc` strict/exact | Approved |
| 3 | Governance: separate pre-planning commit before writing-plans | Approved |
| 4 | Skeleton scope: 7-entry core registry + minimal Options/Appearance | Approved |
| 5 | Permissions: `sidePanel` + `storage` only; dedup via stored tab ID | Approved |
| 6 | Coordination: elected single writer with prepare/ack/commit handoff | Approved |
| 7 | WXT 0.21.4 (Node ≥22), explicit `vite` 8.3.0 peer | Approved |
| 8 | TypeScript 5.9.3 (typescript-eslint peer `<6.1.0`); not TS 7 | Approved |
| 9 | Composer: no interactive or disabled control in Phase 01 | Approved |
| 10 | Unknown routes: Chat fallback + `STANDALONE_ROUTE_FALLBACK` DiagnosticEvent | Approved |
| 11 | Sider: 5 primary + 2 footer, registry-sourced | Approved |
| 12 | Verification: separate pre-baseline vs final gate; `verify:all` == `verify:phase-1` | Approved |
| 13 | Files: gitignore/README/STATUS/tests added; no `.codex`; CI deferred; no `chromePolyfill`; no empty-dir placeholders | Approved |
| 14 | `.planning/DESIGN_SYSTEM.md` non-authoritative; requirements restated; exact path referenced | Approved |
| 15 | Envelope: one closed discriminated union registry in `messageSchemas.ts` | Approved |
| 16 | Storage key-to-store mapping and durability clarified | Approved |
| 17 | Standalone close: unload best-effort; `tabs.onRemoved` authoritative | Approved |
| 18 | Testing categories separated (unit / integration / manifest / bundle / manual) | Approved |
| 19 | Exact dependency set pinned from registry metadata; later-phase deps excluded | Approved |
| 20 | Branch model: `phoenix` planning baseline; `phase/01-phoenix` implementation | Approved |
| 21 | Route model: hash route format `#/` plus a validated `StandaloneRouteId`; default `chat`; `replaceState`; no history routing | Approved |
| 22 | Side Panel actions via one canonical `StandaloneNavigation` service; typed destination | Approved |
| 23 | Registries: `ErrorCode` and `DiagnosticEvent` are separate closed schemas | Approved |
| 24 | `approvedPlanningBaselineCommit` is the immutable approved-plan commit, recorded by a later status commit | Approved |
