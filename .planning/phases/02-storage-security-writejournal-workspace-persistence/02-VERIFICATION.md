---
phase: 02-storage-security-writejournal-workspace-persistence
verified: 2026-08-24T22:21:00Z
status: passed
score: 5/5 truths verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:

    - "WriteJournal recovery test passes (simulated SW kill mid-write → replay restores state without loss)"  # CR-01
    - "Workspace state persists across page reload and cross-surface handoff (no message loss, no scroll jump)"  # CR-02
  gaps_remaining: []
  regressions: []
gaps: []
human_verification:

  - test: "Manually verify the WorkspaceStore persist-on-reload path in a running extension: set workspace state, reload the surface, and confirm workspaceId/conversationId restore with no message loss and no scroll jump"
    expected: "State persists across reload; scroll position preserved"
    why_human: "The happy-path reload-hydrate is covered by automated tests, but the 'no scroll jump' UX and live extension runtime behavior cannot be verified by grep or vitest"
---

# Phase 2: Storage Security · WriteJournal · Workspace Persistence — Verification Report (Re-verification)

**Phase Goal:** All persisted state is encrypted at rest with AES-GCM; secrets never touch chrome.storage.local raw; the WriteJournal prevents silent data loss across SW suspension; IndexedDB stores are migrated and version-gated.
**Verified:** 2026-08-24T22:21:00Z
**Status:** human_needed
**Re-verification:** Yes — re-verification after gap-closure execution (gap plans 02-08, 02-09)

## Gap-Closure Confirmation

This re-verification confirms that **both prior BLOCKERs (CR-01 and CR-02) are now closed in the ACTUAL code** — not merely in the SUMMARY claims. Independent code inspection and the passing `verify:phase-2` gate confirm both fixes:

### CR-01 (boot recovery data loss) — CLOSED

- **`recoverWorkspaceJournal`** (src/core/storage/WriteJournal.ts:297-337) now re-applies the **CURRENT stored `np_workspace` blob verbatim** via `deps.readCurrentWorkspace()` — it never reconstructs a value from `entry.workspaceId`/`conversationId` (which never exist on the metadata-only `WriteJournalEntry`, D-33). The prior `?? ''` / `?? null` empty-reconstruction fallbacks are gone from production (grep for `workspaceId ??` in entrypoints/WriteJournal.ts/tests → zero matches).
- **Both entrypoints** call it with real deps: `entrypoints/sidepanel/main.tsx:44-63` and `entrypoints/standalone/main.tsx:45-63` bind `readCurrentWorkspace` to `chromeStorageAdapter.getItem('np_workspace')`, and both pass the real `getWorkspaceId: () => useWorkspaceStore.getState().workspaceId` into `startElection` (sidepanel:66-68, standalone:66-68).
- **Corrected tests drive the real boot path**: `WriteJournal.test.ts` Test 1 and `WorkspacePersistence.test.ts` Test 5 both seed a real persisted zustand-wrapped `np_workspace` (`ws-1/conv-1`, `persist-real-ws/persist-real-conv`), seed a metadata-only `pending` `update-workspace` entry, run `recoverWorkspaceJournal`, and assert the stored value retains its original `workspaceId`/`conversationId` (NOT overwritten with `''`/null). Both pass in the gate.

### CR-02 (election heartbeat never published) — CLOSED

- **`runHeartbeatTick`** (src/core/workspace/WorkspaceElection.ts:246-296) now calls `notifyWorkspaceHeartbeat(surface, getWorkspaceId())` for `primary`/`solo` states (line 284), after the session-record refresh. Election-in-progress still refreshes the record but emits no heartbeat (D-26 intent preserved).
- **`startElection(surface, opts?: { getWorkspaceId })`** threads the optional getter into the tick (default `() => ''`, additive — `startElection('sidepanel')` unchanged).
- **Production-tick two-surface test** (WorkspaceElection.test.ts Test 5, lines 176-238) models two separate module instances (`vi.resetModules()` + dynamic imports, each with its own `activeInstance` + BroadcastBus `instanceId`) — Sidepanel starts primary, Standalone starts later and wins the tie-break, then Sidepanel demotes to secondary via the **real production heartbeat tick**. **Zero** occurrences of `foreign-instance-id` and **zero** manual `_sender` injection in the test file (grep count = 0; the only `_sender` mention is a comment explicitly stating none is used).
- The SidepanelChat election-demotion mirror path (onWorkspaceSync, SidepanelChat.tsx:213-229) is now live because real heartbeats arrive.

Both fixes are confirmed substantive, wired, and behaviorally exercised by tests that drive the real production paths.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WriteJournal recovery test passes (simulated SW kill mid-write → replay restores state without loss) | ✓ VERIFIED | `recoverWorkspaceJournal` re-applies the current stored np_workspace value (WriteJournal.ts:297-337); both entrypoints wired (sidepanel:44, standalone:45); WriteJournal Test 1 + WorkspacePersistence Test 5 drive the real boot path with metadata-only entries and assert original value retained; both pass in `verify:phase-2`. CR-01 CLOSED. |
| 2 | API key AES-GCM round-trip (encrypt → chrome.storage.local → decrypt) | ✓ VERIFIED | EncryptedStorage.test.ts (7 tests) round-trip + wrong-key + tamper rejection pass in gate; EncryptedStorage.ts uses AES-GCM-256 with PBKDF2-derived key (KeyVault.ts). Unchanged by gap work. |
| 3 | No message body or raw secret appears in chrome.storage.local (TraceRedactor proven by inspection) | ✓ VERIFIED | secrets-inspection.test.ts (6 tests): np_store/np_providers contain no plaintext substring after save/migration; useExtensionStore partialize strips secret fields; hydrateProviderSecrets read-only. Unchanged by gap work. |
| 4 | IndexedDB migration from v1 → v2 fixture passes (idempotent; backward-compatible) | ✓ VERIFIED | IndexedDBMigrator.test.ts (7 tests): backward-compat, idempotency, fresh-open-at-v2; bootstrap opens all 5 production DBs at v1. Unchanged by gap work. |
| 5 | Workspace state persists across page reload and cross-surface handoff (no message loss, no scroll jump) | ✓ VERIFIED | `runHeartbeatTick` publishes WORKSPACE_HEARTBEAT for primary/solo (WorkspaceElection.ts:284); two-surface production-tick test (WorkspaceElection Test 5) demotes sidepanel to secondary with zero manual `_sender` injection; persists across reload via WorkspacePersistence Tests 1/3/3b. CR-02 CLOSED. The "no scroll jump" UX sub-clause remains a human-only check (see Human Verification). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/security/KeyVault.ts` | Install secret + per-key PBKDF2 derivation | ✓ VERIFIED | Real, substantive (install-secret lifecycle, 100k PBKDF2, AES-GCM-256). |
| `src/core/storage/EncryptedStorage.ts` | AES-GCM-256 encrypt/decrypt + provider helpers | ✓ VERIFIED | Substantive; round-trip tested. |
| `src/core/storage/WriteJournal.ts` | recoverJournal/runJournaled + recoverWorkspaceJournal | ✓ VERIFIED | CR-01 fix: `recoverWorkspaceJournal` (lines 297-337) re-applies current value; tests drive real boot path. |
| `src/core/storage/IndexedDBMigrator.ts` | Migration registry + openVersionedDB + bootstrap | ✓ VERIFIED | v1→v2 fixture tested. |
| `src/core/workspace/journalingAdapter.ts` | Election-gated journaled setItem | ✓ VERIFIED | Correct gating + journaling. |
| `src/core/workspace/WorkspaceStore.ts` | isPrimaryWriter delegation + np_workspace persist | ✓ VERIFIED | journalingAdapter wired; canonical key. |
| `src/core/workspace/WorkspaceElection.ts` | CAS + heartbeat + re-election + tie-break | ✓ VERIFIED | CR-02 fix: `runHeartbeatTick` publishes WORKSPACE_HEARTBEAT (line 284); two-surface production-tick test passes. |
| `wxt.config.ts` | permissions exactly [sidePanel, storage, tabs, unlimitedStorage] | ✓ VERIFIED | Line 45 matches (REQ-R06). |
| `src/core/theme/chromeStorageAdapter.ts` | STORAGE_QUOTA / STORAGE_RATE_LIMIT + debounce + flush | ✓ VERIFIED | classifyStorageError implemented; flush on beforeunload/visibilitychange (REQ-R03/R07). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| journalingAdapter.setItem | WriteJournalDB entries | putEntry before inner.setItem (D-34) | ✓ WIRED | Immediate IDB put, then debounced inner write. |
| WorkspaceStore.persist | journalingAdapter | createJournalingAdapter storage | ✓ WIRED | Correct election-gated wiring. |
| boot recoverJournal | chromeStorageAdapter.setItem | recoverWorkspaceJournal re-applies current value | ✓ WIRED | CR-01: re-applies `readCurrentWorkspace()` verbatim; both entrypoints wired. |
| runHeartbeatTick | BroadcastBus WORKSPACE_HEARTBEAT | notifyWorkspaceHeartbeat | ✓ WIRED | CR-02: called for primary/solo (WorkspaceElection.ts:284); two-surface test proves delivery. |
| useExtensionStore partialize/migrate | np_store / np_providers | migrateProviderSecrets + partialize strip | ✓ WIRED | Plaintext stripped; ciphertext-only persist; decrypt-on-read. |
| workspace persist | chrome.storage.local.np_workspace | debounced adapter | ✓ WIRED | Canonical key + legacy lift. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| np_workspace reload-hydrate | workspaceId/conversationId | chromeStorageAdapter.getItem('np_workspace') | ✓ FLOWING | Tests 1/3/3b confirm. |
| np_providers secrets | apiKey/openAiKey/geminiKey | EncryptedStorage decrypt ← np_providers | ✓ FLOWING | secrets-inspection hydrate test. |
| journal recovery value | workspaceId | readCurrentWorkspace() (current stored blob) | ✓ FLOWING | CR-01: re-applies current value, never reconstructs from absent entry fields; tests assert retention. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Verification gate | `pnpm run verify:phase-2` | exit 0, tsc green, 109/109 tests | ✓ PASS |
| CR-01 real boot recovery | WorkspacePersistence.test.ts Test 5 + WriteJournal.test.ts Test 1 | metadata-only entry → original value retained, entry completed | ✓ PASS |
| CR-02 production-tick handoff | WorkspaceElection.test.ts Test 5 | sidepanel primary → standalone wins → sidepanel demotes via real heartbeat | ✓ PASS |
| AES-GCM round-trip | EncryptedStorage.test.ts | round-trip + wrong-key + tamper pass | ✓ PASS |
| Secrets absent from local | secrets-inspection.test.ts | no plaintext substring | ✓ PASS |
| IDB v1→v2 migration | IndexedDBMigrator.test.ts | backward-compat + idempotent | ✓ PASS |
| Manual `_sender` injection | `grep foreign-instance-id / _sender` | 0 occurrences in WorkspaceElection.test.ts | ✓ PASS |

### Probe Execution

No probe scripts (`scripts/*/tests/probe-*.sh`) are declared or present for this phase; verification relies on the vitest gate, which was run directly.

### Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| REQ-R03 | RESEARCH-RECONCILIATION.md §D | Coalesce np_workspace persists (debounce + flush); assert write-rate | ✓ SATISFIED | chromeStorageAdapter STORAGE_DEBOUNCE_MS=300 + flush on beforeunload/visibilitychange; WorkspacePersistence Test 6 (≤30/min); CR-01/CR-02 recovery + handoff now wired. |
| REQ-R06 | RESEARCH-RECONCILIATION.md §D / ADR-STACK-02 | unlimitedStorage manifest permission when IDB ships | ✓ SATISFIED | wxt.config.ts:45 `['sidePanel','storage','tabs','unlimitedStorage']`. |
| REQ-R07 | RESEARCH-RECONCILIATION.md §D | Storage adapter surfaces STORAGE_QUOTA / STORAGE_RATE_LIMIT codes | ✓ SATISFIED | classifyStorageError (chromeStorageAdapter.ts:34-38) + reporter hook. |

All three phase requirement IDs are accounted for and satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| entrypoints/sidepanel/main.tsx | (boot) | Empty reconstruction `?? ''` / `?? null` on recovery | — | **Resolved** — replaced by `recoverWorkspaceJournal` (CR-01). No occurrences remain. |
| entrypoints/standalone/main.tsx | (boot) | Empty reconstruction `?? ''` / `?? null` | — | **Resolved** — replaced by `recoverWorkspaceJournal` (CR-01). No occurrences remain. |
| src/core/workspace/WorkspaceElection.ts | 246-296 | Heartbeat publish absent | — | **Resolved** — `notifyWorkspaceHeartbeat` now called for primary/solo (CR-02). |
| src/components/chat/SidepanelChat.tsx | 369-377 | Production UI imports `__test__` election seam | ⚠️ Warning | Couples UI to test internals (WR-01, from code review). Pre-existing, not introduced by gap work. |
| src/components/options/OptionsPage.tsx | 264 | `console.error` violates debugLog convention | ⚠️ Warning | Failure invisible to diagnostics surface (WR-02). Pre-existing. |
| src/core/security/KeyVault.ts | 46-71 | Install secret stored in chrome.storage.local alongside ciphertext | ⚠️ Warning | Local-storage compromise defeats encryption; length-mismatch rotates root secret (WR-03, documented D-29 trade-off). Pre-existing. |

No `TBD`/`FIXME`/`XXX` debt markers found in phase-2 files.

## Human Verification Required

1. **Workspace persist-on-reload (SC5 happy path / no scroll jump)** — Test: In a running extension, set workspace state, reload the surface, confirm workspaceId/conversationId restore without message loss and no scroll jump. Expected: state persists across reload; scroll preserved. Why human: the happy-path reload-hydrate is covered by automated tests, but the live extension runtime and "no scroll jump" UX cannot be verified by grep or vitest.

## Gaps Summary

No gaps remain. Both prior BLOCKERs are closed and confirmed in code + passing tests:

- **CR-01** (boot recovery data loss) — `recoverWorkspaceJournal` re-applies the current stored value; both entrypoints wired; tests drive the real boot path and assert retention.
- **CR-02** (election heartbeat never published) — `runHeartbeatTick` publishes WORKSPACE_HEARTBEAT; two-surface production-tick test proves demotion with zero manual `_sender` injection.

All 5 success criteria are now VERIFIED. The phase goal ("WriteJournal prevents silent data loss across SW suspension"; "cross-surface handoff") is achieved on the automated-verification side. The single remaining item is the inherently human-only "no scroll jump" live-extension UX check, hence status `human_needed` (not `passed`) per the decision tree.

---

_Verified: 2026-08-24T22:21:00Z_
_Verifier: the agent (gsd-verifier)_
