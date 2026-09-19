# Phase 01 — Runtime, Shells, and Workspace: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Read `AGENTS.md`, `.planning/phases/01-runtime-shells-workspace/DESIGN.md`, and this file before starting any task. Do not implement beyond the current task.

**Goal:** Deliver a deterministic WXT / Chrome MV3 baseline with a Chat-only Side Panel, a Standalone workspace, one canonical `RuntimeEnvelope`, one elected single-writer workspace, a theme foundation, and the canonical 7-entry Standalone registry with skeleton pages.

**Architecture:** Two extension-owned UI surfaces (`sidepanel`, `standalone`) communicate through one Zod-validated `RuntimeEnvelope`; the background service worker is the only caller of `chrome.tabs`, owns singleton-tab routing, and (per ADR-0001) is the narrow serialisation authority for operations that change the elected workspace writer; workspace writes are serialised by an elected single writer with prepare → acknowledge → commit handoff and versioned idempotent mutations; theme is independent of election and propagates through `chrome.storage.sync` + `chrome.storage.onChanged`.

**Tech Stack:** pnpm 12.4.2, WXT 0.21.4, Vite 8.3.0, React 19.3.0, Ant Design 6.6.4, Zod 4.6.5, Zustand 5.0.15, Vitest 5.0.1, jsdom 30.1.0, TypeScript 5.9.3, ESLint 10.11.0 + typescript-eslint 8.70.0, Prettier 3.9.8.

**Spec:** `.planning/phases/01-runtime-shells-workspace/DESIGN.md` (approved 2026-09-19). This plan implements only that design. Where this plan is silent, `DESIGN.md` is authoritative; where they conflict, stop and follow the instruction-precedence conflict procedure in `AGENTS.md` Section 2.

---

## Global Constraints

These apply to every task. Every task's requirements implicitly include this section.

1. **Branch:** `phoenix` is the single sequential branch for planning and implementation. Implementation occurs directly on `phoenix` in the repository root; no separate implementation branch and no linked worktree is used. The exact filesystem path is never hard-coded.
2. **Package manager:** pnpm `12.4.2` (`packageManager: "pnpm@12.4.2"`). Single-package repo — do not add `pnpm-workspace.yaml`. `.npmrc` contains exactly `engine-strict=true` and `save-exact=true`.
3. **Node engines:** `"^22.22.2 || ^24.15.0 || >=26.0.0"` (exact string from DESIGN.md Section 3).
4. **Exact dependency pins** (no `^`, `~`, `latest`, or wildcards). Runtime: `react@19.3.0`, `react-dom@19.3.0`, `antd@6.6.4`, `@ant-design/icons@6.3.4`, `zustand@5.0.15`, `zod@4.6.5`. Dev: `wxt@0.21.4`, `@wxt-dev/module-react@1.2.2`, `vite@8.3.0`, `typescript@5.9.3`, `@types/react@19.3.0`, `@types/react-dom@19.3.0`, `@types/node@24.13.6`, `@types/chrome@0.3.0`, `eslint@10.11.0`, `typescript-eslint@8.70.0`, `prettier@3.9.8`, `vitest@5.0.1`, `jsdom@30.1.0`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`, `@testing-library/jest-dom@7.0.1`.
5. **Excluded dependencies** (must not be added as direct `package.json` dependencies in Phase 01; transitive dependencies of an approved package are permitted): `@ant-design/x`, `@ant-design/x-markdown`, `ai`, `@ai-sdk/*`, `@modelcontextprotocol/sdk`, `defuddle`, `@mozilla/readability`, `minisearch`, `d3-force`, `jszip`, `turndown`, `yaml`, `jsonrepair`, `web-ext`, `@types/wicg-file-system-access`, `vitest-chrome`, `@eslint/js`, `globals`.
6. **Only `pnpm-lock.yaml` is authoritative.** `package-lock.json` must not exist after Task 01.
7. **Locked decisions:** `standalone` stem only; Side Panel is Chat-only; content scripts are extraction-only and **no content script exists in Phase 01**; manifest permissions are exactly `["sidePanel","storage"]`; background is the only caller of `chrome.tabs`; the background is also the narrow serialisation authority for operations that change the elected workspace writer (ADR-0001) and remains not a workspace owner, workspace writer, ordinary mutation broker, content owner, provider/MCP runtime, IndexedDB owner, or long-lived source of truth; UI components use `StandaloneNavigation`; hash routing `#/<StandaloneRouteId>` with `history.replaceState` and no browser-history traversal; elected single writer; prepare/ack/commit handoff; theme independent of election; no IndexedDB, provider, MCP, extraction, notes, memory, diagnostics functionality, or later-phase work; no HTML text input, send button, attachment button, model selector, disabled controls, or speculative chat state in the Side Panel.
8. **Canonical identifiers** are fixed by `DESIGN.md` Section 5 and Section 9. Do not rename, add, or alias: `RuntimeSurface`, `OperationId`, `MessageType`, `RuntimeEnvelope`, payload schema names, `ErrorCode` values, `DiagnosticEvent` value, `StandaloneRouteId` values, storage keys. PLAN-defined internal helper names are listed in each task's **Interfaces produced** block and must be used exactly as written.
9. **TDD rule:** every production-code task starts with a failing test (RED), then minimal implementation (GREEN), then refactor. Tasks explicitly marked **configuration exception** (T01, T02, and the build-artifact inspection scripts in T23/T24 when they only run after a build) are the only exceptions permitted by `AGENTS.md` Section 11.
10. **Every task ends with:** focused verification, the Phase 01 verification command applicable at that point, specification-compliance review, code-quality + security review, evidence append, `STATUS.md` update, and one atomic commit in the format `<type>(phase-01): <task outcome>`.
11. **Evidence** lives under `.planning/evidence/phase-01/`. Tasks append real dated sections to `verification.txt` and `review.md`. Do not create empty evidence files, `.gitkeep`, or placeholder screenshots.
12. **Status:** each task updates only the "Current state" section of `.planning/STATUS.md` and appends to "History"; previous history is never rewritten or deleted.
13. **Persistence:** `local` = metadata + committed version; `sync` = appearance only; `session` = election, instance IDs, handoff intent, singleton tab ID. Session values are never described or treated as durable workspace state.
14. **Fail closed:** unknown message types, invalid envelopes, untrusted senders, invalid metadata, and stale mutations produce canonical structured behaviour, never silent success. Side-effect or ownership failures never render as success.
15. **Security:** never log, persist, display, or export raw API keys, tokens, cookies, prompts, tool bodies, clipboard content, case content, password values, or sensitive paths. All logging goes through `debugLog` with redaction.
16. Do not modify `DESIGN.md`. Do not create CI workflow files. Do not add `.codex/`. Do not add `chromePolyfill.ts` unless a task proves it necessary and stops for approval.
17. **Direct-branch safeguards:** implementation is sequential and only one implementation agent may modify the repository at a time; parallel task execution is prohibited; every subagent uses the same repository root and the same `phoenix` branch; verify the commit branch is exactly `phoenix` before and after every task; never push, force-push, merge, rebase, squash, amend, reset, or rewrite history; recover with a new corrective commit or an operator-approved `git revert`.

---

## Approved Plan Interpretations (operator-approved 2026-09-19)

These four interpretations were approved by the operator and are authoritative for Phase 01. They add no message type, storage key, error code, runtime surface, persistence mechanism, or dependency. They are implemented by the exact tasks named below and are covered by the named tests.

### Interpretation 1 — `MESSAGE_TYPE_ALLOWED_SOURCES` is a closed, typed registry

- Canonical implementation location: `src/core/runtime/MessageType.ts` (created in **T07**).
- The complete mapping is defined explicitly for all eleven `MessageType` values; there is no wildcard, permissive default, or fallback source.
- Boundary validation in `src/core/runtime/RuntimeEnvelope.ts` (created in **T07**, extended in **T08**) rejects an unregistered message type or a disallowed source with `RUNTIME_SENDER_REJECTED`. An envelope that fails schema validation (including an unknown type string) remains `RUNTIME_ENVELOPE_INVALID`, per DESIGN.md Section 5.
- Validation runs at every runtime message boundary: `validateInboundEnvelope` in the background runtime (T22) and in `BroadcastBus` inbound dispatch (T09, which receives `extensionId` and the raw sender).
- Tests cover every Phase 01 message type, its allowed sources, and representative rejected sources (T08), plus a completeness test that every `MessageType` has exactly one registry entry (T08).

### Interpretation 2 — Requester identity and `createWorkspaceCoordinator`

- `WorkspaceRehydrateRequestPayload` carries `instanceId` and `writerType` (T07).
- `createWorkspaceCoordinator` (T16) is the Phase 01 orchestration boundary for the existing prepare, acknowledge, commit, relinquish, mutation, and rehydration contracts.
- It uses only existing canonical message types, storage keys, error codes, and runtime surfaces; it adds no persistence mechanism.
- **Amendment (ADR-0001):** the background service worker is the narrow serialisation authority for election-changing operations only. It remains outside workspace ownership, workspace content, and ordinary workspace mutation coordination; the coordinator runs only in the Side Panel and Standalone surfaces, and ordinary `workspace.mutation` envelopes never pass through the background election arbiter.
- The elected single-writer protocol is preserved: the coordinator prepares or commits only when the local surface is the current writer.
- Coordinator behaviour is fully testable through injected boundaries (`bus`, `storage`, `election`, `handoff`, `store`); every handler is exposed and tested directly in addition to the bus-driven handshake test.
- The coordinator is a narrow orchestration boundary, not a service locator: it exposes only `start`, `announce`, and the named message handlers.

### Interpretation 3 — Single Phase 01 mutation kind

- `WorkspaceMutationKind` is the closed literal `'workspace.metadata.set'` (T06).
- No generic or arbitrary mutation names and no note, conversation, memory, provider, or later-phase mutation kinds are added.
- Extending the registry requires a future approved design and plan; T06 records this and rejects any other literal (tested).

### Interpretation 4 — Separate Vitest projects

- Three projects are defined in `vitest.config.ts` (T02): `unit` (ordinary unit, component, and integration tests), `manifest` (generated-manifest inspection), and `isolation` (post-build bundle-isolation inspection).
- `pnpm run test` runs only the `unit` project and requires no built artefacts.
- `pnpm run build` completes before `pnpm run test:manifest` and `pnpm run test:isolation`.
- Both aggregate scripts are exactly `typecheck → lint → test → build → test:manifest → test:isolation`.
- The `manifest` and `isolation` projects parse actual build output (`.output/chrome-mv3/manifest.json` and built bundles), never source configuration alone.

## Pre-implementation Baseline Verification (gate, no commit)

Run **once** at the start of the first implementation session, from the repository root, before any file is modified. Record the exact output in `.planning/evidence/phase-01/verification.txt` (create the file with this first real record — see Task 01 evidence step for the directory policy).

The block below is executable as-is with `bash -euo pipefail`. It uses no absolute filesystem path and no unresolved placeholder. `approvedPlanningBaselineCommit` is read from `.planning/STATUS.md`; it refers to the immutable **approved-plan commit**, not the later status-record commit and not `HEAD`.

```bash
set -euo pipefail

# 1. Current directory is the repository root.
test "$(git rev-parse --is-inside-work-tree)" = "true"
test "$(git rev-parse --show-toplevel)" = "$(pwd -P)"

# 2. Current branch is exactly the single sequential phase branch.
test "$(git branch --show-current)" = "phoenix"

# 3. Working tree is clean.
test -z "$(git status --porcelain)"

# 4. Governance files exist.
for f in .planning/README.md .planning/STATUS.md .planning/DECISIONS.md; do
  test -f "$f"
done

# 5. Approved DESIGN.md and PLAN.md exist.
test -f .planning/phases/01-runtime-shells-workspace/DESIGN.md
test -f .planning/phases/01-runtime-shells-workspace/PLAN.md

# 6. Dual package-manager lockfiles do not coexist.
! { test -f package-lock.json && test -f pnpm-lock.yaml; }

# 7. approvedPlanningBaselineCommit exists, resolves to a commit, is an ancestor of HEAD,
#    and HEAD contains a later status-record commit that touched STATUS.md.
APPROVED_PLANNING_BASELINE_COMMIT="$(
  sed -nE 's/^- \*\*Approved planning baseline commit:\*\* `([0-9a-f]{40})`.*$/\1/p' \
    .planning/STATUS.md
)"
test -n "$APPROVED_PLANNING_BASELINE_COMMIT"
test "$(printf '%s' "$APPROVED_PLANNING_BASELINE_COMMIT" | wc -c | tr -d ' ')" = "40"
git cat-file -e "${APPROVED_PLANNING_BASELINE_COMMIT}^{commit}"
git merge-base --is-ancestor "$APPROVED_PLANNING_BASELINE_COMMIT" HEAD
test -n "$(git log --format=%H "${APPROVED_PLANNING_BASELINE_COMMIT}..HEAD" -- .planning/STATUS.md)"

echo "BASELINE OK: approvedPlanningBaselineCommit=${APPROVED_PLANNING_BASELINE_COMMIT}"
```

**If the baseline fails, stop.** Record the failure and the exact failing assertion in `verification.txt`. Do not modify files. Baseline failure for the approved-plan-commit reason (Section 15.1.7) means the governance sequencing in `DESIGN.md` Section 17 has not completed; ask the operator to complete it.

**Lockfile transition:** before Task 01 the orphan `package-lock.json` may exist alone. After Task 01, `package-lock.json` must be absent and `pnpm-lock.yaml` must exist. The coexistence check in baseline assertion 6 is therefore valid both before and after Task 01.

---

## Task Dependency Graph

```text
T01 bootstrap
  └─ T02 toolchain config
       ├─ T03 error/diagnostic registries
       │    ├─ T07 runtime primitives  (needs T05, T06)
       │    ├─ T17 theme (needs T04, T03)
       │    └─ T23 manifest inspection (needs T02; real run needs T22)
       ├─ T04 storage keys + adapter
       │    ├─ T06 workspace types (needs T03? no; needs T04 only for store, types are pure)
       │    ├─ T12 workspace store
       │    └─ T17 theme
       ├─ T05 route registry
       │    ├─ T07 runtime primitives
       │    └─ T18 page registry + pages
       ├─ T06 workspace types
       │    └─ T07 runtime primitives
       └─ T07 runtime primitives
            ├─ T08 boundary validation
            ├─ T09 broadcast bus
            ├─ T14 handoff
            ├─ T15 mutations
            └─ T16 sync
       T08 + T09
            └─ T10 navigation request contract
                 └─ T11 singleton tab controller
       T12 + T13
            └─ T13C background-serialised election (ADR-0001)
                 └─ T14 handoff
                      └─ T15 mutations
                           └─ T16 sync
       T05 + T18
            └─ T19 shell/router/sider
                 ├─ T20 options appearance
                 └─ T21 side panel shell
                      └─ T22 entrypoints + background wiring
                           ├─ T23 manifest inspection (real run)
                           ├─ T24 isolation inspection (real run)
                           └─ T25 integration tests
                                └─ T26 complete build + isolation gate
                                     └─ T27 manual acceptance
                                          └─ T28 final verification + acceptance prep
```

Dependencies are also stated per task in **Depends on**. A task may start only when every dependency task is committed and its focused verification passes.

---

## Phase 01 Scope → Task Coverage Matrix

| # | Required scope (task brief) | Covered by |
|---|---|---|
| 1 | pnpm and WXT project bootstrap | T01 |
| 2 | test, lint, type-check, formatting, build configuration | T02 |
| 3 | generated-manifest verification | T23 |
| 4 | post-build isolation verification | T24 |
| 5 | canonical route registry | T05 |
| 6 | storage keys and validated Chrome-storage adapter | T04 |
| 7 | operational error and diagnostic registries | T03 |
| 8 | RuntimeSurface, OperationId, MessageType, payload schemas, RuntimeEnvelope | T07 |
| 9 | sender and envelope boundary validation | T08 |
| 10 | Standalone navigation request contract | T10 |
| 11 | singleton Standalone tab create/focus/stale-ID recovery/close | T11 |
| 12 | workspace types and durable metadata | T06 (types/schemas), T12 (durable store) |
| 13 | writer election | T13 (direct), T13C (background-serialised, ADR-0001) |
| 14 | prepare, acknowledge, commit handoff | T14 |
| 15 | mutation versioning and idempotency | T15 |
| 16 | mirror ordering and rehydration | T16 |
| 17 | theme schemas, Ant Design configuration, persistence, live propagation | T17 |
| 18 | Standalone registry, router, Sider, skeleton pages | T18 (registry/pages), T19 (shell/router/sider) |
| 19 | Options Appearance controls | T20 |
| 20 | Chat-only Side Panel shell and two navigation actions | T21 |
| 21 | WXT entrypoints and background listener wiring | T22 |
| 22 | integration tests | T25 |
| 23 | complete build and isolation gate | T23, T24, T26 |
| 24 | manual unpacked-extension acceptance and evidence | T27 |
| 25 | final Phase 01 verification and acceptance preparation | T28 |
| 26 | background-serialised workspace election (ADR-0001): FIFO arbiter, monotonic epochs, fail-closed persistence/read-back, concurrency and restart tests | T13C |

---

## Phase 01 Verification Commands

`verify:phase-1` and `verify:all` are defined identically and intentionally:

```text
pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build \
  && pnpm run test:manifest && pnpm run test:isolation
```

`pnpm run test` runs only the Vitest `unit` project (unit + component + integration tests). `pnpm run test:manifest` runs only the `manifest` project and `pnpm run test:isolation` runs only the `isolation` project; both inspect real build output under `.output/chrome-mv3/`. This separation is required because the aggregate order runs `test` before `build`.

**Applicability per task:** tasks T01–T22 use `pnpm run typecheck && pnpm run lint && pnpm run test` as the applicable Phase 01 command (the artifact projects are expected RED until T22 completes). T23 onwards use the full `pnpm run verify:phase-1`. `verify:phase-1` is explicitly **not** the pre-implementation baseline.

---

## Task Format Key

- **Implementation tier:** `economy` (routine, self-contained), `balanced` (cross-module/integration), `advanced` (security-critical or architecture reconciliation).
- **RED command** is run before implementation. **Expected RED result** explains why the failure proves the intended behaviour is absent.
- Checkbox steps within a task are the exact ordered actions.
- All shell commands are run from the repository root unless stated otherwise.

### Task 01 — pnpm and WXT Project Bootstrap

**Implementation tier:** economy
**Depends on:** None (requires the pre-implementation baseline gate to pass)
**Classification:** configuration exception (`AGENTS.md` Section 11)
**Files created:** `package.json`, `.npmrc`, `wxt.config.ts`, `tsconfig.json`, `src/entrypoints/background.ts`, `public/icon/16.png`, `public/icon/32.png`, `public/icon/48.png`, `public/icon/128.png`, `pnpm-lock.yaml` (generated)
**Files modified:** none
**Files deleted:** `package-lock.json`
**Files that must not be modified:** `.planning/**`, `.gitignore`, `README.md`
**Test files:** none (configuration exception; `package.json` content is asserted in T02)
**Interfaces produced:** package name `nowpilot`, `type: "module"`, `private: true`, `version: "0.1.0"`, `packageManager: "pnpm@12.4.2"`, `engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"`; scripts `dev`, `postinstall`, `build`; `wxt.config.ts` default export; WXT entrypoint `background`.

- [ ] **Step 1: Prove the bootstrap is absent (RED)**

Run:

```bash
test -f package.json && test -f .npmrc && test -f wxt.config.ts
```

Expected: exit status 1 because none of these files exist yet. This proves the project bootstrap is missing.

- [ ] **Step 2: Remove the orphan npm lockfile**

Run:

```bash
rm -f package-lock.json
```

- [ ] **Step 3: Create `.npmrc`**

```text
engine-strict=true
save-exact=true
```

- [ ] **Step 4: Create `package.json`**

Use the exact content below. Every dependency is an exact pin. Do not add, remove, or change a version.

```json
{
  "name": "nowpilot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.4.2",
  "engines": {
    "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
  },
  "scripts": {
    "dev": "wxt",
    "postinstall": "wxt prepare",
    "build": "wxt build"
  },
  "dependencies": {
    "@ant-design/icons": "6.3.4",
    "antd": "6.6.4",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "zod": "4.6.5",
    "zustand": "5.0.15"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.2",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@types/chrome": "0.3.0",
    "@types/node": "24.13.6",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@wxt-dev/module-react": "1.2.2",
    "eslint": "10.11.0",
    "jsdom": "30.1.0",
    "prettier": "3.9.8",
    "typescript": "5.9.3",
    "typescript-eslint": "8.70.0",
    "vite": "8.3.0",
    "vitest": "5.0.1",
    "wxt": "0.21.4"
  }
}
```

- [ ] **Step 5: Create `wxt.config.ts`**

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'NowPilot',
    version: '0.1.0',
    description: 'Privacy-first Chrome extension for support engineers.',
    permissions: ['sidePanel', 'storage'],
    action: {
      default_title: 'NowPilot',
    },
  },
});
```

Do **not** declare `side_panel`, `standalone`, `content_scripts`, host permissions, or any permission other than `sidePanel` and `storage`. WXT derives `side_panel` later from the `sidepanel` entrypoint (T22), which is why it is absent here.

- [ ] **Step 6: Create `tsconfig.json`**

```json
{
  "extends": ".wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", "tests", ".wxt/types", "wxt.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 7: Create the four icons**

Run the following command exactly (it writes valid RGBA PNGs at the required sizes; `zlib.crc32` is available on the pinned Node runtime):

```bash
node --input-type=module - <<'NODE'
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  let c = 0xffffffff;
  for (const byte of Buffer.concat([typeBuf, data])) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const o = rowStart + 1 + x * 4;
      raw[o] = 0x3b;
      raw[o + 1] = 0x82;
      raw[o + 2] = 0xf6;
      raw[o + 3] = 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icon', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(`public/icon/${size}.png`, makePng(size));
}
console.log('icons written');
NODE
```

- [ ] **Step 8: Create the WXT background scaffold**

```ts
export default defineBackground(() => {
  // Runtime wiring is implemented in Task 22.
});
```

`defineBackground` is provided by WXT auto-imports. This file is a build scaffold only; Task 22 owns its behaviour and test.

- [ ] **Step 9: Install dependencies and generate the pnpm lockfile**

```bash
pnpm install
```

Expected: install succeeds, `postinstall` runs `wxt prepare`, `pnpm-lock.yaml` is created, `package-lock.json` is gone.

- [ ] **Step 10: Run the focused verification**

```bash
test ! -f package-lock.json
test -f pnpm-lock.yaml
node -e "const v=require('./node_modules/wxt/package.json').version; if(v!=='0.21.4'){throw new Error('wxt '+v)}"
node -e "const v=require('./node_modules/vitest/package.json').version; if(v!=='5.0.1'){throw new Error('vitest '+v)}"
pnpm run build
test -f .output/chrome-mv3/manifest.json
```

Expected: all commands succeed; WXT reports a successful build. The generated manifest at this stage has `background`, `action`, `icons`, and permissions `sidePanel` + `storage`, but no `side_panel` or `standalone.html` yet.

- [ ] **Step 11: Verify the build output is not committed**

```bash
git status --porcelain
```

Expected: `.output/` and `.wxt/` are absent from the list (ignored by `.gitignore`); `package.json`, `.npmrc`, `wxt.config.ts`, `tsconfig.json`, `src/entrypoints/background.ts`, `public/icon/*.png`, and `pnpm-lock.yaml` are new; `package-lock.json` is deleted.

- [ ] **Step 12: Record evidence, update status, and commit**

Append a dated Task 01 section to `.planning/evidence/phase-01/verification.txt` containing: task ID, branch (`phoenix`), commit range placeholder filled after commit, the exact commands from Step 10, exit statuses, the WXT version output, and the lockfile state. Create `.planning/evidence/phase-01/` only now, with this first real file; do not create empty siblings (`review.md`, `manual-checks.md`, `screenshots/` are created only when they gain real content).

Update the "Current state" section and History of `.planning/STATUS.md` (current task T01, last commit, verification result, next task T02, evidence path).

```bash
git add -A
git commit -m "chore(phase-01): bootstrap pnpm WXT project"
```

**Constraints and non-goals:** no app code beyond the background scaffold; no runtime, workspace, theme, or UI modules; no CI workflow; no additional dependencies; no `.gitkeep`.
**Focused verification:** Step 10 block.
**Phase 01 verification applicable now:** none (toolchain scripts do not exist yet). Record this explicitly.
**Specification-compliance checklist:** exact pins match DESIGN.md Section 3; `wxt.config.ts` permissions are exactly `sidePanel` + `storage`; no excluded dependency present; `standalone` stem rules untouched; no content script.
**Code-quality and security checklist:** `.output/` and `.wxt/` uncommitted; no secrets or local paths committed; `package-lock.json` removed; `pnpm-lock.yaml` present.
**Evidence:** `.planning/evidence/phase-01/verification.txt` (Task 01 section).
**Atomic commit:** `chore(phase-01): bootstrap pnpm WXT project`
**Completion criteria:** Steps 10–11 pass; one commit exists; working tree clean; status recorded.
**Stop conditions:** `pnpm install` fails on engine or peer constraints; a non-approved dependency is required; WXT build fails for a reason outside Phase 01 scope; baseline gate has not passed.

---

### Task 02 — Test, Lint, Type-Check, Formatting, and Build Configuration

**Implementation tier:** economy
**Depends on:** T01
**Classification:** configuration exception (`AGENTS.md` Section 11)
**Files created:** `vitest.config.ts`, `tests/setup.ts`, `tests/config/toolchain.test.ts`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`
**Files modified:** `package.json` (add scripts), `tsconfig.json` (already includes `tests`)
**Files that must not be modified:** `src/entrypoints/background.ts`, `.planning/**`
**Test files:** `tests/config/toolchain.test.ts`
**Interfaces produced:** Vitest projects `unit`, `manifest`, `isolation`; package scripts `typecheck`, `lint`, `format`, `format:check`, `test`, `test:manifest`, `test:isolation`, `verify:phase-1`, `verify:all`.

- [ ] **Step 1: Write the failing configuration test (RED)**

Create `tests/config/toolchain.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as {
  packageManager: string;
  type: string;
  engines: { node: string };
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const EXACT_DEPENDENCIES: Record<string, string> = {
  react: '19.3.0',
  'react-dom': '19.3.0',
  antd: '6.6.4',
  '@ant-design/icons': '6.3.4',
  zustand: '5.0.15',
  zod: '4.6.5',
};

const EXACT_DEV_DEPENDENCIES: Record<string, string> = {
  wxt: '0.21.4',
  '@wxt-dev/module-react': '1.2.2',
  vite: '8.3.0',
  typescript: '5.9.3',
  '@types/react': '19.3.0',
  '@types/react-dom': '19.3.0',
  '@types/node': '24.13.6',
  '@types/chrome': '0.3.0',
  eslint: '10.11.0',
  'typescript-eslint': '8.70.0',
  prettier: '3.9.8',
  vitest: '5.0.1',
  jsdom: '30.1.0',
  '@testing-library/react': '16.3.3',
  '@testing-library/dom': '10.4.2',
  '@testing-library/jest-dom': '7.0.1',
};

const REQUIRED_SCRIPTS = [
  'typecheck',
  'lint',
  'test',
  'build',
  'test:manifest',
  'test:isolation',
  'verify:phase-1',
  'verify:all',
];

const VERIFY_CHAIN =
  'pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build && pnpm run test:manifest && pnpm run test:isolation';

describe('toolchain configuration', () => {
  it('uses the pinned package manager, module type, and node engines', () => {
    expect(pkg.packageManager).toBe('pnpm@12.4.2');
    expect(pkg.type).toBe('module');
    expect(pkg.engines.node).toBe('^22.22.2 || ^24.15.0 || >=26.0.0');
  });

  it('pins every runtime and development dependency exactly', () => {
    for (const [name, version] of Object.entries(EXACT_DEPENDENCIES)) {
      expect(pkg.dependencies[name]).toBe(version);
    }
    for (const [name, version] of Object.entries(EXACT_DEV_DEPENDENCIES)) {
      expect(pkg.devDependencies[name]).toBe(version);
    }
  });

  it('declares every required verification script', () => {
    for (const script of REQUIRED_SCRIPTS) {
      expect(pkg.scripts[script], `missing script ${script}`).toBeTypeOf('string');
    }
    expect(pkg.scripts['verify:phase-1']).toBe(VERIFY_CHAIN);
    expect(pkg.scripts['verify:all']).toBe(VERIFY_CHAIN);
  });

  it('provides the test, lint, type-check, and formatting configuration files', () => {
    for (const file of ['vitest.config.ts', 'tests/setup.ts', 'eslint.config.mjs', '.prettierrc', '.prettierignore']) {
      expect(existsSync(`${root}${file}`), `missing ${file}`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

Run:

```bash
pnpm exec vitest run tests/config/toolchain.test.ts
```

Expected: FAIL. Missing scripts (`typecheck`, `lint`, `test:manifest`, `test:isolation`, `verify:phase-1`, `verify:all`) and missing configuration files prove the toolchain is not yet configured.

- [ ] **Step 3: Add the scripts to `package.json`**

Replace the `scripts` object with exactly:

```json
{
  "dev": "wxt",
  "postinstall": "wxt prepare",
  "build": "wxt build",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run --project unit",
  "test:manifest": "vitest run --project manifest",
  "test:isolation": "vitest run --project isolation",
  "verify:phase-1": "pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build && pnpm run test:manifest && pnpm run test:isolation",
  "verify:all": "pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build && pnpm run test:manifest && pnpm run test:isolation"
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcAlias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

const sharedExclude = [
  'node_modules/**',
  'dist/**',
  '.output/**',
  '.wxt/**',
];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: srcAlias },
        esbuild: { jsx: 'automatic' },
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: [
            ...sharedExclude,
            'tests/build/manifest.test.ts',
            'tests/build/isolation.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'manifest',
          environment: 'node',
          include: ['tests/build/manifest.test.ts'],
          exclude: sharedExclude,
        },
      },
      {
        test: {
          name: 'isolation',
          environment: 'node',
          include: ['tests/build/isolation.test.ts'],
          exclude: sharedExclude,
        },
      },
    ],
  },
});
```

- [ ] **Step 5: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof globalThis.ResizeObserver;
}
```

- [ ] **Step 6: Create `eslint.config.mjs`**

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['.output/**', '.wxt/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
```

- [ ] **Step 7: Create `.prettierrc` and `.prettierignore`**

`.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all"
}
```

`.prettierignore`:

```text
.output/
.wxt/
node_modules/
coverage/
.planning/
*.md
pnpm-lock.yaml
LICENSE
```

- [ ] **Step 8: Run the focused verification**

```bash
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm exec prettier --check .
pnpm run build
```

Expected: `pnpm run test` passes the `unit` project with `tests/config/toolchain.test.ts`; typecheck, lint, prettier check, and build all pass with zero errors.

- [ ] **Step 9: Record evidence, update status, and commit**

Append a dated Task 02 section to `verification.txt` (commands, exit statuses, unit test count) and create/append `.planning/evidence/phase-01/review.md` with a short configuration review. Update `.planning/STATUS.md`.

```bash
git add -A
git commit -m "chore(phase-01): configure test lint typecheck format and build"
```

**Constraints and non-goals:** configuration only; no production source modules; do not add `@eslint/js`, `globals`, or any formatter/test helper dependency; `test` must not run the `manifest` or `isolation` projects.
**Approved Interpretation 4:** the three Vitest projects are `unit`, `manifest`, and `isolation`. `pnpm run test` runs only `unit` and requires no built artefacts; `pnpm run build` must complete before `test:manifest` and `test:isolation`. Both aggregate scripts remain exactly `typecheck → lint → test → build → test:manifest → test:isolation`, and the `manifest`/`isolation` projects inspect actual build output.
**Focused verification:** Step 8 block.
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** exact script names and identical verify chains; Vitest 5 `projects` only; no excluded dependency; no content-script test.
**Code-quality and security checklist:** no secrets; `eslint`/`prettier` ignore built output; no test writes outside the workspace.
**Evidence:** `verification.txt` Task 02 section; `review.md` Task 02 section.
**Atomic commit:** `chore(phase-01): configure test lint typecheck format and build`
**Completion criteria:** Step 8 passes and the test file is green.
**Stop conditions:** peer/engine incompatibility; a required lint rule needs a non-approved dependency; Vitest `projects` unavailable in the pinned version.

---

### Task 03 — Operational Error and Diagnostic Registries with `debugLog`

**Implementation tier:** economy
**Depends on:** T02
**Files created:** `src/core/error/errorCodes.ts`, `src/core/error/debugLog.ts`, `tests/core/error/errorCodes.test.ts`, `tests/core/error/debugLog.test.ts`
**Files modified:** none
**Files that must not be modified:** any file outside the four listed
**Test files:** `tests/core/error/errorCodes.test.ts`, `tests/core/error/debugLog.test.ts`
**Interfaces produced:**
- `ERROR_CODES: readonly ErrorCode[]`, `type ErrorCode`, `ErrorCodeSchema: z.ZodEnum`
- `DIAGNOSTIC_EVENTS: readonly DiagnosticEvent[]`, `type DiagnosticEvent`, `DiagnosticEventSchema: z.ZodEnum`
- `REDACTED_CONTEXT_KEYS`, `type DebugContext`, `redactContext(context): DebugContext`
- `type ErrorLogRecord`, `type DiagnosticLogRecord`, `type DebugRecord`
- `createErrorRecord(code, context?): ErrorLogRecord`, `createDiagnosticRecord(event, context?): DiagnosticLogRecord`
- `type DebugSink = { debug(message: string): void }`, `debugLog(record: DebugRecord, sink?): void`

- [ ] **Step 1: Write the failing tests (RED)**

Create `tests/core/error/errorCodes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTIC_EVENTS,
  DiagnosticEventSchema,
  ERROR_CODES,
  ErrorCodeSchema,
} from '@/core/error/errorCodes';

describe('error code registry', () => {
  it('contains exactly the approved operational error codes in order', () => {
    expect(ERROR_CODES).toEqual([
      'RUNTIME_ENVELOPE_INVALID',
      'RUNTIME_SENDER_REJECTED',
      'WORKSPACE_INVALID_METADATA',
      'WORKSPACE_OWNERSHIP_AMBIGUOUS',
      'WORKSPACE_EPOCH_MISMATCH',
      'WORKSPACE_VERSION_CONFLICT',
      'WORKSPACE_STALE_MUTATION',
      'WORKSPACE_REHYDRATION_REQUIRED',
      'WORKSPACE_HANDOFF_FAILED',
      'STANDALONE_TAB_INVALID',
      'STANDALONE_OPEN_FAILED',
      'THEME_INVALID_VALUE',
      'THEME_PERSIST_FAILED',
    ]);
  });

  it('is a closed schema that rejects unknown operational codes', () => {
    expect(ErrorCodeSchema.safeParse('RUNTIME_ENVELOPE_INVALID').success).toBe(true);
    expect(ErrorCodeSchema.safeParse('NOT_A_CODE').success).toBe(false);
  });

  it('keeps diagnostic events separate from operational errors', () => {
    expect(DIAGNOSTIC_EVENTS).toEqual(['STANDALONE_ROUTE_FALLBACK']);
    expect(DiagnosticEventSchema.safeParse('STANDALONE_ROUTE_FALLBACK').success).toBe(true);
    expect(ErrorCodeSchema.safeParse('STANDALONE_ROUTE_FALLBACK').success).toBe(false);
    expect(DiagnosticEventSchema.safeParse('RUNTIME_ENVELOPE_INVALID').success).toBe(false);
  });
});
```

Create `tests/core/error/debugLog.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createDiagnosticRecord,
  createErrorRecord,
  debugLog,
  redactContext,
} from '@/core/error/debugLog';

describe('debugLog', () => {
  it('redacts sensitive context keys', () => {
    const redacted = redactContext({
      apiKey: 'sk-secret',
      password: 'hunter2',
      token: 'abc',
      route: 'chat',
      count: 2,
    });
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.route).toBe('chat');
    expect(redacted.count).toBe(2);
  });

  it('replaces nested objects with a redaction marker', () => {
    const redacted = redactContext({ nested: { a: 1 }, list: [1, 2] });
    expect(redacted.nested).toBe('[REDACTED]');
    expect(redacted.list).toBe('[REDACTED]');
  });

  it('emits an operational error record with the canonical code', () => {
    const sink = { debug: vi.fn() };
    debugLog(createErrorRecord('RUNTIME_ENVELOPE_INVALID', { apiKey: 'sk-secret' }), sink);
    expect(sink.debug).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sink.debug.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(payload.level).toBe('error');
    expect(payload.code).toBe('RUNTIME_ENVELOPE_INVALID');
    expect((payload.context as Record<string, unknown>).apiKey).toBe('[REDACTED]');
  });

  it('emits a diagnostic record without an error level', () => {
    const sink = { debug: vi.fn() };
    debugLog(createDiagnosticRecord('STANDALONE_ROUTE_FALLBACK', { route: 'unknown' }), sink);
    const payload = JSON.parse(sink.debug.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(payload.level).toBe('debug');
    expect(payload.event).toBe('STANDALONE_ROUTE_FALLBACK');
    expect(payload.code).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests and confirm the intended failure**

Run:

```bash
pnpm run test -- tests/core/error
```

Expected: FAIL with module-resolution errors for `@/core/error/errorCodes` and `@/core/error/debugLog`, proving the registries and logger do not exist.

- [ ] **Step 3: Implement `src/core/error/errorCodes.ts`**

```ts
import { z } from 'zod';

export const ERROR_CODES = [
  'RUNTIME_ENVELOPE_INVALID',
  'RUNTIME_SENDER_REJECTED',
  'WORKSPACE_INVALID_METADATA',
  'WORKSPACE_OWNERSHIP_AMBIGUOUS',
  'WORKSPACE_EPOCH_MISMATCH',
  'WORKSPACE_VERSION_CONFLICT',
  'WORKSPACE_STALE_MUTATION',
  'WORKSPACE_REHYDRATION_REQUIRED',
  'WORKSPACE_HANDOFF_FAILED',
  'STANDALONE_TAB_INVALID',
  'STANDALONE_OPEN_FAILED',
  'THEME_INVALID_VALUE',
  'THEME_PERSIST_FAILED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const DIAGNOSTIC_EVENTS = ['STANDALONE_ROUTE_FALLBACK'] as const;

export type DiagnosticEvent = (typeof DIAGNOSTIC_EVENTS)[number];

export const DiagnosticEventSchema = z.enum(DIAGNOSTIC_EVENTS);
```

- [ ] **Step 4: Implement `src/core/error/debugLog.ts`**

```ts
import type { DiagnosticEvent, ErrorCode } from './errorCodes';

export const REDACTED_CONTEXT_KEYS = [
  'apiKey',
  'api_key',
  'authorization',
  'body',
  'caseContent',
  'clipboard',
  'content',
  'cookie',
  'password',
  'path',
  'prompt',
  'token',
] as const;

const REDACTED = '[REDACTED]';

export type DebugContext = Record<string, unknown>;

function isSensitiveKey(key: string): boolean {
  return (REDACTED_CONTEXT_KEYS as readonly string[]).includes(key);
}

export function redactContext(context: DebugContext): DebugContext {
  const out: DebugContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (isSensitiveKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) {
      out[key] = value;
      continue;
    }
    out[key] = REDACTED;
  }
  return out;
}

export interface ErrorLogRecord {
  level: 'error';
  code: ErrorCode;
  context?: DebugContext;
  timestamp: number;
}

export interface DiagnosticLogRecord {
  level: 'debug';
  event: DiagnosticEvent;
  context?: DebugContext;
  timestamp: number;
}

export type DebugRecord = ErrorLogRecord | DiagnosticLogRecord;

export interface DebugSink {
  debug(message: string): void;
}

export function createErrorRecord(code: ErrorCode, context?: DebugContext): ErrorLogRecord {
  return { level: 'error', code, context, timestamp: Date.now() };
}

export function createDiagnosticRecord(
  event: DiagnosticEvent,
  context?: DebugContext,
): DiagnosticLogRecord {
  return { level: 'debug', event, context, timestamp: Date.now() };
}

export function debugLog(record: DebugRecord, sink: DebugSink = console): void {
  const serialised = {
    ...record,
    context: record.context ? redactContext(record.context) : undefined,
  };
  sink.debug(JSON.stringify(serialised));
}
```

- [ ] **Step 5: Run the tests and confirm they pass (GREEN)**

```bash
pnpm run test -- tests/core/error
pnpm run typecheck
pnpm run lint
```

Expected: all pass.

- [ ] **Step 6: Record evidence, update status, and commit**

Append the Task 03 section to `verification.txt` and `review.md`. Update `.planning/STATUS.md`.

```bash
git add src/core/error tests/core/error .planning
git commit -m "feat(phase-01): add error and diagnostic registries"
```

**Constraints and non-goals:** no `ErrorCode | DiagnosticEvent` union; no arbitrary-string overloads; no redaction framework beyond key-based redaction and non-primitive replacement; no network or storage access.
**Focused verification:** `pnpm run test -- tests/core/error`.
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** exactly the 13 `ErrorCode` values and the 1 `DiagnosticEvent` value from DESIGN.md Section 5; two separate closed schemas; no invented codes.
**Code-quality and security checklist:** every logged context passes `redactContext`; non-primitive values are never serialised; no empty catch; no raw sensitive content.
**Evidence:** `verification.txt` and `review.md` Task 03 sections.
**Atomic commit:** `feat(phase-01): add error and diagnostic registries`
**Completion criteria:** both test files green; typecheck and lint pass; commit created.
**Stop conditions:** a required code is missing from DESIGN.md; redaction cannot be implemented without a new dependency.

---

### Task 04 — Storage Keys and Validated Chrome-Storage Adapter

**Implementation tier:** economy
**Depends on:** T02, T03
**Files created:** `src/core/storage/storageKeys.ts`, `src/core/storage/chromeStorage.ts`, `tests/helpers/chromeMock.ts`, `tests/core/storage/storageKeys.test.ts`, `tests/core/storage/chromeStorage.test.ts`
**Files modified:** `tests/setup.ts`
**Files that must not be modified:** any file outside the six listed
**Test files:** `tests/core/storage/storageKeys.test.ts`, `tests/core/storage/chromeStorage.test.ts`
**Interfaces produced:**
- `STORAGE_AREAS`, `type StorageArea`, `STORAGE_KEYS`, `type StorageKey`, `STORAGE_KEY_AREAS`, `storageAreaForKey(key)`
- `type ChromeStorageAreaLike`, `type ChromeStorageChange`, `type ChromeStorageChangedListener`, `type ChromeStorageOnChangedLike`, `type ChromeStorageLike`
- `type StorageReadResult<T>`, `type ValidatedStorage`, `createValidatedStorage(chromeStorage?)`, `getChromeStorage()`
- Test helper: `createChromeStorageMock()`, `type StorageAreaMock`

- [ ] **Step 1: Write the failing tests (RED)**

Create `tests/helpers/chromeMock.ts`:

```ts
import { vi } from 'vitest';
import type {
  ChromeStorageAreaLike,
  ChromeStorageChange,
  ChromeStorageChangedListener,
  ChromeStorageLike,
  StorageArea,
} from '@/core/storage/chromeStorage';

export interface StorageAreaMock extends ChromeStorageAreaLike {
  _data: Map<string, unknown>;
  _setRaw(key: string, value: unknown): void;
}

export function createStorageAreaMock(): StorageAreaMock {
  const data = new Map<string, unknown>();
  const area: StorageAreaMock = {
    _data: data,
    _setRaw(key, value) {
      data.set(key, value);
    },
    get: vi.fn(async (keys: string | string[] | null) => {
      if (keys === null) return Object.fromEntries(data);
      const list = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of list) if (data.has(key)) result[key] = data.get(key);
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) data.set(key, value);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
    }),
  };
  return area;
}

export interface ChromeStorageMock extends ChromeStorageLike {
  local: StorageAreaMock;
  sync: StorageAreaMock;
  session: StorageAreaMock;
  emitStorageChange(changes: Record<string, ChromeStorageChange>, areaName: StorageArea): void;
}

export function createChromeStorageMock(): ChromeStorageMock {
  const listeners = new Set<ChromeStorageChangedListener>();
  return {
    local: createStorageAreaMock(),
    sync: createStorageAreaMock(),
    session: createStorageAreaMock(),
    onChanged: {
      addListener(listener) {
        listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
    },
    emitStorageChange(changes, areaName) {
      for (const listener of listeners) listener(changes, areaName);
    },
  };
}
```

Create `tests/core/storage/storageKeys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS, STORAGE_KEY_AREAS, storageAreaForKey } from '@/core/storage/storageKeys';

describe('storage keys', () => {
  it('declares each canonical key once', () => {
    expect(new Set(STORAGE_KEYS).size).toBe(STORAGE_KEYS.length);
    expect(STORAGE_KEYS).toEqual([
      'np_workspace_meta',
      'np_workspace_version',
      'np_workspace_election',
      'np_workspace_handoff',
      'np_standalone_tab',
      'np_theme',
      'np_theme_pack',
    ]);
  });

  it('maps each key to its approved chrome storage area', () => {
    expect(STORAGE_KEY_AREAS).toEqual({
      np_workspace_meta: 'local',
      np_workspace_version: 'local',
      np_workspace_election: 'session',
      np_workspace_handoff: 'session',
      np_standalone_tab: 'session',
      np_theme: 'sync',
      np_theme_pack: 'sync',
    });
    for (const key of STORAGE_KEYS) {
      expect(storageAreaForKey(key)).toBe(STORAGE_KEY_AREAS[key]);
    }
  });
});
```

Create `tests/core/storage/chromeStorage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';

const Schema = z.object({ value: z.number() });

describe('createValidatedStorage', () => {
  it('returns missing when a key is absent', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    await expect(storage.read('np_workspace_meta', Schema)).resolves.toEqual({ status: 'missing' });
  });

  it('returns a parsed value for valid stored data', async () => {
    const mock = createChromeStorageMock();
    mock.local._setRaw('np_workspace_meta', { value: 3 });
    const storage = createValidatedStorage(mock);
    await expect(storage.read('np_workspace_meta', Schema)).resolves.toEqual({
      status: 'valid',
      value: { value: 3 },
    });
  });

  it('returns invalid without throwing for malformed stored data', async () => {
    const mock = createChromeStorageMock();
    mock.local._setRaw('np_workspace_meta', { value: 'not-a-number' });
    const storage = createValidatedStorage(mock);
    await expect(storage.read('np_workspace_meta', Schema)).resolves.toEqual({ status: 'invalid' });
  });

  it('writes through the schema to the mapped area', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    await storage.write('np_theme', Schema, { value: 1 });
    expect(mock.sync.set).toHaveBeenCalledWith({ np_theme: { value: 1 } });
    expect(mock.local.set).not.toHaveBeenCalled();
  });

  it('rejects invalid values before writing', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    await expect(storage.write('np_theme', Schema, { value: 'bad' } as never)).rejects.toThrow();
    expect(mock.sync.set).not.toHaveBeenCalled();
  });

  it('removes a key from its mapped area', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    await storage.remove('np_workspace_election');
    expect(mock.session.remove).toHaveBeenCalledWith('np_workspace_election');
  });

  it('notifies subscribers only for the subscribed key and validates the value', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    const listener = vi.fn();
    const unsubscribe = storage.subscribe('np_theme', Schema, listener);
    mock.emitStorageChange({ np_theme: { newValue: { value: 9 } } }, 'sync');
    mock.emitStorageChange({ np_theme_pack: { newValue: 'other' } }, 'sync');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ status: 'valid', value: { value: 9 } });
    unsubscribe();
    mock.emitStorageChange({ np_theme: { newValue: { value: 10 } } }, 'sync');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports invalid on a change event with malformed data', async () => {
    const mock = createChromeStorageMock();
    const storage = createValidatedStorage(mock);
    const listener = vi.fn();
    storage.subscribe('np_theme', Schema, listener);
    mock.emitStorageChange({ np_theme: { newValue: 'bad' } }, 'sync');
    expect(listener).toHaveBeenCalledWith({ status: 'invalid' });
  });
});
```

- [ ] **Step 2: Run the tests and confirm the intended failure**

```bash
pnpm run test -- tests/core/storage
```

Expected: FAIL with module-resolution errors for `@/core/storage/storageKeys` and `@/core/storage/chromeStorage`.

- [ ] **Step 3: Implement `src/core/storage/storageKeys.ts`**

```ts
export const STORAGE_AREAS = ['local', 'sync', 'session'] as const;

export type StorageArea = (typeof STORAGE_AREAS)[number];

export const STORAGE_KEYS = [
  'np_workspace_meta',
  'np_workspace_version',
  'np_workspace_election',
  'np_workspace_handoff',
  'np_standalone_tab',
  'np_theme',
  'np_theme_pack',
] as const;

export type StorageKey = (typeof STORAGE_KEYS)[number];

export const STORAGE_KEY_AREAS: Readonly<Record<StorageKey, StorageArea>> = {
  np_workspace_meta: 'local',
  np_workspace_version: 'local',
  np_workspace_election: 'session',
  np_workspace_handoff: 'session',
  np_standalone_tab: 'session',
  np_theme: 'sync',
  np_theme_pack: 'sync',
};

export function storageAreaForKey(key: StorageKey): StorageArea {
  return STORAGE_KEY_AREAS[key];
}
```

- [ ] **Step 4: Implement `src/core/storage/chromeStorage.ts`**

```ts
import type { ZodType } from 'zod';
import type { StorageArea, StorageKey } from './storageKeys';
import { STORAGE_KEY_AREAS } from './storageKeys';

export interface ChromeStorageAreaLike {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface ChromeStorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export type ChromeStorageChangedListener = (
  changes: Record<string, ChromeStorageChange>,
  areaName: StorageArea,
) => void;

export interface ChromeStorageOnChangedLike {
  addListener(listener: ChromeStorageChangedListener): void;
  removeListener(listener: ChromeStorageChangedListener): void;
}

export interface ChromeStorageLike {
  local: ChromeStorageAreaLike;
  sync: ChromeStorageAreaLike;
  session: ChromeStorageAreaLike;
  onChanged: ChromeStorageOnChangedLike;
}

export function getChromeStorage(): ChromeStorageLike {
  const storage = (globalThis as { chrome?: { storage?: ChromeStorageLike } }).chrome?.storage;
  if (!storage) {
    throw new Error('chrome.storage is unavailable in this context');
  }
  return storage;
}

export type StorageReadResult<T> =
  | { status: 'missing' }
  | { status: 'valid'; value: T }
  | { status: 'invalid' };

export interface ValidatedStorage {
  read<T>(key: StorageKey, schema: ZodType<T>): Promise<StorageReadResult<T>>;
  write<T>(key: StorageKey, schema: ZodType<T>, value: T): Promise<void>;
  remove(key: StorageKey): Promise<void>;
  subscribe<T>(
    key: StorageKey,
    schema: ZodType<T>,
    listener: (result: StorageReadResult<T>) => void,
  ): () => void;
}

function parse<T>(schema: ZodType<T>, raw: unknown): StorageReadResult<T> {
  const result = schema.safeParse(raw);
  return result.success ? { status: 'valid', value: result.data } : { status: 'invalid' };
}

export function createValidatedStorage(
  chromeStorage: ChromeStorageLike = getChromeStorage(),
): ValidatedStorage {
  function areaFor(key: StorageKey): ChromeStorageAreaLike {
    return chromeStorage[STORAGE_KEY_AREAS[key]];
  }

  return {
    async read<T>(key, schema) {
      const record = await areaFor(key).get(key);
      if (!(key in record)) return { status: 'missing' };
      return parse(schema, record[key]);
    },
    async write<T>(key, schema, value) {
      const parsed = schema.parse(value);
      await areaFor(key).set({ [key]: parsed });
    },
    async remove(key) {
      await areaFor(key).remove(key);
    },
    subscribe<T>(key, schema, listener) {
      const areaName = STORAGE_KEY_AREAS[key];
      const handler: ChromeStorageChangedListener = (changes, changedArea) => {
        if (changedArea !== areaName || !(key in changes)) return;
        const change = changes[key];
        if (change.newValue === undefined) {
          listener({ status: 'missing' });
          return;
        }
        listener(parse(schema, change.newValue));
      };
      chromeStorage.onChanged.addListener(handler);
      return () => chromeStorage.onChanged.removeListener(handler);
    },
  };
}
```

- [ ] **Step 5: Run the tests and confirm they pass (GREEN)**

```bash
pnpm run test -- tests/core/storage
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 6: Install a default Chrome-storage mock in `tests/setup.ts`**

Component and integration tests render modules that create a validated storage adapter at runtime. Extend `tests/setup.ts` so `globalThis.chrome.storage` exists by default. Add:

```ts
import { createChromeStorageMock } from './helpers/chromeMock';

if (typeof globalThis.chrome === 'undefined') {
  (globalThis as { chrome?: unknown }).chrome = {
    storage: createChromeStorageMock(),
    runtime: { id: 'test-extension-id' },
  };
}
```

This default mock is not a substitute for the per-test mocks created with `createChromeStorageMock()`; tests that assert storage behaviour must continue to inject their own mock explicitly.

- [ ] **Step 7: Re-run the focused verification**

```bash
pnpm run test -- tests/core/storage
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 8: Record evidence, update status, and commit**

```bash
git add src/core/storage tests/core/storage tests/helpers tests/setup.ts .planning
git commit -m "feat(phase-01): add storage keys and validated storage adapter"
```

**Constraints and non-goals:** no IndexedDB; no encryption; no migration; no write journal; no WXT `storage` API; no direct `chrome.storage` call outside this adapter.
**Focused verification:** `pnpm run test -- tests/core/storage`.
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** exactly the 7 keys and the area mapping in DESIGN.md Section 9; session values never labelled durable; all reads validated.
**Code-quality and security checklist:** `read` never throws on malformed data; `write` validates before persisting; unsubscribe is idempotent-safe; no raw value logging.
**Evidence:** `verification.txt` and `review.md` Task 04 sections.
**Atomic commit:** `feat(phase-01): add storage keys and validated storage adapter`
**Completion criteria:** storage tests green; typecheck and lint pass.
**Stop conditions:** a key or area mapping is missing from DESIGN.md; adapter requires a new dependency.

---

### Task 05 — Canonical Standalone Route Registry

**Implementation tier:** economy
**Depends on:** T02
**Files created:** `src/core/registry/standaloneRoutes.ts`, `tests/core/registry/standaloneRoutes.test.ts`
**Files modified:** none
**Test files:** `tests/core/registry/standaloneRoutes.test.ts`
**Interfaces produced:**
- `STANDALONE_ROUTE_IDS`, `type StandaloneRouteId`, `StandaloneRouteIdSchema`
- `DEFAULT_STANDALONE_ROUTE_ID`, `type StandaloneRoutePlacement`
- `interface StandaloneRouteDefinition { id; label; placement; order; hash }`
- `STANDALONE_ROUTES: Readonly<Record<StandaloneRouteId, StandaloneRouteDefinition>>`
- `PRIMARY_STANDALONE_ROUTES`, `FOOTER_STANDALONE_ROUTES`
- `standaloneHashRoute(id): string`, `parseStandaloneRouteId(hash): StandaloneRouteId | undefined`, `resolveStandaloneRouteId(hash): { routeId; fellBack }`

- [ ] **Step 1: Write the failing test (RED)**

Create `tests/core/registry/standaloneRoutes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STANDALONE_ROUTE_ID,
  FOOTER_STANDALONE_ROUTES,
  PRIMARY_STANDALONE_ROUTES,
  STANDALONE_ROUTE_IDS,
  StandaloneRouteIdSchema,
  STANDALONE_ROUTES,
  parseStandaloneRouteId,
  resolveStandaloneRouteId,
  standaloneHashRoute,
} from '@/core/registry/standaloneRoutes';

describe('standalone route registry', () => {
  it('declares exactly the seven canonical routes in order', () => {
    expect(STANDALONE_ROUTE_IDS).toEqual([
      'chat',
      'agent',
      'notes',
      'write',
      'tools',
      'options',
      'diagnostics',
    ]);
  });

  it('uses chat as the default route', () => {
    expect(DEFAULT_STANDALONE_ROUTE_ID).toBe('chat');
  });

  it('places five routes in primary navigation and two in the footer', () => {
    expect(PRIMARY_STANDALONE_ROUTES.map((route) => route.id)).toEqual([
      'chat',
      'agent',
      'notes',
      'write',
      'tools',
    ]);
    expect(FOOTER_STANDALONE_ROUTES.map((route) => route.id)).toEqual(['options', 'diagnostics']);
  });

  it('renders the canonical hash format for each route', () => {
    for (const id of STANDALONE_ROUTE_IDS) {
      expect(STANDALONE_ROUTES[id].hash).toBe(`#/${id}`);
      expect(standaloneHashRoute(id)).toBe(`#/${id}`);
    }
  });

  it('validates route identifiers with a closed schema', () => {
    expect(StandaloneRouteIdSchema.safeParse('chat').success).toBe(true);
    expect(StandaloneRouteIdSchema.safeParse('teamgqm').success).toBe(false);
    expect(StandaloneRouteIdSchema.safeParse('servicenow').success).toBe(false);
  });

  it('parses valid hashes and rejects unknown ones', () => {
    expect(parseStandaloneRouteId('#/notes')).toBe('notes');
    expect(parseStandaloneRouteId('#/not-a-route')).toBeUndefined();
    expect(parseStandaloneRouteId('#/')).toBeUndefined();
    expect(parseStandaloneRouteId('notes')).toBeUndefined();
  });

  it('normalises unknown hashes to chat and reports the fallback', () => {
    expect(resolveStandaloneRouteId('#/options')).toEqual({ routeId: 'options', fellBack: false });
    expect(resolveStandaloneRouteId('#/unknown')).toEqual({ routeId: 'chat', fellBack: true });
    expect(resolveStandaloneRouteId('')).toEqual({ routeId: 'chat', fellBack: true });
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/registry/standaloneRoutes.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/registry/standaloneRoutes`.

- [ ] **Step 3: Implement `src/core/registry/standaloneRoutes.ts`**

```ts
import { z } from 'zod';

export const STANDALONE_ROUTE_IDS = [
  'chat',
  'agent',
  'notes',
  'write',
  'tools',
  'options',
  'diagnostics',
] as const;

export type StandaloneRouteId = (typeof STANDALONE_ROUTE_IDS)[number];

export const StandaloneRouteIdSchema = z.enum(STANDALONE_ROUTE_IDS);

export const DEFAULT_STANDALONE_ROUTE_ID: StandaloneRouteId = 'chat';

export type StandaloneRoutePlacement = 'primary' | 'footer';

export interface StandaloneRouteDefinition {
  id: StandaloneRouteId;
  label: string;
  placement: StandaloneRoutePlacement;
  order: number;
  hash: string;
}

export function standaloneHashRoute(id: StandaloneRouteId): string {
  return `#/${id}`;
}

export const STANDALONE_ROUTES: Readonly<Record<StandaloneRouteId, StandaloneRouteDefinition>> = {
  chat: { id: 'chat', label: 'Chat', placement: 'primary', order: 1, hash: '#/chat' },
  agent: { id: 'agent', label: 'Agent', placement: 'primary', order: 2, hash: '#/agent' },
  notes: { id: 'notes', label: 'Notes', placement: 'primary', order: 3, hash: '#/notes' },
  write: { id: 'write', label: 'Write', placement: 'primary', order: 4, hash: '#/write' },
  tools: { id: 'tools', label: 'Tools', placement: 'primary', order: 5, hash: '#/tools' },
  options: { id: 'options', label: 'Options', placement: 'footer', order: 6, hash: '#/options' },
  diagnostics: {
    id: 'diagnostics',
    label: 'Diagnostics',
    placement: 'footer',
    order: 7,
    hash: '#/diagnostics',
  },
};

export const PRIMARY_STANDALONE_ROUTES = STANDALONE_ROUTE_IDS.filter(
  (id) => STANDALONE_ROUTES[id].placement === 'primary',
).map((id) => STANDALONE_ROUTES[id]);

export const FOOTER_STANDALONE_ROUTES = STANDALONE_ROUTE_IDS.filter(
  (id) => STANDALONE_ROUTES[id].placement === 'footer',
).map((id) => STANDALONE_ROUTES[id]);

const HASH_ROUTE_PATTERN = /^#\/([a-z-]+)$/;

export function parseStandaloneRouteId(hash: string): StandaloneRouteId | undefined {
  const match = HASH_ROUTE_PATTERN.exec(hash);
  if (!match) return undefined;
  const candidate = match[1];
  return (STANDALONE_ROUTE_IDS as readonly string[]).includes(candidate)
    ? (candidate as StandaloneRouteId)
    : undefined;
}

export function resolveStandaloneRouteId(hash: string): {
  routeId: StandaloneRouteId;
  fellBack: boolean;
} {
  const routeId = parseStandaloneRouteId(hash);
  if (routeId) return { routeId, fellBack: false };
  return { routeId: DEFAULT_STANDALONE_ROUTE_ID, fellBack: true };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/registry/standaloneRoutes.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/registry/standaloneRoutes.ts tests/core/registry/standaloneRoutes.test.ts .planning
git commit -m "feat(phase-01): add canonical standalone route registry"
```

**Constraints and non-goals:** no React imports; no page components; no TeamGQM or ServiceNow entries; no query/path routing; no browser-history routing concerns here.
**Focused verification:** `pnpm run test -- tests/core/registry/standaloneRoutes.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** exactly the 7 identifiers, default `chat`, 5 primary + 2 footer, hash form `#/<id>`, unknown → chat fallback signal with no user-facing error.
**Code-quality and security checklist:** closed schema; no stringly-typed route math in UI; fallback is explicit and testable.
**Evidence:** `verification.txt` and `review.md` Task 05 sections.
**Atomic commit:** `feat(phase-01): add canonical standalone route registry`
**Completion criteria:** route test green; typecheck and lint pass.
**Stop conditions:** route identifier or placement disagreement with DESIGN.md Section 11.

### Task 06 — Workspace Types and Durable Metadata Schemas

**Implementation tier:** economy
**Depends on:** T02
**Files created:** `src/core/workspace/workspaceTypes.ts`, `tests/core/workspace/workspaceTypes.test.ts`
**Files modified:** none
**Test files:** `tests/core/workspace/workspaceTypes.test.ts`
**Interfaces produced:**
- `WORKSPACE_SCHEMA_VERSION`, `WorkspaceWriterTypeSchema`/`type WorkspaceWriterType`, `HandoffPhaseSchema`/`type HandoffPhase`, `InstanceIdSchema`/`type InstanceId`
- `WorkspaceMetadataSchema`/`type WorkspaceMetadata`, `WorkspaceVersionRecordSchema`, `ElectionRecordSchema`/`type ElectionRecord`, `HandoffRecordSchema`/`type HandoffRecord`, `StandaloneTabRecordSchema`/`type StandaloneTabRecord`
- `WorkspaceMutationKindSchema`/`type WorkspaceMutationKind`, `WorkspaceMutationSchema`/`type WorkspaceMutation`
- `createEmptyWorkspaceMetadata(now): WorkspaceMetadata`, `createInstanceId(): InstanceId`

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it } from 'vitest';
import {
  ElectionRecordSchema,
  HandoffRecordSchema,
  StandaloneTabRecordSchema,
  WORKSPACE_SCHEMA_VERSION,
  WorkspaceMetadataSchema,
  WorkspaceMutationSchema,
  createEmptyWorkspaceMetadata,
  createInstanceId,
} from '@/core/workspace/workspaceTypes';

describe('workspace types', () => {
  it('creates empty metadata at version zero', () => {
    expect(createEmptyWorkspaceMetadata(1000)).toEqual({
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      committedVersion: 0,
      updatedAt: 1000,
    });
  });

  it('creates unique instance identifiers', () => {
    expect(createInstanceId()).not.toBe(createInstanceId());
  });

  it('rejects negative versions and unknown writer types', () => {
    expect(
      WorkspaceMetadataSchema.safeParse({
        schemaVersion: 1,
        committedVersion: -1,
        updatedAt: 0,
      }).success,
    ).toBe(false);
    expect(
      ElectionRecordSchema.safeParse({
        writerType: 'background',
        writerInstanceId: 'a',
        epoch: 0,
        committedVersion: 0,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
        updatedAt: 0,
      }).success,
    ).toBe(false);
  });

  it('validates an election record with a nullable handoff target', () => {
    expect(
      ElectionRecordSchema.safeParse({
        writerType: 'sidepanel',
        writerInstanceId: 'instance-1',
        epoch: 0,
        committedVersion: 0,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
        updatedAt: 10,
      }).success,
    ).toBe(true);
  });

  it('requires an acknowledgement timestamp to be present or null', () => {
    expect(
      HandoffRecordSchema.safeParse({
        phase: 'prepared',
        fromInstanceId: 'a',
        fromWriterType: 'sidepanel',
        toInstanceId: 'b',
        toWriterType: 'standalone',
        epoch: 0,
        baseVersion: 0,
        preparedAt: 1,
        acknowledgedAt: null,
      }).success,
    ).toBe(true);
    expect(
      HandoffRecordSchema.safeParse({
        phase: 'prepared',
        fromInstanceId: 'a',
        fromWriterType: 'sidepanel',
        toInstanceId: 'b',
        toWriterType: 'standalone',
        epoch: 0,
        baseVersion: 0,
        preparedAt: 1,
      }).success,
    ).toBe(false);
  });

  it('validates a standalone tab record', () => {
    expect(StandaloneTabRecordSchema.safeParse({ tabId: 7, openedAt: 1 }).success).toBe(true);
    expect(StandaloneTabRecordSchema.safeParse({ tabId: -1, openedAt: 1 }).success).toBe(false);
  });

  it('accepts exactly one mutation kind with a schema-valid metadata payload', () => {
    const mutation = {
      mutationId: '00000000-0000-4000-8000-000000000000',
      writerInstanceId: 'writer',
      epoch: 0,
      baseVersion: 0,
      resultingVersion: 1,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 5 },
    };
    expect(WorkspaceMutationSchema.safeParse(mutation).success).toBe(true);
    expect(WorkspaceMutationSchema.safeParse({ ...mutation, kind: 'workspace.notes.set' }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/workspace/workspaceTypes.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/workspace/workspaceTypes`.

- [ ] **Step 3: Implement `src/core/workspace/workspaceTypes.ts`**

```ts
import { z } from 'zod';

export const WORKSPACE_SCHEMA_VERSION = 1 as const;

export const WorkspaceWriterTypeSchema = z.enum(['sidepanel', 'standalone']);
export type WorkspaceWriterType = z.infer<typeof WorkspaceWriterTypeSchema>;

export const HandoffPhaseSchema = z.enum(['idle', 'prepared', 'acknowledged', 'committed']);
export type HandoffPhase = z.infer<typeof HandoffPhaseSchema>;

export const InstanceIdSchema = z.string().min(1);
export type InstanceId = z.infer<typeof InstanceIdSchema>;

export function createInstanceId(): InstanceId {
  return crypto.randomUUID();
}

export const WorkspaceMetadataSchema = z.object({
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  committedVersion: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type WorkspaceMetadata = z.infer<typeof WorkspaceMetadataSchema>;

export const WorkspaceVersionRecordSchema = z.object({
  committedVersion: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type WorkspaceVersionRecord = z.infer<typeof WorkspaceVersionRecordSchema>;

export const ElectionRecordSchema = z.object({
  writerType: WorkspaceWriterTypeSchema,
  writerInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
  handoffPhase: HandoffPhaseSchema,
  handoffTargetInstanceId: InstanceIdSchema.nullable(),
  updatedAt: z.number().int().nonnegative(),
});
export type ElectionRecord = z.infer<typeof ElectionRecordSchema>;

export const HandoffRecordSchema = z.object({
  phase: z.enum(['prepared', 'acknowledged']),
  fromInstanceId: InstanceIdSchema,
  fromWriterType: WorkspaceWriterTypeSchema,
  toInstanceId: InstanceIdSchema,
  toWriterType: WorkspaceWriterTypeSchema,
  epoch: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
  preparedAt: z.number().int().nonnegative(),
  acknowledgedAt: z.number().int().nonnegative().nullable(),
});
export type HandoffRecord = z.infer<typeof HandoffRecordSchema>;

export const StandaloneTabRecordSchema = z.object({
  tabId: z.number().int().nonnegative(),
  openedAt: z.number().int().nonnegative(),
});
export type StandaloneTabRecord = z.infer<typeof StandaloneTabRecordSchema>;

export const WorkspaceMutationKindSchema = z.literal('workspace.metadata.set');
export type WorkspaceMutationKind = z.infer<typeof WorkspaceMutationKindSchema>;

export const WorkspaceMutationSchema = z.object({
  mutationId: z.string().uuid(),
  writerInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
  resultingVersion: z.number().int().nonnegative(),
  kind: WorkspaceMutationKindSchema,
  payload: WorkspaceMetadataSchema,
});
export type WorkspaceMutation = z.infer<typeof WorkspaceMutationSchema>;

export function createEmptyWorkspaceMetadata(now: number): WorkspaceMetadata {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    committedVersion: 0,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/workspace/workspaceTypes.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/workspace/workspaceTypes.ts tests/core/workspace/workspaceTypes.test.ts .planning
git commit -m "feat(phase-01): add workspace types and durable metadata schemas"
```

**Constraints and non-goals:** no store, election, handoff, or mutation logic; no IndexedDB; one mutation kind only; no conversation, note, or memory types.
**Approved Interpretation 3:** `WorkspaceMutationKind` is the closed literal `'workspace.metadata.set'`. No generic or arbitrary mutation names and no note, conversation, memory, provider, or later-phase mutation kinds are added. Extending this registry requires a future approved design and plan; the schema rejects every other literal (tested in Step 1).
**Focused verification:** `pnpm run test -- tests/core/workspace/workspaceTypes.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** election metadata fields match DESIGN.md Section 6 (writer type, instance ID, epoch, committed version, handoff state, target ID); mutation fields match (mutation ID, writer instance ID, epoch, base version, resulting version, type, payload).
**Code-quality and security checklist:** closed schemas; no `any`; instance IDs are generated with `crypto.randomUUID`.
**Evidence:** `verification.txt` and `review.md` Task 06 sections.
**Atomic commit:** `feat(phase-01): add workspace types and durable metadata schemas`
**Completion criteria:** type test green; typecheck and lint pass.
**Stop conditions:** a required field cannot be derived from DESIGN.md Section 6.

---

### Task 07 — Runtime Primitives, Payload Schemas, and `RuntimeEnvelope`

**Implementation tier:** balanced
**Depends on:** T03, T05, T06
**Files created:** `src/core/runtime/RuntimeSurface.ts`, `src/core/runtime/OperationId.ts`, `src/core/runtime/MessageType.ts`, `src/core/runtime/messageSchemas.ts`, `src/core/runtime/RuntimeEnvelope.ts`, `tests/core/runtime/runtimePrimitives.test.ts`, `tests/core/runtime/messageSchemas.test.ts`, `tests/core/runtime/runtimeEnvelope.test.ts`
**Files modified:** none
**Test files:** the three listed test files
**Interfaces produced:**
- `RUNTIME_SURFACES`, `type RuntimeSurface`, `RuntimeSurfaceSchema`, `RUNTIME_TARGETS`, `type RuntimeTarget`, `RuntimeTargetSchema`, `type WorkspaceWriterSurface`
- `OperationIdSchema`, `type OperationId`, `createOperationId()`
- `MESSAGE_TYPES`, `type MessageType`, `MessageTypeSchema`, `MESSAGE_TYPE_ALLOWED_SOURCES`
- Payload schemas `WorkspaceMutationPayload`, `WorkspaceHandoffPreparePayload`, `WorkspaceHandoffAckPayload`, `WorkspaceHandoffCommitPayload`, `WorkspaceRelinquishPayload`, `WorkspaceRehydrateRequestPayload`, `WorkspaceRehydrateResponsePayload`, `StandaloneOpenPayload`, `StandaloneFocusPayload`, `StandaloneClosedPayload`, `RuntimeErrorPayload`; `RuntimeMessageSchema`
- `RuntimeEnvelopeSchema`, `type RuntimeEnvelope`, `parseRuntimeEnvelope(input)`

- [ ] **Step 1: Write the failing tests (RED)**

Create `tests/core/runtime/runtimePrimitives.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MESSAGE_TYPES, MessageTypeSchema } from '@/core/runtime/MessageType';
import { OperationIdSchema, createOperationId } from '@/core/runtime/OperationId';
import { RUNTIME_SURFACES, RuntimeSurfaceSchema } from '@/core/runtime/RuntimeSurface';

describe('runtime primitives', () => {
  it('declares exactly three runtime surfaces', () => {
    expect(RUNTIME_SURFACES).toEqual(['background', 'sidepanel', 'standalone']);
    expect(RuntimeSurfaceSchema.safeParse('content').success).toBe(false);
  });

  it('generates valid operation identifiers', () => {
    const id = createOperationId();
    expect(OperationIdSchema.safeParse(id).success).toBe(true);
    expect(OperationIdSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('declares the eleven canonical message types in order', () => {
    expect(MESSAGE_TYPES).toEqual([
      'workspace.mutation',
      'workspace.handoff.prepare',
      'workspace.handoff.ack',
      'workspace.handoff.commit',
      'workspace.relinquish',
      'workspace.rehydrate.request',
      'workspace.rehydrate.response',
      'standalone.open',
      'standalone.focus',
      'standalone.closed',
      'runtime.error',
    ]);
    expect(MessageTypeSchema.safeParse('workspace.mutation').success).toBe(true);
    expect(MessageTypeSchema.safeParse('workspace.unknown').success).toBe(false);
  });
});
```

Create `tests/core/runtime/messageSchemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  RuntimeErrorPayload,
  StandaloneOpenPayload,
  WorkspaceMutationPayload,
  WorkspaceRehydrateRequestPayload,
} from '@/core/runtime/messageSchemas';

const VALID_MUTATION = {
  mutationId: '00000000-0000-4000-8000-000000000000',
  writerInstanceId: 'writer',
  epoch: 0,
  baseVersion: 0,
  resultingVersion: 1,
  kind: 'workspace.metadata.set',
  payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 5 },
};

describe('payload schemas', () => {
  it('validates a mutation payload', () => {
    expect(WorkspaceMutationPayload.safeParse(VALID_MUTATION).success).toBe(true);
    expect(WorkspaceMutationPayload.safeParse({ ...VALID_MUTATION, epoch: -1 }).success).toBe(false);
  });

  it('validates standalone destinations against the route registry', () => {
    expect(StandaloneOpenPayload.safeParse({ destination: 'options' }).success).toBe(true);
    expect(StandaloneOpenPayload.safeParse({ destination: 'teamgqm' }).success).toBe(false);
  });

  it('validates a rehydrate request including the requesting instance', () => {
    expect(
      WorkspaceRehydrateRequestPayload.safeParse({
        sinceVersion: 2,
        instanceId: 'standalone-instance',
        writerType: 'standalone',
      }).success,
    ).toBe(true);
    expect(
      WorkspaceRehydrateRequestPayload.safeParse({
        sinceVersion: -1,
        instanceId: 'standalone-instance',
        writerType: 'standalone',
      }).success,
    ).toBe(false);
  });

  it('validates runtime error payloads against the error registry', () => {
    expect(RuntimeErrorPayload.safeParse({ code: 'WORKSPACE_VERSION_CONFLICT' }).success).toBe(true);
    expect(RuntimeErrorPayload.safeParse({ code: 'NOT_A_CODE' }).success).toBe(false);
  });
});
```

Create `tests/core/runtime/runtimeEnvelope.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createOperationId } from '@/core/runtime/OperationId';
import { parseRuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

function validEnvelope() {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'standalone.open',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: { destination: 'chat' },
  };
}

describe('RuntimeEnvelope', () => {
  it('parses a valid envelope', () => {
    const result = parseRuntimeEnvelope(validEnvelope());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('standalone.open');
  });

  it('fails closed on an unknown message type', () => {
    const result = parseRuntimeEnvelope({ ...validEnvelope(), type: 'workspace.unknown' });
    expect(result.success).toBe(false);
  });

  it('fails closed when the payload does not match the type', () => {
    const result = parseRuntimeEnvelope({
      ...validEnvelope(),
      payload: { destination: 'not-a-route' },
    });
    expect(result.success).toBe(false);
  });

  it('fails closed on an invalid target surface', () => {
    expect(parseRuntimeEnvelope({ ...validEnvelope(), target: 'content' }).success).toBe(false);
  });

  it('rejects unknown envelope versions', () => {
    expect(parseRuntimeEnvelope({ ...validEnvelope(), envelopeVersion: 2 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and confirm the intended failure**

```bash
pnpm run test -- tests/core/runtime
```

Expected: FAIL with module-resolution errors for the five runtime modules.

- [ ] **Step 3: Implement `src/core/runtime/RuntimeSurface.ts`**

```ts
import { z } from 'zod';

export const RUNTIME_SURFACES = ['background', 'sidepanel', 'standalone'] as const;

export type RuntimeSurface = (typeof RUNTIME_SURFACES)[number];

export const RuntimeSurfaceSchema = z.enum(RUNTIME_SURFACES);

export const RUNTIME_TARGETS = ['background', 'sidepanel', 'standalone', '*'] as const;

export type RuntimeTarget = (typeof RUNTIME_TARGETS)[number];

export const RuntimeTargetSchema = z.enum(RUNTIME_TARGETS);

export type WorkspaceWriterSurface = Exclude<RuntimeSurface, 'background'>;
```

- [ ] **Step 4: Implement `src/core/runtime/OperationId.ts`**

```ts
import { z } from 'zod';

export const OperationIdSchema = z.string().uuid();

export type OperationId = z.infer<typeof OperationIdSchema>;

export function createOperationId(): OperationId {
  return crypto.randomUUID();
}
```

- [ ] **Step 5: Implement `src/core/runtime/MessageType.ts`**

```ts
import { z } from 'zod';
import type { RuntimeSurface } from './RuntimeSurface';

export const MESSAGE_TYPES = [
  'workspace.mutation',
  'workspace.handoff.prepare',
  'workspace.handoff.ack',
  'workspace.handoff.commit',
  'workspace.relinquish',
  'workspace.rehydrate.request',
  'workspace.rehydrate.response',
  'standalone.open',
  'standalone.focus',
  'standalone.closed',
  'runtime.error',
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MessageTypeSchema = z.enum(MESSAGE_TYPES);

export const MESSAGE_TYPE_ALLOWED_SOURCES: Readonly<
  Record<MessageType, readonly RuntimeSurface[]>
> = {
  'workspace.mutation': ['sidepanel', 'standalone'],
  'workspace.handoff.prepare': ['sidepanel', 'standalone'],
  'workspace.handoff.ack': ['sidepanel', 'standalone'],
  'workspace.handoff.commit': ['sidepanel', 'standalone'],
  'workspace.relinquish': ['sidepanel', 'standalone'],
  'workspace.rehydrate.request': ['sidepanel', 'standalone'],
  'workspace.rehydrate.response': ['sidepanel', 'standalone'],
  'standalone.open': ['sidepanel', 'standalone'],
  'standalone.focus': ['background', 'sidepanel', 'standalone'],
  'standalone.closed': ['standalone'],
  'runtime.error': ['background', 'sidepanel', 'standalone'],
};
```

- [ ] **Step 6: Implement `src/core/runtime/messageSchemas.ts`**

```ts
import { z } from 'zod';
import { ErrorCodeSchema } from '../error/errorCodes';
import { StandaloneRouteIdSchema } from '../registry/standaloneRoutes';
import {
  InstanceIdSchema,
  WorkspaceMetadataSchema,
  WorkspaceMutationSchema,
  WorkspaceWriterTypeSchema,
} from '../workspace/workspaceTypes';
import { MESSAGE_TYPES, type MessageType } from './MessageType';

export const WorkspaceMutationPayload = WorkspaceMutationSchema;

export const WorkspaceHandoffPreparePayload = z.object({
  toInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
});

export const WorkspaceHandoffAckPayload = z.object({
  toInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
});

export const WorkspaceHandoffCommitPayload = z.object({
  toInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
});

export const WorkspaceRelinquishPayload = z.object({
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
});

export const WorkspaceRehydrateRequestPayload = z.object({
  sinceVersion: z.number().int().nonnegative(),
  instanceId: InstanceIdSchema,
  writerType: WorkspaceWriterTypeSchema,
});

export const WorkspaceRehydrateResponsePayload = z.object({
  committedVersion: z.number().int().nonnegative(),
  epoch: z.number().int().nonnegative(),
  metadata: WorkspaceMetadataSchema,
});

export const StandaloneOpenPayload = z.object({
  destination: StandaloneRouteIdSchema,
});

export const StandaloneFocusPayload = z.object({
  destination: StandaloneRouteIdSchema,
});

export const StandaloneClosedPayload = z.object({});

export const RuntimeErrorPayload = z.object({
  code: ErrorCodeSchema,
  message: z.string().max(280).optional(),
});

export const RUNTIME_PAYLOAD_SCHEMAS: Readonly<Record<MessageType, z.ZodType>> = {
  'workspace.mutation': WorkspaceMutationPayload,
  'workspace.handoff.prepare': WorkspaceHandoffPreparePayload,
  'workspace.handoff.ack': WorkspaceHandoffAckPayload,
  'workspace.handoff.commit': WorkspaceHandoffCommitPayload,
  'workspace.relinquish': WorkspaceRelinquishPayload,
  'workspace.rehydrate.request': WorkspaceRehydrateRequestPayload,
  'workspace.rehydrate.response': WorkspaceRehydrateResponsePayload,
  'standalone.open': StandaloneOpenPayload,
  'standalone.focus': StandaloneFocusPayload,
  'standalone.closed': StandaloneClosedPayload,
  'runtime.error': RuntimeErrorPayload,
};

export const RuntimeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('workspace.mutation'), payload: WorkspaceMutationPayload }),
  z.object({ type: z.literal('workspace.handoff.prepare'), payload: WorkspaceHandoffPreparePayload }),
  z.object({ type: z.literal('workspace.handoff.ack'), payload: WorkspaceHandoffAckPayload }),
  z.object({ type: z.literal('workspace.handoff.commit'), payload: WorkspaceHandoffCommitPayload }),
  z.object({ type: z.literal('workspace.relinquish'), payload: WorkspaceRelinquishPayload }),
  z.object({ type: z.literal('workspace.rehydrate.request'), payload: WorkspaceRehydrateRequestPayload }),
  z.object({ type: z.literal('workspace.rehydrate.response'), payload: WorkspaceRehydrateResponsePayload }),
  z.object({ type: z.literal('standalone.open'), payload: StandaloneOpenPayload }),
  z.object({ type: z.literal('standalone.focus'), payload: StandaloneFocusPayload }),
  z.object({ type: z.literal('standalone.closed'), payload: StandaloneClosedPayload }),
  z.object({ type: z.literal('runtime.error'), payload: RuntimeErrorPayload }),
]);

export { MESSAGE_TYPES };
```

`RUNTIME_PAYLOAD_SCHEMAS` must map every `MessageType` exactly once; a unit test in `messageSchemas.test.ts` is added in Step 9 to assert this invariant. The `MESSAGE_TYPES` re-export exists so `RuntimeEnvelope.ts` imports both from one place; do not create a second message-type list.

- [ ] **Step 7: Implement `src/core/runtime/RuntimeEnvelope.ts`**

```ts
import { z } from 'zod';
import {
  RuntimeErrorPayload,
  StandaloneClosedPayload,
  StandaloneFocusPayload,
  StandaloneOpenPayload,
  WorkspaceHandoffAckPayload,
  WorkspaceHandoffCommitPayload,
  WorkspaceHandoffPreparePayload,
  WorkspaceMutationPayload,
  WorkspaceRehydrateRequestPayload,
  WorkspaceRehydrateResponsePayload,
  WorkspaceRelinquishPayload,
} from './messageSchemas';
import { OperationIdSchema } from './OperationId';
import { RuntimeSurfaceSchema, RuntimeTargetSchema } from './RuntimeSurface';

const envelopeBaseFields = {
  envelopeVersion: z.literal(1),
  id: OperationIdSchema,
  source: RuntimeSurfaceSchema,
  target: RuntimeTargetSchema,
  timestamp: z.number().int().nonnegative(),
  correlationId: z.string().optional(),
  electionEpoch: z.number().int().nonnegative().optional(),
  workspaceVersion: z.number().int().nonnegative().optional(),
};

export const RuntimeEnvelopeSchema = z.discriminatedUnion('type', [
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.mutation'),
    payload: WorkspaceMutationPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.prepare'),
    payload: WorkspaceHandoffPreparePayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.ack'),
    payload: WorkspaceHandoffAckPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.commit'),
    payload: WorkspaceHandoffCommitPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.relinquish'),
    payload: WorkspaceRelinquishPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.rehydrate.request'),
    payload: WorkspaceRehydrateRequestPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.rehydrate.response'),
    payload: WorkspaceRehydrateResponsePayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.open'),
    payload: StandaloneOpenPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.focus'),
    payload: StandaloneFocusPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.closed'),
    payload: StandaloneClosedPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('runtime.error'),
    payload: RuntimeErrorPayload,
  }),
]);

export type RuntimeEnvelope = z.infer<typeof RuntimeEnvelopeSchema>;

export function parseRuntimeEnvelope(input: unknown) {
  return RuntimeEnvelopeSchema.safeParse(input);
}
```

- [ ] **Step 8: Run the tests and confirm they pass (GREEN)**

```bash
pnpm run test -- tests/core/runtime
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 9: Add and run the payload-registry completeness test**

Append to `tests/core/runtime/messageSchemas.test.ts`:

```ts
import { MESSAGE_TYPES } from '@/core/runtime/MessageType';
import { RUNTIME_PAYLOAD_SCHEMAS } from '@/core/runtime/messageSchemas';

it('maps every message type to exactly one payload schema', () => {
  expect(Object.keys(RUNTIME_PAYLOAD_SCHEMAS).sort()).toEqual([...MESSAGE_TYPES].sort());
});
```

Run:

```bash
pnpm run test -- tests/core/runtime
```

Expected: PASS.

- [ ] **Step 10: Record evidence, update status, and commit**

```bash
git add src/core/runtime tests/core/runtime .planning
git commit -m "feat(phase-01): add runtime envelope primitives and registries"
```

**Constraints and non-goals:** no handlers, no transport, no sender validation (T08); unknown types fail closed via schema; no second message-type list; no `content` surface.
**Approved Interpretation 1:** `MESSAGE_TYPE_ALLOWED_SOURCES` in `MessageType.ts` is the single canonical allowed-source registry. It is explicit for every one of the eleven `MessageType` values with no wildcard, permissive default, or fallback. The registry is consumed only by `validateInboundEnvelope` (T08) and by `BroadcastBus` inbound dispatch (T09).
**Focused verification:** `pnpm run test -- tests/core/runtime`.
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** exact message-type strings and payload-schema names from DESIGN.md Section 5; envelope field names and types match; `RuntimeSurface` is exactly three values; unknown types fail closed.
**Code-quality and security checklist:** one canonical payload registry; `RuntimeMessageSchema` is a closed discriminated union; no payload accepts raw untrusted extra keys silently (Zod strips them; handlers must still validate sender in T08).
**Evidence:** `verification.txt` and `review.md` Task 07 sections.
**Atomic commit:** `feat(phase-01): add runtime envelope primitives and registries`
**Completion criteria:** all three runtime test files green; registry completeness test green; typecheck and lint pass.
**Stop conditions:** message type, payload name, or envelope field disagreement with DESIGN.md Section 5.

---

### Task 08 — Sender and Envelope Boundary Validation

**Implementation tier:** advanced (trust boundary)
**Depends on:** T07
**Files created:** none
**Files modified:** `src/core/runtime/RuntimeEnvelope.ts` (append validation exports)
**Test files:** `tests/core/runtime/boundaryValidation.test.ts`
**Interfaces produced:**
- `type SenderIdentity = { id?: string; url?: string }`
- `isTrustedExtensionSender(sender, extensionId): boolean`
- `getAllowedSources(type: MessageType): readonly RuntimeSurface[]`, `isSourceAllowed(type: MessageType, source: RuntimeSurface): boolean`
- `type InboundValidationResult = { ok: true; envelope: RuntimeEnvelope } | { ok: false; code: 'RUNTIME_ENVELOPE_INVALID' | 'RUNTIME_SENDER_REJECTED' }`
- `validateInboundEnvelope(input, sender, extensionId): InboundValidationResult`

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it } from 'vitest';
import { createOperationId } from '@/core/runtime/OperationId';
import { MESSAGE_TYPE_ALLOWED_SOURCES, MESSAGE_TYPES, type MessageType } from '@/core/runtime/MessageType';
import type { RuntimeSurface } from '@/core/runtime/RuntimeSurface';
import {
  getAllowedSources,
  isTrustedExtensionSender,
  validateInboundEnvelope,
} from '@/core/runtime/RuntimeEnvelope';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

const ALL_SURFACES: readonly RuntimeSurface[] = ['background', 'sidepanel', 'standalone'];

function payloadFor(type: MessageType): unknown {
  const payloads: Record<MessageType, unknown> = {
    'workspace.mutation': {
      mutationId: '00000000-0000-4000-8000-000000000000',
      writerInstanceId: 'writer',
      epoch: 0,
      baseVersion: 0,
      resultingVersion: 1,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 1 },
    },
    'workspace.handoff.prepare': { toInstanceId: 'target', epoch: 0, baseVersion: 0 },
    'workspace.handoff.ack': { toInstanceId: 'target', epoch: 0, committedVersion: 0 },
    'workspace.handoff.commit': { toInstanceId: 'target', epoch: 0, committedVersion: 0 },
    'workspace.relinquish': { epoch: 0, committedVersion: 0 },
    'workspace.rehydrate.request': { sinceVersion: 0, instanceId: 'target', writerType: 'standalone' },
    'workspace.rehydrate.response': {
      committedVersion: 0,
      epoch: 0,
      metadata: { schemaVersion: 1, committedVersion: 0, updatedAt: 1 },
    },
    'standalone.open': { destination: 'chat' },
    'standalone.focus': { destination: 'chat' },
    'standalone.closed': {},
    'runtime.error': { code: 'RUNTIME_ENVELOPE_INVALID' },
  };
  return payloads[type];
}

function envelopeForType(type: MessageType, source: RuntimeSurface) {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type,
    source,
    target: 'background',
    timestamp: 1,
    payload: payloadFor(type),
  };
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'standalone.open',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: { destination: 'chat' },
    ...overrides,
  };
}

const TRUSTED_SENDER = {
  id: EXTENSION_ID,
  url: `chrome-extension://${EXTENSION_ID}/sidepanel.html`,
};

describe('boundary validation', () => {
  it('accepts a valid envelope from a trusted extension sender', () => {
    const result = validateInboundEnvelope(envelope(), TRUSTED_SENDER, EXTENSION_ID);
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid envelope with RUNTIME_ENVELOPE_INVALID', () => {
    const result = validateInboundEnvelope({ nope: true }, TRUSTED_SENDER, EXTENSION_ID);
    expect(result).toEqual({ ok: false, code: 'RUNTIME_ENVELOPE_INVALID' });
  });

  it('rejects a foreign sender with RUNTIME_SENDER_REJECTED', () => {
    const result = validateInboundEnvelope(
      envelope(),
      { id: 'someoneelse', url: 'chrome-extension://someoneelse/sidepanel.html' },
      EXTENSION_ID,
    );
    expect(result).toEqual({ ok: false, code: 'RUNTIME_SENDER_REJECTED' });
  });

  it('rejects a sender without an id', () => {
    expect(
      validateInboundEnvelope(envelope(), { url: 'https://example.com' }, EXTENSION_ID),
    ).toEqual({ ok: false, code: 'RUNTIME_SENDER_REJECTED' });
  });

  it('rejects a non-extension sender url', () => {
    expect(
      isTrustedExtensionSender({ id: EXTENSION_ID, url: 'https://example.com/x' }, EXTENSION_ID),
    ).toBe(false);
  });

  it('rejects a message whose source is not allowed for its type', () => {
    const result = validateInboundEnvelope(
      envelope({ type: 'standalone.closed', payload: {} }),
      TRUSTED_SENDER,
      EXTENSION_ID,
    );
    expect(result).toEqual({ ok: false, code: 'RUNTIME_SENDER_REJECTED' });
  });

  it('accepts the background as a source for standalone.focus', () => {
    const result = validateInboundEnvelope(
      envelope({ type: 'standalone.focus', source: 'background', payload: { destination: 'chat' } }),
      { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/background.js` },
      EXTENSION_ID,
    );
    expect(result.ok).toBe(true);
  });

  it('declares exactly one explicit non-empty allowed-source list per message type', () => {
    for (const type of MESSAGE_TYPES) {
      const allowed = MESSAGE_TYPE_ALLOWED_SOURCES[type];
      expect(Array.isArray(allowed), type).toBe(true);
      expect(allowed.length, type).toBeGreaterThan(0);
      for (const source of allowed) {
        expect(ALL_SURFACES, `${type}:${source}`).toContain(source);
      }
      expect(getAllowedSources(type)).toEqual(allowed);
    }
    expect(Object.keys(MESSAGE_TYPE_ALLOWED_SOURCES).sort()).toEqual([...MESSAGE_TYPES].sort());
  });

  it('never falls back to a wildcard or permissive default', () => {
    for (const type of MESSAGE_TYPES) {
      expect(getAllowedSources(type).length).toBeLessThan(ALL_SURFACES.length + 1);
      expect(getAllowedSources(type)).not.toContain('*' as unknown as RuntimeSurface);
    }
  });

  it('accepts every message type from each of its allowed sources', () => {
    for (const type of MESSAGE_TYPES) {
      for (const source of MESSAGE_TYPE_ALLOWED_SOURCES[type]) {
        const result = validateInboundEnvelope(
          envelopeForType(type, source),
          { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/${source}` },
          EXTENSION_ID,
        );
        expect(result.ok, `${type} from ${source}`).toBe(true);
      }
    }
  });

  it('rejects a representative disallowed source for every message type that has one', () => {
    for (const type of MESSAGE_TYPES) {
      const disallowed = ALL_SURFACES.find(
        (source) => !MESSAGE_TYPE_ALLOWED_SOURCES[type].includes(source),
      );
      if (!disallowed) continue;
      const result = validateInboundEnvelope(
        envelopeForType(type, disallowed),
        { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/${disallowed}` },
        EXTENSION_ID,
      );
      expect(result, `${type} from ${disallowed}`).toEqual({
        ok: false,
        code: 'RUNTIME_SENDER_REJECTED',
      });
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/runtime/boundaryValidation.test.ts
```

Expected: FAIL because `isTrustedExtensionSender` and `validateInboundEnvelope` are not exported.

- [ ] **Step 3: Append to `src/core/runtime/RuntimeEnvelope.ts`**

```ts
import { createErrorRecord, debugLog } from '../error/debugLog';
import { MESSAGE_TYPE_ALLOWED_SOURCES, type MessageType } from './MessageType';
import type { RuntimeSurface } from './RuntimeSurface';

export function getAllowedSources(type: MessageType): readonly RuntimeSurface[] {
  return MESSAGE_TYPE_ALLOWED_SOURCES[type] ?? [];
}

export function isSourceAllowed(type: MessageType, source: RuntimeSurface): boolean {
  return getAllowedSources(type).includes(source);
}

export interface SenderIdentity {
  id?: string;
  url?: string;
}

export function isTrustedExtensionSender(
  sender: SenderIdentity | undefined,
  extensionId: string,
): boolean {
  if (!sender?.id || sender.id !== extensionId) return false;
  if (sender.url && !sender.url.startsWith(`chrome-extension://${extensionId}/`)) return false;
  return true;
}

export type InboundValidationResult =
  | { ok: true; envelope: RuntimeEnvelope }
  | { ok: false; code: 'RUNTIME_ENVELOPE_INVALID' | 'RUNTIME_SENDER_REJECTED' };

export function validateInboundEnvelope(
  input: unknown,
  sender: SenderIdentity | undefined,
  extensionId: string,
): InboundValidationResult {
  const parsed = parseRuntimeEnvelope(input);
  if (!parsed.success) {
    debugLog(createErrorRecord('RUNTIME_ENVELOPE_INVALID', { reason: 'schema' }));
    return { ok: false, code: 'RUNTIME_ENVELOPE_INVALID' };
  }
  if (!isTrustedExtensionSender(sender, extensionId)) {
    debugLog(createErrorRecord('RUNTIME_SENDER_REJECTED', { reason: 'identity' }));
    return { ok: false, code: 'RUNTIME_SENDER_REJECTED' };
  }
  if (!isSourceAllowed(parsed.data.type, parsed.data.source)) {
    // An unregistered type (empty allowed list) or a disallowed source is rejected here.
    debugLog(createErrorRecord('RUNTIME_SENDER_REJECTED', { reason: 'source' }));
    return { ok: false, code: 'RUNTIME_SENDER_REJECTED' };
  }
  return { ok: true, envelope: parsed.data };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/runtime/boundaryValidation.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/runtime/RuntimeEnvelope.ts tests/core/runtime/boundaryValidation.test.ts .planning
git commit -m "feat(phase-01): validate runtime envelope and sender at boundaries"
```

**Constraints and non-goals:** validation lives only in `RuntimeEnvelope.ts`; no new file; no handlers; no transport; validation never throws to callers; both failure paths log canonical error codes with no raw content.
**Approved Interpretation 1:** the closed, typed `MESSAGE_TYPE_ALLOWED_SOURCES` registry is canonical in `MessageType.ts`, explicit for every message type, validated at every runtime boundary, and free of wildcard or permissive defaults. Tests cover every message type, all its allowed sources, and representative disallowed sources; unregistered types and disallowed sources yield `RUNTIME_SENDER_REJECTED` (schema-invalid types remain `RUNTIME_ENVELOPE_INVALID`).
**Focused verification:** `pnpm run test -- tests/core/runtime/boundaryValidation.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** invalid envelope → `RUNTIME_ENVELOPE_INVALID`; untrusted sender → `RUNTIME_SENDER_REJECTED`; fail closed; no arbitrary error strings.
**Code-quality and security checklist:** sender identity is checked before use; foreign extension IDs are rejected; URL scheme is validated; no raw payload logged.
**Evidence:** `verification.txt` and `review.md` Task 08 sections, including the source-map observation.
**Atomic commit:** `feat(phase-01): validate runtime envelope and sender at boundaries`
**Completion criteria:** boundary test green; typecheck and lint pass.
**Stop conditions:** the operator rejects the allowed-source map; the design requires a different trust rule.

---

### Task 09 — Canonical Broadcast Bus

**Implementation tier:** balanced
**Depends on:** T08
**Files created:** `src/core/runtime/BroadcastBus.ts`, `tests/core/runtime/broadcastBus.test.ts`
**Files modified:** none
**Test files:** `tests/core/runtime/broadcastBus.test.ts`
**Interfaces produced:**
- `type RawMessageListener = (message: unknown, sender: unknown) => void`
- `interface BroadcastBusDependencies { extensionId: string; sendMessage(message: RuntimeEnvelope): Promise<unknown>; addMessageListener(listener: RawMessageListener): void; removeMessageListener(listener: RawMessageListener): void }`
- `interface BroadcastBus { send(envelope): Promise<void>; on(type, handler): () => void }`
- `createBroadcastBus(deps): BroadcastBus`
- Inbound dispatch validates sender and envelope with `validateInboundEnvelope` (Approved Interpretation 1) before any handler runs.

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createBroadcastBus } from '@/core/runtime/BroadcastBus';
import { createOperationId } from '@/core/runtime/OperationId';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

function envelope(overrides: Partial<RuntimeEnvelope> = {}): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'standalone.open',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: { destination: 'chat' },
    ...overrides,
  } as RuntimeEnvelope;
}

const EXTENSION_ID = 'test-extension-id';
const TRUSTED_SENDER = {
  id: EXTENSION_ID,
  url: `chrome-extension://${EXTENSION_ID}/sidepanel.html`,
};

function createDeps() {
  const listeners = new Set<(message: unknown, sender: unknown) => void>();
  return {
    listeners,
    deps: {
      extensionId: EXTENSION_ID,
      sendMessage: vi.fn(async () => undefined),
      addMessageListener(listener: (message: unknown, sender: unknown) => void) {
        listeners.add(listener);
      },
      removeMessageListener(listener: (message: unknown, sender: unknown) => void) {
        listeners.delete(listener);
      },
    },
  };
}

describe('BroadcastBus', () => {
  it('sends envelopes through the injected transport', async () => {
    const { deps } = createDeps();
    const bus = createBroadcastBus(deps);
    const message = envelope();
    await bus.send(message);
    expect(deps.sendMessage).toHaveBeenCalledWith(message);
  });

  it('delivers only envelopes of the subscribed type', () => {
    const { deps, listeners } = createDeps();
    const bus = createBroadcastBus(deps);
    const handler = vi.fn();
    bus.on('standalone.open', handler);
    for (const listener of listeners) {
      listener(envelope(), TRUSTED_SENDER);
      listener(envelope({ type: 'standalone.focus', payload: { destination: 'chat' } }), TRUSTED_SENDER);
    }
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe('standalone.open');
  });

  it('ignores messages from an untrusted sender', () => {
    const { deps, listeners } = createDeps();
    const bus = createBroadcastBus(deps);
    const handler = vi.fn();
    bus.on('standalone.open', handler);
    for (const listener of listeners) {
      listener(envelope(), { id: 'someoneelse', url: 'chrome-extension://someoneelse/sidepanel.html' });
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores malformed incoming messages without throwing', () => {
    const { deps, listeners } = createDeps();
    const bus = createBroadcastBus(deps);
    const handler = vi.fn();
    bus.on('standalone.open', handler);
    for (const listener of listeners) listener({ nope: true }, undefined);
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe', () => {
    const { deps, listeners } = createDeps();
    const bus = createBroadcastBus(deps);
    const handler = vi.fn();
    const off = bus.on('standalone.open', handler);
    off();
    for (const listener of listeners) listener(envelope(), TRUSTED_SENDER);
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/runtime/broadcastBus.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/runtime/BroadcastBus`.

- [ ] **Step 3: Implement `src/core/runtime/BroadcastBus.ts`**

```ts
import type { MessageType } from './MessageType';
import {
  validateInboundEnvelope,
  type RuntimeEnvelope,
  type SenderIdentity,
} from './RuntimeEnvelope';

export type RawMessageListener = (message: unknown, sender: unknown) => void;

export interface BroadcastBusDependencies {
  extensionId: string;
  sendMessage(message: RuntimeEnvelope): Promise<unknown>;
  addMessageListener(listener: RawMessageListener): void;
  removeMessageListener(listener: RawMessageListener): void;
}

export type EnvelopeHandler = (envelope: RuntimeEnvelope, sender: unknown) => void;

export interface BroadcastBus {
  send(envelope: RuntimeEnvelope): Promise<void>;
  on(type: MessageType, handler: EnvelopeHandler): () => void;
}

export function createBroadcastBus(deps: BroadcastBusDependencies): BroadcastBus {
  const listeners = new Map<RawMessageListener, Map<MessageType, Set<EnvelopeHandler>>>();

  function dispatch(message: unknown, sender: unknown): void {
    const validated = validateInboundEnvelope(message, sender as SenderIdentity, deps.extensionId);
    if (!validated.ok) return;
    for (const byType of listeners.values()) {
      const handlers = byType.get(validated.envelope.type);
      if (!handlers) continue;
      for (const handler of handlers) handler(validated.envelope, sender);
    }
  }

  return {
    async send(envelope) {
      await deps.sendMessage(envelope);
    },
    on(type, handler) {
      let raw = [...listeners.keys()].find((candidate) =>
        listeners.get(candidate)?.has(type),
      );
      if (!raw) {
        raw = (message, sender) => dispatch(message, sender);
        listeners.set(raw, new Map());
        deps.addMessageListener(raw);
      }
      const byType = listeners.get(raw)!;
      const handlers = byType.get(type) ?? new Set<EnvelopeHandler>();
      handlers.add(handler);
      byType.set(type, handlers);
      return () => {
        const current = listeners.get(raw!);
        current?.get(type)?.delete(handler);
        if (current && [...current.values()].every((set) => set.size === 0)) {
          deps.removeMessageListener(raw!);
          listeners.delete(raw!);
        }
      };
    },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/runtime/broadcastBus.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/runtime/BroadcastBus.ts tests/core/runtime/broadcastBus.test.ts .planning
git commit -m "feat(phase-01): add canonical broadcast bus"
```

**Constraints and non-goals:** transport and in-process dispatch only; inbound sender and envelope validation is performed centrally in `dispatch` via `validateInboundEnvelope` with the injected `extensionId` (Approved Interpretation 1); no handler receives an unvalidated envelope; no retries; no queues; no direct `chrome.*` reference (dependencies are injected).
**Focused verification:** `pnpm run test -- tests/core/runtime/broadcastBus.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** all outgoing messages are `RuntimeEnvelope`; malformed incoming messages fail closed and log `RUNTIME_ENVELOPE_INVALID`; no invented message types.
**Code-quality and security checklist:** no raw message logged; listener cleanup on unsubscribe; no duplicate raw listeners per type.
**Evidence:** `verification.txt` and `review.md` Task 09 sections.
**Atomic commit:** `feat(phase-01): add canonical broadcast bus`
**Completion criteria:** bus test green; typecheck and lint pass.
**Stop conditions:** transport API requirement exceeds injected dependencies.

### Task 10 — Standalone Navigation Request Contract

**Implementation tier:** balanced
**Depends on:** T08, T09
**Files created:** `src/core/runtime/StandaloneNavigation.ts`, `tests/core/runtime/standaloneNavigation.test.ts`
**Files modified:** none
**Test files:** `tests/core/runtime/standaloneNavigation.test.ts`
**Interfaces produced:**
- `type StandaloneNavigationOpenRequest`, `type StandaloneNavigationFocusRequest`, `type StandaloneNavigationRequest`
- `createStandaloneOpenEnvelope(destination, source): RuntimeEnvelope`
- `createStandaloneFocusEnvelope(destination, source): RuntimeEnvelope`
- `readStandaloneNavigationRequest(envelope): StandaloneNavigationRequest | undefined`
- `openStandalone(destination, surface, bus): Promise<void>`
- `focusStandalone(destination, surface, bus): Promise<void>`

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createStandaloneFocusEnvelope,
  createStandaloneOpenEnvelope,
  focusStandalone,
  openStandalone,
  readStandaloneNavigationRequest,
} from '@/core/runtime/StandaloneNavigation';
import { parseRuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

describe('standalone navigation contract', () => {
  it('builds a valid standalone.open envelope targeted at the background', () => {
    const envelope = createStandaloneOpenEnvelope('chat', 'sidepanel');
    expect(parseRuntimeEnvelope(envelope).success).toBe(true);
    expect(envelope.type).toBe('standalone.open');
    expect(envelope.target).toBe('background');
    expect(envelope.source).toBe('sidepanel');
    expect(envelope.payload).toEqual({ destination: 'chat' });
  });

  it('builds a valid standalone.focus envelope targeted at the standalone surface', () => {
    const envelope = createStandaloneFocusEnvelope('options', 'background');
    expect(parseRuntimeEnvelope(envelope).success).toBe(true);
    expect(envelope.type).toBe('standalone.focus');
    expect(envelope.target).toBe('standalone');
    expect(envelope.payload).toEqual({ destination: 'options' });
  });

  it('reads navigation requests from both message types', () => {
    expect(readStandaloneNavigationRequest(createStandaloneOpenEnvelope('notes', 'sidepanel'))).toEqual(
      { kind: 'open', destination: 'notes' },
    );
    expect(
      readStandaloneNavigationRequest(createStandaloneFocusEnvelope('tools', 'background')),
    ).toEqual({ kind: 'focus', destination: 'tools' });
  });

  it('returns undefined for unrelated envelopes', () => {
    const envelope = createStandaloneOpenEnvelope('chat', 'sidepanel');
    expect(
      readStandaloneNavigationRequest({
        ...envelope,
        type: 'workspace.relinquish',
        payload: { epoch: 0, committedVersion: 0 },
      } as never),
    ).toBeUndefined();
  });

  it('openStandalone sends the open envelope through the bus', async () => {
    const bus = { send: vi.fn(async () => {}), on: vi.fn() };
    await openStandalone('chat', 'sidepanel', bus);
    expect(bus.send).toHaveBeenCalledTimes(1);
    expect(bus.send.mock.calls[0][0].type).toBe('standalone.open');
  });

  it('focusStandalone sends the focus envelope through the bus', async () => {
    const bus = { send: vi.fn(async () => {}), on: vi.fn() };
    await focusStandalone('diagnostics', 'background', bus);
    expect(bus.send.mock.calls[0][0].type).toBe('standalone.focus');
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/runtime/standaloneNavigation.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/runtime/StandaloneNavigation`.

- [ ] **Step 3: Implement `src/core/runtime/StandaloneNavigation.ts`**

```ts
import { StandaloneRouteIdSchema, type StandaloneRouteId } from '../registry/standaloneRoutes';
import type { BroadcastBus } from './BroadcastBus';
import { createOperationId } from './OperationId';
import type { RuntimeEnvelope } from './RuntimeEnvelope';
import type { WorkspaceWriterSurface } from './RuntimeSurface';

export interface StandaloneNavigationOpenRequest {
  kind: 'open';
  destination: StandaloneRouteId;
}

export interface StandaloneNavigationFocusRequest {
  kind: 'focus';
  destination: StandaloneRouteId;
}

export type StandaloneNavigationRequest =
  | StandaloneNavigationOpenRequest
  | StandaloneNavigationFocusRequest;

function createNavigationEnvelope(
  type: 'standalone.open' | 'standalone.focus',
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface | 'background',
): RuntimeEnvelope {
  const parsedDestination = StandaloneRouteIdSchema.parse(destination);
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type,
    source,
    target: type === 'standalone.open' ? 'background' : 'standalone',
    timestamp: Date.now(),
    payload: { destination: parsedDestination },
  };
}

export function createStandaloneOpenEnvelope(
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return createNavigationEnvelope('standalone.open', destination, source);
}

export function createStandaloneFocusEnvelope(
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface | 'background',
): RuntimeEnvelope {
  return createNavigationEnvelope('standalone.focus', destination, source);
}

export function readStandaloneNavigationRequest(
  envelope: RuntimeEnvelope,
): StandaloneNavigationRequest | undefined {
  if (envelope.type === 'standalone.open') {
    return { kind: 'open', destination: envelope.payload.destination };
  }
  if (envelope.type === 'standalone.focus') {
    return { kind: 'focus', destination: envelope.payload.destination };
  }
  return undefined;
}

export async function openStandalone(
  destination: StandaloneRouteId,
  surface: WorkspaceWriterSurface,
  bus: Pick<BroadcastBus, 'send'>,
): Promise<void> {
  await bus.send(createStandaloneOpenEnvelope(destination, surface));
}

export async function focusStandalone(
  destination: StandaloneRouteId,
  surface: WorkspaceWriterSurface | 'background',
  bus: Pick<BroadcastBus, 'send'>,
): Promise<void> {
  await bus.send(createStandaloneFocusEnvelope(destination, surface));
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/runtime/standaloneNavigation.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/runtime/StandaloneNavigation.ts tests/core/runtime/standaloneNavigation.test.ts .planning
git commit -m "feat(phase-01): add standalone navigation request contract"
```

**Constraints and non-goals:** no `chrome.tabs` in this module; no routing strings beyond the route registry; no UI; no handoff logic (the Side Panel action composes handoff + open in T21).
**Focused verification:** `pnpm run test -- tests/core/runtime/standaloneNavigation.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** uses only canonical route IDs and message types; destination is typed and schema-validated; open targets background, focus targets the live standalone.
**Code-quality and security checklist:** destination validated before envelope creation; no invented destinations; no direct tab API.
**Evidence:** `verification.txt` and `review.md` Task 10 sections.
**Atomic commit:** `feat(phase-01): add standalone navigation request contract`
**Completion criteria:** navigation test green; typecheck and lint pass.
**Stop conditions:** destination conveyance requires a new message type or a tabs call in this module.

---

### Task 11 — Singleton Standalone Tab Controller (Create, Focus, Stale-ID Recovery, Close)

**Implementation tier:** advanced (tab identity and recovery)
**Depends on:** T10, T04, T06
**Files created:** none
**Files modified:** `src/core/runtime/StandaloneNavigation.ts` (append controller)
**Test files:** `tests/core/runtime/standaloneTabController.test.ts`
**Interfaces produced:**
- `interface StandaloneTabApi { get; create; update; focusWindow }`
- `interface StandaloneTabControllerDependencies { tabs; storage; buildStandaloneUrl; sendFocus; now }`
- `type StandaloneOpenResult = { status: 'created' | 'focused'; tabId: number } | { status: 'failed'; code: 'STANDALONE_OPEN_FAILED' | 'STANDALONE_TAB_INVALID' }`
- `createStandaloneTabController(deps): { open; handleTabRemoved; readRecord }`

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createStandaloneTabController } from '@/core/runtime/StandaloneNavigation';
import { StandaloneTabRecordSchema } from '@/core/workspace/workspaceTypes';

function setup(overrides: Partial<Parameters<typeof createStandaloneTabController>[0]> = {}) {
  const chromeStorage = createChromeStorageMock();
  const storage = createValidatedStorage(chromeStorage);
  const tabs = {
    get: vi.fn(async (tabId: number) => ({ id: tabId })),
    create: vi.fn(async () => ({ id: 42 })),
    update: vi.fn(async () => undefined),
    focusWindow: vi.fn(async () => undefined),
  };
  const sendFocus = vi.fn(async () => undefined);
  const controller = createStandaloneTabController({
    tabs,
    storage,
    buildStandaloneUrl: (destination) => `chrome-extension://test/standalone.html#/${destination}`,
    sendFocus,
    now: () => 100,
    ...overrides,
  });
  return { chromeStorage, storage, tabs, sendFocus, controller };
}

describe('standalone tab controller', () => {
  it('creates a singleton tab and stores its id when none exists', async () => {
    const { controller, tabs, storage } = setup();
    const result = await controller.open('chat');
    expect(tabs.create).toHaveBeenCalledWith(
      'chrome-extension://test/standalone.html#/chat',
    );
    expect(result).toEqual({ status: 'created', tabId: 42 });
    await expect(storage.read('np_standalone_tab', StandaloneTabRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: { tabId: 42, openedAt: 100 },
    });
  });

  it('focuses the existing singleton tab and forwards the destination', async () => {
    const { controller, tabs, storage, sendFocus } = setup();
    await storage.write('np_standalone_tab', StandaloneTabRecordSchema, { tabId: 7, openedAt: 1 });
    const result = await controller.open('options');
    expect(tabs.get).toHaveBeenCalledWith(7);
    expect(tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(tabs.focusWindow).toHaveBeenCalledWith(7);
    expect(tabs.create).not.toHaveBeenCalled();
    expect(sendFocus).toHaveBeenCalledTimes(1);
    expect(sendFocus.mock.calls[0][0].type).toBe('standalone.focus');
    expect(sendFocus.mock.calls[0][0].payload).toEqual({ destination: 'options' });
    expect(result).toEqual({ status: 'focused', tabId: 7 });
  });

  it('recovers from a stale tab id by clearing it and creating a new tab', async () => {
    const { controller, tabs, storage } = setup();
    await storage.write('np_standalone_tab', StandaloneTabRecordSchema, { tabId: 7, openedAt: 1 });
    tabs.get.mockRejectedValueOnce(new Error('No tab with id: 7'));
    const result = await controller.open('chat');
    expect(tabs.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'created', tabId: 42 });
    await expect(storage.read('np_standalone_tab', StandaloneTabRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: { tabId: 42, openedAt: 100 },
    });
  });

  it('treats a malformed stored record as absent', async () => {
    const { controller, tabs, chromeStorage } = setup();
    chromeStorage.session._setRaw('np_standalone_tab', { tabId: 'not-a-number' });
    const result = await controller.open('chat');
    expect(tabs.create).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('created');
  });

  it('fails closed when tab creation returns no id', async () => {
    const { controller, tabs } = setup();
    tabs.create.mockResolvedValueOnce({});
    const result = await controller.open('chat');
    expect(result).toEqual({ status: 'failed', code: 'STANDALONE_OPEN_FAILED' });
  });

  it('clears the stored record when the singleton tab is removed', async () => {
    const { controller, storage } = setup();
    await storage.write('np_standalone_tab', StandaloneTabRecordSchema, { tabId: 7, openedAt: 1 });
    await expect(controller.handleTabRemoved(7)).resolves.toBe(true);
    await expect(storage.read('np_standalone_tab', StandaloneTabRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('ignores removal of an unrelated tab', async () => {
    const { controller, storage } = setup();
    await storage.write('np_standalone_tab', StandaloneTabRecordSchema, { tabId: 7, openedAt: 1 });
    await expect(controller.handleTabRemoved(99)).resolves.toBe(false);
    await expect(storage.read('np_standalone_tab', StandaloneTabRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: { tabId: 7, openedAt: 1 },
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/runtime/standaloneTabController.test.ts
```

Expected: FAIL because `createStandaloneTabController` is not exported.

- [ ] **Step 3: Append to `src/core/runtime/StandaloneNavigation.ts`**

Add these imports to the existing top import block of the file (do not create a self-import and do not duplicate the `StandaloneNavigation` import):

```ts
import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import type { StorageKey } from '../storage/storageKeys';
import { StandaloneTabRecordSchema, type StandaloneTabRecord } from '../workspace/workspaceTypes';
```

Then append the following controller implementation at the end of the file:

```ts
export interface StandaloneTabApi {
  get(tabId: number): Promise<{ id?: number }>;
  create(url: string): Promise<{ id?: number }>;
  update(tabId: number, props: { active: boolean }): Promise<unknown>;
  focusWindow(tabId: number): Promise<void>;
}

export interface StandaloneTabControllerDependencies {
  tabs: StandaloneTabApi;
  storage: ValidatedStorage;
  buildStandaloneUrl(destination: StandaloneRouteId): string;
  sendFocus(envelope: RuntimeEnvelope): Promise<void>;
  now(): number;
}

export type StandaloneOpenResult =
  | { status: 'created' | 'focused'; tabId: number }
  | { status: 'failed'; code: 'STANDALONE_OPEN_FAILED' | 'STANDALONE_TAB_INVALID' };

export interface StandaloneTabController {
  open(destination: StandaloneRouteId): Promise<StandaloneOpenResult>;
  handleTabRemoved(tabId: number): Promise<boolean>;
  readRecord(): Promise<StandaloneTabRecord | undefined>;
}

const STANDALONE_TAB_KEY: StorageKey = 'np_standalone_tab';

export function createStandaloneTabController(
  deps: StandaloneTabControllerDependencies,
): StandaloneTabController {
  async function readRecord(): Promise<StandaloneTabRecord | undefined> {
    const result = await deps.storage.read(STANDALONE_TAB_KEY, StandaloneTabRecordSchema);
    if (result.status === 'valid') return result.value;
    if (result.status === 'invalid') {
      debugLog(createErrorRecord('STANDALONE_TAB_INVALID', { reason: 'record' }));
    }
    return undefined;
  }

  return {
    readRecord,
    async open(destination) {
      const record = await readRecord();
      if (record) {
        let live = false;
        try {
          const tab = await deps.tabs.get(record.tabId);
          live = tab.id !== undefined;
        } catch {
          live = false;
        }
        if (live) {
          await deps.tabs.update(record.tabId, { active: true });
          await deps.tabs.focusWindow(record.tabId);
          await deps.sendFocus(createStandaloneFocusEnvelope(destination, 'background'));
          return { status: 'focused', tabId: record.tabId };
        }
        debugLog(createErrorRecord('STANDALONE_TAB_INVALID', { reason: 'stale' }));
        await deps.storage.remove(STANDALONE_TAB_KEY);
      }

      let created: { id?: number };
      try {
        created = await deps.tabs.create(deps.buildStandaloneUrl(destination));
      } catch {
        debugLog(createErrorRecord('STANDALONE_OPEN_FAILED', { reason: 'create' }));
        return { status: 'failed', code: 'STANDALONE_OPEN_FAILED' };
      }
      if (created.id === undefined) {
        debugLog(createErrorRecord('STANDALONE_OPEN_FAILED', { reason: 'missing-id' }));
        return { status: 'failed', code: 'STANDALONE_OPEN_FAILED' };
      }
      await deps.storage.write(STANDALONE_TAB_KEY, StandaloneTabRecordSchema, {
        tabId: created.id,
        openedAt: deps.now(),
      });
      return { status: 'created', tabId: created.id };
    },
    async handleTabRemoved(tabId) {
      const record = await readRecord();
      if (!record || record.tabId !== tabId) return false;
      await deps.storage.remove(STANDALONE_TAB_KEY);
      return true;
    },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/runtime/standaloneTabController.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/runtime/StandaloneNavigation.ts tests/core/runtime/standaloneTabController.test.ts .planning
git commit -m "feat(phase-01): add singleton standalone tab controller"
```

**Constraints and non-goals:** never call `chrome.tabs.query`; never read URL, title, favicon, or page content; the injected API is the only tab surface; `chrome.tabs` is wired only in the background entrypoint (T22); the unload `standalone.closed` message is not used here and remains non-authoritative.
**Focused verification:** `pnpm run test -- tests/core/runtime/standaloneTabController.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** singleton identity is the stored tab ID; open validates via `get`, focuses via `update` + `focusWindow`, clears stale IDs, creates the entrypoint at the requested hash route; close recovery is `onRemoved` + stored-ID validation.
**Code-quality and security checklist:** no URL/title read; stale recovery is deterministic; create failure fails closed with a canonical code; no duplicate tab.
**Evidence:** `verification.txt` and `review.md` Task 11 sections.
**Atomic commit:** `feat(phase-01): add singleton standalone tab controller`
**Completion criteria:** tab controller test green; typecheck and lint pass.
**Stop conditions:** `tabs` permission or a `tabs.query`/URL read is required (escalate per DESIGN.md Section 7); popup/query-based dedup is required.

---

### Task 12 — Workspace Metadata Store and Durable Version

**Implementation tier:** balanced
**Depends on:** T04, T06
**Files created:** `src/core/workspace/WorkspaceStore.ts`, `tests/core/workspace/workspaceStore.test.ts`
**Files modified:** none
**Test files:** `tests/core/workspace/workspaceStore.test.ts`
**Interfaces produced:**
- `interface WorkspaceStore { readMetadata(); writeMetadata(); readVersion(); writeVersion() }`
- `createWorkspaceStore(storage: ValidatedStorage): WorkspaceStore`
- `type WorkspaceMetadataReadResult = { status: 'missing' } | { status: 'valid'; metadata } | { status: 'invalid' }`

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createEmptyWorkspaceMetadata } from '@/core/workspace/workspaceTypes';

describe('workspace store', () => {
  it('reports missing metadata and zero version for a fresh profile', async () => {
    const store = createWorkspaceStore(createValidatedStorage(createChromeStorageMock()));
    await expect(store.readMetadata()).resolves.toEqual({ status: 'missing' });
    await expect(store.readVersion()).resolves.toBe(0);
  });

  it('persists metadata and version to chrome.storage.local', async () => {
    const chromeStorage = createChromeStorageMock();
    const store = createWorkspaceStore(createValidatedStorage(chromeStorage));
    const metadata = createEmptyWorkspaceMetadata(1000);
    await store.writeMetadata(metadata);
    await expect(store.readMetadata()).resolves.toEqual({ status: 'valid', metadata });
    await expect(store.readVersion()).resolves.toBe(0);
    expect(chromeStorage.local.set).toHaveBeenCalled();
    expect(chromeStorage.sync.set).not.toHaveBeenCalled();
  });

  it('reports invalid metadata instead of throwing', async () => {
    const chromeStorage = createChromeStorageMock();
    chromeStorage.local._setRaw('np_workspace_meta', { schemaVersion: 'bad' });
    const store = createWorkspaceStore(createValidatedStorage(chromeStorage));
    await expect(store.readMetadata()).resolves.toEqual({ status: 'invalid' });
  });

  it('falls back to version zero for invalid version records', async () => {
    const chromeStorage = createChromeStorageMock();
    chromeStorage.local._setRaw('np_workspace_version', { committedVersion: 'nope' });
    const store = createWorkspaceStore(createValidatedStorage(chromeStorage));
    await expect(store.readVersion()).resolves.toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/workspace/workspaceStore.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/workspace/WorkspaceStore`.

- [ ] **Step 3: Implement `src/core/workspace/WorkspaceStore.ts`**

```ts
import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import {
  WorkspaceMetadataSchema,
  WorkspaceVersionRecordSchema,
  type WorkspaceMetadata,
} from './workspaceTypes';

export type WorkspaceMetadataReadResult =
  | { status: 'missing' }
  | { status: 'valid'; metadata: WorkspaceMetadata }
  | { status: 'invalid' };

export interface WorkspaceStore {
  readMetadata(): Promise<WorkspaceMetadataReadResult>;
  writeMetadata(metadata: WorkspaceMetadata): Promise<void>;
  readVersion(): Promise<number>;
  writeVersion(committedVersion: number, updatedAt: number): Promise<void>;
}

export function createWorkspaceStore(storage: ValidatedStorage): WorkspaceStore {
  return {
    async readMetadata() {
      const result = await storage.read('np_workspace_meta', WorkspaceMetadataSchema);
      if (result.status === 'valid') return { status: 'valid', metadata: result.value };
      if (result.status === 'invalid') {
        debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_meta' }));
        return { status: 'invalid' };
      }
      return { status: 'missing' };
    },
    async writeMetadata(metadata) {
      await storage.write('np_workspace_meta', WorkspaceMetadataSchema, metadata);
      await storage.write('np_workspace_version', WorkspaceVersionRecordSchema, {
        committedVersion: metadata.committedVersion,
        updatedAt: metadata.updatedAt,
      });
    },
    async readVersion() {
      const result = await storage.read('np_workspace_version', WorkspaceVersionRecordSchema);
      if (result.status === 'valid') return result.value.committedVersion;
      if (result.status === 'invalid') {
        debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_version' }));
      }
      return 0;
    },
    async writeVersion(committedVersion, updatedAt) {
      await storage.write('np_workspace_version', WorkspaceVersionRecordSchema, {
        committedVersion,
        updatedAt,
      });
    },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/workspace/workspaceStore.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/workspace/WorkspaceStore.ts tests/core/workspace/workspaceStore.test.ts .planning
git commit -m "feat(phase-01): persist workspace metadata and version"
```

**Constraints and non-goals:** no IndexedDB; no conversation bodies; invalid metadata is surfaced, never silently repaired; no encryption (Phase 2).
**Focused verification:** `pnpm run test -- tests/core/workspace/workspaceStore.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** only `np_workspace_meta` and `np_workspace_version` in `chrome.storage.local`; durability wording matches DESIGN.md Section 9; invalid metadata logs `WORKSPACE_INVALID_METADATA`.
**Code-quality and security checklist:** reads never throw on malformed data; no raw value logging; local storage only for workspace metadata.
**Evidence:** `verification.txt` and `review.md` Task 12 sections.
**Atomic commit:** `feat(phase-01): persist workspace metadata and version`
**Completion criteria:** store test green; typecheck and lint pass.
**Stop conditions:** durable metadata requires a store or key outside DESIGN.md Section 9.

### Task 13 — Writer Election

> **Superseded (ADR-0001):** the direct multi-context election write path
> implemented and committed by this task (`claim()`, `relinquish()` writing
> `np_workspace_election` directly) is superseded by corrective task **T13C**.
> This section is retained as the historical baseline that T13C corrects; it is
> not the final election contract. `WorkspaceElection.isWriter`/`read` remain
> valid and are reused by T13C.

**Implementation tier:** advanced (ownership correctness)
**Depends on:** T12
**Files created:** `src/core/workspace/WorkspaceElection.ts`, `tests/core/workspace/workspaceElection.test.ts`
**Files modified:** none
**Test files:** `tests/core/workspace/workspaceElection.test.ts`
**Interfaces produced:**
- `interface WorkspaceElectionDependencies { storage; store; writerType; instanceId; now }`
- `type ElectionReadResult`, `type ElectionClaimResult`
- `interface WorkspaceElection { read(); claim(); relinquish(); isWriter(record) }`
- `createWorkspaceElection(deps): WorkspaceElection`

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { ElectionRecordSchema, type ElectionRecord } from '@/core/workspace/workspaceTypes';

function setup(writerType: 'sidepanel' | 'standalone' = 'sidepanel') {
  const chromeStorage = createChromeStorageMock();
  const storage = createValidatedStorage(chromeStorage);
  const store = createWorkspaceStore(storage);
  const election = createWorkspaceElection({
    storage,
    store,
    writerType,
    instanceId: `${writerType}-instance`,
    now: () => 500,
  });
  return { chromeStorage, storage, store, election };
}

describe('workspace election', () => {
  it('acquires the writer role when no valid writer exists', async () => {
    const { election, storage } = setup();
    const result = await election.claim();
    expect(result.status).toBe('acquired');
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: {
        writerType: 'sidepanel',
        writerInstanceId: 'sidepanel-instance',
        epoch: 0,
        committedVersion: 0,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
        updatedAt: 500,
      },
    });
  });

  it('preserves the committed version when acquiring', async () => {
    const { election, store } = setup();
    await store.writeMetadata({ schemaVersion: 1, committedVersion: 4, updatedAt: 1 });
    const result = await election.claim();
    expect(result.status).toBe('acquired');
    if (result.status === 'acquired') expect(result.record.committedVersion).toBe(4);
  });

  it('does not displace a valid writer held by another instance', async () => {
    const { election, storage } = setup();
    const other: ElectionRecord = {
      writerType: 'standalone',
      writerInstanceId: 'standalone-instance',
      epoch: 2,
      committedVersion: 1,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: 1,
    };
    await storage.write('np_workspace_election', ElectionRecordSchema, other);
    const result = await election.claim();
    expect(result).toEqual({ status: 'held', record: other });
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: other,
    });
  });

  it('treats a repeated claim by the same instance as held', async () => {
    const { election } = setup();
    await election.claim();
    const second = await election.claim();
    expect(second.status).toBe('held');
  });

  it('recovers from invalid election metadata by claiming a fresh epoch', async () => {
    const { election, chromeStorage, storage } = setup();
    chromeStorage.session._setRaw('np_workspace_election', { writerType: 'broken' });
    const result = await election.claim();
    expect(result.status).toBe('acquired');
    if (result.status === 'acquired') expect(result.recovered).toBe(true);
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toMatchObject({
      status: 'valid',
    });
  });

  it('relinquishes both election and handoff records', async () => {
    const { election, storage } = setup();
    await election.claim();
    await election.relinquish();
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('reports whether a record belongs to this instance', async () => {
    const { election } = setup();
    const mine: ElectionRecord = {
      writerType: 'sidepanel',
      writerInstanceId: 'sidepanel-instance',
      epoch: 0,
      committedVersion: 0,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: 1,
    };
    expect(election.isWriter(mine)).toBe(true);
    expect(election.isWriter(undefined)).toBe(false);
    expect(election.isWriter({ ...mine, writerInstanceId: 'other' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/workspace/workspaceElection.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/workspace/WorkspaceElection`.

- [ ] **Step 3: Implement `src/core/workspace/WorkspaceElection.ts`**

```ts
import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import type { WorkspaceStore } from './WorkspaceStore';
import {
  ElectionRecordSchema,
  type ElectionRecord,
  type InstanceId,
  type WorkspaceWriterType,
} from './workspaceTypes';

export interface WorkspaceElectionDependencies {
  storage: ValidatedStorage;
  store: WorkspaceStore;
  writerType: WorkspaceWriterType;
  instanceId: InstanceId;
  now(): number;
}

export type ElectionReadResult =
  | { status: 'missing' }
  | { status: 'valid'; record: ElectionRecord }
  | { status: 'invalid' };

export type ElectionClaimResult =
  | { status: 'acquired'; record: ElectionRecord; recovered: boolean }
  | { status: 'held'; record: ElectionRecord };

export interface WorkspaceElection {
  read(): Promise<ElectionReadResult>;
  claim(): Promise<ElectionClaimResult>;
  relinquish(): Promise<void>;
  isWriter(record: ElectionRecord | undefined): boolean;
}

export function createWorkspaceElection(deps: WorkspaceElectionDependencies): WorkspaceElection {
  async function read(): Promise<ElectionReadResult> {
    const result = await deps.storage.read('np_workspace_election', ElectionRecordSchema);
    if (result.status === 'valid') return { status: 'valid', record: result.value };
    if (result.status === 'invalid') {
      debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_election' }));
      return { status: 'invalid' };
    }
    return { status: 'missing' };
  }

  function build(epoch: number, committedVersion: number): ElectionRecord {
    return {
      writerType: deps.writerType,
      writerInstanceId: deps.instanceId,
      epoch,
      committedVersion,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: deps.now(),
    };
  }

  return {
    read,
    isWriter(record) {
      return record?.writerInstanceId === deps.instanceId && record.writerType === deps.writerType;
    },
    async claim() {
      const current = await read();
      if (current.status === 'valid') {
        if (this.isWriter(current.record)) return { status: 'held', record: current.record };
        return { status: 'held', record: current.record };
      }
      const committedVersion = await deps.store.readVersion();
      const recovered = current.status === 'invalid';
      const record = build(0, committedVersion);
      await deps.storage.write('np_workspace_election', ElectionRecordSchema, record);
      return { status: 'acquired', record, recovered };
    },
    async relinquish() {
      await deps.storage.remove('np_workspace_election');
      await deps.storage.remove('np_workspace_handoff');
    },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/workspace/workspaceElection.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/workspace/WorkspaceElection.ts tests/core/workspace/workspaceElection.test.ts .planning
git commit -m "feat(phase-01): elect a single workspace writer"
```

**Constraints and non-goals:** no handoff transitions (T14); no mutations (T15); no background broker; owner is always a UI surface; a valid existing writer is never displaced.
**Focused verification:** `pnpm run test -- tests/core/workspace/workspaceElection.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** single writer; first eligible Side Panel may claim when no valid writer; stale/invalid records are recovered; committed version preserved; writer identity is never inferred from surface type alone.
**Code-quality and security checklist:** invalid metadata fails closed and logs `WORKSPACE_INVALID_METADATA`; no silent writer pick; session storage only for election.
**Evidence:** `verification.txt` and `review.md` Task 13 sections.
**Atomic commit:** `feat(phase-01): elect a single workspace writer`
**Completion criteria:** election test green; typecheck and lint pass.
**Stop conditions:** TWO live writers can be authorised by any code path; committed version cannot be preserved on claim.

---

### Task 13C — Corrective: Background-Serialised Workspace Election (ADR-0001)

**Implementation tier:** advanced (ownership correctness, trust boundary, background serialisation)
**Depends on:** T13, T08, T09, T12
**Classification:** corrective production task; TDD required.
**Supersedes:** the direct multi-context election write path implemented by T13.
**Files created:** `src/core/workspace/WorkspaceElectionArbiter.ts`, `tests/core/workspace/workspaceElectionArbiter.test.ts`
**Files modified:** `src/core/error/errorCodes.ts`, `tests/core/error/errorCodes.test.ts`, `src/core/runtime/MessageType.ts`, `src/core/runtime/messageSchemas.ts`, `tests/core/runtime/messageSchemas.test.ts`, `tests/core/runtime/boundaryValidation.test.ts`, `src/core/workspace/workspaceTypes.ts`, `tests/core/workspace/workspaceTypes.test.ts`, `src/core/workspace/WorkspaceElection.ts`, `tests/core/workspace/workspaceElection.test.ts`, `.planning/evidence/phase-01/verification.txt`, `.planning/evidence/phase-01/review.md`, `.planning/STATUS.md`
**Files that must not be modified:** `DESIGN.md`, `PLAN.md`, `AGENTS.md`, `ARCHITECTURE.md`, `wxt.config.ts`, `tsconfig.json`, `package.json`, `tests/setup.ts`, `src/core/runtime/BroadcastBus.ts`, `src/core/runtime/RuntimeEnvelope.ts`, `src/core/runtime/MessageType.ts` (only additive registry changes below), `src/core/workspace/WorkspaceStore.ts`, and every not-yet-created file owned by T14+.
**Interfaces produced:**
- `WorkspaceElectionOperation` (`'claim' | 'relinquish' | 'handoff-commit'`), `WorkspaceElectionClaimReason` (`'initial' | 'stale-recovery' | 'fallback'`)
- `WorkspaceElectionRequestPayload`, `WorkspaceElectionResponsePayload` (schemas in `messageSchemas.ts`)
- `ElectionRequestFingerprint`, `ElectionIdempotencyRecord`; `ElectionRecord` gains `recentCompletedRequests: ElectionIdempotencyRecord[]` (bounded to 32, oldest to newest)
- `ElectionSerialExecutor`, `createElectionSerialExecutor()`
- `WorkspaceElectionArbiterDependencies`, `WorkspaceElectionArbiter`, `createWorkspaceElectionArbiter(deps)`
- `BackgroundElectionMessageListener` (`(message, sender, sendResponse) => boolean | void`)
- Error codes `WORKSPACE_ELECTION_REJECTED`, `WORKSPACE_ELECTION_FAILED`
- Refactored `WorkspaceElection` client: `read()`, `isWriter(record)`, `claim(reason)`, `relinquish()`, and request/response handling; no direct write of `np_workspace_election`

**Canonical contract:** exactly as defined in
`.planning/architecture/decisions/ADR-0001-background-serialised-workspace-election.md`
and `DESIGN.md` Section 6. In particular:

- Request payload: `{ requestId: OperationId; operation; requesterInstanceId;
  requesterWriterType; committedVersion; reason?; expectedEpoch?;
  targetInstanceId?; targetWriterType? }`. `requestId` is stable across retries
  of the same logical operation; a retry must not mint a new `requestId`.
- Response payload: `{ requestId: OperationId; accepted: boolean;
  record?: ElectionRecord; code?: ErrorCode }`. `record` is present and
  authoritative when accepted; `code` is present when not accepted.
- Response envelope: `source: 'background'`, `target` = requesting surface only,
  `correlationId` = the request envelope `id`.
- Election record idempotency: `ElectionRecord.recentCompletedRequests` is a
  bounded ledger (retention limit exactly **32**, oldest to newest) of
  `ElectionIdempotencyRecord` entries (request fingerprint, accepted, code,
  resulting epoch, completedAt). On completion the arbiter removes any entry with
  the same `requestId`, appends the authoritative completed result, and keeps only
  the newest 32. Fingerprint equality compares named operation-defining fields
  (order-independent, no `JSON.stringify`). Duplicate recognition is guaranteed
  only for the 32 most recently completed requests within the browser session;
  older requests are not guaranteed to be recognised and unlimited historical
  deduplication is not claimed. Ledger entries never embed an `ElectionRecord`.
- Queue lifecycle: `ElectionSerialExecutor` FIFO applies only within the current
  service-worker lifetime; cross-restart correctness comes from the persisted
  record, the persisted idempotency metadata, monotonic epoch validation,
  storage-derived decisions, and persistence read-back.

**Files created/modified rationale:** the two new message types extend the closed
registry in `MessageType.ts` (11 → 13 entries) and `RUNTIME_PAYLOAD_SCHEMAS` in
`messageSchemas.ts`; the closed `MESSAGE_TYPE_ALLOWED_SOURCES` gains:
`workspace.election.request` → `['sidepanel','standalone']` and
`workspace.election.response` → `['background']`. `boundaryValidation.test.ts`
and `messageSchemas.test.ts` completeness assertions must be updated to the
13-entry registry. `errorCodes.test.ts` must be updated to the 15-code registry.

- [ ] **Step 1: Write the failing tests (RED)**

Create `tests/core/workspace/workspaceElectionArbiter.test.ts` and update the
four existing test files named above. The arbiter suite must prove, at minimum:

1. two simultaneous valid initial claims produce exactly one successful writer
   (drive both `handle()` promises through the injected executor and assert one
   `accepted: true` and one `accepted: false` with `WORKSPACE_ELECTION_REJECTED`);
2. the losing claimant never receives `accepted: true`, and the persisted record
   names the winner;
3. the winner is persisted before `accepted: true` is returned (read-back assertion);
4. two successful ownership changes never receive the same epoch;
5. epochs increase monotonically across claim → handoff-commit → recovery;
6. a stale claim (`expectedEpoch` behind the persisted epoch) cannot overwrite a
   newer writer and returns `accepted: false`;
7. a non-writer `relinquish` returns `accepted: false` and leaves the record
   unchanged;
8. duplicate requests with the same `requestId` and identical fingerprint are
   idempotent: a repeated identical claim/commit returns the persisted
   authoritative result with the same epoch and no record change, no relinquish
   replay, no handoff-commit replay, and no writer-identity change;
9. idempotency survives a simulated service-worker restart: a fresh arbiter over
   the same session storage returns the same persisted result for the duplicate;
10. reuse of a `requestId` with different operation data fails closed with
    `WORKSPACE_ELECTION_REJECTED`;
11. `handoff-commit` and `fallback` claim cannot both succeed (whichever is
    evaluated second is rejected/idempotent-no-change, never a second epoch);
12. stale Standalone recovery is serialised against a live handoff (a recovery
    claim queued behind a handoff-commit evaluates the committed record);
13. persistence failure produces no successful writer (`accepted: false` +
    `WORKSPACE_ELECTION_FAILED`, record unchanged/absent);
14. persisted-record read-back mismatch fails closed (`accepted: false`);
15. a fresh arbiter instance over the same session storage reconstructs the same
    decision after restart;
16. the arbiter handles only `workspace.election.request`; ordinary
    `workspace.mutation` never changes the election record or epoch (asserted
    again end-to-end in T25).

The idempotency-ledger suite must also prove:

- duplicate request A remains idempotent after request B completes;
- the newest 32 completed requests are retained;
- the oldest request is evicted when a 33rd request completes;
- replay within the retained window returns the prior result;
- replay does not increment the epoch;
- the same `requestId` with a different fingerprint is rejected;
- ledger ordering is deterministic (oldest to newest) with no duplicate
  `requestId`;
- replacement of an existing `requestId` does not create a duplicate entry;
- a service-worker restart preserves the 32-entry ledger;
- a malformed or oversized persisted ledger is normalised to the newest 32 valid
  entries, or fails closed exactly as defined in DESIGN §6.

The background listener suite (in `tests/core/runtime/backgroundRuntime.test.ts`
or the T13C arbiter suite as the amended T22 specifies) must prove:

17. the listener returns literal `true` synchronously for an election request;
18. the response is sent only after the queued operation completes;
19. persistence failure produces exactly one `accepted: false` response;
20. an unexpected exception produces exactly one canonical failure response;
21. no response is sent twice for one request;
22. an untrusted sender or schema-invalid envelope receives no response;
23. the response `correlationId` equals the request envelope `id`, and the
    response `target` is the requesting surface only;
24. wildcard-election requests, background-originated election requests,
    wildcard responses, and responses targeted at a different surface are
    rejected.

Also update the completeness/boundary tests to the 13-type registry and the
15-code registry, and rewrite the `WorkspaceElection.ts` client tests to use an
injected request transport instead of direct storage writes.

Run:

```bash
pnpm run test -- tests/core/workspace/workspaceElectionArbiter.test.ts
pnpm run test -- tests/core/workspace/workspaceElection.test.ts
pnpm run test -- tests/core/runtime
pnpm run test -- tests/core/error
```

Expected: FAIL — `WorkspaceElectionArbiter` does not resolve; the new message
types and error codes are absent from the closed registries.

- [ ] **Step 2: Implement the corrected election**

1. Add `WORKSPACE_ELECTION_REJECTED` and `WORKSPACE_ELECTION_FAILED` to
   `ERROR_CODES` (append after `THEME_PERSIST_FAILED`; the sealed order is the
   approved list from DESIGN §5 followed by these two).
2. Add the two message types, both payload schemas, and the allowed sources. The
   request payload includes a stable `requestId: OperationId`; the response
   payload is `{ requestId; accepted: boolean; record?: ElectionRecord;
   code?: ErrorCode }`. Enforce the sender/target matrix (request source
   `sidepanel`/`standalone`, target `background`; response source `background`,
   target the requesting surface only; response `correlationId` equals the
   request envelope `id`). Reject wildcard/background-originated requests and
   mis-targeted responses.
3. Extend `ElectionRecordSchema` with
   `recentCompletedRequests: ElectionIdempotencyRecord[]` and add
   `ElectionRequestFingerprint`/`ElectionIdempotencyRecord` (bounded to the newest
   32 entries, oldest to newest; no unbounded growth; no recursive
   `ElectionRecord`). No new storage key.
4. Implement `ElectionSerialExecutor` and `createElectionSerialExecutor` with a
   FIFO promise chain: `runExclusive` appends the operation and chains it after
   the previous tail, propagating the tail regardless of rejection. Document that
   FIFO applies only within the current service-worker lifetime.
5. Implement `WorkspaceElectionArbiter`:
   - wrap the whole of `handle()` in `executor.runExclusive`;
   - read and schema-validate `np_workspace_election` after acquiring exclusivity;
   - evaluate `claim` / `relinquish` / `handoff-commit` against the latest
     writer identity, epoch, committed version, and handoff state;
   - search `recentCompletedRequests` by `requestId`: if an entry matches with an
     equal fingerprint, return the persisted authoritative result without
     changing epoch, repeating relinquish, replaying handoff commit, or changing
     writer identity; if the `requestId` matches with a different fingerprint,
     reject with `WORKSPACE_ELECTION_REJECTED`; if `requestId` is absent, evaluate
     it as a new request;
   - fingerprint equality compares the named operation-defining fields directly
     (`requestId`, `operation`, `requesterInstanceId`, `requesterWriterType`,
     `committedVersion`, and optional `reason`/`expectedEpoch`/`targetInstanceId`/
     `targetWriterType` with absent normalised to `undefined`); it is
     order-independent and never uses `JSON.stringify`;
   - build exactly one next record; increment epoch monotonically on ownership
     change (initial no-record claim → `0`; every later ownership change,
     including recovery, → `priorEpoch + 1`, where `priorEpoch` is the numeric
     `epoch` of the persisted record, or the numeric `epoch` field of an invalid
     raw value when finite and non-negative; if no numeric prior epoch exists,
     recovery uses `1`, never a bare `0`);
   - apply the ledger retention algorithm to the next record: remove any existing
     entry with the same `requestId`, append the authoritative completed result
     (accepted or rejected), then keep only the newest 32 entries;
   - persist the complete record (including `recentCompletedRequests`), read it
     back, and validate equality before returning `accepted: true`;
   - on write failure or read-back mismatch return `accepted: false` with
     `WORKSPACE_ELECTION_FAILED`, record no ledger entry, and never report
     success;
   - normalise a malformed or oversized persisted ledger to the newest 32 valid
     entries, or fail closed with `WORKSPACE_INVALID_METADATA` when it cannot be
     normalised;
   - reject stale (`expectedEpoch` mismatch), unauthorised (non-writer
     relinquish/commit), conflicting, and non-idempotent requests with
     `accepted: false` + `WORKSPACE_ELECTION_REJECTED`;
   - make duplicate requests state-derived idempotent (no in-memory cache that
     would not survive restart).
6. Wire the background election listener with the Chrome signature
   `(message, sender, sendResponse) => boolean | void`: register synchronously at
   module evaluation; for a validated `workspace.election.request` return literal
   `true`, call `arbiter.handle(request)`, and call `sendResponse` exactly once
   with the schema-valid response envelope (`correlationId` = request envelope
   `id`, `target` = requester) after the queued operation completes; on
   persistence failure or unexpected exception send exactly one `accepted: false`
   response with the canonical failure code; send no response for an untrusted
   sender or schema-invalid envelope; never respond twice.
7. Refactor `WorkspaceElection.ts` into a read/request client:
   `read()` and `isWriter()` unchanged; `claim(reason)` and `relinquish()` send a
   `workspace.election.request` envelope through the canonical bus and resolve the
   matching `workspace.election.response` by `correlationId`, retaining the
   payload `requestId` across retries; never write `np_workspace_election`
   directly. Keep the legacy `ElectionClaimResult` vocabulary only where the
   client translates `accepted`/`code`.
8. Do not change `BroadcastBus`, `RuntimeEnvelope` (other than registry-driven
   schema additions), `WorkspaceStore`, or the toolchain. Do not add a storage
   key, permission, or third message type.

- [ ] **Step 3: Run the focused and cumulative verification**

```bash
pnpm run test -- tests/core/workspace/workspaceElectionArbiter.test.ts
pnpm run test -- tests/core/workspace/workspaceElection.test.ts
pnpm run typecheck
pnpm run lint
pnpm exec prettier --check .
pnpm run typecheck && pnpm run lint && pnpm run test
```

Expected: all exit 0; the new message-type and error-code completeness tests pass
at 13 and 15 entries.

- [ ] **Step 4: Record evidence, update status, and commit**

Append the T13C section (commands, exit statuses, the 15-case arbiter matrix, and
the corrected T13 acceptance) to `.planning/evidence/phase-01/verification.txt`
and `.planning/evidence/phase-01/review.md`, and update `.planning/STATUS.md`
(T13 accepted after correction; next task T14).

```bash
git add src tests .planning
git commit -m "fix(phase-01): serialise workspace election through the background arbiter"
```

**Constraints and non-goals:** no new permission; no IndexedDB; no provider/MCP;
ordinary mutations never route through the arbiter; no background in-memory
source of truth; no change to `chrome.storage` areas or keys; no new
`DiagnosticEvent`; no amendment to `DESIGN.md`/`PLAN.md` in this task.
**Focused verification:** the Step 3 focused commands.
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Evidence:** `verification.txt` and `review.md` T13C sections.
**Atomic commit:** `fix(phase-01): serialise workspace election through the background arbiter`
**Completion criteria:** all Step 1 obligations pass; typecheck/lint/prettier/phase chain exit 0; one corrective commit; corrected T13 recorded as accepted.
**Stop conditions:** two live writers can still be authorised; epochs can repeat; persistence failure can report success; the correction requires a new dependency or permission; the correction cannot avoid touching a forbidden file.

---

### Task 14 — Prepare, Acknowledge, and Commit Handoff

> **Amendment (ADR-0001):** T14 now depends on **T13C**, not T13. The handoff
> `commit(epoch, committedVersion)` step no longer writes `np_workspace_election`
> directly. Instead, the current writer submits a
> `workspace.election.request` with `operation: 'handoff-commit'` (including
> `targetInstanceId`, `targetWriterType`, and `expectedEpoch`) through the
> arbiter, and transitions ownership only when the arbiter returns `granted`
> with the new epoch. `prepare` and `acknowledge` remain local handoff-record
> transitions. The T14 dependency set becomes `T13C`. Update its RED and GREEN
> steps and interface notes accordingly; no other behavioural change.

**Implementation tier:** advanced (ownership transition)
**Depends on:** T13
**Files created:** `src/core/workspace/WorkspaceHandoff.ts`, `tests/core/workspace/workspaceHandoff.test.ts`
**Files modified:** none
**Test files:** `tests/core/workspace/workspaceHandoff.test.ts`
**Interfaces produced:**
- `interface WorkspaceHandoffDependencies { storage; writerType; instanceId; now }`
- `type HandoffReadResult`
- `type HandoffTransitionResult`
- `interface WorkspaceHandoff { read(); prepare(to, baseVersion); acknowledge(epoch, committedVersion); commit(epoch, committedVersion) }`
- `createWorkspaceHandoff(deps): WorkspaceHandoff`

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import { ElectionRecordSchema, HandoffRecordSchema } from '@/core/workspace/workspaceTypes';

const TARGET = { instanceId: 'standalone-instance', writerType: 'standalone' as const };

function setup() {
  const chromeStorage = createChromeStorageMock();
  const storage = createValidatedStorage(chromeStorage);
  const handoff = createWorkspaceHandoff({
    storage,
    writerType: 'sidepanel',
    instanceId: 'sidepanel-instance',
    now: () => 900,
  });
  async function becomeWriter(version = 0) {
    await storage.write('np_workspace_election', ElectionRecordSchema, {
      writerType: 'sidepanel',
      writerInstanceId: 'sidepanel-instance',
      epoch: 0,
      committedVersion: version,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: 1,
    });
  }
  return { chromeStorage, storage, handoff, becomeWriter };
}

describe('workspace handoff', () => {
  it('prepares a handoff and keeps the current writer authorised', async () => {
    const { handoff, storage, becomeWriter } = setup();
    await becomeWriter(3);
    const result = await handoff.prepare(TARGET, 3);
    expect(result.status).toBe('prepared');
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toMatchObject({
      status: 'valid',
    });
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toMatchObject({
      status: 'valid',
      value: { writerInstanceId: 'sidepanel-instance', handoffPhase: 'prepared' },
    });
  });

  it('rejects a prepare from a non-writer', async () => {
    const { handoff } = setup();
    const result = await handoff.prepare(TARGET, 0);
    expect(result).toEqual({ status: 'rejected', code: 'WORKSPACE_HANDOFF_FAILED' });
  });

  it('acknowledges only the same version and epoch', async () => {
    const { handoff, becomeWriter } = setup();
    await becomeWriter(3);
    await handoff.prepare(TARGET, 3);
    await expect(handoff.acknowledge(0, 2)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_VERSION_CONFLICT',
    });
    await expect(handoff.acknowledge(5, 3)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_EPOCH_MISMATCH',
    });
    await expect(handoff.acknowledge(0, 3)).resolves.toEqual({ status: 'acknowledged' });
  });

  it('commits ownership only after acknowledgement and starts a new epoch', async () => {
    const { handoff, storage, becomeWriter } = setup();
    await becomeWriter(3);
    await handoff.prepare(TARGET, 3);
    await expect(handoff.commit(0, 3)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_HANDOFF_FAILED',
    });
    await handoff.acknowledge(0, 3);
    await expect(handoff.commit(0, 3)).resolves.toEqual({ status: 'committed' });
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: {
        writerType: 'standalone',
        writerInstanceId: 'standalone-instance',
        epoch: 1,
        committedVersion: 3,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
        updatedAt: 900,
      },
    });
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('leaves exactly one authorised writer after commit', async () => {
    const { handoff, storage, becomeWriter } = setup();
    await becomeWriter(0);
    await handoff.prepare(TARGET, 0);
    await handoff.acknowledge(0, 0);
    await handoff.commit(0, 0);
    const election = await storage.read('np_workspace_election', ElectionRecordSchema);
    expect(election.status).toBe('valid');
    if (election.status === 'valid') {
      expect(election.value.writerInstanceId).toBe('standalone-instance');
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/workspace/workspaceHandoff.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/workspace/WorkspaceHandoff`.

- [ ] **Step 3: Implement `src/core/workspace/WorkspaceHandoff.ts`**

```ts
import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import {
  ElectionRecordSchema,
  HandoffRecordSchema,
  type ElectionRecord,
  type HandoffRecord,
  type InstanceId,
  type WorkspaceWriterType,
} from './workspaceTypes';

export interface WorkspaceHandoffDependencies {
  storage: ValidatedStorage;
  writerType: WorkspaceWriterType;
  instanceId: InstanceId;
  now(): number;
}

export type HandoffReadResult =
  | { status: 'missing' }
  | { status: 'valid'; record: HandoffRecord }
  | { status: 'invalid' };

export type HandoffRejectionCode =
  | 'WORKSPACE_HANDOFF_FAILED'
  | 'WORKSPACE_EPOCH_MISMATCH'
  | 'WORKSPACE_VERSION_CONFLICT';

export type HandoffTransitionResult =
  | { status: 'prepared' | 'acknowledged' | 'committed' }
  | { status: 'rejected'; code: HandoffRejectionCode };

export interface WorkspaceHandoff {
  read(): Promise<HandoffReadResult>;
  prepare(
    to: { instanceId: InstanceId; writerType: WorkspaceWriterType },
    baseVersion: number,
  ): Promise<HandoffTransitionResult>;
  acknowledge(epoch: number, committedVersion: number): Promise<HandoffTransitionResult>;
  commit(epoch: number, committedVersion: number): Promise<HandoffTransitionResult>;
}

export function createWorkspaceHandoff(
  deps: WorkspaceHandoffDependencies,
): WorkspaceHandoff {
  async function readElection(): Promise<ElectionRecord | undefined> {
    const result = await deps.storage.read('np_workspace_election', ElectionRecordSchema);
    return result.status === 'valid' ? result.value : undefined;
  }

  async function read(): Promise<HandoffReadResult> {
    const result = await deps.storage.read('np_workspace_handoff', HandoffRecordSchema);
    if (result.status === 'valid') return { status: 'valid', record: result.value };
    if (result.status === 'invalid') {
      debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_handoff' }));
      return { status: 'invalid' };
    }
    return { status: 'missing' };
  }

  function reject(code: HandoffRejectionCode): HandoffTransitionResult {
    debugLog(createErrorRecord(code, { phase: 'handoff' }));
    return { status: 'rejected', code };
  }

  return {
    read,
    async prepare(to, baseVersion) {
      const election = await readElection();
      if (
        !election ||
        election.writerInstanceId !== deps.instanceId ||
        election.writerType !== deps.writerType
      ) {
        return reject('WORKSPACE_HANDOFF_FAILED');
      }
      await deps.storage.write('np_workspace_handoff', HandoffRecordSchema, {
        phase: 'prepared',
        fromInstanceId: deps.instanceId,
        fromWriterType: deps.writerType,
        toInstanceId: to.instanceId,
        toWriterType: to.writerType,
        epoch: election.epoch,
        baseVersion,
        preparedAt: deps.now(),
        acknowledgedAt: null,
      });
      await deps.storage.write('np_workspace_election', ElectionRecordSchema, {
        ...election,
        handoffPhase: 'prepared',
        handoffTargetInstanceId: to.instanceId,
        updatedAt: deps.now(),
      });
      return { status: 'prepared' };
    },
    async acknowledge(epoch, committedVersion) {
      const current = await read();
      if (current.status !== 'valid' || current.record.phase !== 'prepared') {
        return reject('WORKSPACE_HANDOFF_FAILED');
      }
      if (current.record.epoch !== epoch) return reject('WORKSPACE_EPOCH_MISMATCH');
      if (current.record.baseVersion !== committedVersion) {
        return reject('WORKSPACE_VERSION_CONFLICT');
      }
      await deps.storage.write('np_workspace_handoff', HandoffRecordSchema, {
        ...current.record,
        phase: 'acknowledged',
        acknowledgedAt: deps.now(),
      });
      return { status: 'acknowledged' };
    },
    async commit(epoch, committedVersion) {
      const current = await read();
      if (current.status !== 'valid' || current.record.phase !== 'acknowledged') {
        return reject('WORKSPACE_HANDOFF_FAILED');
      }
      if (current.record.epoch !== epoch) return reject('WORKSPACE_EPOCH_MISMATCH');
      if (current.record.baseVersion !== committedVersion) {
        return reject('WORKSPACE_VERSION_CONFLICT');
      }
      const next: ElectionRecord = {
        writerType: current.record.toWriterType,
        writerInstanceId: current.record.toInstanceId,
        epoch: current.record.epoch + 1,
        committedVersion,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
        updatedAt: deps.now(),
      };
      await deps.storage.write('np_workspace_election', ElectionRecordSchema, next);
      await deps.storage.remove('np_workspace_handoff');
      return { status: 'committed' };
    },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/workspace/workspaceHandoff.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/workspace/WorkspaceHandoff.ts tests/core/workspace/workspaceHandoff.test.ts .planning
git commit -m "feat(phase-01): implement prepare acknowledge commit handoff"
```

**Constraints and non-goals:** only Side Panel → Standalone handoff is exercised in Phase 01; the current writer remains authorised until commit; commit persists before ownership changes; new epoch on commit; no message transport here (composition happens in T21/T22).
**Focused verification:** `pnpm run test -- tests/core/workspace/workspaceHandoff.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** prepare → acknowledge → commit; same version + epoch required to ack; ownership changes only after commit persisted; new epoch; never two authorised writers; rejections use canonical codes.
**Code-quality and security checklist:** invalid handoff metadata fails closed; no silent ownership transfer; no committed mutation replay.
**Evidence:** `verification.txt` and `review.md` Task 14 sections.
**Atomic commit:** `feat(phase-01): implement prepare acknowledge commit handoff`
**Completion criteria:** handoff test green; typecheck and lint pass.
**Stop conditions:** handoff requires a new message type or a background broker; the epoch cannot be advanced deterministically.

---

### Task 15 — Mutation Versioning and Idempotency

**Implementation tier:** advanced (write correctness)
**Depends on:** T12, T14
**Files created:** `src/core/workspace/WorkspaceMutations.ts`, `tests/core/workspace/workspaceMutations.test.ts`
**Files modified:** none
**Test files:** `tests/core/workspace/workspaceMutations.test.ts`
**Interfaces produced:**
- `interface MutationEngineState { committedVersion; epoch; writerInstanceId; appliedMutationIds }`
- `type MutationRejectionCode`
- `type MutationOutcome`
- `createMutationEngineState(input): MutationEngineState`
- `applyWorkspaceMutation(state, mutation): MutationOutcome`
- `commitWorkspaceMutation(deps, state, mutation): Promise<MutationOutcome>`

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import {
  applyWorkspaceMutation,
  commitWorkspaceMutation,
  createMutationEngineState,
} from '@/core/workspace/WorkspaceMutations';
import { WorkspaceMutationSchema, type WorkspaceMutation } from '@/core/workspace/workspaceTypes';

function mutation(overrides: Partial<WorkspaceMutation> = {}): WorkspaceMutation {
  return {
    mutationId: '00000000-0000-4000-8000-000000000001',
    writerInstanceId: 'writer',
    epoch: 0,
    baseVersion: 0,
    resultingVersion: 1,
    kind: 'workspace.metadata.set',
    payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 10 },
    ...overrides,
  } as WorkspaceMutation;
}

describe('workspace mutations', () => {
  it('applies a valid next mutation and increments the version', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    const outcome = applyWorkspaceMutation(state, mutation());
    expect(outcome.status).toBe('applied');
    expect(outcome.state.committedVersion).toBe(1);
    expect(outcome.state.appliedMutationIds).toContain(mutation().mutationId);
  });

  it('rejects a mutation from the wrong writer', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    expect(applyWorkspaceMutation(state, mutation({ writerInstanceId: 'other' }))).toMatchObject({
      status: 'rejected',
      code: 'WORKSPACE_OWNERSHIP_AMBIGUOUS',
    });
  });

  it('rejects a mutation from the wrong epoch', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 2 });
    expect(applyWorkspaceMutation(state, mutation({ epoch: 1 }))).toMatchObject({
      status: 'rejected',
      code: 'WORKSPACE_EPOCH_MISMATCH',
    });
  });

  it('rejects a stale base version', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    const first = applyWorkspaceMutation(state, mutation());
    expect(
      applyWorkspaceMutation(first.state, mutation({ mutationId: '00000000-0000-4000-8000-000000000002', baseVersion: 0, resultingVersion: 1 })),
    ).toMatchObject({ status: 'rejected', code: 'WORKSPACE_STALE_MUTATION' });
  });

  it('rejects a non-monotonic resulting version', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    expect(applyWorkspaceMutation(state, mutation({ resultingVersion: 5 }))).toMatchObject({
      status: 'rejected',
      code: 'WORKSPACE_VERSION_CONFLICT',
    });
  });

  it('treats a repeated mutation id as a duplicate and applies it once', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    const first = applyWorkspaceMutation(state, mutation());
    const second = applyWorkspaceMutation(first.state, mutation());
    expect(second.status).toBe('duplicate');
    expect(second.state.committedVersion).toBe(1);
  });

  it('persists an applied mutation through the workspace store', async () => {
    const chromeStorage = createChromeStorageMock();
    const store = createWorkspaceStore(createValidatedStorage(chromeStorage));
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    const outcome = await commitWorkspaceMutation({ store, now: () => 77 }, state, mutation());
    expect(outcome.status).toBe('applied');
    expect(WorkspaceMutationSchema.safeParse(mutation()).success).toBe(true);
    await expect(store.readVersion()).resolves.toBe(1);
    await expect(store.readMetadata()).resolves.toMatchObject({
      status: 'valid',
      metadata: { committedVersion: 1, updatedAt: 77 },
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/workspace/workspaceMutations.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/workspace/WorkspaceMutations`.

- [ ] **Step 3: Implement `src/core/workspace/WorkspaceMutations.ts`**

```ts
import { createErrorRecord, debugLog } from '../error/debugLog';
import type { WorkspaceStore } from './WorkspaceStore';
import { WorkspaceMetadataSchema, type InstanceId, type WorkspaceMutation } from './workspaceTypes';

export interface MutationEngineState {
  committedVersion: number;
  epoch: number;
  writerInstanceId: InstanceId;
  appliedMutationIds: readonly string[];
}

export type MutationRejectionCode =
  | 'WORKSPACE_OWNERSHIP_AMBIGUOUS'
  | 'WORKSPACE_EPOCH_MISMATCH'
  | 'WORKSPACE_STALE_MUTATION'
  | 'WORKSPACE_VERSION_CONFLICT';

export type MutationOutcome =
  | { status: 'applied'; mutation: WorkspaceMutation; state: MutationEngineState }
  | { status: 'duplicate'; state: MutationEngineState }
  | { status: 'rejected'; code: MutationRejectionCode; state: MutationEngineState };

export function createMutationEngineState(input: {
  writerInstanceId: InstanceId;
  epoch: number;
  committedVersion?: number;
  appliedMutationIds?: readonly string[];
}): MutationEngineState {
  return {
    committedVersion: input.committedVersion ?? 0,
    epoch: input.epoch,
    writerInstanceId: input.writerInstanceId,
    appliedMutationIds: input.appliedMutationIds ?? [],
  };
}

function rejected(
  state: MutationEngineState,
  code: MutationRejectionCode,
): MutationOutcome {
  debugLog(createErrorRecord(code, { reason: 'mutation' }));
  return { status: 'rejected', code, state };
}

export function applyWorkspaceMutation(
  state: MutationEngineState,
  mutation: WorkspaceMutation,
): MutationOutcome {
  if (state.appliedMutationIds.includes(mutation.mutationId)) {
    return { status: 'duplicate', state };
  }
  if (mutation.writerInstanceId !== state.writerInstanceId) {
    return rejected(state, 'WORKSPACE_OWNERSHIP_AMBIGUOUS');
  }
  if (mutation.epoch !== state.epoch) {
    return rejected(state, 'WORKSPACE_EPOCH_MISMATCH');
  }
  if (mutation.baseVersion !== state.committedVersion) {
    return rejected(state, 'WORKSPACE_STALE_MUTATION');
  }
  if (mutation.resultingVersion !== mutation.baseVersion + 1) {
    return rejected(state, 'WORKSPACE_VERSION_CONFLICT');
  }
  const nextState: MutationEngineState = {
    ...state,
    committedVersion: mutation.resultingVersion,
    appliedMutationIds: [...state.appliedMutationIds, mutation.mutationId],
  };
  return { status: 'applied', mutation, state: nextState };
}

export interface CommitWorkspaceMutationDependencies {
  store: WorkspaceStore;
  now(): number;
}

export async function commitWorkspaceMutation(
  deps: CommitWorkspaceMutationDependencies,
  state: MutationEngineState,
  mutation: WorkspaceMutation,
): Promise<MutationOutcome> {
  const outcome = applyWorkspaceMutation(state, mutation);
  if (outcome.status !== 'applied') return outcome;
  const metadata = WorkspaceMetadataSchema.parse({
    ...mutation.payload,
    committedVersion: mutation.resultingVersion,
    updatedAt: deps.now(),
  });
  await deps.store.writeMetadata(metadata);
  return outcome;
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/workspace/workspaceMutations.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/workspace/WorkspaceMutations.ts tests/core/workspace/workspaceMutations.test.ts .planning
git commit -m "feat(phase-01): version and idempotently apply workspace mutations"
```

**Constraints and non-goals:** one mutation kind; in-memory applied-ID set (Phase 01 scope); no write journal (Phase 2); no IndexedDB; persisted mutations are never replayed; version increments are monotonic.
**Focused verification:** `pnpm run test -- tests/core/workspace/workspaceMutations.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** mutation ID, writer instance, epoch, base + resulting version, kind, schema-valid payload; wrong writer/epoch/stale base rejected; apply once; monotonic; persisted.
**Code-quality and security checklist:** rejections use canonical codes; duplicate detection precedes all other checks; no partial persistence on rejection.
**Evidence:** `verification.txt` and `review.md` Task 15 sections.
**Atomic commit:** `feat(phase-01): version and idempotently apply workspace mutations`
**Completion criteria:** mutation test green; typecheck and lint pass.
**Stop conditions:** idempotency requires durable storage beyond Phase 01 scope; more than one mutation kind is required.

---

### Task 16 — Mirror Ordering, Gap Rehydration, and Writer Coordination

> **Amendment (ADR-0001):** T16 depends on **T13C**. The coordinator no longer
> writes the election record directly. `start()` must not auto-claim by writing
> `np_workspace_election` (the background arbiter owns claims). `handleHandoffAck`
> commits ownership by submitting a `workspace.election.request`
> (`operation: 'handoff-commit'`, with `targetInstanceId`, `targetWriterType`,
> `expectedEpoch`, `committedVersion`) and proceeds only on `granted`;
> `handleRelinquish` submits `operation: 'relinquish'` and acts only on
> `granted`. Add a `workspace.election.response` subscription and correlate
> request/response by `requestId`. Ordinary `workspace.mutation` handling is
> unchanged and must never route through the background arbiter.

**Implementation tier:** advanced (convergence and ownership coordination)
**Depends on:** T15, T13, T14
**Files created:** `src/core/workspace/WorkspaceSync.ts`, `tests/core/workspace/workspaceSync.test.ts`
**Files modified:** none
**Test files:** `tests/core/workspace/workspaceSync.test.ts`
**Interfaces produced:**
- `interface MirrorState { epoch; committedVersion }`
- `type MirrorDecision`
- `classifyMirrorEnvelope(state, envelope): MirrorDecision`
- `applyMirrorEnvelope(state, envelope): { state: MirrorState; decision: MirrorDecision }`
- `createRehydrateRequestEnvelope(input, source): RuntimeEnvelope`
- `createRehydrateResponseEnvelope(input, source): RuntimeEnvelope`
- `createHandoffPrepareEnvelope`, `createHandoffAckEnvelope`, `createHandoffCommitEnvelope`
- `interface WorkspaceCoordinatorDependencies`, `type CoordinatorStep`, `interface WorkspaceCoordinator`, `createWorkspaceCoordinator(deps): WorkspaceCoordinator`
- Exposed handlers: `handleRehydrateRequest`, `handleHandoffPrepare`, `handleHandoffAck`, `handleMutation`, `handleRelinquish` (all injected-boundary testable)

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  applyMirrorEnvelope,
  classifyMirrorEnvelope,
  createRehydrateRequestEnvelope,
  createRehydrateResponseEnvelope,
} from '@/core/workspace/WorkspaceSync';
import { parseRuntimeEnvelope, type RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { createOperationId } from '@/core/runtime/OperationId';

function envelope(overrides: Partial<RuntimeEnvelope> = {}): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.mutation',
    source: 'standalone',
    target: 'sidepanel',
    timestamp: 1,
    electionEpoch: 1,
    workspaceVersion: 2,
    payload: {
      mutationId: '00000000-0000-4000-8000-000000000003',
      writerInstanceId: 'writer',
      epoch: 1,
      baseVersion: 1,
      resultingVersion: 2,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: 2, updatedAt: 5 },
    },
    ...overrides,
  } as RuntimeEnvelope;
}

function mutationEnvelope(version: number, epoch = 0): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.mutation',
    source: 'standalone',
    target: 'sidepanel',
    timestamp: version,
    electionEpoch: epoch,
    workspaceVersion: version,
    payload: {
      mutationId: createOperationId(),
      writerInstanceId: 'writer',
      epoch,
      baseVersion: version - 1,
      resultingVersion: version,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: version, updatedAt: version },
    },
  } as RuntimeEnvelope;
}

function relinquishEnvelope(): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.relinquish',
    source: 'standalone',
    target: 'sidepanel',
    timestamp: 1,
    electionEpoch: 0,
    payload: { epoch: 0, committedVersion: 0 },
  } as RuntimeEnvelope;
}

describe('workspace mirror', () => {
  it('applies the next sequential version', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 1 }, envelope())).toEqual({
      action: 'apply',
    });
  });

  it('ignores a duplicate version', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 2 }, envelope())).toEqual({
      action: 'ignore',
      reason: 'duplicate',
    });
  });

  it('ignores a stale version', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 5 }, envelope())).toEqual({
      action: 'ignore',
      reason: 'stale',
    });
  });

  it('requests rehydration on a version gap', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 0 }, envelope())).toEqual({
      action: 'rehydrate',
      reason: 'gap',
    });
  });

  it('ignores an envelope from a different epoch', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 1 }, envelope({ electionEpoch: 0 }))).toEqual(
      { action: 'ignore', reason: 'epoch' },
    );
  });

  it('advances mirror state only when applying', () => {
    const applied = applyMirrorEnvelope({ epoch: 1, committedVersion: 1 }, envelope());
    expect(applied.state).toEqual({ epoch: 1, committedVersion: 2 });
    const gap = applyMirrorEnvelope({ epoch: 1, committedVersion: 0 }, envelope());
    expect(gap.state).toEqual({ epoch: 1, committedVersion: 0 });
    expect(gap.decision.action).toBe('rehydrate');
  });

  it('builds valid rehydrate request and response envelopes', () => {
    const request = createRehydrateRequestEnvelope(
      { sinceVersion: 3, instanceId: 'standalone-instance', writerType: 'standalone' },
      'standalone',
    );
    expect(parseRuntimeEnvelope(request).success).toBe(true);
    expect(request.type).toBe('workspace.rehydrate.request');
    const response = createRehydrateResponseEnvelope(
      { committedVersion: 4, epoch: 2, metadata: { schemaVersion: 1, committedVersion: 4, updatedAt: 9 } },
      'sidepanel',
    );
    expect(parseRuntimeEnvelope(response).success).toBe(true);
    expect(response.type).toBe('workspace.rehydrate.response');
    expect(response.workspaceVersion).toBe(4);
    expect(response.electionEpoch).toBe(2);
  });
});
```

Add a second `describe` block in the same file for the coordination handshake:

```ts
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { createWorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import { createWorkspaceCoordinator } from '@/core/workspace/WorkspaceSync';
import { ElectionRecordSchema } from '@/core/workspace/workspaceTypes';

interface TestBus {
  send(envelope: RuntimeEnvelope): Promise<void>;
  on(type: string, handler: (envelope: RuntimeEnvelope) => unknown): () => void;
}

function createTestBus(): TestBus {
  const handlers = new Map<string, Set<(envelope: RuntimeEnvelope) => unknown>>();
  return {
    async send(envelope) {
      const set = handlers.get(envelope.type);
      if (!set) return;
      for (const handler of set) await handler(envelope);
    },
    on(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler);
      handlers.set(type, set);
      return () => set.delete(handler);
    },
  };
}

describe('workspace coordinator handshake', () => {
  it('hands writer ownership from sidepanel to standalone through prepare/ack/commit', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    const store = createWorkspaceStore(storage);
    await store.writeMetadata({ schemaVersion: 1, committedVersion: 0, updatedAt: 1 });
    const election = createWorkspaceElection({
      storage,
      store,
      writerType: 'sidepanel',
      instanceId: 'sp',
      now: () => 1,
    });
    await election.claim();
    const handoff = createWorkspaceHandoff({
      storage,
      writerType: 'sidepanel',
      instanceId: 'sp',
      now: () => 2,
    });
    const bus = createTestBus();
    const sidepanel = createWorkspaceCoordinator({
      bus,
      surface: 'sidepanel',
      instanceId: 'sp',
      storage,
      election,
      handoff,
      store,
    });
    const standalone = createWorkspaceCoordinator({
      bus,
      surface: 'standalone',
      instanceId: 'st',
      storage,
      election: createWorkspaceElection({
        storage,
        store,
        writerType: 'standalone',
        instanceId: 'st',
        now: () => 3,
      }),
      handoff: createWorkspaceHandoff({
        storage,
        writerType: 'standalone',
        instanceId: 'st',
        now: () => 3,
      }),
      store,
    });
    const stopSidepanel = sidepanel.start();
    const stopStandalone = standalone.start();
    await standalone.announce();
    const record = await storage.read('np_workspace_election', ElectionRecordSchema);
    expect(record.status).toBe('valid');
    if (record.status === 'valid') {
      expect(record.value.writerType).toBe('standalone');
      expect(record.value.writerInstanceId).toBe('st');
      expect(record.value.epoch).toBe(1);
    }
    stopSidepanel();
    stopStandalone();
  });

  it('reclaims side panel ownership after the writer election is relinquished', async () => {
    const chromeStorage = createChromeStorageMock();
    const storage = createValidatedStorage(chromeStorage);
    const store = createWorkspaceStore(storage);
    const election = createWorkspaceElection({
      storage,
      store,
      writerType: 'sidepanel',
      instanceId: 'sp',
      now: () => 1,
    });
    await election.claim();
    const bus = createTestBus();
    const coordinator = createWorkspaceCoordinator({
      bus,
      surface: 'sidepanel',
      instanceId: 'sp',
      storage,
      election,
      handoff: createWorkspaceHandoff({
        storage,
        writerType: 'sidepanel',
        instanceId: 'sp',
        now: () => 2,
      }),
      store,
    });
    const stop = coordinator.start();
    await storage.remove('np_workspace_election');
    chromeStorage.emitStorageChange(
      { np_workspace_election: { newValue: undefined } },
      'session',
    );
    await vi.waitFor(async () => {
      const record = await storage.read('np_workspace_election', ElectionRecordSchema);
      expect(record.status).toBe('valid');
    });
    stop();
  });

  it('mirrors a current-epoch next-version mutation', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    const store = createWorkspaceStore(storage);
    const election = createWorkspaceElection({
      storage,
      store,
      writerType: 'sidepanel',
      instanceId: 'sp',
      now: () => 1,
    });
    await storage.write('np_workspace_election', ElectionRecordSchema, {
      writerType: 'standalone',
      writerInstanceId: 'st',
      epoch: 0,
      committedVersion: 0,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: 1,
    });
    const coordinator = createWorkspaceCoordinator({
      bus: createTestBus(),
      surface: 'sidepanel',
      instanceId: 'sp',
      storage,
      election,
      handoff: createWorkspaceHandoff({
        storage,
        writerType: 'sidepanel',
        instanceId: 'sp',
        now: () => 2,
      }),
      store,
    });
    await expect(coordinator.handleMutation(mutationEnvelope(1, 0))).resolves.toEqual({
      status: 'mirrored',
    });
  });

  it('requests rehydration when a mutation arrives with a version gap', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    const store = createWorkspaceStore(storage);
    const bus = createTestBus();
    const sent: RuntimeEnvelope[] = [];
    const baseSend = bus.send.bind(bus);
    bus.send = async (envelope) => {
      sent.push(envelope);
      await baseSend(envelope);
    };
    const coordinator = createWorkspaceCoordinator({
      bus,
      surface: 'sidepanel',
      instanceId: 'sp',
      storage,
      election: createWorkspaceElection({
        storage,
        store,
        writerType: 'sidepanel',
        instanceId: 'sp',
        now: () => 1,
      }),
      handoff: createWorkspaceHandoff({
        storage,
        writerType: 'sidepanel',
        instanceId: 'sp',
        now: () => 2,
      }),
      store,
    });
    await store.writeMetadata({ schemaVersion: 1, committedVersion: 0, updatedAt: 1 });
    await expect(coordinator.handleMutation(mutationEnvelope(5, 0))).resolves.toEqual({
      status: 'rehydrated',
    });
    expect(sent.some((envelope) => envelope.type === 'workspace.rehydrate.request')).toBe(true);
  });

  it('relinquishes only when the local surface is the current writer', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    const store = createWorkspaceStore(storage);
    const election = createWorkspaceElection({
      storage,
      store,
      writerType: 'sidepanel',
      instanceId: 'sp',
      now: () => 1,
    });
    await election.claim();
    const coordinator = createWorkspaceCoordinator({
      bus: createTestBus(),
      surface: 'sidepanel',
      instanceId: 'sp',
      storage,
      election,
      handoff: createWorkspaceHandoff({
        storage,
        writerType: 'sidepanel',
        instanceId: 'sp',
        now: () => 2,
      }),
      store,
    });
    await expect(coordinator.handleRelinquish(relinquishEnvelope())).resolves.toEqual({
      status: 'relinquished',
    });
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/workspace/workspaceSync.test.ts
```

Expected: FAIL with a module-resolution error for `@/core/workspace/WorkspaceSync`.

- [ ] **Step 3: Implement `src/core/workspace/WorkspaceSync.ts`**

```ts
import type { ValidatedStorage } from '../storage/chromeStorage';
import type { MessageType } from '../runtime/MessageType';
import { createOperationId } from '../runtime/OperationId';
import type { RuntimeEnvelope } from '../runtime/RuntimeEnvelope';
import type { WorkspaceWriterSurface } from '../runtime/RuntimeSurface';
import type { WorkspaceElection } from './WorkspaceElection';
import type { WorkspaceHandoff } from './WorkspaceHandoff';
import type { WorkspaceStore } from './WorkspaceStore';
import {
  ElectionRecordSchema,
  type InstanceId,
  type WorkspaceMetadata,
  type WorkspaceWriterType,
} from './workspaceTypes';

export interface MirrorState {
  epoch: number;
  committedVersion: number;
}

export type MirrorDecision =
  | { action: 'apply' }
  | { action: 'ignore'; reason: 'duplicate' | 'stale' | 'epoch' }
  | { action: 'rehydrate'; reason: 'gap' };

export function classifyMirrorEnvelope(
  state: MirrorState,
  envelope: RuntimeEnvelope,
): MirrorDecision {
  const epoch = envelope.electionEpoch;
  const version = envelope.workspaceVersion;
  if (epoch === undefined || version === undefined) {
    return { action: 'ignore', reason: 'stale' };
  }
  if (epoch !== state.epoch) return { action: 'ignore', reason: 'epoch' };
  if (version === state.committedVersion) return { action: 'ignore', reason: 'duplicate' };
  if (version < state.committedVersion) return { action: 'ignore', reason: 'stale' };
  if (version === state.committedVersion + 1) return { action: 'apply' };
  return { action: 'rehydrate', reason: 'gap' };
}

export function applyMirrorEnvelope(
  state: MirrorState,
  envelope: RuntimeEnvelope,
): { state: MirrorState; decision: MirrorDecision } {
  const decision = classifyMirrorEnvelope(state, envelope);
  if (decision.action !== 'apply') return { state, decision };
  return {
    state: { epoch: state.epoch, committedVersion: envelope.workspaceVersion as number },
    decision,
  };
}

export function createRehydrateRequestEnvelope(
  input: { sinceVersion: number; instanceId: InstanceId; writerType: WorkspaceWriterType },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.rehydrate.request',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    workspaceVersion: input.sinceVersion,
    payload: input,
  };
}

export function createRehydrateResponseEnvelope(
  input: { committedVersion: number; epoch: number; metadata: WorkspaceMetadata },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.rehydrate.response',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    electionEpoch: input.epoch,
    workspaceVersion: input.committedVersion,
    payload: {
      committedVersion: input.committedVersion,
      epoch: input.epoch,
      metadata: input.metadata,
    },
  };
}

export function createHandoffPrepareEnvelope(
  input: { toInstanceId: InstanceId; epoch: number; baseVersion: number },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.handoff.prepare',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    electionEpoch: input.epoch,
    payload: input,
  };
}

export function createHandoffAckEnvelope(
  input: { toInstanceId: InstanceId; epoch: number; committedVersion: number },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.handoff.ack',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    electionEpoch: input.epoch,
    workspaceVersion: input.committedVersion,
    payload: input,
  };
}

export function createHandoffCommitEnvelope(
  input: { toInstanceId: InstanceId; epoch: number; committedVersion: number },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.handoff.commit',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    electionEpoch: input.epoch,
    workspaceVersion: input.committedVersion,
    payload: input,
  };
}

export interface CoordinatorBus {
  send(envelope: RuntimeEnvelope): Promise<void>;
  on(type: MessageType, handler: (envelope: RuntimeEnvelope) => unknown): () => void;
}

export interface WorkspaceCoordinatorDependencies {
  bus: CoordinatorBus;
  surface: WorkspaceWriterSurface;
  instanceId: InstanceId;
  storage: ValidatedStorage;
  election: WorkspaceElection;
  handoff: WorkspaceHandoff;
  store: WorkspaceStore;
}

export type CoordinatorStep =
  | { status: 'noop' }
  | { status: 'rehydrated' }
  | { status: 'prepared' }
  | { status: 'acknowledged' }
  | { status: 'committed' }
  | { status: 'mirrored' }
  | { status: 'relinquished' }
  | {
      status: 'failed';
      code: 'WORKSPACE_HANDOFF_FAILED' | 'WORKSPACE_INVALID_METADATA';
    };

export interface WorkspaceCoordinator {
  start(): () => void;
  announce(): Promise<void>;
  handleRehydrateRequest(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
  handleHandoffPrepare(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
  handleHandoffAck(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
  handleMutation(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
  handleRelinquish(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
}

export function createWorkspaceCoordinator(
  deps: WorkspaceCoordinatorDependencies,
): WorkspaceCoordinator {
  async function handleRehydrateRequest(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.rehydrate.request') return { status: 'noop' };
    const election = await deps.election.read();
    if (election.status !== 'valid' || !deps.election.isWriter(election.record)) {
      return { status: 'noop' };
    }
    const metadata = await deps.store.readMetadata();
    if (metadata.status !== 'valid') {
      return { status: 'failed', code: 'WORKSPACE_INVALID_METADATA' };
    }
    await deps.bus.send(
      createRehydrateResponseEnvelope(
        {
          committedVersion: metadata.metadata.committedVersion,
          epoch: election.record.epoch,
          metadata: metadata.metadata,
        },
        deps.surface,
      ),
    );
    if (deps.surface === 'sidepanel' && envelope.payload.writerType === 'standalone') {
      const prepared = await deps.handoff.prepare(
        { instanceId: envelope.payload.instanceId, writerType: 'standalone' },
        metadata.metadata.committedVersion,
      );
      if (prepared.status !== 'prepared') {
        return { status: 'failed', code: 'WORKSPACE_HANDOFF_FAILED' };
      }
      await deps.bus.send(
        createHandoffPrepareEnvelope(
          {
            toInstanceId: envelope.payload.instanceId,
            epoch: election.record.epoch,
            baseVersion: metadata.metadata.committedVersion,
          },
          deps.surface,
        ),
      );
      return { status: 'prepared' };
    }
    return { status: 'rehydrated' };
  }

  async function handleHandoffPrepare(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.handoff.prepare') return { status: 'noop' };
    if (envelope.payload.toInstanceId !== deps.instanceId) return { status: 'noop' };
    await deps.bus.send(
      createHandoffAckEnvelope(
        {
          toInstanceId: deps.instanceId,
          epoch: envelope.payload.epoch,
          committedVersion: envelope.payload.baseVersion,
        },
        deps.surface,
      ),
    );
    return { status: 'acknowledged' };
  }

  async function handleHandoffAck(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.handoff.ack') return { status: 'noop' };
    const election = await deps.election.read();
    if (election.status !== 'valid' || !deps.election.isWriter(election.record)) {
      return { status: 'noop' };
    }
    const committed = await deps.handoff.commit(
      envelope.payload.epoch,
      envelope.payload.committedVersion,
    );
    if (committed.status !== 'committed') {
      return { status: 'failed', code: 'WORKSPACE_HANDOFF_FAILED' };
    }
    await deps.bus.send(
      createHandoffCommitEnvelope(
        {
          toInstanceId: envelope.payload.toInstanceId,
          epoch: envelope.payload.epoch,
          committedVersion: envelope.payload.committedVersion,
        },
        deps.surface,
      ),
    );
    return { status: 'committed' };
  }

  async function handleMutation(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.mutation') return { status: 'noop' };
    const election = await deps.election.read();
    const committedVersion = await deps.store.readVersion();
    const state: MirrorState = {
      epoch: election.status === 'valid' ? election.record.epoch : 0,
      committedVersion,
    };
    const result = applyMirrorEnvelope(state, envelope);
    if (result.decision.action === 'apply') return { status: 'mirrored' };
    if (result.decision.action === 'rehydrate') {
      await deps.bus.send(
        createRehydrateRequestEnvelope(
          { sinceVersion: committedVersion, instanceId: deps.instanceId, writerType: deps.surface },
          deps.surface,
        ),
      );
      return { status: 'rehydrated' };
    }
    return { status: 'noop' };
  }

  async function handleRelinquish(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.relinquish') return { status: 'noop' };
    const election = await deps.election.read();
    if (election.status === 'valid' && deps.election.isWriter(election.record)) {
      await deps.election.relinquish();
      return { status: 'relinquished' };
    }
    return { status: 'noop' };
  }

  return {
    async announce() {
      const sinceVersion = await deps.store.readVersion();
      await deps.bus.send(
        createRehydrateRequestEnvelope(
          { sinceVersion, instanceId: deps.instanceId, writerType: deps.surface },
          deps.surface,
        ),
      );
    },
    handleRehydrateRequest,
    handleHandoffPrepare,
    handleHandoffAck,
    handleMutation,
    handleRelinquish,
    start() {
      const unsubscribe = [
        deps.bus.on('workspace.rehydrate.request', (envelope) => handleRehydrateRequest(envelope)),
        deps.bus.on('workspace.handoff.prepare', (envelope) => handleHandoffPrepare(envelope)),
        deps.bus.on('workspace.handoff.ack', (envelope) => handleHandoffAck(envelope)),
        deps.bus.on('workspace.mutation', (envelope) => handleMutation(envelope)),
        deps.bus.on('workspace.relinquish', (envelope) => handleRelinquish(envelope)),
        deps.storage.subscribe('np_workspace_election', ElectionRecordSchema, (result) => {
          if (deps.surface !== 'sidepanel') return;
          if (result.status === 'valid') return;
          void deps.election.claim();
        }),
      ];
      return () => {
        for (const off of unsubscribe) off();
      };
    },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/core/workspace/workspaceSync.test.ts
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/core/workspace/WorkspaceSync.ts tests/core/workspace/workspaceSync.test.ts .planning
git commit -m "feat(phase-01): coordinate writer handoff and mirror convergence"
```

**Constraints and non-goals:** `chrome.storage.onChanged` remains recovery/convergence support, not an unversioned stream; no direct mirror writes; only current-epoch next-version envelopes apply; no IndexedDB; the coordinator only orchestrates existing canonical message types and never adds a message type, a background broker, or a writer election bypass.
**Approved Interpretation 2:** `createWorkspaceCoordinator` is the Phase 01 orchestration boundary for prepare, acknowledge, commit, relinquish, mutation, and rehydration. `WorkspaceRehydrateRequestPayload` carries `instanceId` and `writerType`. No new message type, storage key, error code, runtime surface, or persistence mechanism is introduced. The background service worker stays outside workspace ownership and mutation coordination. The elected single-writer protocol is preserved (prepare/commit only when the local surface is the writer). Every handler is exposed and tested directly through injected boundaries; the coordinator exposes only `start`, `announce`, and the named handlers and is not a service locator.
**Focused verification:** `pnpm run test -- tests/core/workspace/workspaceSync.test.ts`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** ignore duplicate/stale; rehydrate on gaps; apply only current-epoch next-version; rehydration uses the canonical message pair; handoff prepare/ack/commit never authorises two writers.
**Code-quality and security checklist:** no mirror state advanced on ignored/rehydrate decisions; no silent gap skip; the coordinator validates writer status before preparing or committing; no committed mutation replay.
**Evidence:** `verification.txt` and `review.md` Task 16 sections, including the orchestration observation.
**Atomic commit:** `feat(phase-01): coordinate writer handoff and mirror convergence`
**Completion criteria:** sync test file green (mirror + handshake); typecheck and lint pass.
**Stop conditions:** convergence requires an unversioned stream; the handshake requires a new message type; the operator rejects the requester-identity contract.

### Task 17 — Theme Schemas, Ant Design Configuration, Persistence, and Live Propagation

**Implementation tier:** balanced
**Depends on:** T03, T04
**Files created:** `src/core/theme/themeTypes.ts`, `src/core/theme/antdConfig.ts`, `src/core/theme/ThemeStore.ts`, `src/core/theme/useTheme.ts`, `tests/core/theme/themeTypes.test.ts`, `tests/core/theme/antdConfig.test.ts`, `tests/core/theme/themeStore.test.ts`, `tests/core/theme/useTheme.test.tsx`
**Files modified:** none
**Test files:** the four listed test files
**Interfaces produced:**
- `THEME_MODES`, `type ThemeMode`, `ThemeModeSchema`, `THEME_PACKS`, `type ThemePack`, `ThemePackSchema`, `DEFAULT_THEME_MODE`, `DEFAULT_THEME_PACK`, `type ResolvedColorScheme`, `resolveColorScheme(mode, prefersDark)`
- `NOWPILOT_SEED`, `NOWPILOT_COMPONENTS`, `NOWPILOT_PACK_OVERLAYS`, `interface AntdConfigInput`, `getAntdConfig(input): ThemeConfig`
- `interface ThemePreferences`, `interface ThemeStore`, `createThemeStore(storage): ThemeStore`
- `useTheme(store, options): { config; mode; pack }`

- [ ] **Step 1: Write the failing tests (RED)**

Create `tests/core/theme/themeTypes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PACK,
  THEME_MODES,
  THEME_PACKS,
  ThemeModeSchema,
  ThemePackSchema,
  resolveColorScheme,
} from '@/core/theme/themeTypes';

describe('theme types', () => {
  it('declares the three display modes and three packs in order', () => {
    expect(THEME_MODES).toEqual(['auto', 'light', 'dark']);
    expect(THEME_PACKS).toEqual(['default', 'liquid-glass', 'claude-warm']);
    expect(DEFAULT_THEME_MODE).toBe('auto');
    expect(DEFAULT_THEME_PACK).toBe('default');
  });

  it('rejects unknown theme values', () => {
    expect(ThemeModeSchema.safeParse('sepia').success).toBe(false);
    expect(ThemePackSchema.safeParse('solarized').success).toBe(false);
  });

  it('resolves auto by prefers-color-scheme and passes explicit modes through', () => {
    expect(resolveColorScheme('auto', true)).toBe('dark');
    expect(resolveColorScheme('auto', false)).toBe('light');
    expect(resolveColorScheme('light', true)).toBe('light');
    expect(resolveColorScheme('dark', false)).toBe('dark');
  });
});
```

Create `tests/core/theme/antdConfig.test.ts`:

```ts
import { theme } from 'antd';
import { describe, expect, it } from 'vitest';
import { NOWPILOT_SEED, getAntdConfig } from '@/core/theme/antdConfig';

describe('getAntdConfig', () => {
  it('uses the default algorithm for light and dark algorithm for dark', () => {
    expect(getAntdConfig({ mode: 'light', pack: 'default', compact: false }).algorithm).toBe(
      theme.defaultAlgorithm,
    );
    expect(getAntdConfig({ mode: 'dark', pack: 'default', compact: false }).algorithm).toBe(
      theme.darkAlgorithm,
    );
  });

  it('appends the compact algorithm when compact is true', () => {
    const config = getAntdConfig({ mode: 'light', pack: 'default', compact: true });
    expect(Array.isArray(config.algorithm)).toBe(true);
    expect(config.algorithm).toEqual([theme.defaultAlgorithm, theme.compactAlgorithm]);
  });

  it('resolves auto mode from prefersDark', () => {
    expect(getAntdConfig({ mode: 'auto', pack: 'default', compact: false, prefersDark: true }).algorithm).toBe(
      theme.darkAlgorithm,
    );
  });

  it('applies the seed and pack overlays in order', () => {
    const base = getAntdConfig({ mode: 'light', pack: 'default', compact: false });
    expect(base.token?.colorPrimary).toBe(NOWPILOT_SEED.colorPrimary);
    const warm = getAntdConfig({ mode: 'light', pack: 'claude-warm', compact: false });
    expect(warm.token?.colorBgBase).toBe('#FAF7F2');
    const glass = getAntdConfig({ mode: 'light', pack: 'liquid-glass', compact: false });
    expect(glass.token?.colorBgContainer).toBe('rgba(255,255,255,0.68)');
  });

  it('enables stable CSS variables for live theme switching', () => {
    expect(getAntdConfig({ mode: 'light', pack: 'default', compact: false }).cssVar).toEqual({
      key: 'nowpilot',
    });
  });
});
```

Create `tests/core/theme/themeStore.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createThemeStore } from '@/core/theme/ThemeStore';

describe('theme store', () => {
  it('returns canonical defaults for a fresh profile', async () => {
    const store = createThemeStore(createValidatedStorage(createChromeStorageMock()));
    await expect(store.read()).resolves.toEqual({ mode: 'auto', pack: 'default' });
  });

  it('returns canonical defaults for invalid stored values', async () => {
    const chromeStorage = createChromeStorageMock();
    chromeStorage.sync._setRaw('np_theme', 'sepia');
    chromeStorage.sync._setRaw('np_theme_pack', 'solarized');
    const store = createThemeStore(createValidatedStorage(chromeStorage));
    await expect(store.read()).resolves.toEqual({ mode: 'auto', pack: 'default' });
  });

  it('persists mode and pack to chrome.storage.sync', async () => {
    const chromeStorage = createChromeStorageMock();
    const store = createThemeStore(createValidatedStorage(chromeStorage));
    await store.writeMode('dark');
    await store.writePack('liquid-glass');
    await expect(store.read()).resolves.toEqual({ mode: 'dark', pack: 'liquid-glass' });
    expect(chromeStorage.sync.set).toHaveBeenCalledWith({ np_theme: 'dark' });
    expect(chromeStorage.sync.set).toHaveBeenCalledWith({ np_theme_pack: 'liquid-glass' });
    expect(chromeStorage.local.set).not.toHaveBeenCalled();
  });

  it('logs THEME_PERSIST_FAILED and rejects when a write fails', async () => {
    const chromeStorage = createChromeStorageMock();
    chromeStorage.sync.set.mockRejectedValueOnce(new Error('quota'));
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const store = createThemeStore(createValidatedStorage(chromeStorage));
    await expect(store.writeMode('dark')).rejects.toThrow();
    expect(debug.mock.calls.flat().join(' ')).toContain('THEME_PERSIST_FAILED');
    debug.mockRestore();
  });

  it('emits combined preferences when a theme key changes', async () => {
    const chromeStorage = createChromeStorageMock();
    const store = createThemeStore(createValidatedStorage(chromeStorage));
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    chromeStorage.sync._setRaw('np_theme', 'dark');
    chromeStorage.emitStorageChange({ np_theme: { newValue: 'dark' } }, 'sync');
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith({ mode: 'dark', pack: 'default' }));
    unsubscribe();
  });
});
```

Create `tests/core/theme/useTheme.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTheme } from '@/core/theme/useTheme';
import type { ThemePreferences, ThemeStore } from '@/core/theme/ThemeStore';

function createStore(initial: ThemePreferences): ThemeStore {
  let listener: ((prefs: ThemePreferences) => void) | undefined;
  let prefs = initial;
  return {
    async read() {
      return prefs;
    },
    async writeMode(mode) {
      prefs = { ...prefs, mode };
    },
    async writePack(pack) {
      prefs = { ...prefs, pack };
    },
    subscribe(next) {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
  };
}

describe('useTheme', () => {
  it('starts with stored preferences and updates on propagation', async () => {
    const store = createStore({ mode: 'light', pack: 'default' });
    const { result } = renderHook(() => useTheme(store, { compact: false }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.mode).toBe('light');
  });
});
```

- [ ] **Step 2: Run the tests and confirm the intended failure**

```bash
pnpm run test -- tests/core/theme
```

Expected: FAIL with module-resolution errors for the four theme modules.

- [ ] **Step 3: Implement `src/core/theme/themeTypes.ts`**

```ts
import { z } from 'zod';

export const THEME_MODES = ['auto', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const ThemeModeSchema = z.enum(THEME_MODES);

export const THEME_PACKS = ['default', 'liquid-glass', 'claude-warm'] as const;
export type ThemePack = (typeof THEME_PACKS)[number];
export const ThemePackSchema = z.enum(THEME_PACKS);

export const DEFAULT_THEME_MODE: ThemeMode = 'auto';
export const DEFAULT_THEME_PACK: ThemePack = 'default';

export type ResolvedColorScheme = 'light' | 'dark';

export function resolveColorScheme(mode: ThemeMode, prefersDark: boolean): ResolvedColorScheme {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}
```

- [ ] **Step 4: Implement `src/core/theme/antdConfig.ts`**

```ts
import { theme, type ThemeConfig } from 'antd';
import { resolveColorScheme, type ThemeMode, type ThemePack } from './themeTypes';

export const NOWPILOT_SEED = {
  colorPrimary: '#3B82F6',
  colorSuccess: '#10B981',
  colorWarning: '#F59E0B',
  colorError: '#EF4444',
  colorInfo: '#3B82F6',
  colorTextBase: '#1F2430',
  colorBgBase: '#FCFCFD',
  borderRadius: 8,
  wireframe: false,
} as const;

export const NOWPILOT_COMPONENTS = {
  Card: { borderRadiusLG: 12 },
  Button: { borderRadius: 8, controlHeight: 32 },
  Layout: { headerHeight: 52 },
  Menu: { itemBorderRadius: 8 },
  Modal: { borderRadiusLG: 16 },
} as const;

export const NOWPILOT_PACK_OVERLAYS: Record<
  ThemePack,
  { token?: ThemeConfig['token']; components?: ThemeConfig['components'] }
> = {
  default: {},
  'liquid-glass': { token: { colorBgContainer: 'rgba(255,255,255,0.68)' } },
  'claude-warm': { token: { colorBgBase: '#FAF7F2' } },
};

export interface AntdConfigInput {
  mode: ThemeMode;
  pack: ThemePack;
  compact: boolean;
  prefersDark?: boolean;
}

export function getAntdConfig({
  mode,
  pack,
  compact,
  prefersDark = false,
}: AntdConfigInput): ThemeConfig {
  const scheme = resolveColorScheme(mode, prefersDark);
  const overlay = NOWPILOT_PACK_OVERLAYS[pack];
  const baseAlgorithm = scheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;
  return {
    cssVar: { key: 'nowpilot' },
    hashed: false,
    algorithm: compact ? [baseAlgorithm, theme.compactAlgorithm] : baseAlgorithm,
    token: { ...NOWPILOT_SEED, ...overlay.token },
    components: { ...NOWPILOT_COMPONENTS, ...overlay.components },
  };
}
```

- [ ] **Step 5: Implement `src/core/theme/ThemeStore.ts`**

```ts
import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PACK,
  ThemeModeSchema,
  ThemePackSchema,
  type ThemeMode,
  type ThemePack,
} from './themeTypes';

export interface ThemePreferences {
  mode: ThemeMode;
  pack: ThemePack;
}

export interface ThemeStore {
  read(): Promise<ThemePreferences>;
  writeMode(mode: ThemeMode): Promise<void>;
  writePack(pack: ThemePack): Promise<void>;
  subscribe(listener: (preferences: ThemePreferences) => void): () => void;
}

export function createThemeStore(storage: ValidatedStorage): ThemeStore {
  async function read(): Promise<ThemePreferences> {
    const modeResult = await storage.read('np_theme', ThemeModeSchema);
    const packResult = await storage.read('np_theme_pack', ThemePackSchema);
    if (modeResult.status === 'invalid') {
      debugLog(createErrorRecord('THEME_INVALID_VALUE', { key: 'np_theme' }));
    }
    if (packResult.status === 'invalid') {
      debugLog(createErrorRecord('THEME_INVALID_VALUE', { key: 'np_theme_pack' }));
    }
    return {
      mode: modeResult.status === 'valid' ? modeResult.value : DEFAULT_THEME_MODE,
      pack: packResult.status === 'valid' ? packResult.value : DEFAULT_THEME_PACK,
    };
  }

  return {
    read,
    async writeMode(mode) {
      try {
        await storage.write('np_theme', ThemeModeSchema, mode);
      } catch {
        debugLog(createErrorRecord('THEME_PERSIST_FAILED', { key: 'np_theme' }));
        throw new Error('THEME_PERSIST_FAILED');
      }
    },
    async writePack(pack) {
      try {
        await storage.write('np_theme_pack', ThemePackSchema, pack);
      } catch {
        debugLog(createErrorRecord('THEME_PERSIST_FAILED', { key: 'np_theme_pack' }));
        throw new Error('THEME_PERSIST_FAILED');
      }
    },
    subscribe(listener) {
      const emit = () => {
        void read().then(listener);
      };
      const offMode = storage.subscribe('np_theme', ThemeModeSchema, emit);
      const offPack = storage.subscribe('np_theme_pack', ThemePackSchema, emit);
      return () => {
        offMode();
        offPack();
      };
    },
  };
}
```

- [ ] **Step 6: Implement `src/core/theme/useTheme.ts`**

```ts
import { useEffect, useState } from 'react';
import type { ThemeConfig } from 'antd';
import { getAntdConfig } from './antdConfig';
import type { ThemeStore } from './ThemeStore';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PACK,
  type ThemeMode,
  type ThemePack,
} from './themeTypes';

export interface UseThemeOptions {
  compact: boolean;
  prefersDark?: boolean;
}

export interface UseThemeResult {
  config: ThemeConfig;
  mode: ThemeMode;
  pack: ThemePack;
}

export function useTheme(store: ThemeStore, options: UseThemeOptions): UseThemeResult {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [pack, setPack] = useState<ThemePack>(DEFAULT_THEME_PACK);

  useEffect(() => {
    let active = true;
    const unsubscribe = store.subscribe((preferences) => {
      if (!active) return;
      setMode(preferences.mode);
      setPack(preferences.pack);
    });
    void store.read().then((preferences) => {
      if (!active) return;
      setMode(preferences.mode);
      setPack(preferences.pack);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store]);

  return {
    config: getAntdConfig({
      mode,
      pack,
      compact: options.compact,
      prefersDark: options.prefersDark ?? false,
    }),
    mode,
    pack,
  };
}
```

- [ ] **Step 7: Run the tests and confirm they pass (GREEN)**

```bash
pnpm run test -- tests/core/theme
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 8: Record evidence, update status, and commit**

```bash
git add src/core/theme tests/core/theme .planning
git commit -m "feat(phase-01): add theme schemas config store and hook"
```

**Constraints and non-goals:** no hard-coded hex in components; no `@ant-design/x`; no provider configuration; theme is independent of writer election; `chrome.storage.onChanged` drives live propagation; invalid values fall back to canonical defaults and log `THEME_INVALID_VALUE`.
**Focused verification:** `pnpm run test -- tests/core/theme`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** `np_theme` and `np_theme_pack` in `chrome.storage.sync`; seed → pack overlay → algorithm; Side Panel compact true / Standalone compact false is applied by callers; invalid → defaults.
**Code-quality and security checklist:** no raw stored value logged; write failures fail closed with `THEME_PERSIST_FAILED`; no remount-dependent switching.
**Evidence:** `verification.txt` and `review.md` Task 17 sections.
**Atomic commit:** `feat(phase-01): add theme schemas config store and hook`
**Completion criteria:** theme tests green; typecheck and lint pass.
**Stop conditions:** a theme token is not available in the pinned antd version; pack overlays require a new dependency.

---

### Task 18 — Standalone Page Registry, Core Registration, and Skeleton Pages

**Implementation tier:** economy
**Depends on:** T05
**Files created:** `src/core/registry/StandalonePageRegistry.ts`, `src/core/registry/registerCorePages.ts`, `src/components/standalone/pages/ChatPage.tsx`, `src/components/standalone/pages/AgentPage.tsx`, `src/components/standalone/pages/NotesPage.tsx`, `src/components/standalone/pages/WritePage.tsx`, `src/components/standalone/pages/ToolsPage.tsx`, `src/components/standalone/pages/DiagnosticsPage.tsx`, `src/components/options/OptionsPage.tsx` (skeleton, replaced in T20), `tests/core/registry/standalonePageRegistry.test.ts`, `tests/core/registry/registerCorePages.test.tsx`
**Files modified:** none
**Test files:** `tests/core/registry/standalonePageRegistry.test.ts`, `tests/core/registry/registerCorePages.test.tsx`
**Interfaces produced:**
- `type StandalonePageComponent`, `interface StandalonePageRegistry`, `createStandalonePageRegistry()`
- `createCorePageRegistry(): StandalonePageRegistry`, `CORE_PAGE_REGISTRY`
- `data-testid="standalone-page-<id>"` on every skeleton page (used by T24 isolation inspection)

- [ ] **Step 1: Write the failing tests (RED)**

Create `tests/core/registry/standalonePageRegistry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createStandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';

const Dummy = () => null;

describe('standalone page registry', () => {
  it('registers and resolves components by route id', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', Dummy);
    expect(registry.get('chat')).toBe(Dummy);
    expect(registry.has('chat')).toBe(true);
    expect(registry.get('notes')).toBeUndefined();
  });

  it('rejects duplicate registration', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', Dummy);
    expect(() => registry.register('chat', Dummy)).toThrow();
  });

  it('lists entries in registration order', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', Dummy);
    registry.register('agent', Dummy);
    expect(registry.entries().map((entry) => entry.routeId)).toEqual(['chat', 'agent']);
  });
});
```

Create `tests/core/registry/registerCorePages.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CORE_PAGE_REGISTRY } from '@/core/registry/registerCorePages';
import { STANDALONE_ROUTE_IDS } from '@/core/registry/standaloneRoutes';

describe('core page registry', () => {
  it('registers a component for every route id', () => {
    for (const id of STANDALONE_ROUTE_IDS) {
      expect(CORE_PAGE_REGISTRY.has(id)).toBe(true);
    }
    expect(CORE_PAGE_REGISTRY.entries()).toHaveLength(STANDALONE_ROUTE_IDS.length);
  });

  it('renders each skeleton page with its canonical test id', () => {
    for (const id of STANDALONE_ROUTE_IDS) {
      const Page = CORE_PAGE_REGISTRY.get(id);
      expect(Page).toBeDefined();
      const { unmount } = render(Page ? <Page /> : null);
      expect(screen.getByTestId(`standalone-page-${id}`)).toBeInTheDocument();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm the intended failure**

```bash
pnpm run test -- tests/core/registry
```

Expected: FAIL with module-resolution errors for `StandalonePageRegistry` and `registerCorePages`.

- [ ] **Step 3: Implement `src/core/registry/StandalonePageRegistry.ts`**

```ts
import type { ComponentType } from 'react';
import type { StandaloneRouteId } from './standaloneRoutes';

export type StandalonePageComponent = ComponentType;

export interface StandalonePageRegistry {
  register(routeId: StandaloneRouteId, component: StandalonePageComponent): void;
  get(routeId: StandaloneRouteId): StandalonePageComponent | undefined;
  has(routeId: StandaloneRouteId): boolean;
  entries(): ReadonlyArray<{ routeId: StandaloneRouteId; component: StandalonePageComponent }>;
}

export function createStandalonePageRegistry(): StandalonePageRegistry {
  const pages = new Map<StandaloneRouteId, StandalonePageComponent>();
  return {
    register(routeId, component) {
      if (pages.has(routeId)) {
        throw new Error(`Standalone route already registered: ${routeId}`);
      }
      pages.set(routeId, component);
    },
    get(routeId) {
      return pages.get(routeId);
    },
    has(routeId) {
      return pages.has(routeId);
    },
    entries() {
      return [...pages.entries()].map(([routeId, component]) => ({ routeId, component }));
    },
  };
}
```

- [ ] **Step 4: Implement the six skeleton page components**

Each page is presentational, non-interactive, and carries its canonical test id.

`src/components/standalone/pages/ChatPage.tsx`:

```tsx
import { Empty, Typography } from 'antd';

export function ChatPage() {
  return (
    <section data-testid="standalone-page-chat" aria-label="Chat">
      <Typography.Title level={3}>Chat</Typography.Title>
      <Empty description="Chat workspace arrives in a later phase." />
    </section>
  );
}
```

`src/components/standalone/pages/AgentPage.tsx`:

```tsx
import { Empty, Typography } from 'antd';

export function AgentPage() {
  return (
    <section data-testid="standalone-page-agent" aria-label="Agent">
      <Typography.Title level={3}>Agent</Typography.Title>
      <Empty description="Agent workspace arrives in a later phase." />
    </section>
  );
}
```

`src/components/standalone/pages/NotesPage.tsx`:

```tsx
import { Empty, Typography } from 'antd';

export function NotesPage() {
  return (
    <section data-testid="standalone-page-notes" aria-label="Notes">
      <Typography.Title level={3}>Notes</Typography.Title>
      <Empty description="Notes arrive in a later phase." />
    </section>
  );
}
```

`src/components/standalone/pages/WritePage.tsx`:

```tsx
import { Empty, Typography } from 'antd';

export function WritePage() {
  return (
    <section data-testid="standalone-page-write" aria-label="Write">
      <Typography.Title level={3}>Write</Typography.Title>
      <Empty description="Write arrives in a later phase." />
    </section>
  );
}
```

`src/components/standalone/pages/ToolsPage.tsx`:

```tsx
import { Empty, Typography } from 'antd';

export function ToolsPage() {
  return (
    <section data-testid="standalone-page-tools" aria-label="Tools">
      <Typography.Title level={3}>Tools</Typography.Title>
      <Empty description="Tools arrive in a later phase." />
    </section>
  );
}
```

`src/components/standalone/pages/DiagnosticsPage.tsx`:

```tsx
import { Empty, Typography } from 'antd';

export function DiagnosticsPage() {
  return (
    <section data-testid="standalone-page-diagnostics" aria-label="Diagnostics">
      <Typography.Title level={3}>Diagnostics</Typography.Title>
      <Empty description="Diagnostics arrive in a later phase." />
    </section>
  );
}
```

- [ ] **Step 5: Implement `src/core/registry/registerCorePages.ts`**

```ts
import { AgentPage } from '../../components/standalone/pages/AgentPage';
import { ChatPage } from '../../components/standalone/pages/ChatPage';
import { DiagnosticsPage } from '../../components/standalone/pages/DiagnosticsPage';
import { NotesPage } from '../../components/standalone/pages/NotesPage';
import { ToolsPage } from '../../components/standalone/pages/ToolsPage';
import { WritePage } from '../../components/standalone/pages/WritePage';
import { OptionsPage } from '../../components/options/OptionsPage';
import { createStandalonePageRegistry, type StandalonePageRegistry } from './StandalonePageRegistry';

export function createCorePageRegistry(): StandalonePageRegistry {
  const registry = createStandalonePageRegistry();
  registry.register('chat', ChatPage);
  registry.register('agent', AgentPage);
  registry.register('notes', NotesPage);
  registry.register('write', WritePage);
  registry.register('tools', ToolsPage);
  registry.register('options', OptionsPage);
  registry.register('diagnostics', DiagnosticsPage);
  return registry;
}

export const CORE_PAGE_REGISTRY = createCorePageRegistry();
```

`OptionsPage` is created in Task 20. Until Task 20 exists, this import fails; therefore **perform Task 20's `OptionsPage.tsx` and `AppearanceSection.tsx` creation before running Step 6 of this task**, or temporarily register a local placeholder. To keep the commit atomic and green, this task's file list includes only the six skeleton pages; create a minimal `src/components/options/OptionsPage.tsx` in this task as a skeleton with `data-testid="standalone-page-options"`, and let Task 20 replace its body. Record this in the task notes.

Add `src/components/options/OptionsPage.tsx` (skeleton, replaced in T20):

```tsx
import { Empty, Typography } from 'antd';

export function OptionsPage() {
  return (
    <section data-testid="standalone-page-options" aria-label="Options">
      <Typography.Title level={3}>Options</Typography.Title>
      <Empty description="Appearance controls are added in Task 20." />
    </section>
  );
}
```

Do not create `AppearanceSection.tsx` in this task.

- [ ] **Step 6: Run the tests and confirm they pass (GREEN)**

```bash
pnpm run test -- tests/core/registry
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 7: Record evidence, update status, and commit**

```bash
git add src/core/registry src/components/standalone/pages src/components/options tests/core/registry .planning
git commit -m "feat(phase-01): register standalone pages and skeletons"
```

**Constraints and non-goals:** no later-phase page logic; no TeamGQM or ServiceNow; no mock services; no inactive controls; skeleton pages are presentational only.
**Focused verification:** `pnpm run test -- tests/core/registry`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** exactly seven registry entries; primary/footer placement comes from `standaloneRoutes.ts` (not this task); labels match; no route duplication.
**Code-quality and security checklist:** registry rejects duplicates; no interactive controls; stable test ids for isolation inspection.
**Evidence:** `verification.txt` and `review.md` Task 18 sections.
**Atomic commit:** `feat(phase-01): register standalone pages and skeletons`
**Completion criteria:** registry tests green; typecheck and lint pass.
**Stop conditions:** a route lacks a page; a page needs later-phase behaviour.

---

### Task 19 — Standalone Shell, Router, and Sider

**Implementation tier:** balanced
**Depends on:** T18
**Files created:** `src/components/standalone/StandaloneShell.tsx`, `src/components/standalone/StandaloneRouter.tsx`, `src/components/standalone/StandaloneSider.tsx`, `tests/components/standaloneRouter.test.tsx`, `tests/components/standaloneSider.test.tsx`, `tests/components/standaloneShell.test.tsx`
**Files modified:** none
**Test files:** the three listed test files
**Interfaces produced:**
- `interface UseStandaloneRouteOptions`, `interface StandaloneRouteController`, `useStandaloneRoute(options)`
- `interface StandaloneRouterProps { registry; routeId }`, `StandaloneRouter`
- `interface StandaloneSiderProps { activeRoute; onNavigate }`, `StandaloneSider`
- `interface StandaloneShellProps`, `StandaloneShell`

- [ ] **Step 1: Write the failing tests (RED)**

Create `tests/components/standaloneSider.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StandaloneSider } from '@/components/standalone/StandaloneSider';

describe('StandaloneSider', () => {
  it('renders the five primary and two footer routes from the registry', () => {
    render(<StandaloneSider activeRoute="chat" onNavigate={() => {}} />);
    for (const label of ['Chat', 'Agent', 'Notes', 'Write', 'Tools', 'Options', 'Diagnostics']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('navigates to the clicked route id', () => {
    const onNavigate = vi.fn();
    render(<StandaloneSider activeRoute="chat" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Notes'));
    expect(onNavigate).toHaveBeenCalledWith('notes');
  });
});
```

Create `tests/components/standaloneRouter.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createStandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import { StandaloneRouter } from '@/components/standalone/StandaloneRouter';

function registryWithChat() {
  const registry = createStandalonePageRegistry();
  registry.register('chat', () => <div>Chat page body</div>);
  registry.register('notes', () => <div>Notes page body</div>);
  return registry;
}

describe('StandaloneRouter', () => {
  it('renders the page for the active route', () => {
    render(<StandaloneRouter registry={registryWithChat()} routeId="notes" />);
    expect(screen.getByText('Notes page body')).toBeInTheDocument();
  });

  it('renders nothing missing a registered page', () => {
    const registry = createStandalonePageRegistry();
    const { container } = render(<StandaloneRouter registry={registry} routeId="chat" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('useStandaloneRoute', () => {
  it('falls back to chat for an unknown hash and reports it', async () => {
    const { useStandaloneRoute } = await import('@/components/standalone/StandaloneRouter');
    const onFallback = vi.fn();
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const Harness = () => {
      const { routeId } = useStandaloneRoute({ initialHash: '#/unknown', onRouteFallback: onFallback });
      return <div>{routeId}</div>;
    };
    render(<Harness />);
    expect(screen.getByText('chat')).toBeInTheDocument();
    expect(onFallback).toHaveBeenCalledWith('#/unknown');
    expect(replaceState).toHaveBeenCalledWith(null, '', '#/chat');
    replaceState.mockRestore();
  });
});
```

Create `tests/components/standaloneShell.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createStandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';

describe('StandaloneShell', () => {
  it('shows the sider and the active page, and switches pages on navigation', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', () => <div>Chat page body</div>);
    registry.register('notes', () => <div>Notes page body</div>);
    render(<StandaloneShell registry={registry} initialHash="#/chat" />);
    expect(screen.getByText('Chat page body')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Notes'));
    expect(screen.getByText('Notes page body')).toBeInTheDocument();
  });

  it('reports the STANDALONE_ROUTE_FALLBACK diagnostic for an unknown hash', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', () => <div>Chat page body</div>);
    const onRouteFallback = vi.fn();
    render(<StandaloneShell registry={registry} initialHash="#/nope" onRouteFallback={onRouteFallback} />);
    expect(onRouteFallback).toHaveBeenCalledWith('#/nope');
  });
});
```

- [ ] **Step 2: Run the tests and confirm the intended failure**

```bash
pnpm run test -- tests/components
```

Expected: FAIL with module-resolution errors for the three shell components.

- [ ] **Step 3: Implement `src/components/standalone/StandaloneSider.tsx`**

```tsx
import { Layout, Menu } from 'antd';
import {
  FOOTER_STANDALONE_ROUTES,
  PRIMARY_STANDALONE_ROUTES,
  type StandaloneRouteId,
} from '@/core/registry/standaloneRoutes';

export interface StandaloneSiderProps {
  activeRoute: StandaloneRouteId;
  onNavigate(routeId: StandaloneRouteId): void;
}

export function StandaloneSider({ activeRoute, onNavigate }: StandaloneSiderProps) {
  const items = [
    ...PRIMARY_STANDALONE_ROUTES.map((route) => ({ key: route.id, label: route.label })),
    ...FOOTER_STANDALONE_ROUTES.map((route) => ({ key: route.id, label: route.label })),
  ];
  return (
    <Layout.Sider width={240} theme="light" aria-label="Workspace navigation">
      <Menu
        mode="inline"
        selectedKeys={[activeRoute]}
        items={items}
        onClick={({ key }) => onNavigate(key as StandaloneRouteId)}
      />
    </Layout.Sider>
  );
}
```

- [ ] **Step 4: Implement `src/components/standalone/StandaloneRouter.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { StandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import {
  DEFAULT_STANDALONE_ROUTE_ID,
  resolveStandaloneRouteId,
  standaloneHashRoute,
  type StandaloneRouteId,
} from '@/core/registry/standaloneRoutes';

export interface StandaloneRouterProps {
  registry: StandalonePageRegistry;
  routeId: StandaloneRouteId;
}

export function StandaloneRouter({ registry, routeId }: StandaloneRouterProps) {
  const Page = registry.get(routeId);
  return Page ? <Page /> : null;
}

export interface UseStandaloneRouteOptions {
  initialHash?: string;
  focusSubscription?: (listener: (destination: StandaloneRouteId) => void) => () => void;
  onRouteFallback?: (rawHash: string) => void;
}

export interface StandaloneRouteController {
  routeId: StandaloneRouteId;
  navigate(routeId: StandaloneRouteId): void;
}

export function useStandaloneRoute(
  options: UseStandaloneRouteOptions = {},
): StandaloneRouteController {
  const [routeId, setRouteId] = useState<StandaloneRouteId>(() => {
    const raw =
      options.initialHash ?? (typeof window === 'undefined' ? '' : window.location.hash);
    const resolved = resolveStandaloneRouteId(raw);
    if (resolved.fellBack && options.onRouteFallback) options.onRouteFallback(raw);
    return resolved.routeId;
  });

  const navigate = useCallback((next: StandaloneRouteId) => {
    setRouteId(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', standaloneHashRoute(next));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', standaloneHashRoute(routeId));
    }
  }, [routeId]);

  useEffect(() => {
    if (!options.focusSubscription) return undefined;
    return options.focusSubscription((destination) => setRouteId(destination));
  }, [options.focusSubscription]);

  return { routeId, navigate };
}
```

- [ ] **Step 5: Implement `src/components/standalone/StandaloneShell.tsx`**

```tsx
import { Layout } from 'antd';
import type { StandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import type { StandaloneRouteId } from '@/core/registry/standaloneRoutes';
import { StandaloneRouter, useStandaloneRoute } from './StandaloneRouter';
import { StandaloneSider } from './StandaloneSider';

export interface StandaloneShellProps {
  registry: StandalonePageRegistry;
  initialHash?: string;
  focusSubscription?: (listener: (destination: StandaloneRouteId) => void) => () => void;
  onRouteFallback?: (rawHash: string) => void;
}

export function StandaloneShell({
  registry,
  initialHash,
  focusSubscription,
  onRouteFallback,
}: StandaloneShellProps) {
  const { routeId, navigate } = useStandaloneRoute({
    initialHash,
    focusSubscription,
    onRouteFallback,
  });
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <StandaloneSider activeRoute={routeId} onNavigate={navigate} />
      <Layout.Content>
        <StandaloneRouter registry={registry} routeId={routeId} />
      </Layout.Content>
    </Layout>
  );
}
```

- [ ] **Step 6: Run the tests and confirm they pass (GREEN)**

```bash
pnpm run test -- tests/components
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 7: Record evidence, update status, and commit**

```bash
git add src/components/standalone tests/components .planning
git commit -m "feat(phase-01): add standalone shell router and sider"
```

**Constraints and non-goals:** hash routing via `replaceState`; no `hashchange`/`popstate` listeners; no browser-history traversal; no hard-coded Sider arrays; no Standalone navigation UI in the Side Panel.
**Focused verification:** `pnpm run test -- tests/components`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** default `chat`; unknown hash → chat + fallback diagnostic callback; Sider lists 5 primary + 2 footer from the registry; focus destination applied by the live router.
**Code-quality and security checklist:** accessible nav label; no route strings built outside the registry; no history entries.
**Evidence:** `verification.txt` and `review.md` Task 19 sections.
**Atomic commit:** `feat(phase-01): add standalone shell router and sider`
**Completion criteria:** component tests green; typecheck and lint pass.
**Stop conditions:** routing requires browser-history traversal or query/path routing.

---

### Task 20 — Options Appearance Controls (General → Appearance)

**Implementation tier:** balanced
**Depends on:** T17, T19
**Files created:** `src/components/options/AppearanceSection.tsx`, `tests/components/optionsAppearance.test.tsx`
**Files modified:** `src/components/options/OptionsPage.tsx` (replace skeleton body)
**Test files:** `tests/components/optionsAppearance.test.tsx`
**Interfaces produced:**
- `interface AppearanceSectionProps { mode; pack; onModeChange; onPackChange }`, `AppearanceSection`
- `OptionsPage` renders exactly `General → Appearance → { Display mode, Theme pack }` and wires a `ThemeStore`

- [ ] **Step 1: Write the failing test (RED)**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppearanceSection } from '@/components/options/AppearanceSection';
import { OptionsPage } from '@/components/options/OptionsPage';
import type { ThemeStore } from '@/core/theme/ThemeStore';

describe('AppearanceSection', () => {
  it('renders display mode and theme pack controls with the approved options', () => {
    render(
      <AppearanceSection
        mode="auto"
        pack="default"
        onModeChange={() => {}}
        onPackChange={() => {}}
      />,
    );
    expect(screen.getByText('Display mode')).toBeInTheDocument();
    expect(screen.getByText('Theme pack')).toBeInTheDocument();
    for (const option of ['Auto', 'Light', 'Dark']) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }
    for (const option of ['Default', 'Liquid Glass', 'Claude Warm']) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }
  });

  it('reports mode and pack changes', () => {
    const onModeChange = vi.fn();
    const onPackChange = vi.fn();
    render(
      <AppearanceSection
        mode="auto"
        pack="default"
        onModeChange={onModeChange}
        onPackChange={onPackChange}
      />,
    );
    fireEvent.click(screen.getByText('Dark'));
    expect(onModeChange).toHaveBeenCalledWith('dark');
    fireEvent.click(screen.getByText('Liquid Glass'));
    expect(onPackChange).toHaveBeenCalledWith('liquid-glass');
  });
});

describe('OptionsPage', () => {
  it('renders only the General → Appearance controls', () => {
    const store: ThemeStore = {
      read: vi.fn(async () => ({ mode: 'auto', pack: 'default' })),
      writeMode: vi.fn(async () => {}),
      writePack: vi.fn(async () => {}),
      subscribe: vi.fn(() => () => {}),
    };
    render(<OptionsPage store={store} />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Display mode')).toBeInTheDocument();
    expect(screen.getByText('Theme pack')).toBeInTheDocument();
    expect(screen.queryByText('Providers')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnostics')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/components/optionsAppearance.test.tsx
```

Expected: FAIL with a module-resolution error for `@/components/options/AppearanceSection` and because `OptionsPage` does not accept a `store` prop.

- [ ] **Step 3: Implement `src/components/options/AppearanceSection.tsx`**

```tsx
import { Segmented, Space, Typography } from 'antd';
import {
  THEME_MODES,
  THEME_PACKS,
  type ThemeMode,
  type ThemePack,
} from '@/core/theme/themeTypes';

const MODE_LABELS: Record<ThemeMode, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

const PACK_LABELS: Record<ThemePack, string> = {
  default: 'Default',
  'liquid-glass': 'Liquid Glass',
  'claude-warm': 'Claude Warm',
};

export interface AppearanceSectionProps {
  mode: ThemeMode;
  pack: ThemePack;
  onModeChange(mode: ThemeMode): void;
  onPackChange(pack: ThemePack): void;
}

export function AppearanceSection({
  mode,
  pack,
  onModeChange,
  onPackChange,
}: AppearanceSectionProps) {
  return (
    <Space direction="vertical" size="middle">
      <Typography.Title level={4} style={{ marginBottom: 0 }}>
        Appearance
      </Typography.Title>
      <Space direction="vertical" size="small">
        <Typography.Text>Display mode</Typography.Text>
        <Segmented
          value={mode}
          options={THEME_MODES.map((value) => ({ value, label: MODE_LABELS[value] }))}
          onChange={(value) => onModeChange(value as ThemeMode)}
        />
      </Space>
      <Space direction="vertical" size="small">
        <Typography.Text>Theme pack</Typography.Text>
        <Segmented
          value={pack}
          options={THEME_PACKS.map((value) => ({ value, label: PACK_LABELS[value] }))}
          onChange={(value) => onPackChange(value as ThemePack)}
        />
      </Space>
    </Space>
  );
}
```

- [ ] **Step 4: Replace `src/components/options/OptionsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Card, Typography } from 'antd';
import { getChromeStorage, createValidatedStorage } from '@/core/storage/chromeStorage';
import { createThemeStore, type ThemeStore } from '@/core/theme/ThemeStore';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PACK,
  type ThemeMode,
  type ThemePack,
} from '@/core/theme/themeTypes';
import { AppearanceSection } from './AppearanceSection';

export interface OptionsPageProps {
  store?: ThemeStore;
}

export function OptionsPage({ store }: OptionsPageProps) {
  const [themeStore] = useState<ThemeStore>(
    () => store ?? createThemeStore(createValidatedStorage(getChromeStorage())),
  );
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [pack, setPack] = useState<ThemePack>(DEFAULT_THEME_PACK);

  useEffect(() => {
    let active = true;
    const unsubscribe = themeStore.subscribe((preferences) => {
      if (!active) return;
      setMode(preferences.mode);
      setPack(preferences.pack);
    });
    void themeStore.read().then((preferences) => {
      if (!active) return;
      setMode(preferences.mode);
      setPack(preferences.pack);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [themeStore]);

  return (
    <section data-testid="standalone-page-options" aria-label="Options">
      <Typography.Title level={3}>General</Typography.Title>
      <Card>
        <AppearanceSection
          mode={mode}
          pack={pack}
          onModeChange={(next) => {
            setMode(next);
            void themeStore.writeMode(next);
          }}
          onPackChange={(next) => {
            setPack(next);
            void themeStore.writePack(next);
          }}
        />
      </Card>
    </section>
  );
}
```

- [ ] **Step 5: Run the tests and confirm they pass (GREEN)**

```bash
pnpm run test -- tests/components
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 6: Record evidence, update status, and commit**

```bash
git add src/components/options tests/components/optionsAppearance.test.tsx .planning
git commit -m "feat(phase-01): add options appearance controls"
```

**Constraints and non-goals:** only `General → Appearance → { Display mode, Theme pack }`; no Providers, Models, MCP, Memory, Diagnostics, Notes, Persona, Import/Export, Feature Flags, or Add-on sections; no provider dialog; no Chrome options page.
**Focused verification:** `pnpm run test -- tests/components/optionsAppearance.test.tsx`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** nested exactly General → Appearance; controls update only theme config and persistence; persistence goes to `chrome.storage.sync`.
**Code-quality and security checklist:** no other Options controls; accessible labels; no secrets.
**Evidence:** `verification.txt` and `review.md` Task 20 sections.
**Atomic commit:** `feat(phase-01): add options appearance controls`
**Completion criteria:** options test green; typecheck and lint pass.
**Stop conditions:** an extra Options section is required; the Options route must open a separate tab or browser page.

---

### Task 21 — Chat-Only Side Panel Shell and Its Two Actions

**Implementation tier:** balanced
**Depends on:** T10, T17
**Files created:** `src/components/sidepanel/SidePanelShell.tsx`, `tests/components/sidePanelShell.test.tsx`
**Files modified:** none
**Test files:** `tests/components/sidePanelShell.test.tsx`
**Interfaces produced:**
- `interface SidePanelShellProps { onNavigate(destination: StandaloneRouteId): void | Promise<void> }`
- `SidePanelShell`

- [ ] **Step 1: Write the failing test (RED)**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';

describe('SidePanelShell', () => {
  it('is Chat-only with a header, chat region, and deterministic empty state', () => {
    render(<SidePanelShell onNavigate={() => {}} />);
    expect(screen.getByRole('region', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByText('NowPilot')).toBeInTheDocument();
    expect(screen.queryByText('Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnostics')).not.toBeInTheDocument();
  });

  it('exposes only the Options and Switch to Full Chat actions', () => {
    const onNavigate = vi.fn();
    render(<SidePanelShell onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(onNavigate).toHaveBeenCalledWith('options');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Full Chat' }));
    expect(onNavigate).toHaveBeenCalledWith('chat');
  });

  it('contains no interactive chat controls in Phase 01', () => {
    render(<SidePanelShell onNavigate={() => {}} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /attach/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/components/sidePanelShell.test.tsx
```

Expected: FAIL with a module-resolution error for `@/components/sidepanel/SidePanelShell`.

- [ ] **Step 3: Implement `src/components/sidepanel/SidePanelShell.tsx`**

```tsx
import { Button, Empty, Layout, Space, Typography } from 'antd';
import { ExpandAltOutlined, SettingOutlined } from '@ant-design/icons';
import type { StandaloneRouteId } from '@/core/registry/standaloneRoutes';

export interface SidePanelShellProps {
  onNavigate(destination: StandaloneRouteId): void | Promise<void>;
}

export function SidePanelShell({ onNavigate }: SidePanelShellProps) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 12,
        }}
      >
        <Typography.Text strong>NowPilot</Typography.Text>
        <Space>
          <Button
            type="text"
            aria-label="Options"
            icon={<SettingOutlined />}
            onClick={() => void onNavigate('options')}
          />
          <Button
            type="text"
            aria-label="Switch to Full Chat"
            icon={<ExpandAltOutlined />}
            onClick={() => void onNavigate('chat')}
          />
        </Space>
      </Layout.Header>
      <Layout.Content>
        <section aria-label="Chat" role="region">
          <Empty description="Start a conversation from a later phase." />
        </section>
        <div aria-hidden="true" data-testid="composer-placeholder" />
      </Layout.Content>
    </Layout>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes (GREEN)**

```bash
pnpm run test -- tests/components/sidePanelShell.test.tsx
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add src/components/sidepanel tests/components/sidePanelShell.test.tsx .planning
git commit -m "feat(phase-01): add chat-only side panel shell and actions"
```

**Constraints and non-goals:** exactly two actions; no text input, send button, attachment button, model selector, provider control, keyboard submit, or speculative chat state; no Agent/Notes/Write/Tools/TeamGQM/provider/diagnostics screens; composer region is non-interactive and non-form.
**Focused verification:** `pnpm run test -- tests/components/sidePanelShell.test.tsx`
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** Side Panel is Chat-only; both actions use the canonical navigation destination type; no Standalone admin UI.
**Code-quality and security checklist:** icon-only controls have `aria-label`; no host-page access; no credentials.
**Evidence:** `verification.txt` and `review.md` Task 21 sections.
**Atomic commit:** `feat(phase-01): add chat-only side panel shell and actions`
**Completion criteria:** side-panel shell test green; typecheck and lint pass.
**Stop conditions:** a third action or any interactive chat control is required in Phase 01.

### Task 22 — WXT Entrypoints and Background Listener Wiring

> **Amendment (ADR-0001):** `Depends on` gains **T13C**. The background runtime
> registers an election listener synchronously at module evaluation with the
> Chrome signature `BackgroundElectionMessageListener = (message, sender,
> sendResponse) => boolean | void`. For a validated `workspace.election.request`
> it returns literal `true` synchronously, calls `arbiter.handle(request)`, and
> calls `sendResponse` exactly once with the schema-valid
> `workspace.election.response` envelope (`source: 'background'`, `target` =
> requesting surface only, `correlationId` = request envelope `id`) only after
> the queued operation completes. Persistence failure or an unexpected exception
> produces exactly one `accepted: false` response with the canonical failure
> code; an untrusted sender or schema-invalid envelope receives no response; no
> response is ever sent twice. Enforce the sender/target matrix. The arbiter
> reads/writes only the `np_workspace_election`/`np_workspace_handoff` session
> records and performs no ordinary workspace mutation, provider/MCP, or
> IndexedDB work. Also wire the UI-side `WorkspaceElection` request transport.
> Add `backgroundRuntime.test.ts` cases for: listener returns literal `true`;
> response sent only after the queued operation completes; exactly one response
> on accepted, rejected, persistence-failure, and unexpected-exception paths; no
> double response; untrusted sender / invalid envelope receives no response;
> `correlationId`/target correctness; and rejection of wildcard or
> background-originated requests and mis-targeted responses.

**Implementation tier:** advanced (context wiring and isolation)
**Depends on:** T11, T16, T17, T19, T20, T21
**Files created:** `src/entrypoints/sidepanel/index.html`, `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/sidepanel/App.tsx`, `src/entrypoints/standalone/index.html`, `src/entrypoints/standalone/main.tsx`, `src/entrypoints/standalone/App.tsx`, `tests/core/runtime/backgroundRuntime.test.ts`
**Files modified:** `src/entrypoints/background.ts`, `src/core/runtime/StandaloneNavigation.ts` (append `createBackgroundRuntime`)
**Test files:** `tests/core/runtime/backgroundRuntime.test.ts`
**Interfaces produced:**
- `interface BackgroundRuntimeDependencies` (including optional `onSingletonTabClosed`), `interface BackgroundRuntime`, `createBackgroundRuntime(deps)`
- Background close recovery: `tabs.onRemoved` + stored tab-ID validation + election validation clears a stale standalone writer so the Side Panel can reclaim (T16 subscription).

- [ ] **Step 1: Write the failing test (RED)**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createBackgroundRuntime } from '@/core/runtime/StandaloneNavigation';
import { createOperationId } from '@/core/runtime/OperationId';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
const SENDER = { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/sidepanel.html` };

function openMessage(destination = 'chat') {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'standalone.open',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: { destination },
  };
}

function setup() {
  const listeners: Array<(message: unknown, sender: unknown) => void> = [];
  const removed: Array<(tabId: number) => void> = [];
  const controller = {
    open: vi.fn(async () => ({ status: 'created' as const, tabId: 1 })),
    handleTabRemoved: vi.fn(async () => true),
    readRecord: vi.fn(async () => undefined),
  };
  const onSingletonTabClosed = vi.fn(async () => undefined);
  const runtime = createBackgroundRuntime({
    extensionId: EXTENSION_ID,
    controller,
    onMessage: (listener) => listeners.push(listener),
    removeMessageListener: (listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    onTabRemoved: (listener) => removed.push(listener),
    onSingletonTabClosed,
  });
  const stop = runtime.start();
  return { controller, listeners, removed, onSingletonTabClosed, stop };
}

describe('background runtime', () => {
  it('opens the requested standalone destination for a trusted open message', async () => {
    const { controller, listeners } = setup();
    await listeners[0](openMessage('options'), SENDER);
    expect(controller.open).toHaveBeenCalledWith('options');
  });

  it('ignores messages from an untrusted sender', async () => {
    const { controller, listeners } = setup();
    listeners[0](openMessage(), { id: 'someoneelse', url: 'https://example.com' });
    expect(controller.open).not.toHaveBeenCalled();
  });

  it('ignores malformed messages without throwing', () => {
    const { controller, listeners } = setup();
    expect(() => listeners[0]({ nope: true }, SENDER)).not.toThrow();
    expect(controller.open).not.toHaveBeenCalled();
  });

  it('routes tab removal to the singleton controller', async () => {
    const { controller, removed } = setup();
    removed[0](7);
    expect(controller.handleTabRemoved).toHaveBeenCalledWith(7);
  });

  it('runs close recovery when the singleton tab is removed', async () => {
    const { removed, onSingletonTabClosed } = setup();
    removed[0](7);
    await vi.waitFor(() => expect(onSingletonTabClosed).toHaveBeenCalledTimes(1));
  });

  it('does not run close recovery for an unrelated tab', async () => {
    const { controller, removed, onSingletonTabClosed } = setup();
    controller.handleTabRemoved.mockResolvedValueOnce(false);
    removed[0](99);
    await vi.waitFor(() => expect(controller.handleTabRemoved).toHaveBeenCalledWith(99));
    expect(onSingletonTabClosed).not.toHaveBeenCalled();
  });

  it('removes the message listener on stop', () => {
    const { controller, listeners, removed, stop } = setup();
    stop();
    expect(listeners).toHaveLength(0);
    expect(removed).toHaveLength(1);
    expect(controller.open).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/core/runtime/backgroundRuntime.test.ts
```

Expected: FAIL because `createBackgroundRuntime` is not exported.

- [ ] **Step 3: Append `createBackgroundRuntime` to `src/core/runtime/StandaloneNavigation.ts`**

Add to the top import block:

```ts
import {
  validateInboundEnvelope,
  type SenderIdentity,
} from './RuntimeEnvelope';
```

Append:

```ts
export interface BackgroundRuntimeDependencies {
  extensionId: string;
  controller: StandaloneTabController;
  onMessage(listener: (message: unknown, sender: unknown) => void): void;
  removeMessageListener(listener: (message: unknown, sender: unknown) => void): void;
  onTabRemoved(listener: (tabId: number) => void): void;
  onSingletonTabClosed?(): Promise<void>;
}

export interface BackgroundRuntime {
  start(): () => void;
}

export function createBackgroundRuntime(
  deps: BackgroundRuntimeDependencies,
): BackgroundRuntime {
  const handleMessage = (message: unknown, sender: unknown): void => {
    const validated = validateInboundEnvelope(message, sender as SenderIdentity, deps.extensionId);
    if (!validated.ok) return;
    if (validated.envelope.type === 'standalone.closed') return;
    const request = readStandaloneNavigationRequest(validated.envelope);
    if (request) void deps.controller.open(request.destination);
  };

  const handleTabRemoved = (tabId: number): void => {
    void (async () => {
      const wasSingleton = await deps.controller.handleTabRemoved(tabId);
      if (wasSingleton && deps.onSingletonTabClosed) {
        await deps.onSingletonTabClosed();
      }
    })();
  };

  return {
    start() {
      deps.onMessage(handleMessage);
      deps.onTabRemoved(handleTabRemoved);
      return () => {
        deps.removeMessageListener(handleMessage);
      };
    },
  };
}
```

- [ ] **Step 4: Create the Side Panel entrypoint**

`src/entrypoints/sidepanel/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NowPilot</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/entrypoints/sidepanel/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Side Panel root container is missing');
createRoot(container).render(<App />);
```

`src/entrypoints/sidepanel/App.tsx`:

```tsx
import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
import { createBroadcastBus } from '@/core/runtime/BroadcastBus';
import { openStandalone } from '@/core/runtime/StandaloneNavigation';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createThemeStore } from '@/core/theme/ThemeStore';
import { useTheme } from '@/core/theme/useTheme';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { createWorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceCoordinator } from '@/core/workspace/WorkspaceSync';
import { createInstanceId } from '@/core/workspace/workspaceTypes';

const storage = createValidatedStorage();
const instanceId = createInstanceId();
const store = createWorkspaceStore(storage);
const election = createWorkspaceElection({
  storage,
  store,
  writerType: 'sidepanel',
  instanceId,
  now: () => Date.now(),
});
const handoff = createWorkspaceHandoff({
  storage,
  writerType: 'sidepanel',
  instanceId,
  now: () => Date.now(),
});
const bus = createBroadcastBus({
  extensionId: chrome.runtime.id,
  sendMessage: (envelope) => chrome.runtime.sendMessage(envelope) as Promise<unknown>,
  addMessageListener: (listener) =>
    chrome.runtime.onMessage.addListener(
      listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
    ),
  removeMessageListener: (listener) =>
    chrome.runtime.onMessage.removeListener(
      listener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0],
    ),
});
const coordinator = createWorkspaceCoordinator({
  bus,
  surface: 'sidepanel',
  instanceId,
  storage,
  election,
  handoff,
  store,
});
const themeStore = createThemeStore(storage);

export default function App() {
  const { config } = useTheme(themeStore, { compact: true });

  useEffect(() => {
    void election.claim();
    return coordinator.start();
  }, []);

  return (
    <ConfigProvider theme={config}>
      <SidePanelShell
        onNavigate={(destination) => openStandalone(destination, 'sidepanel', bus)}
      />
    </ConfigProvider>
  );
}
```

- [ ] **Step 5: Create the Standalone entrypoint**

`src/entrypoints/standalone/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NowPilot Standalone</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/entrypoints/standalone/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Standalone root container is missing');
createRoot(container).render(<App />);
```

`src/entrypoints/standalone/App.tsx`:

```tsx
import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
import { CORE_PAGE_REGISTRY } from '@/core/registry/registerCorePages';
import { createBroadcastBus } from '@/core/runtime/BroadcastBus';
import { readStandaloneNavigationRequest } from '@/core/runtime/StandaloneNavigation';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createThemeStore } from '@/core/theme/ThemeStore';
import { useTheme } from '@/core/theme/useTheme';
import { createDiagnosticRecord, debugLog } from '@/core/error/debugLog';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { createWorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceCoordinator } from '@/core/workspace/WorkspaceSync';
import { createInstanceId } from '@/core/workspace/workspaceTypes';
import type { StandaloneRouteId } from '@/core/registry/standaloneRoutes';

const storage = createValidatedStorage();
const instanceId = createInstanceId();
const store = createWorkspaceStore(storage);
const election = createWorkspaceElection({
  storage,
  store,
  writerType: 'standalone',
  instanceId,
  now: () => Date.now(),
});
const handoff = createWorkspaceHandoff({
  storage,
  writerType: 'standalone',
  instanceId,
  now: () => Date.now(),
});
const bus = createBroadcastBus({
  extensionId: chrome.runtime.id,
  sendMessage: (envelope) => chrome.runtime.sendMessage(envelope) as Promise<unknown>,
  addMessageListener: (listener) =>
    chrome.runtime.onMessage.addListener(
      listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
    ),
  removeMessageListener: (listener) =>
    chrome.runtime.onMessage.removeListener(
      listener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0],
    ),
});
const coordinator = createWorkspaceCoordinator({
  bus,
  surface: 'standalone',
  instanceId,
  storage,
  election,
  handoff,
  store,
});
const themeStore = createThemeStore(storage);

const focusSubscription = (listener: (destination: StandaloneRouteId) => void) =>
  bus.on('standalone.focus', (envelope) => {
    const request = readStandaloneNavigationRequest(envelope);
    if (request) listener(request.destination);
  });

export default function App() {
  const { config } = useTheme(themeStore, { compact: false });

  useEffect(() => {
    void election.claim();
    void coordinator.announce();
    return coordinator.start();
  }, []);

  return (
    <ConfigProvider theme={config}>
      <StandaloneShell
        registry={CORE_PAGE_REGISTRY}
        focusSubscription={focusSubscription}
        onRouteFallback={(rawHash) =>
          debugLog(createDiagnosticRecord('STANDALONE_ROUTE_FALLBACK', { rawHash }))
        }
      />
    </ConfigProvider>
  );
}
```

`StandaloneRouteId` is imported from the route registry, not from `workspaceTypes`; keep the two import lines above exactly as written.

- [ ] **Step 6: Replace `src/entrypoints/background.ts`**

```ts
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import {
  createBackgroundRuntime,
  createStandaloneTabController,
} from '@/core/runtime/StandaloneNavigation';
import { ElectionRecordSchema } from '@/core/workspace/workspaceTypes';

export default defineBackground(() => {
  const storage = createValidatedStorage();

  const controller = createStandaloneTabController({
    tabs: {
      get: (tabId) => chrome.tabs.get(tabId).then((tab) => ({ id: tab.id })),
      create: (url) => chrome.tabs.create({ url }),
      update: (tabId, props) => chrome.tabs.update(tabId, props),
      focusWindow: async (tabId) => {
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId !== undefined) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      },
    },
    storage,
    buildStandaloneUrl: (destination) => chrome.runtime.getURL(`standalone.html#/${destination}`),
    sendFocus: async (envelope) => {
      await chrome.runtime.sendMessage(envelope);
    },
    now: () => Date.now(),
  });

  createBackgroundRuntime({
    extensionId: chrome.runtime.id,
    controller,
    onMessage: (listener) => chrome.runtime.onMessage.addListener(listener),
    removeMessageListener: (listener) => chrome.runtime.onMessage.removeListener(listener),
    onTabRemoved: (listener) => chrome.tabs.onRemoved.addListener(listener),
    onSingletonTabClosed: async () => {
      const record = await storage.read('np_workspace_election', ElectionRecordSchema);
      if (record.status === 'valid' && record.value.writerType === 'standalone') {
        await storage.remove('np_workspace_election');
        await storage.remove('np_workspace_handoff');
      }
    },
  }).start();

  chrome.runtime.onInstalled.addListener(() => {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });
});
```

Do **not** import React, Ant Design, IndexedDB, or any provider module in `background.ts`.

- [ ] **Step 7: Run the focused verification**

```bash
pnpm run test -- tests/core/runtime/backgroundRuntime.test.ts
pnpm run typecheck
pnpm run lint
pnpm run build
test -f .output/chrome-mv3/sidepanel.html
test -f .output/chrome-mv3/standalone.html
```

Expected: all pass; the build emits both HTML pages.

- [ ] **Step 8: Record evidence, update status, and commit**

```bash
git add src/entrypoints src/components/sidepanel src/core/runtime/StandaloneNavigation.ts tests/core/runtime/backgroundRuntime.test.ts .planning
git commit -m "feat(phase-01): wire WXT entrypoints and background listeners"
```

**Constraints and non-goals:** background registers listeners synchronously inside `defineBackground`; background never imports UI, IndexedDB, or providers; background is the only `chrome.tabs` caller; background's only storage writes are the session coordination keys during close recovery (`np_workspace_election`, `np_workspace_handoff`), never workspace metadata; Side Panel and Standalone both run the refresh/claim coordinator; Side Panel is the only surface that reclaims ownership when the election disappears; no content script; no `tabs` permission.
**Focused verification:** Step 7 block.
**Phase 01 verification applicable now:** `pnpm run typecheck && pnpm run lint && pnpm run test`.
**Specification-compliance checklist:** `sidepanel` and `standalone` entrypoints exist; manifest gains `side_panel` and `standalone.html`; background uses canonical navigation and boundary validation; theme provider per surface with correct compact flags.
**Code-quality and security checklist:** background bundle contains no React/antd/IndexedDB/provider; tab API usage is bounded to stored IDs; no URL/title reads; no secrets.
**Evidence:** `verification.txt` and `review.md` Task 22 sections.
**Atomic commit:** `feat(phase-01): wire WXT entrypoints and background listeners`
**Completion criteria:** background runtime test green; typecheck, lint, and build pass; both HTML pages exist.
**Stop conditions:** serving the Side Panel requires a `tabs`/`activeTab`/host permission; background must import UI; the build fails on entrypoint discovery.

---

### Task 23 — Generated-Manifest Inspection

**Implementation tier:** balanced
**Depends on:** T22
**Files created:** `tests/build/manifestChecks.ts`, `tests/build/manifest.test.ts`, `tests/build/manifestAssertions.test.ts`
**Files modified:** none
**Test files:** `tests/build/manifest.test.ts` (runs in the `manifest` project), `tests/build/manifestAssertions.test.ts` (runs in the `unit` project)
**Interfaces produced:**
- `interface GeneratedManifest`
- `interface ManifestCheckResult { ok; failures }`
- `checkGeneratedManifest(manifest, options): ManifestCheckResult`

- [ ] **Step 1: Write the failing unit test for the checker (RED)**

Create `tests/build/manifestAssertions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkGeneratedManifest, type GeneratedManifest } from './manifestChecks';

const VALID: GeneratedManifest = {
  manifest_version: 3,
  permissions: ['storage', 'sidePanel'],
  side_panel: { default_path: 'sidepanel.html' },
  action: { default_title: 'NowPilot' },
  icons: { '16': 'icon/16.png', '32': 'icon/32.png', '48': 'icon/48.png', '128': 'icon/128.png' },
};

describe('checkGeneratedManifest', () => {
  it('passes a manifest matching the Phase 01 contract', () => {
    expect(checkGeneratedManifest(VALID, { standaloneHtmlExists: true })).toEqual({
      ok: true,
      failures: [],
    });
  });

  it('fails when a forbidden permission is present', () => {
    const result = checkGeneratedManifest(
      { ...VALID, permissions: ['storage', 'sidePanel', 'tabs'] },
      { standaloneHtmlExists: true },
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('tabs');
  });

  it('fails when side_panel default path is wrong', () => {
    const result = checkGeneratedManifest(
      { ...VALID, side_panel: { default_path: 'other.html' } },
      { standaloneHtmlExists: true },
    );
    expect(result.ok).toBe(false);
  });

  it('fails when content_scripts are declared', () => {
    const result = checkGeneratedManifest(
      { ...VALID, content_scripts: [{ matches: ['<all_urls>'] }] },
      { standaloneHtmlExists: true },
    );
    expect(result.ok).toBe(false);
  });

  it('fails when host permissions are declared', () => {
    expect(
      checkGeneratedManifest({ ...VALID, host_permissions: ['https://example.com/*'] }, { standaloneHtmlExists: true }).ok,
    ).toBe(false);
  });

  it('fails when standalone.html is missing', () => {
    expect(checkGeneratedManifest(VALID, { standaloneHtmlExists: false }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/build/manifestAssertions.test.ts
```

Expected: FAIL with a module-resolution error for `./manifestChecks`.

- [ ] **Step 3: Implement `tests/build/manifestChecks.ts`**

```ts
export interface GeneratedManifest {
  manifest_version?: number;
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: unknown[];
  side_panel?: { default_path?: string };
  action?: unknown;
  icons?: Record<string, string>;
  [key: string]: unknown;
}

export interface ManifestCheckResult {
  ok: boolean;
  failures: string[];
}

const FORBIDDEN_PERMISSIONS = ['tabs', 'activeTab', 'scripting', 'alarms', 'unlimitedStorage'];
const REQUIRED_PERMISSIONS = ['sidePanel', 'storage'];
const REQUIRED_ICON_SIZES = ['16', '32', '48', '128'];

export function checkGeneratedManifest(
  manifest: GeneratedManifest,
  options: { standaloneHtmlExists: boolean },
): ManifestCheckResult {
  const failures: string[] = [];

  if (manifest.manifest_version !== 3) failures.push('manifest_version must be 3');

  const permissions = [...(manifest.permissions ?? [])].sort();
  if (JSON.stringify(permissions) !== JSON.stringify([...REQUIRED_PERMISSIONS].sort())) {
    failures.push(`permissions must be exactly sidePanel and storage; found ${permissions.join(',')}`);
  }
  for (const forbidden of FORBIDDEN_PERMISSIONS) {
    if ((manifest.permissions ?? []).includes(forbidden)) {
      failures.push(`forbidden permission present: ${forbidden}`);
    }
  }
  if ((manifest.host_permissions ?? []).length > 0) {
    failures.push('host_permissions must be absent or empty');
  }
  if (manifest.content_scripts !== undefined) {
    failures.push('content_scripts must be absent');
  }
  if (manifest.side_panel?.default_path !== 'sidepanel.html') {
    failures.push(`side_panel.default_path must be sidepanel.html; found ${manifest.side_panel?.default_path}`);
  }
  if (!manifest.action) failures.push('action must be present');
  for (const size of REQUIRED_ICON_SIZES) {
    if (!manifest.icons?.[size]) failures.push(`icons.${size} must be present`);
  }
  if (!options.standaloneHtmlExists) failures.push('standalone.html must exist in the build output');

  return { ok: failures.length === 0, failures };
}
```

- [ ] **Step 4: Create the real-manifest test**

Create `tests/build/manifest.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkGeneratedManifest, type GeneratedManifest } from './manifestChecks';

const outputDir = resolve(process.cwd(), '.output/chrome-mv3');
const manifestPath = resolve(outputDir, 'manifest.json');

describe('generated Chrome MV3 manifest', () => {
  it('matches the Phase 01 permission and entrypoint contract', () => {
    expect(existsSync(manifestPath), `missing ${manifestPath}; run pnpm run build first`).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as GeneratedManifest;
    const result = checkGeneratedManifest(manifest, {
      standaloneHtmlExists: existsSync(resolve(outputDir, 'standalone.html')),
    });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 5: Run the manifest project and confirm it passes**

```bash
pnpm run build
pnpm run test:manifest
```

Expected: PASS against the real generated manifest.

- [ ] **Step 6: Record evidence, update status, and commit**

```bash
git add tests/build/manifestChecks.ts tests/build/manifest.test.ts tests/build/manifestAssertions.test.ts .planning
git commit -m "test(phase-01): inspect generated manifest"
```

**Constraints and non-goals:** config unit tests are not accepted as proof; the real test parses the generated file; no source-scan substitute.
**Approved Interpretation 4:** this inspection runs in the dedicated `manifest` Vitest project, after `pnpm run build`, and parses `.output/chrome-mv3/manifest.json` from actual build output. The `manifestAssertions.test.ts` fixture test runs in the `unit` project and proves the checker logic only.
**Focused verification:** `pnpm run test -- tests/build/manifestAssertions.test.ts` and `pnpm run test:manifest`.
**Phase 01 verification applicable now:** full `pnpm run verify:phase-1` from this task onward.
**Specification-compliance checklist:** presence of `sidePanel`/`storage`; absence of `tabs`, `activeTab`, `scripting`, `alarms`, `unlimitedStorage`, host permissions, content scripts; `side_panel` and `standalone.html` present.
**Code-quality and security checklist:** manifest assertion fails closed with explicit messages; no permission broadening.
**Evidence:** `verification.txt` (include the parsed manifest permission list and failures) and `review.md` Task 23 section.
**Atomic commit:** `test(phase-01): inspect generated manifest`
**Completion criteria:** both manifest tests pass against the real build.
**Stop conditions:** the generated manifest contains an unapproved permission or a content script.

---

### Task 24 — Post-Build Bundle-Isolation Inspection

> **Amendment (ADR-0001):** the background bundle now imports the election
> arbiter. Re-run isolation and confirm the background forbidden-marker set is
> unchanged and still passes: the arbiter imports no React/Ant Design, provider
> SDK, MCP SDK, or IndexedDB. No marker change is expected.

**Implementation tier:** balanced
**Depends on:** T22, T23
**Files created:** `tests/build/isolationChecks.ts`, `tests/build/isolation.test.ts`, `tests/build/isolationAssertions.test.ts`
**Files modified:** none
**Test files:** `tests/build/isolation.test.ts` (runs in the `isolation` project), `tests/build/isolationAssertions.test.ts` (runs in the `unit` project)
**Interfaces produced:**
- `collectModuleGraph(entryFile, outDir): Map<string, string>`
- `scanForbiddenMarkers(graph, markers): string[]`
- `checkBundleIsolation(outDir): IsolationCheckResult`

- [ ] **Step 1: Write the failing unit test (RED)**

Create `tests/build/isolationAssertions.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBundleIsolation, collectModuleGraph, scanForbiddenMarkers } from './isolationChecks';

const tempDirs: string[] = [];

function makeOutDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'np-isolation-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, contents);
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('collectModuleGraph', () => {
  it('follows static relative chunk imports', () => {
    const dir = makeOutDir({
      'background.js': 'import "./chunk-a.js";',
      'chunk-a.js': 'import "./chunk-b.js"; console.log("a");',
      'chunk-b.js': 'console.log("b");',
    });
    const graph = collectModuleGraph(join(dir, 'background.js'), dir);
    expect([...graph.keys()].sort()).toEqual(['background.js', 'chunk-a.js', 'chunk-b.js']);
  });
});

describe('scanForbiddenMarkers', () => {
  it('reports markers found in the graph', () => {
    const graph = new Map([['background.js', 'const x = "indexedDB";']]);
    expect(scanForbiddenMarkers(graph, ['indexedDB', 'ant-'])).toEqual(['indexedDB']);
  });
});

describe('checkBundleIsolation', () => {
  it('passes a clean build output', () => {
    const dir = makeOutDir({
      'background.js': 'console.log("background");',
      'sidepanel.js': 'console.log("sidepanel");',
      'standalone.js': 'const id = "standalone-page-chat";',
    });
    expect(checkBundleIsolation(dir).ok).toBe(true);
  });

  it('fails when the background graph imports React', () => {
    const dir = makeOutDir({
      'background.js': 'import "./chunk-react.js";',
      'chunk-react.js': 'var e = Symbol.for("react.element");',
      'sidepanel.js': 'console.log("sidepanel");',
      'standalone.js': 'const id = "standalone-page-chat";',
    });
    const result = checkBundleIsolation(dir);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('background');
  });

  it('fails when the side panel graph contains standalone page markers', () => {
    const dir = makeOutDir({
      'background.js': 'console.log("background");',
      'sidepanel.js': 'import "./chunk-standalone.js";',
      'chunk-standalone.js': 'const id = "standalone-page-agent";',
      'standalone.js': 'const id = "standalone-page-chat";',
    });
    const result = checkBundleIsolation(dir);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('sidepanel');
  });

  it('fails when a content-script bundle exists', () => {
    const dir = makeOutDir({
      'background.js': 'console.log("background");',
      'sidepanel.js': 'console.log("sidepanel");',
      'standalone.js': 'const id = "standalone-page-chat";',
      'content-scripts/content.js': 'console.log("content");',
    });
    const result = checkBundleIsolation(dir);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('content');
  });
});
```

- [ ] **Step 2: Run the test and confirm the intended failure**

```bash
pnpm run test -- tests/build/isolationAssertions.test.ts
```

Expected: FAIL with a module-resolution error for `./isolationChecks`.

- [ ] **Step 3: Implement `tests/build/isolationChecks.ts`**

```ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const STATIC_IMPORT_PATTERN = /(?:from\s*|import\s*\(?\s*)["']\.\/([^"']+\.js)["']/g;

export function collectModuleGraph(entryFile: string, outDir: string): Map<string, string> {
  const graph = new Map<string, string>();
  const queue = [resolve(entryFile)];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    const name = basename(file);
    if (graph.has(name) || !existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    graph.set(name, source);
    for (const match of source.matchAll(STATIC_IMPORT_PATTERN)) {
      queue.push(join(outDir, match[1]));
    }
  }
  return graph;
}

export function scanForbiddenMarkers(graph: Map<string, string>, markers: string[]): string[] {
  const found: string[] = [];
  for (const [file, source] of graph) {
    for (const marker of markers) {
      if (source.includes(marker)) found.push(`${file}:${marker}`);
    }
  }
  return found;
}

export interface IsolationCheckResult {
  ok: boolean;
  failures: string[];
}

const BACKGROUND_FORBIDDEN_MARKERS = [
  'react.element',
  'ant-',
  'indexedDB',
  'IDBDatabase',
  'IDBKeyRange',
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  '@ai-sdk',
  'modelcontextprotocol',
];

const SIDEPANEL_FORBIDDEN_MARKERS = ['standalone-page-'];

function listJsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJsFiles(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function entryFileNamed(dir: string, stem: string): string | undefined {
  const candidates = listJsFiles(dir).filter((file) => basename(file).startsWith(stem));
  return candidates[0];
}

export function checkBundleIsolation(outDir: string): IsolationCheckResult {
  const failures: string[] = [];

  const background = entryFileNamed(outDir, 'background');
  if (background) {
    const graph = collectModuleGraph(background, outDir);
    for (const hit of scanForbiddenMarkers(graph, BACKGROUND_FORBIDDEN_MARKERS)) {
      failures.push(`background bundle contains forbidden marker ${hit}`);
    }
  } else {
    failures.push('background bundle was not found in the build output');
  }

  const sidepanel = entryFileNamed(outDir, 'sidepanel');
  if (sidepanel) {
    const graph = collectModuleGraph(sidepanel, outDir);
    for (const hit of scanForbiddenMarkers(graph, SIDEPANEL_FORBIDDEN_MARKERS)) {
      failures.push(`sidepanel bundle contains standalone marker ${hit}`);
    }
  } else {
    failures.push('sidepanel bundle was not found in the build output');
  }

  const contentScripts = listJsFiles(outDir).filter((file) => basename(file).startsWith('content'));
  if (contentScripts.length > 0) {
    failures.push(`content-script bundle must not exist: ${contentScripts.join(',')}`);
  }

  return { ok: failures.length === 0, failures };
}
```

- [ ] **Step 4: Create the real-isolation test**

Create `tests/build/isolation.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkBundleIsolation } from './isolationChecks';

const outputDir = resolve(process.cwd(), '.output/chrome-mv3');

describe('built bundle isolation', () => {
  it('keeps the background lean, the side panel free of standalone pages, and ships no content script', () => {
    expect(existsSync(outputDir), `missing ${outputDir}; run pnpm run build first`).toBe(true);
    const result = checkBundleIsolation(outputDir);
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 5: Run the isolation project and confirm it passes**

```bash
pnpm run build
pnpm run test:isolation
```

Expected: PASS. If the background graph marker scan reports a false positive, stop and record the exact marker, file, and source excerpt before changing markers; do not weaken the check silently.

- [ ] **Step 6: Record evidence, update status, and commit**

```bash
git add tests/build/isolationChecks.ts tests/build/isolation.test.ts tests/build/isolationAssertions.test.ts .planning
git commit -m "test(phase-01): inspect built bundle isolation"
```

**Constraints and non-goals:** a source-scan test is not accepted as proof; the real test scans built artifacts; no content-script bundle; no marker weakening without recorded justification.
**Approved Interpretation 4:** this inspection runs in the dedicated `isolation` Vitest project, after `pnpm run build`, and scans actual built bundles under `.output/chrome-mv3/`. The `isolationAssertions.test.ts` fixture test runs in the `unit` project and proves the checker logic only.
**Focused verification:** `pnpm run test -- tests/build/isolationAssertions.test.ts` and `pnpm run test:isolation`.
**Phase 01 verification applicable now:** full `pnpm run verify:phase-1`.
**Specification-compliance checklist:** background bundle imports no React/antd/IndexedDB/provider; Side Panel bundle imports no Standalone pages/registry/admin; no content-script bundle.
**Code-quality and security checklist:** graph traversal is bounded and cycle-safe; failures name the file and marker.
**Evidence:** `verification.txt` with the isolation result and any marker investigation; `review.md` Task 24 section.
**Atomic commit:** `test(phase-01): inspect built bundle isolation`
**Completion criteria:** both isolation tests pass against the real build.
**Stop conditions:** a real isolation violation exists; the check cannot be implemented without a new dependency.

### Task 25 — Cross-Module Integration Tests

> **Amendment (ADR-0001):** add cross-module integration tests for
> background-serialised election — concurrent initial claims, epoch monotonicity
> across claim/handoff/recovery, handoff-commit versus fallback-claim exclusion,
> service-worker restart reconstruction from session storage, and an
> end-to-end assertion that ordinary `workspace.mutation` never changes the
> election record/epoch and never routes through the background election
> arbiter.

**Implementation tier:** balanced
**Depends on:** T22, T23, T24
**Files created:** `tests/integration/workspaceIntegration.test.ts`
**Files modified:** none
**Test files:** `tests/integration/workspaceIntegration.test.ts`
**Interfaces produced:** none (tests only)

- [ ] **Step 1: Write the failing integration tests (RED)**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createChromeStorageMock } from '../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { createThemeStore } from '@/core/theme/ThemeStore';
import { applyMirrorEnvelope, classifyMirrorEnvelope } from '@/core/workspace/WorkspaceSync';
import { createOperationId } from '@/core/runtime/OperationId';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

function mutationEnvelope(version: number, epoch = 0): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.mutation',
    source: 'standalone',
    target: 'sidepanel',
    timestamp: version,
    electionEpoch: epoch,
    workspaceVersion: version,
    payload: {
      mutationId: createOperationId(),
      writerInstanceId: 'writer',
      epoch,
      baseVersion: version - 1,
      resultingVersion: version,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: version, updatedAt: version },
    },
  } as RuntimeEnvelope;
}

describe('workspace integration', () => {
  it('converges on exactly one writer across two surfaces', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    const store = createWorkspaceStore(storage);
    const sidepanel = createWorkspaceElection({
      storage,
      store,
      writerType: 'sidepanel',
      instanceId: 'sp',
      now: () => 1,
    });
    const standalone = createWorkspaceElection({
      storage,
      store,
      writerType: 'standalone',
      instanceId: 'st',
      now: () => 2,
    });
    const first = await sidepanel.claim();
    const second = await standalone.claim();
    expect(first.status).toBe('acquired');
    expect(second.status).toBe('held');
    if (second.status === 'held') expect(second.record.writerInstanceId).toBe('sp');
  });

  it('applies ordered mirror versions, ignores duplicates, and rehydrates a gap', () => {
    let state = { epoch: 0, committedVersion: 0 };
    state = applyMirrorEnvelope(state, mutationEnvelope(1)).state;
    state = applyMirrorEnvelope(state, mutationEnvelope(2)).state;
    expect(state.committedVersion).toBe(2);
    expect(applyMirrorEnvelope(state, mutationEnvelope(2)).decision).toEqual({
      action: 'ignore',
      reason: 'duplicate',
    });
    expect(classifyMirrorEnvelope(state, mutationEnvelope(5))).toEqual({
      action: 'rehydrate',
      reason: 'gap',
    });
  });

  it('survives a service-worker-style restart without losing workspace state', async () => {
    const chromeStorage = createChromeStorageMock();
    const first = createWorkspaceStore(createValidatedStorage(chromeStorage));
    await first.writeMetadata({ schemaVersion: 1, committedVersion: 6, updatedAt: 10 });
    const afterRestart = createWorkspaceStore(createValidatedStorage(chromeStorage));
    await expect(afterRestart.readMetadata()).resolves.toEqual({
      status: 'valid',
      metadata: { schemaVersion: 1, committedVersion: 6, updatedAt: 10 },
    });
    await expect(afterRestart.readVersion()).resolves.toBe(6);
  });

  it('propagates theme changes to a second surface independently of election', async () => {
    const chromeStorage = createChromeStorageMock();
    const surfaceA = createThemeStore(createValidatedStorage(chromeStorage));
    const surfaceB = createThemeStore(createValidatedStorage(chromeStorage));
    const listener = vi.fn();
    const unsubscribe = surfaceB.subscribe(listener);
    await surfaceA.writePack('claude-warm');
    chromeStorage.emitStorageChange({ np_theme_pack: { newValue: 'claude-warm' } }, 'sync');
    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith({ mode: 'auto', pack: 'claude-warm' }),
    );
    unsubscribe();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail for the right reason**

```bash
pnpm run test -- tests/integration
```

Expected: the first run fails only if a real integration defect exists. If all four tests pass immediately, record that they were written against already-implemented behaviour and treat this task as a verification task (no production change); do not delete the tests.

- [ ] **Step 3: Fix any genuine integration defect**

If a test reveals a defect, apply the minimal correction in the owning module and re-run the owning task's focused test as well as this integration file. Do not weaken an assertion to pass.

- [ ] **Step 4: Run the focused verification**

```bash
pnpm run test -- tests/integration
pnpm run typecheck
pnpm run lint
```

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add tests/integration .planning
git commit -m "test(phase-01): add cross-module integration tests"
```

**Constraints and non-goals:** mocked Chrome APIs only; no real network; no provider calls; no IndexedDB.
**Focused verification:** `pnpm run test -- tests/integration`.
**Phase 01 verification applicable now:** full `pnpm run verify:phase-1`.
**Specification-compliance checklist:** single-writer convergence; mirror ordering; gap rehydration; restart durability; theme propagation independent of election.
**Code-quality and security checklist:** no flaky timing beyond `vi.waitFor`; no hidden external dependency.
**Evidence:** `verification.txt` (test names and results) and `review.md` Task 25 section.
**Atomic commit:** `test(phase-01): add cross-module integration tests`
**Completion criteria:** integration tests green; typecheck and lint pass.
**Stop conditions:** a genuine convergence or ownership defect is found and cannot be fixed within Phase 01 scope.

---

### Task 26 — Complete Build and Isolation Gate

> **Amendment (ADR-0001):** the complete build/isolation gate runs after T13C and
> includes the background-serialised election tests and the 13-type / 15-code
> registry completeness tests.

**Implementation tier:** balanced
**Depends on:** T23, T24, T25
**Files created:** none
**Files modified:** none (evidence only)
**Test files:** none (runs existing suites)
**Interfaces produced:** none
**RED/GREEN:** not applicable — approved non-code gate task (`AGENTS.md` Section 11). The observable failure condition is any gate in Step 1 failing, and the expected pass is the full chain succeeding from a clean `.output`.

- [ ] **Step 1: Run the full Phase 01 chain from a clean build**

```bash
rm -rf .output
pnpm run verify:phase-1
```

Expected: `typecheck`, `lint`, `test`, `build`, `test:manifest`, and `test:isolation` all pass in that order.

- [ ] **Step 2: Confirm `verify:all` is identical and not weaker**

```bash
node -e "const s=require('./package.json').scripts; if(s['verify:phase-1']!==s['verify:all']){throw new Error('verify scripts differ')}"
```

Expected: exit 0.

- [ ] **Step 3: Confirm no test was skipped**

```bash
pnpm run test -- --reporter=verbose
pnpm run test:manifest -- --reporter=verbose
pnpm run test:isolation -- --reporter=verbose
```

Expected: no `skipped` entries. If any test is skipped, stop and record why.

- [ ] **Step 4: Capture artifact evidence**

```bash
node -e "const m=require('./.output/chrome-mv3/manifest.json'); console.log(JSON.stringify({permissions:m.permissions,side_panel:m.side_panel,content_scripts:m.content_scripts,host_permissions:m.host_permissions}))"
shasum -a 256 .output/chrome-mv3/background.js .output/chrome-mv3/sidepanel.html .output/chrome-mv3/standalone.html
```

Record the output in `verification.txt`.

- [ ] **Step 5: Record evidence, update status, and commit**

```bash
git add .planning
git commit -m "test(phase-01): complete build and isolation gate"
```

**Constraints and non-goals:** no production changes in this task; if a gate fails, return to the owning task instead of weakening the gate.
**Focused verification:** Step 1 chain.
**Phase 01 verification applicable now:** full `pnpm run verify:phase-1`.
**Specification-compliance checklist:** aggregate order exactly `typecheck → lint → test → build → test:manifest → test:isolation`; manifest and isolation inspected against real artifacts.
**Code-quality and security checklist:** no skipped tests; no unapproved permission; no content script.
**Evidence:** `verification.txt` Task 26 section with full command output summary, manifest summary, and checksums.
**Atomic commit:** `test(phase-01): complete build and isolation gate`
**Completion criteria:** Step 1 passes from a clean `.output`; Step 2 and Step 3 pass.
**Stop conditions:** any aggregate command fails; a test is skipped; the manifest or isolation gate fails.

---

### Task 27 — Manual Unpacked-Extension Acceptance and Evidence

**Implementation tier:** balanced
**Depends on:** T26
**Files created:** `.planning/evidence/phase-01/manual-checks.md`, `.planning/evidence/phase-01/screenshots/` (with real screenshots)
**Files modified:** `.planning/evidence/phase-01/verification.txt` (append)
**Test files:** none (manual)
**Interfaces produced:** none
**RED/GREEN:** not applicable — approved manual-evidence task (`AGENTS.md` Section 11). The observable failure condition is any manual check failing in Step 2; the expected pass is every checklist row recorded with a screenshot.

- [ ] **Step 1: Build and load the unpacked extension**

```bash
pnpm run build
```

In Chrome: open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `.output/chrome-mv3`. Pin NowPilot to the toolbar.

- [ ] **Step 2: Perform each manual check and capture a screenshot**

Record each check in `manual-checks.md` with result, date, Chrome version, and screenshot filename. Required checks and exact screenshot names:

| Check | Steps | Screenshot |
|---|---|---|
| Side Panel opens from the action button | Click the toolbar action; the Side Panel opens | `sidepanel-open.png` |
| Side Panel is Chat-only | Confirm only header, Chat region, empty state; no text input, send, attach, model selector, or admin pages | `sidepanel-chat-only.png` |
| Switch to Full Chat opens one tab | Click **Switch to Full Chat**; a Standalone tab opens at `#/chat` | `standalone-chat.png` |
| Singleton reuse | Close the Side Panel, reopen it, click **Switch to Full Chat** again; the same tab is focused, not duplicated | `standalone-singleton.png` |
| Options uses the same tab | Click **Options**; the same Standalone tab navigates to `#/options`; no second tab and no browser options page | `standalone-options.png` |
| Standalone Sider registry | Confirm Chat, Agent, Notes, Write, Tools in primary and Options, Diagnostics in footer; TeamGQM and ServiceNow absent | `standalone-sider.png` |
| Appearance propagation | Change Display mode to Dark and Theme pack to Claude Warm; both Side Panel and Standalone update live without reload | `theme-dark-warm.png` |
| Unknown route fallback | Navigate the Standalone tab to `standalone.html#/unknown`; it shows Chat and no error screen | `route-fallback.png` |
| Service-worker restart | In `chrome://extensions` click **service worker** then **Stop**, then reopen the Side Panel and Standalone; no crash and workspace version is unchanged | `service-worker-restart.png` |
| No content script | Confirm the extension shows no content-script injection and `chrome://extensions` permissions are `sidePanel` and `storage` only | `extension-permissions.png` |

- [ ] **Step 2b: Stop on any failed check**

If a check fails, record the failure, return to the owning task, fix, rebuild, and repeat the full manual checklist. Do not mark a check passed without a screenshot.

- [ ] **Step 3: Record evidence, update status, and commit**

```bash
git add .planning/evidence/phase-01 .planning/STATUS.md
git commit -m "docs(phase-01): record manual unpacked extension acceptance"
```

**Constraints and non-goals:** real screenshots only; no placeholder images; no raw credentials or customer data in screenshots; do not edit screenshots.
**Focused verification:** the manual checklist with screenshots.
**Phase 01 verification applicable now:** full `pnpm run verify:phase-1` plus the manual checklist.
**Specification-compliance checklist:** Side Panel Chat-only; singleton dedup; Options uses the Standalone tab; theme across both surfaces; service-worker restart safe; no content script.
**Code-quality and security checklist:** no sensitive data in screenshots; permissions remain `sidePanel` + `storage`.
**Evidence:** `manual-checks.md` and `screenshots/*.png`.
**Atomic commit:** `docs(phase-01): record manual unpacked extension acceptance`
**Completion criteria:** every checklist row has a recorded result and screenshot; failures are resolved.
**Stop conditions:** a manual check fails; a screenshot would contain sensitive data.

---

### Task 28 — Final Phase 01 Verification and Acceptance Preparation

> **Amendment (ADR-0001):** the final acceptance matrix must include the
> ADR-0001 election-serialisation acceptance items and the corrected T13/T13C
> evidence, and must confirm the background remains free of ordinary mutation,
> provider/MCP, and IndexedDB work.

**Implementation tier:** balanced
**Depends on:** T27
**Files created:** `.planning/phases/01-runtime-shells-workspace/ACCEPTANCE.md`
**Files modified:** `.planning/evidence/phase-01/verification.txt` (append final run), `.planning/evidence/phase-01/review.md` (final compliance + quality review), `.planning/STATUS.md`
**Test files:** none (runs existing suites)
**Interfaces produced:** none

- [ ] **Step 1: Run the final verification from a clean build**

```bash
rm -rf .output
pnpm run verify:phase-1
git status --porcelain
```

Expected: all gates pass; the working tree is clean before this task's documentation changes.

- [ ] **Step 2: Write `ACCEPTANCE.md`**

Map every Phase 01 acceptance criterion to its evidence. Use exactly this table with the result recorded per row:

| Criterion (DESIGN.md) | Evidence |
|---|---|
| Side Panel is Chat-only (Section 10) | `tests/components/sidePanelShell.test.tsx`; `screenshots/sidepanel-chat-only.png` |
| Two Side Panel actions use one navigation service (Section 10) | `tests/core/runtime/standaloneNavigation.test.ts`; `tests/components/sidePanelShell.test.tsx` |
| Singleton Standalone dedup and stale-ID recovery (Section 7) | `tests/core/runtime/standaloneTabController.test.ts`; `screenshots/standalone-singleton.png` |
| Close recovery via `tabs.onRemoved` (Section 7) | `tests/core/runtime/standaloneTabController.test.ts`; `tests/core/runtime/backgroundRuntime.test.ts` |
| Canonical route registry, 7 entries, default chat (Section 11) | `tests/core/registry/standaloneRoutes.test.ts`; `screenshots/standalone-sider.png` |
| Hash routing with `replaceState`, no history traversal (Section 11) | `tests/components/standaloneRouter.test.tsx` |
| Unknown route → Chat + `STANDALONE_ROUTE_FALLBACK` (Section 11) | `tests/components/standaloneRouter.test.tsx`; `screenshots/route-fallback.png` |
| Options only General → Appearance (Section 12) | `tests/components/optionsAppearance.test.tsx`; `screenshots/standalone-options.png` |
| Elected single writer (Section 6) | `tests/core/workspace/workspaceElection.test.ts`; `tests/integration/workspaceIntegration.test.ts` |
| Prepare/ack/commit handoff, one writer (Section 6) | `tests/core/workspace/workspaceHandoff.test.ts`; `tests/core/workspace/workspaceSync.test.ts` |
| Mutation versioning and idempotency (Section 6) | `tests/core/workspace/workspaceMutations.test.ts` |
| Mirror ordering and gap rehydration (Section 6) | `tests/core/workspace/workspaceSync.test.ts`; `tests/integration/workspaceIntegration.test.ts` |
| Canonical envelope and closed registries (Section 5) | `tests/core/runtime/runtimeEnvelope.test.ts`; `tests/core/runtime/messageSchemas.test.ts` |
| Sender and envelope boundary validation (Section 5) | `tests/core/runtime/boundaryValidation.test.ts` |
| Error/diagnostic registries separate and closed (Section 5) | `tests/core/error/errorCodes.test.ts` |
| Storage keys and area mapping (Section 9) | `tests/core/storage/storageKeys.test.ts`; `tests/core/storage/chromeStorage.test.ts` |
| Theme schemas, config, persistence, live propagation (Section 8) | `tests/core/theme/*.test.ts`; `tests/integration/workspaceIntegration.test.ts`; `screenshots/theme-dark-warm.png` |
| Manifest permissions `sidePanel` + `storage` (Section 13) | `pnpm run test:manifest`; `screenshots/extension-permissions.png` |
| Background bundle isolation (Section 13) | `pnpm run test:isolation` |
| No content script (Section 13) | `pnpm run test:manifest`; `pnpm run test:isolation` |
| Restart durability (Section 9) | `tests/integration/workspaceIntegration.test.ts`; `screenshots/service-worker-restart.png` |
| Build/typecheck/lint gates (Section 15) | `verification.txt` final `pnpm run verify:phase-1` output |

- [ ] **Step 3: Perform the final specification-compliance review and code-quality/security review**

Append the final review to `review.md`. Record any blocking finding and do not proceed to acceptance while a critical or high finding remains. Include the two plan-defined observations (allowed-source map and coordinator/requester-identity contract) as items for operator confirmation.

- [ ] **Step 4: Update `STATUS.md`**

Record: current phase, completed task T28, last commit, verification result, review result, evidence path, next action (operator acceptance), blockers, deferred findings.

- [ ] **Step 5: Commit**

```bash
git add .planning
git commit -m "docs(phase-01): prepare phase 01 acceptance"
```

**Constraints and non-goals:** do not approve the phase on the operator's behalf; do not merge or tag; `ACCEPTANCE.md` is prepared for operator decision only.
**Focused verification:** the full `pnpm run verify:phase-1` run and the manual checklist from T27.
**Phase 01 verification applicable now:** full `pnpm run verify:phase-1`.
**Specification-compliance checklist:** every criterion mapped to real evidence; no unmapped criterion; deferred features absent.
**Code-quality and security checklist:** final review recorded; no blocking finding; no secrets in evidence.
**Evidence:** `ACCEPTANCE.md`, final `verification.txt`, final `review.md`, `manual-checks.md`, `screenshots/`.
**Atomic commit:** `docs(phase-01): prepare phase 01 acceptance`
**Completion criteria:** every criterion has evidence; all gates pass; reviews recorded; operator acceptance is the only remaining step.
**Stop conditions:** any criterion lacks evidence; any gate fails; a critical or high finding remains; the operator has not accepted.

---

## Phase 01 Acceptance-Criterion → Evidence Map

This map is the authoritative coverage list used by Task 28's `ACCEPTANCE.md`. Every row must be backed by fresh command output, a generated-manifest inspection, a post-build bundle inspection, a manual record with screenshot, or a reviewed screenshot.

| Design section | Criterion | Evidence type | Owning task |
|---|---|---|---|
| 5 | One closed discriminated union; each type maps to one payload schema; unknown types fail closed | automated test | T07 |
| 5 | Sender and envelope validated at the trust boundary; invalid fails closed | automated test | T08 |
| 5 | `ErrorCode` and `DiagnosticEvent` are separate closed schemas | automated test | T03 |
| 6 | One live writer; first eligible Side Panel may claim when no valid writer | automated test | T13, T25 |
| 6 | Stale/invalid election recovery preserves committed version | automated test | T13, T25 |
| 6 | Prepare → acknowledge → commit; one writer after commit; new epoch | automated test | T14, T16 |
| 6 | Mutation ID, writer, epoch, base/resulting version; reject wrong/stale; apply once; monotonic; persist | automated test | T15 |
| 6 | Mirror ignores duplicate/stale; rehydrates gaps; no direct writes | automated test | T16, T25 |
| 7 | Singleton identity is the stored tab ID; validate via `tabs.get`; focus or create | automated test | T11 |
| 7 | Stale tab-ID recovery; no URL/title reads; no query-by-URL | automated test | T11 |
| 7 | `tabs.onRemoved` is authoritative; `standalone.closed` is non-authoritative | automated test | T11, T22 |
| 8 | Seed + pack overlays via `getAntdConfig({mode, pack, compact})` | automated test | T17 |
| 8 | `np_theme`/`np_theme_pack` in sync; invalid → defaults | automated test | T17 |
| 8 | One provider per surface; Side Panel compact; live propagation | component test + automated test | T17, T22, T25 |
| 9 | Seven keys map to the approved areas; session is ephemeral | automated test | T04, T12 |
| 9 | Metadata/version survive restart | automated test | T12, T25 |
| 10 | Side Panel contains only header, Chat region, empty state, two actions | component test | T21 |
| 10 | No text input, send, attach, model selector, or speculative chat state | component test | T21 |
| 10 | Both actions use one canonical navigation service with typed destination | automated test | T10, T21 |
| 11 | Exactly seven route IDs; default chat; 5 primary + 2 footer | automated test | T05, T18, T19 |
| 11 | Hash format `#/<id>`; `replaceState`; no history traversal | automated test | T19 |
| 11 | Unknown → chat + `STANDALONE_ROUTE_FALLBACK`; no crash | automated test + screenshot | T19, T27 |
| 11 | TeamGQM and ServiceNow absent; skeletons only | automated test | T18 |
| 12 | Nested exactly General → Appearance → Display mode + Theme pack | component test | T20 |
| 13 | Generated manifest: `sidePanel` + `storage` present; forbidden absent; no content script | generated-manifest inspection | T23 |
| 13 | Background bundle imports no React/antd/IndexedDB/provider | post-build bundle inspection | T24 |
| 13 | Side Panel bundle imports no Standalone pages/registry/admin | post-build bundle inspection | T24 |
| 13 | No content-script bundle exists | post-build bundle inspection | T24 |
| 14 | Unit tests for schemas, election, handoff, mutation, dedup, theme, registry | automated tests | T03–T21 |
| 14 | Integration tests for convergence, ordering, rehydration, restart, theme | automated tests | T25 |
| 15 | Pre-implementation baseline assertions | recorded command output | Baseline + T01 |
| 15 | Final `verify:phase-1` chain passes; `verify:all` identical | recorded command output | T26, T28 |
| 16 | Evidence files exist under `.planning/evidence/phase-01/` | evidence review | T27, T28 |

---

## Global Risks and Mitigations

- **WXT/Vite pin drift:** all tasks assert exact versions in T02; any install error stops the task.
- **Zod 4 API drift:** schemas use `z.enum`, `z.literal`, `z.discriminatedUnion`, `safeParse`, and `z.string().uuid()`. If the pinned Zod build reports a removed method, stop and record the method rather than switching to a different schema library.
- **antd v6 token/algorithm drift:** `getAntdConfig` uses only `theme.defaultAlgorithm`, `theme.darkAlgorithm`, `theme.compactAlgorithm`, `cssVar`, `hashed`, `token`, and `components`. If a key is unavailable, stop and record it.
- **Post-build marker false positives:** isolation marker changes require a recorded investigation with file and source excerpt (T24). Do not weaken silently.
- **Approved plan interpretations:** the allowed-source registry (T07/T08/T09), the coordinator and requester-identity contract (T07/T16), the single mutation kind (T06), and the Vitest project split (T02/T23/T24) are operator-approved (2026-09-19). None introduces a new message type, storage key, error code, runtime surface, persistence mechanism, or dependency.

---

## Plan Self-Review Record

Deterministic review performed against the twelve points in the planning brief:

1. **Paths exact** — every created and modified path is one of the allowed paths in DESIGN.md Section 4.4, except plan-defined test files under `tests/**`, which the design explicitly allows.
2. **Identifiers canonical** — `RuntimeSurface`, `OperationId`, `MessageType`/payload names, `ErrorCode`/`DiagnosticEvent`, `StandaloneRouteId` values, and storage keys are copied from DESIGN.md Sections 5 and 9. No identifier is renamed or aliased.
3. **Dependencies explicit** — each task lists `Depends on` and the dependency graph is provided.
4. **RED observable** — every task states the RED command and the expected failure and its meaning.
5. **GREEN minimal** — implementation steps are the smallest change that satisfies the focused test.
6. **Verification executable** — every command is a real pnpm script or shell command defined by T01/T02; no placeholders remain in executable blocks.
7. **Evidence objective** — each task names an exact evidence location and content; no placeholder evidence or empty directories are created during planning.
8. **Commit boundaries atomic** — one task equals one commit, with format `<type>(phase-01): <outcome>`.
9. **Later-phase work excluded** — no IndexedDB, provider, MCP, extraction, notes, memory, diagnostics functionality, host-page UI, or write-back appears.
10. **No delegated decisions** — every task states files, interfaces, commands, and expected results; the four plan interpretations were explicitly approved by the operator (2026-09-19) and are recorded in the "Approved Plan Interpretations" section, in the owning tasks, and in the tests that assert them.
11. **No placeholder interpretation** — no `TBD`, `TODO`, `implement later`, or "similar to Task N" remains; code blocks are present for every code step.
12. **Design coverage** — the acceptance map and the scope coverage matrix map every required scope and every Section 5–16 acceptance point to at least one task.

**Approved interpretations (no open observations):**

1. `MESSAGE_TYPE_ALLOWED_SOURCES` is a closed, typed per-message allowed-source registry, canonical in `MessageType.ts`, validated at every runtime boundary, and free of wildcard/permissive defaults. Covered by T07, T08, T09, T22.
2. `WorkspaceRehydrateRequestPayload` carries `instanceId` and `writerType`, and `createWorkspaceCoordinator` is the Phase 01 orchestration boundary for prepare, acknowledge, commit, relinquish, mutation, and rehydration. Covered by T07, T16, T22.
3. `WorkspaceMutationKind` is the single closed literal `workspace.metadata.set`; extension requires a future approved design and plan. Covered by T06.
4. The `manifest` and `isolation` Vitest projects inspect actual build output after `build`, while `test` runs only artefact-free tests. Covered by T02, T23, T24.

All four were approved by the operator on 2026-09-19. No unresolved placeholder, alternative, or open observation remains.


