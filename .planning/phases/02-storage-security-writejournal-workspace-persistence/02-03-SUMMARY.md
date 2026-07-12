---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 03
subsystem: storage
tags: [aes-gcm, pbkdf2, webcrypto, chrome-storage, encryption]
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: Storage test infrastructure (02-01), set of chrome.storage mocks
provides:
  - EncryptedStorage class — transparent AES-GCM-256 wrapper around chrome.storage.local
  - PBKDF2 key derivation from install secret + extensionId
  - Per-value unique 16-byte salt and 12-byte IV
affects:
  - Plan 02-08 (providerStore encryption integration)
tech-stack:
  added: [Web Crypto API (crypto.subtle)]
  patterns:
    - Class + singleton with private initialized flag and lazy auto-init
    - chrome.storage.local get/set/remove adapter matching Zustand StateStorage shape
    - ArrayBuffer → number[] serialization for chrome.storage JSON compatibility
key-files:
  created:
    - src/core/storage/EncryptedStorage.ts
    - tests/core/storage/EncryptedStorage.test.ts
  modified: []
key-decisions:
  - "EncryptedPayload uses number[] instead of ArrayBuffer for salt/iv/ciphertext — chrome.storage.local serializes to JSON and ArrayBuffer is not JSON-serializable"
  - "Used vi.stubGlobal to override crypto.subtle in tests since Node.js 20+ provides native crypto.subtle (setup.ts conditional stub does not apply)"
  - "Used vi.mocked() with ReturnType<typeof vi.fn> casts for type-safe chrome.storage mock access (avoids @types/chrome return type conflicts)"
patterns-established:
  - "EncryptedStorage class + singleton: follows same pattern as SidepanelPageRegistry and IndexedDBManager in src/core/storage/"
requirements-completed:
  - STOR-02
coverage:
  - id: D1
    description: "EncryptedStorage class with PBKDF2-derived AES-GCM-256 master key, per-value salt/IV, and chrome.storage.local persistence"
    requirement: STOR-02
    verification:
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#creates np_install_secret if not present"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#reuses existing np_install_secret"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#set() then get() round-trip preserves original value"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#generates unique salt and IV each call"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#returns null for non-existent key"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#remove calls chrome.storage.local.remove"
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-12
status: complete
---

# Phase 2 Plan 3: EncryptedStorage with AES-GCM-256 and PBKDF2 Key Derivation

**Transparent AES-GCM-256 encryption wrapper around chrome.storage.local with PBKDF2 key derivation from install secret, per-value unique salt+IV, and lazy auto-init — implementing decisions D-10 through D-14.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-12T08:54:18Z
- **Completed:** 2026-07-12T09:01:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `EncryptedStorage` class with `initialize()`/`set()`/`get()`/`remove()` API
- PBKDF2 key derivation: `PBKDF2(installSecret + extensionId, masterSalt)` → AES-GCM-256 master key with 100,000 iterations
- Per-value encryption: 16-byte random salt + 12-byte random IV via `crypto.getRandomValues()`, unique per `set()` call
- Encrypted payload stored as JSON-compatible `number[]` arrays (not `ArrayBuffer`)
- Lazy auto-init: `ensureInitialized()` calls `initialize()` transparently on first `set`/`get` call
- Singleton export `encryptedStorage` ready for consumer stores
- 6-test test suite covering secret lifecycle, round-trip encryption, salt/IV uniqueness, null handling, and remove delegation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EncryptedStorage.ts with AES-GCM wrapper** - `366eece` (feat)
2. **Task 2: Create EncryptedStorage tests** - `df43ae2` (test)

**Plan metadata:** (pending metadata commit)

## Files Created/Modified

- `src/core/storage/EncryptedStorage.ts` - EncryptedStorage class (+ interface `EncryptedPayload`, singleton `encryptedStorage`)
- `tests/core/storage/EncryptedStorage.test.ts` - 6 test cases for EncryptedStorage

## Decisions Made

- **number[] vs ArrayBuffer for EncryptedPayload:** `chrome.storage.local` serializes values to JSON. `ArrayBuffer` is not JSON-serializable, so salt/iv/ciphertext are stored as `number[]` and converted back to `Uint8Array` on retrieval.
- **Test crypto mocking strategy:** Node.js 20+ provides native `crypto.subtle`, so the conditional stub in `tests/setup.ts` does not apply. The test uses `vi.stubGlobal('crypto', ...)` in `beforeEach` with vitest mock functions for all `subtle` methods.
- **Mock type safety:** Used `ReturnType<typeof vi.fn>` wrapper variables for `chrome.storage.local` mocks to avoid `@types/chrome` type conflicts with `vi.mocked()`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Node.js 20+ has native `crypto.subtle`, so the conditional stub in `tests/setup.ts` (which checks `typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle`) does NOT mock it. Had to use `vi.stubGlobal('crypto', {...})` in test `beforeEach` with vitest mocks for all crypto methods.
- `vi.clearAllMocks()` calls `mockClear()` (keeping implementations) but test-specific `mockReset()` calls can clear implementations across tests. Fixed by explicitly re-establishing chrome mock implementations in `beforeEach` after `vi.clearAllMocks()`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EncryptedStorage complete with full test coverage
- Ready for Plan 04 (WriteJournal) or subsequent plans that consume EncryptedStorage

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-07-12*
