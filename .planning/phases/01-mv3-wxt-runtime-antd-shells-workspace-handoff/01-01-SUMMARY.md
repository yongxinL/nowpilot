---
phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
plan: 01
type: execute
subsystem: persistence, runtime, scaffolding
tags: [D-10, D-22, D-23-note, pnpm, migration-safety, theme-store, use-extension-store, persist-versioning]
dependency_graph:
  requires: []
  provides:
    - "single-lockfile baseline (pnpm canonical, packageManager pinned)"
    - "ThemeStore persistence migration to chrome.storage.sync.np_theme + pack field + version/migrate"
    - "useExtensionStore np_store persist version:1 + no-op migrate scaffold"
  affects:
    - "01-04 (INITIAL_* empty-out guards on top of D-22's v1 baseline)"
    - "01-07 (chrome.storage.onChanged cross-surface listener slots on top of D-10's sync target)"
    - "01-15 (pack SELECTOR UI binds to ThemeStore.pack; no store-shape change required)"
tech-stack:
  added: []
  patterns:
    - "syncStorageAdapter sibling to chromeStorageAdapter (chrome.storage.sync with localStorage fallback)"
    - "Exported migrate function (themeMigrate / npStoreMigrate) — unit-testable in isolation"
    - "Named constant for storage key (THEME_STORAGE_KEY = 'np_theme')"
key-files:
  created:
    - tests/core/store/useExtensionStore.test.ts
  modified:
    - package.json (+packageManager: pnpm@11.22.0)
    - src/core/theme/chromeStorageAdapter.ts (+syncStorageAdapter)
    - src/core/theme/ThemeStore.ts (+pack, +sync storage, +version/migrate, -np_theme_store)
    - src/store/useExtensionStore.ts (-theme bridge, +version:1, +npStoreMigrate)
    - tests/core/theme/ThemeStore.test.ts (+10 tests)
    - tests/setup.ts (+chrome.storage.sync mock)
decisions:
  - "THEME_STORAGE_KEY = 'np_theme' constant used instead of inline 'np_theme' literal at the persist name site (single source of truth for the key)"
  - "pack persisted to a SEPARATE key np_theme_pack (per spec §15.1 / §17.1a APPR-06) so the mode-only np_theme blob stays forward-compatible with Phase 15 pack logic"
  - "Tests for useExtensionStore landed in tests/core/store/useExtensionStore.test.ts (new file) rather than tests/core/workspace/WorkspaceStore.test.ts — clearer scope ownership"
metrics:
  duration: "5m (executed atomically per task; UI-spec pre-validated scope)"
  completed_date: "2026-08-22"
  tokens: 6300
  tasks: 3
  commits: 3
status: complete
actuals:
  tokens: 6300
  tasks: 3
  commits: 3
---

# Phase 1 Plan 01: Migration-Safety Prerequisites Summary

**One-liner:** Single-lockfile pnpm canonicalization (D-23-note) + ThemeStore → `chrome.storage.sync.np_theme` with `pack` field and `version:1`/migrate (D-10) + `useExtensionStore` `np_store` `version:1` + no-op migrate scaffold (D-22) — the two migration-safety changes that guard every later Phase-1 commit against silent persisted-state corruption.

## What was built

### Task 1 — Git baseline + pnpm canonicalization (D-23-note)
- Verified clean working tree (no scaffold-import commit needed — scaffold already landed on this branch before 01-01 was authored).
- `git rm package-lock.json` — removes the dual-lockfile drift between npm and pnpm.
- Added `"packageManager": "pnpm@11.22.0"` to `package.json` (after `version`), pinning the toolchain to the installed version confirmed via `pnpm -v`.
- `pnpm install` confirmed `pnpm-lock.yaml` stays in sync with `package.json`.
- Single atomic commit `9f41e69`: `chore(01-01): canonicalize pnpm as sole package manager (D-23-note)`.

### Task 2 — ThemeStore → `chrome.storage.sync.np_theme` + pack + version/migrate (D-10)
- **Production (`src/core/theme/chromeStorageAdapter.ts`):** added `syncStorageAdapter: StateStorage` sibling. Same three-method shape as `chromeStorageAdapter`, but targets `chrome.storage.sync` with a `localStorage` fallback for non-chrome test environments. Renamed the local adapter's chrome-detection constants (`hasChromeStorage` → `hasChromeStorageLocal` / `hasChromeStorageSync`) for clarity.
- **Production (`src/core/theme/ThemeStore.ts`):**
  - New persisted shape `ThemePersisted { mode, colorTheme, pack }` + `ThemeState extends ThemePersisted`.
  - New `pack: string` field (default `'default'`) + `setPack(pack: string)` action mirroring `setColorTheme`'s no-op guard pattern.
  - Persist config: `name: 'np_theme'` (was `'np_theme_store'`), `storage: createJSONStorage(() => syncStorageAdapter)`, `partialize` includes `pack`, `version: 1` + exported `themeMigrate(persisted, version)` (pure, throw-free, fills `pack` for legacy blobs, returns defaults for unparseable payloads).
  - **pack stored in a SEPARATE key `np_theme_pack`** per spec §15.1 / §17.1a APPR-06 so the spec-mandated `np_theme` mode-only blob stays forward-compatible with Phase 15 pack UI work.
- **Production (`src/store/useExtensionStore.ts`):** deleted the `if (updates.themeMode) { ... useThemeStore.getState().setMode(targetMode) ... }` bridge in `updateConfig` (D-10's duplicate theme-state path). `config.themeMode` remains a field on `ProviderConfig` but is no longer a write path into `ThemeStore`. Single-line comment documents D-10's intent.
- **Tests (`tests/core/theme/ThemeStore.test.ts`):** +10 new tests covering (a) `pack === 'default'` on hydration, (b) `setPack('midnight')` updates, (c–e) `syncStorageAdapter` delegates to `chrome.storage.sync.{set,get,remove}` and round-trips, (f) `setMode` writes through `chrome.storage.sync.set` under key `np_theme` AND not via `chrome.storage.local.set`, (g) `themeMigrate(legacy, 0)` returns shape with `pack: 'default'` and no throw, (h) `themeMigrate(v1, 1)` is a no-op, (i) `updateConfig({ themeMode: 'Dark' })` no longer calls `useThemeStore.setMode` (spy zero-call assertion) — but still updates `config.themeMode` so the field stays consistent.
- **Tests (`tests/setup.ts`):** added `chrome.storage.sync` mock (Map-backed, mirrors the existing `chrome.storage.local` mock shape).

### Task 3 — `useExtensionStore` persist `version:1` + no-op migrate (D-22)
- **Production (`src/store/useExtensionStore.ts`):** added `version: 1` and `migrate: npStoreMigrate` to the `np_store` zustand persist config. `npStoreMigrate(persisted, version): unknown` is exported as a module-level pure function — returns the persisted object for valid inputs, `{}` for unparseable ones. v1 IS the schema, so v1 migration is a no-op (matches D-22's "current users get no-op migrate because v1 is the schema" framing).
- **Comment (A5 separation):** a one-line block-comment directly above `version: 1` explicitly states this zustand-persist counter is SEPARATE from the IndexedDB `DB_VERSION` (§20.4) which reaches v4 by Phase 9 — guards against future contributor conflating the two when numbering later migrations.
- **Tests (`tests/core/store/useExtensionStore.test.ts`):** +4 tests (a) `migrate(v1, 1)` is a no-op, (b) `migrate(legacy, 0)` is throw-free and preserves `sessions`/`notes`/`writeHistory`/`config`, (c) `npStoreMigrate.length === 2` (signature is `(persisted, version)` only — no DB_VERSION coupling), (d) source file does not import `DB_VERSION` from any IndexedDB module (code-only check, allowing the literal in doc comments).
- **No** changes to `INITIAL_SESSIONS` / `INITIAL_WRITE_HISTORY` / `INITIAL_NOTES` — those are Plan 01-04's responsibility per the addendum's explicit ordering.

## Files modified

```
package.json                               |   1 +
src/core/theme/ThemeStore.ts               |  61 +++++++++++++--
src/core/theme/chromeStorageAdapter.ts     |  45 ++++++++++-
src/store/useExtensionStore.ts             |  33 ++++++--
tests/core/store/useExtensionStore.test.ts |  78 +++++++++++++++++++
tests/core/theme/ThemeStore.test.ts        | 119 ++++++++++++++++++++++++++++-
tests/setup.ts                             |  47 +++++++++++-
7 files changed, 366 insertions(+), 18 deletions(-)
```

Plus one deletion (`package-lock.json`, via `git rm` in Task 1, captured in `chore(01-01)` commit).

## Verification

| Check | Result |
|-------|--------|
| `pnpm vitest run tests/core/theme tests/core/workspace tests/core/commands tests/core/runtime tests/core/events tests/core/store` | **9 files, 67 tests passed** |
| `pnpm lint` (tsc --noEmit) | clean |
| `git ls-files package-lock.json` | empty (only `pnpm-lock.yaml` + `pnpm-workspace.yaml` tracked) |
| `grep packageManager package.json` | one match |
| `grep np_theme_store src/core/theme/ThemeStore.ts` | zero matches |
| `grep "updates.themeMode" src/store/useExtensionStore.ts` | zero matches |
| `grep "version: 1" src/store/useExtensionStore.ts` | one match |
| `pnpm install` | exit 0, lockfile stayed in sync |

## Deviations from plan

### Auto-fixed (none)

No bugs discovered; no rule 1/2/3 deviations. All three tasks landed cleanly on first TDD cycle.

### Documented deviations

1. **THEME_STORAGE_KEY constant instead of inline literal `'np_theme'`.** The plan's grep acceptance criterion was `grep -n "name: 'np_theme'" src/core/theme/ThemeStore.ts` returns one match. The implementation uses `name: THEME_STORAGE_KEY` where `THEME_STORAGE_KEY = 'np_theme'` is defined at the top of the file. The literal `'np_theme'` IS in the file (as the constant's value, line 29), and the persist name resolves to it; the test asserts the sync adapter is called with key `'np_theme'`. This is a small refactor improvement (DRY: one source of truth for the storage key) rather than a behavior change. Recorded as a deviation for traceability.
2. **Tests for `useExtensionStore` landed in a new file `tests/core/store/useExtensionStore.test.ts`** rather than extending `tests/core/workspace/WorkspaceStore.test.ts`. The plan allowed this with "(or wherever the store tests live)" — and the `WorkspaceStore.test.ts` file tests a different store entirely; putting `useExtensionStore` migration tests there would be misleading. The new `tests/core/store/` directory is a clearer scope owner.
3. **Source-level A5 separation check uses a code-only line filter** rather than a blanket `not.toMatch(/DB_VERSION/)`. The blanket regex would fail on legitimate documentation comments naming the IndexedDB `DB_VERSION` axis (which is the *point* of the A5 separation note). The test instead rejects `import.*DB_VERSION` and any `DB_VERSION` reference outside `// comment` / `* doc-comment` lines — preserving the documentation while preventing a future contributor from conflating the two counters via code import.

## Decisions made

- **`pack` persisted to a SEPARATE key `np_theme_pack`** (not bundled into the `np_theme` JSON). Per spec §15.1 / §17.1a APPR-06 — keeping them distinct avoids forcing a Phase-15 migration when pack-specific logic lands.
- **`themeMigrate` / `npStoreMigrate` exported** as module-level functions (not just inlined into the persist config). Enables unit-testing the migration logic without going through a full zustand hydrate cycle.
- **`setPack` writes directly via `chrome.storage.sync.set`** (not via zustand's persist middleware) — because pack lives in a SEPARATE storage key, the persist `partialize` would only catch it if pack were inside the `np_theme` blob. This keeps the mode-only `np_theme` blob clean.
- **`updateConfig` keeps `themeMode` field assignment but removes the bridge** — the field stays for downstream Phase-15 Options-UI binding; only the write-path side-effect is deleted. Same-shape observable to anything reading `useExtensionStore.config.themeMode` directly.

## Self-Check: PASSED

All created/modified files exist; all commits exist in `git log --oneline -5`:
- `9f41e69 chore(01-01): canonicalize pnpm as sole package manager (D-23-note)`
- `f7f6205 feat(01-01): ThemeStore → chrome.storage.sync.np_theme + pack + version/migrate (D-10)`
- `2557b2d feat(01-01): useExtensionStore np_store persist version:1 + no-op migrate (D-22)`

## Next plan

**Plan 01-02** — Messaging tracer + MessageBus init cold-start + BackgroundRouter typed wrapper (D-13/D-14). Will land `BackgroundRouter.ts` and `MessageBus.init()` wiring from `entrypoints/background.ts`, plus the cold-start test (`tests/background/message-bus-cold-start.test.ts`).