---
phase: 02-storage-security-writejournal-workspace-persistence
verified: 2026-08-24T11:09:28Z
status: gaps_found
score: 3/5 truths verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "WriteJournal recovery test passes (simulated SW kill mid-write → replay restores state without loss)"
    status: failed
    reason: "The real boot recovery path in entrypoints/sidepanel/main.tsx:75-78 and entrypoints/standalone/main.tsx:76-77 reconstructs np_workspace from entry.workspaceId/entry.conversationId, but WriteJournalEntry is metadata-only (src/types/storage.ts:63-70; journalingAdapter.ts:158-165 persists no workspaceId). The ?? '' / ?? null fallbacks always fire, so any boot with a pending/applying update-workspace entry OVERWRITES np_workspace with {\"workspaceId\":\"\",\"conversationId\":null} — data loss on the exact crash-recovery path this phase exists to provide. The passing WriteJournal.test.ts Test 1 and WorkspacePersistence.test.ts Test 5 register steps with a hardcoded/captured value and never exercise the real boot reconstruction, so the suite is green while production recovery corrupts state."
    artifacts:
      - path: "entrypoints/sidepanel/main.tsx"
        issue: "Line 75-78 reconstructs the value from undefined entry fields (workspaceId ?? '', conversationId ?? null)"
      - path: "entrypoints/standalone/main.tsx"
        issue: "Identical empty-reconstruction bug at lines 76-77"
      - path: "src/types/storage.ts"
        issue: "WriteJournalEntry (lines 63-70) carries no workspaceId/conversationId — the reconstruction reads fields that never exist"
      - path: "src/core/workspace/journalingAdapter.ts"
        issue: "setItem builds a metadata-only entry (lines 158-165), confirming the entry cannot carry the value recovery needs"
    missing:
      - "Persist the full value (or workspaceId+conversationId) on the entry when journalingAdapter.setItem creates it, OR have the boot replay re-read the CURRENT np_workspace from storage and re-apply it rather than reconstructing an empty placeholder"
      - "An integration test that drives the real boot recovery path (an entry whose only persisted fields are id/operation/status) and asserts np_workspace retains its original value"
  - truth: "Workspace state persists across page reload and cross-surface handoff (no message loss, no scroll jump)"
    status: failed
    reason: "The persist-on-reload happy path works (WorkspacePersistence Tests 1/3/3b), but the cross-surface election tie-break handoff is dead: runHeartbeatTick (WorkspaceElection.ts:246-284) never calls notifyWorkspaceHeartbeat, which has zero call sites in src/ (confirmed by grep). WORKSPACE_HEARTBEAT is therefore never published, so foreignSurfacesEverSeen stays false and the standalone-wins tie-break demotion rule (WorkspaceElection.ts:348-363) never fires in production. The claimed 'election demotion without WORKSPACE_HANDOFF' mirror path (SidepanelChat.tsx:226-241) never triggers. The WorkspaceElection.test.ts Test 5 manually injects the heartbeat via publish(..., _sender:'foreign-instance-id') rather than relying on the production tick, so the test passes while production never sends a heartbeat."
    artifacts:
      - path: "src/core/workspace/WorkspaceElection.ts"
        issue: "runHeartbeatTick (lines 246-284) only calls writeRecord — the documented WORKSPACE_HEARTBEAT publish is absent"
      - path: "src/core/workspace/WorkspaceSync.ts"
        issue: "notifyWorkspaceHeartbeat (line 44) has zero call sites in src/ and entrypoints/"
      - path: "src/components/chat/SidepanelChat.tsx"
        issue: "Election-demotion mirror trigger (lines 226-241) is dead because no foreign heartbeat ever arrives"
    missing:
      - "Publish the heartbeat in runHeartbeatTick for primary/solo surfaces (mirroring the documented intent): if (cur.state==='primary'||cur.state==='solo') notifyWorkspaceHeartbeat(surface, workspaceId)"
      - "A two-surface test (Sidepanel primary → Standalone starts later → Standalone wins) that does not manually inject the heartbeat"
behavior_unverified_items: []
human_verification:
  - test: "Manually verify the WorkspaceStore persist-on-reload path in a running extension: set workspace state, reload the surface, and confirm workspaceId/conversationId restore with no message loss and no scroll jump"
    expected: "State persists across reload; scroll position preserved"
    why_human: "The happy-path reload-hydrate is covered by automated tests, but the 'no scroll jump' UX and live extension runtime behavior cannot be verified by grep or vitest"
---

# Phase 2: Storage Security · WriteJournal · Workspace Persistence — Verification Report

**Phase Goal:** All persisted state is encrypted at rest with AES-GCM; secrets never touch chrome.storage.local raw; the WriteJournal prevents silent data loss across SW suspension; IndexedDB stores are migrated and version-gated.
**Verified:** 2026-08-24T11:09:28Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The encrypt-at-rest layer, IndexedDB foundation, WriteJournal primitive, election-gated journaling adapter, storage-error classification, and the `np_workspace` persist wiring are all present, substantive, and well-tested — the `verify:phase-2` gate (tsc + 109 vitest tests) passes cleanly. **However, two CRITICAL production-wiring defects confirmed against the code break the phase's headline success criteria** (1 and 5). The test suite is green because the tests bypass the exact broken wiring.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WriteJournal recovery test passes (simulated SW kill mid-write → replay restores state without loss) | ✗ FAILED | `entrypoints/{sidepanel,standalone}/main.tsx` reconstruct `np_workspace` from `entry.workspaceId ?? ''` / `entry.conversationId ?? null`, but `WriteJournalEntry` (types/storage.ts:63-70, journalingAdapter.ts:158-165) is metadata-only. Every crash-recovery with a pending/applying entry overwrites `np_workspace` with `{"workspaceId":"","conversationId":null}`. Tests hardcode the recovered value and bypass the boot wiring. |
| 2 | API key AES-GCM round-trip (encrypt → chrome.storage.local → decrypt) | ✓ VERIFIED | EncryptedStorage.test.ts round-trip + wrong-key + tamper rejection pass; EncryptedStorage.ts uses AES-GCM-256 with PBKDF2-derived key (KeyVault.ts). |
| 3 | No message body or raw secret appears in chrome.storage.local (TraceRedactor proven by inspection) | ✓ VERIFIED | secrets-inspection.test.ts: np_store/np_providers contain no plaintext substring after save/migration; useExtensionStore partialize strips secret fields; hydrateProviderSecrets is read-only. |
| 4 | IndexedDB migration from v1 → v2 fixture passes (idempotent; backward-compatible) | ✓ VERIFIED | IndexedDBMigrator.test.ts Tests 1-3 exercise backward-compat, idempotency, fresh-open-at-v2; bootstrap opens all 5 production DBs at v1. |
| 5 | Workspace state persists across page reload and cross-surface handoff (no message loss, no scroll jump) | ✗ FAILED | Persist-on-reload works (WorkspacePersistence Tests 1/3/3b), but the election tie-break handoff is dead: `runHeartbeatTick` never publishes `WORKSPACE_HEARTBEAT`; `notifyWorkspaceHeartbeat` has zero call sites. Standalone-wins tie-break and election-demotion mirror never fire in production. |

**Score:** 3/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/security/KeyVault.ts` | Install secret + per-key PBKDF2 derivation | ✓ VERIFIED | Real, substantive (install-secret lifecycle, 100k PBKDF2, AES-GCM-256). |
| `src/core/storage/EncryptedStorage.ts` | AES-GCM-256 encrypt/decrypt + provider helpers | ✓ VERIFIED | Substantive; round-trip tested. |
| `src/core/storage/WriteJournal.ts` | O.11 runJournaled/recoverJournal | ✓ VERIFIED (primitive) | Core primitive correct; but boot replay wiring (below) is defective. |
| `src/core/storage/IndexedDBMigrator.ts` | Migration registry + openVersionedDB + bootstrap | ✓ VERIFIED | v1→v2 fixture tested. |
| `src/core/workspace/journalingAdapter.ts` | Election-gated journaled setItem | ✓ VERIFIED | Correct gating + journaling; entry is metadata-only (source of CR-01). |
| `src/core/workspace/WorkspaceStore.ts` | isPrimaryWriter delegation + np_workspace persist | ✓ VERIFIED | journalingAdapter wired; canonical key. |
| `src/core/workspace/WorkspaceElection.ts` | CAS + heartbeat + re-election + tie-break | ✗ FAILED | Heartbeat never published (CR-02). |
| `wxt.config.ts` | permissions exactly [sidePanel, storage, tabs, unlimitedStorage] | ✓ VERIFIED | Line 45 matches (REQ-R06). |
| `src/core/theme/chromeStorageAdapter.ts` | STORAGE_QUOTA / STORAGE_RATE_LIMIT + debounce + flush | ✓ VERIFIED | classifyStorageError implemented; flush on beforeunload/visibilitychange (REQ-R03/R07). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| journalingAdapter.setItem | WriteJournalDB entries | putEntry before inner.setItem (D-34) | ✓ WIRED | Immediate IDB put, then debounced inner write. |
| WorkspaceStore.persist | journalingAdapter | createJournalingAdapter storage | ✓ WIRED | Correct election-gated wiring. |
| boot recoverJournal | chromeStorageAdapter.setItem | stepFactory('np_workspace', ...) | ✗ NOT_WIRED | Reconstructs empty value from undefined entry fields (CR-01). |
| runHeartbeatTick | BroadcastBus WORKSPACE_HEARTBEAT | notifyWorkspaceHeartbeat | ✗ NOT_WIRED | Function has zero call sites; heartbeat never published (CR-02). |
| useExtensionStore partialize/migrate | np_store / np_providers | migrateProviderSecrets + partialize strip | ✓ WIRED | Plaintext stripped; ciphertext-only persist; decrypt-on-read. |
| workspace persist | chrome.storage.local.np_workspace | debounced adapter | ✓ WIRED | Canonical key + legacy lift. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| np_workspace reload-hydrate | workspaceId/conversationId | chromeStorageAdapter.getItem('np_workspace') | ✓ FLOWING | Tests 1/3/3b confirm. |
| np_providers secrets | apiKey/openAiKey/geminiKey | EncryptedStorage decrypt ← np_providers | ✓ FLOWING | secrets-inspection hydrate test. |
| journal recovery value | workspaceId | entry.workspaceId (never persisted) | ✗ DISCONNECTED | Recovery writes empty value (CR-01). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Verification gate | `pnpm run verify:phase-2` | exit 0, 109/109 tests | ✓ PASS |
| AES-GCM round-trip | EncryptedStorage.test.ts | round-trip + wrong-key + tamper pass | ✓ PASS |
| Secrets absent from local | secrets-inspection.test.ts | no plaintext substring | ✓ PASS |
| IDB v1→v2 migration | IndexedDBMigrator.test.ts | backward-compat + idempotent | ✓ PASS |
| Real boot recovery path | code inspection of main.tsx:75-78 | writes empty workspaceId | ✗ FAIL (CR-01) |
| Heartbeat published | `grep notifyWorkspaceHeartbeat src/ entrypoints/` | zero call sites (definition only) | ✗ FAIL (CR-02) |

### Probe Execution

No probe scripts (`scripts/*/tests/probe-*.sh`) are declared or present for this phase; verification relies on the vitest gate, which was run directly.

### Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| REQ-R03 | RESEARCH-RECONCILIATION.md §D | Coalesce np_workspace persists (debounce + flush); assert write-rate | ✓ SATISFIED | chromeStorageAdapter STORAGE_DEBOUNCE_MS=300 + flush on beforeunload/visibilitychange; WorkspacePersistence Test 6 (≤30/min). |
| REQ-R06 | RESEARCH-RECONCILIATION.md §D / ADR-STACK-02 | unlimitedStorage manifest permission when IDB ships | ✓ SATISFIED | wxt.config.ts:45 `['sidePanel','storage','tabs','unlimitedStorage']`. |
| REQ-R07 | RESEARCH-RECONCILIATION.md §D | Storage adapter surfaces STORAGE_QUOTA / STORAGE_RATE_LIMIT codes | ✓ SATISFIED | classifyStorageError (chromeStorageAdapter.ts:34-38) + reporter hook. |

All three phase requirement IDs are accounted for and satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| entrypoints/sidepanel/main.tsx | 75-78 | Empty reconstruction `?? ''` / `?? null` on recovery | 🛑 Blocker | Data loss on crash-recovery path (CR-01). |
| entrypoints/standalone/main.tsx | 76-77 | Identical empty reconstruction | 🛑 Blocker | Data loss on crash-recovery path (CR-01). |
| src/core/workspace/WorkspaceElection.ts | 246-284 | Documented heartbeat publish never called | 🛑 Blocker | Election tie-break/demotion dead in production (CR-02). |
| src/components/chat/SidepanelChat.tsx | 369-377 | Production UI imports `__test__` election seam | ⚠️ Warning | Couples UI to test internals (WR-01, from code review). |
| src/components/options/OptionsPage.tsx | 264 | `console.error` violates debugLog convention | ⚠️ Warning | Failure invisible to diagnostics surface (WR-02). |
| src/core/security/KeyVault.ts | 46-71 | Install secret stored in chrome.storage.local alongside ciphertext | ⚠️ Warning | Local-storage compromise defeats encryption; length-mismatch rotates root secret (WR-03, documented D-29 trade-off). |

No `TBD`/`FIXME`/`XXX` debt markers found in phase-2 files.

## Summary of Findings Against the Code-Review CRITICALs

Both code-review CRITICAL findings are **confirmed by independent inspection**:

- **CRITICAL-01 (BLOCKER):** The boot `recoverJournal` replay in both entrypoints reconstructs the `np_workspace` value from `entry.workspaceId`/`entry.conversationId`, which never exist on the metadata-only `WriteJournalEntry`. The `?? ''`/`?? null` fallbacks fire, so any crash recovery overwrites `np_workspace` with an empty workspaceId. The WriteJournal tests pass only because they register steps with a captured/hardcoded value rather than exercising the real boot reconstruction. **Success Criterion 1 FAILED.**
- **CRITICAL-02 (BLOCKER):** `runHeartbeatTick` never calls `notifyWorkspaceHeartbeat` (zero call sites). The election heartbeat is never published, so the standalone-wins tie-break demotion and the election-demotion mirror path never fire in production. The election test manually injects the heartbeat via `publish(..., _sender)` instead of the real tick. **Success Criterion 5 (cross-surface handoff tie-break) FAILED.**

These are code-observable defects, not merely unverified behavior, so they resolve to FAILED (gaps_found), not PRESENT_BEHAVIOR_UNVERIFIED.

### Human Verification Required

1. **Workspace persist-on-reload (SC5 happy path)** — Test: In a running extension, set workspace state, reload the surface, confirm workspaceId/conversationId restore without message loss and no scroll jump. Expected: state persists across reload; scroll preserved. Why human: the happy-path reload-hydrate is covered by automated tests, but the live extension runtime and "no scroll jump" UX cannot be verified by grep or vitest.

## Gaps Summary

The phase delivers a strong, well-tested encrypt-at-rest layer (SC2, SC3), a correct IndexedDB migration framework (SC4), and a correctly-wired workspace persist + coalescing (REQ-R03/R06/R07). But its two most important success criteria — crash-safe recovery (SC1) and cross-surface election handoff (SC5) — are broken by defects in the production wiring that the test suite does not exercise. Both are BLOCKERs and must be fixed before the phase goal ("WriteJournal prevents silent data loss across SW suspension"; "cross-surface handoff") is achieved.

---

_Verified: 2026-08-24T11:09:28Z_
_Verifier: the agent (gsd-verifier)_
