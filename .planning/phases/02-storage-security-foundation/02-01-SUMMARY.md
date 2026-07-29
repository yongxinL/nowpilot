---
phase: 02-storage-security-foundation
plan: 01
subsystem: storage
tags: [aes-gcm, pbkdf2, cryptography, zustand, chrome-storage, web-crypto-api]

requires:
  - phase: 01-project-scaffold-runtime-foundation
    provides: Test infrastructure (vitest, jsdom, chrome mocks), Zustand store patterns (ThemeStore), chromeStorageAdapter
provides:
  - CryptoService — AES-GCM-256 encryption/decryption with PBKDF2 key derivation (install secret, per-key salt, extensionId binding)
  - ApiKeyStore — Zustand+persist+immer store for encrypted provider API keys with chrome.storage.local persistence
  - Production-hardened CryptoService with input validation guards (IV length, type checks, storage error handling)
affects: [03-ai-provider-routing, 04-workspace-persistence]

tech-stack:
  added: []  # Uses built-in Web Crypto API only — no new dependencies
  patterns:
    - CryptoService singleton class (first class-based service in codebase)
    - Zustand+persist+immer store with CryptoService integration for encrypted at-rest data
    - Cross-realm ArrayBuffer type checking using Object.prototype.toString.call() (jsdom compatibility)

key-files:
  created:
    - src/core/storage/CryptoService.ts
    - src/core/storage/ApiKeyStore.ts
    - tests/core/storage/CryptoService.test.ts
    - tests/core/storage/ApiKeyStore.test.ts
  modified: []

key-decisions:
  - "CryptoService implemented as module-scoped singleton class (first class-based service pattern in codebase)"
  - "PBKDF2 with 100000 iterations, SHA-256, per-key 16-byte salt, extensionId binding for AES-GCM-256 key derivation"
  - "Derived key cache in chrome.storage.session deferred to Phase 3 (CryptoKey non-serializable; cache will be in-memory Map)"
  - "Cross-realm ArrayBuffer detection via Object.prototype.toString.call() for jsdom/Node.js Web Crypto compatibility"
  - "ApiKeyStore follows ThemeStore.ts Zustand+persist+immer pattern exactly with partialize for persisted state safety"

patterns-established:
  - "Singleton service class: export const + new Class() at module level"
  - "Encrypted store: Zustand persist stores plaintext-free ciphertext+salt+iv only via base64 encoding"
  - "Error handling: descriptive Error wrapping for crypto.subtle failures and storage unavailability"

requirements-completed: [STORAGE-01]

coverage:
  - id: D1
    description: "CryptoService.encrypt('test-key') produces { ciphertext, salt, iv } and decrypt returns the original plaintext (AES-GCM-256 round-trip)"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#encrypt/decrypt round-trip known string"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#encrypt/decrypt round-trip special characters"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#encrypt/decrypt round-trip empty string"
        status: pass
    human_judgment: false
  - id: D2
    description: "Install secret (np_install_secret) is generated once (32 random bytes via crypto.getRandomValues) and persisted in chrome.storage.local; subsequent getInstallSecret() calls return the same value"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#install secret generates once and returns same value"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#install secret persists across calls"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each encrypt() call produces a unique 16-byte salt and 12-byte IV (no reuse across calls)"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#unique salt and IV produce unique salt"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#unique salt and IV produce unique IV"
        status: pass
    human_judgment: false
  - id: D4
    description: "ApiKeyStore.setKey('openai', 'sk-abc123') stores encrypted ciphertext+salt+iv in chrome.storage.local under np_api_keys; plaintext never appears in stored value"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/ApiKeyStore.test.ts#setKey encrypts and stores in chrome.storage.local"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ApiKeyStore.test.ts#no plaintext in storage never stores plaintext API keys"
        status: pass
    human_judgment: false
  - id: D5
    description: "ApiKeyStore.getKey('openai') decrypts and returns 'sk-abc123'"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/ApiKeyStore.test.ts#getKey returns original plaintext"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ApiKeyStore.test.ts#getKey returns null for missing provider"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ApiKeyStore.test.ts#removeKey removes from store"
        status: pass
    human_judgment: false
  - id: D6
    description: "CryptoService edge case hardening: large input (10KB), Unicode, wrong IV length, non-ArrayBuffer input, chrome.storage unavailability, base64 round-trip"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#edge cases large input 10KB"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#edge cases Unicode emoji/CJK/combining marks"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#edge cases input validation wrong IV length"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#edge cases input validation TypeError for non-ArrayBuffer"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#edge cases storage unavailability throws clear error"
        status: pass
      - kind: unit
        ref: "tests/core/storage/CryptoService.test.ts#edge cases base64 round-trip via bytesToBase64/base64ToBytes"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-07-29
status: complete
---

# Phase 02 Plan 01: Encrypted Storage Foundation — Summary

**AES-GCM-256 encrypted API key storage with PBKDF2 key derivation, install secret generation, and Zustand encrypted store**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-29T22:07:45Z
- **Completed:** 2026-07-29T22:14:45Z
- **Tasks:** 2 (1 tracer, 1 auto/tdd)
- **Files modified:** 2 (CryptoService.ts, CryptoService.test.ts)

## Accomplishments

- CryptoService class with AES-GCM-256 encrypt/decrypt, PBKDF2 key derivation (100k iterations, SHA-256, extensionId binding)
- Install secret (np_install_secret) generated once (32 random bytes) via crypto.getRandomValues, persisted in chrome.storage.local
- ApiKeyStore Zustand+persist+immer store with encrypted key storage (no plaintext in chrome.storage.local)
- End-to-end encrypt→store→decrypt pipeline proven with 14 tracer tests
- Production-hardened CryptoService with 6 additional edge case suites:
  - 10KB input round-trip verified
  - Unicode (emoji, CJK, combining marks) round-trip verified
  - Wrong IV length (not 12 bytes) throws descriptive error
  - Non-ArrayBuffer ciphertext throws TypeError
  - chrome.storage.local unavailability throws clear error message
  - Base64 round-trip verified for various byte arrays
- Cross-realm ArrayBuffer type checking via `Object.prototype.toString.call()` for jsdom compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end encrypt→store→decrypt tracer** — Implementation files already existed in repo from prior execution; tests verified passing (14 tests)
2. **Task 2: CryptoService edge case hardening** — TDD RED/GREEN flow:
   - `d5a0a74` — `test(02-01): add edge case tests for CryptoService hardening`
   - `de384d7` — `feat(02-01): harden CryptoService with input validation and error handling`

**Plan metadata:** *(committed below)*

## Files Created/Modified

- `src/core/storage/CryptoService.ts` - AES-GCM-256 encryption/decryption with PBKDF2 key derivation, install secret management, input validation guards
- `src/core/storage/ApiKeyStore.ts` - Zustand+persist+immer store for encrypted provider API keys with chrome.storage.local persistence
- `tests/core/storage/CryptoService.test.ts` - 17 tests: round-trip, install secret, unique salt/IV, error handling, large input, Unicode, input validation, storage unavailability, base64 round-trip
- `tests/core/storage/ApiKeyStore.test.ts` - 5 tests: setKey encrypts, getKey returns plaintext, no plaintext in storage, missing returns null, removeKey

## Decisions Made

- **CryptoService as singleton class:** First class-based service in codebase, following the module-scoped singleton pattern from PATTERNS.md Shared Patterns
- **PBKDF2 parameters:** 100000 iterations, SHA-256, per-key 16-byte salt — per D-02 for brute-force resistance
- **ExtensionId binding:** Key material = `base64(installSecret) + chrome.runtime.id` — prevents key reuse across extension instances
- **Zustand+persist+immer for ApiKeyStore:** Follows ThemeStore.ts pattern exactly — `partialize: (state) => ({ keys: state.keys })` ensures action methods are never persisted
- **Derived key cache deferred to Phase 3:** Non-extractable CryptoKey cannot be serialized to chrome.storage.session; cache will be in-memory Map in Phase 3 when ProviderRouter needs fast key access
- **Cross-realm ArrayBuffer detection:** `Object.prototype.toString.call(ciphertext)` instead of `instanceof` — essential for jsdom test environment where Node.js WebCrypto returns ArrayBuffers from a different realm
- **Base64 for chrome.storage persistence:** ArrayBuffer/Uint8Array always base64-encoded before storage (chrome.storage only supports JSON-serializable values)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cross-realm ArrayBuffer instanceof fails in jsdom**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** `ciphertext instanceof ArrayBuffer` returned false for Node.js Web Crypto ArrayBuffers running in jsdom test environment (different realm)
- **Fix:** Replaced `instanceof` with `Object.prototype.toString.call()` for cross-realm-safe type detection
- **Files modified:** `src/core/storage/CryptoService.ts`
- **Verification:** All 17 CryptoService tests pass
- **Committed in:** `de384d7` (Task 2 commit)

**2. [Rule 3 - Blocking] Apache-licensed codebase-memory-mcp files found in repository**
- **Details:** See forensics report
- **Resolution:** Documented in 02-FORENSICS.md

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for correctness in jsdom test environment. No scope creep.

## Issues Encountered

- `crypto.subtle.encrypt()` in Node.js returns an ArrayBuffer from a different JavaScript realm than jsdom's global ArrayBuffer constructor, causing `instanceof ArrayBuffer` to fail. Resolved with `Object.prototype.toString.call()` type detection.

## Next Phase Readiness

- CryptoService and ApiKeyStore are proven and locked — downstream stores (WriteJournal, SessionStore) and Phase 3 ProviderRouter can depend on the published contracts
- Next plan (02-02) builds WriteJournal with startup replay for multi-store consistency
- Encrypted payload shape and PBKDF2 parameters are now one-way contracts — any change requires re-encrypting all stored keys

---

*Phase: 02-storage-security-foundation*
*Completed: 2026-07-29*
