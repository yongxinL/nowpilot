---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 02
subsystem: security
tags: [redaction, traceredactor, redactsensitive, r-10, o-13, security]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-01 storage foundation — redaction fixture builder (buildRedactionFixture), fake-indexeddb harness, error code registry shape
provides:
  - TraceRedactor real body: REDACTION_PATTERNS (six Appendix O.13 patterns) scrubbing every string to the literal [REDACTED] token — replaces the Phase-1 pass-through placeholder, signature byte-identical
  - redactSensitive(value): field-level redaction for storage-bound values — recursive string scrubbing, password-like field DROP (never masked), vault-envelope passthrough
  - SENSITIVE_FIELD_KEYS (exported dropped-key set: password/secret/token/authorization) + isVaultEnvelope guard
  - redactSensitive.test.ts: 7 tests via the shared 02-01 fixture proving O.13 scrubbing, DROP, and envelope passthrough
affects: [02-04 WriteJournalDB persist, 02-06 ErrorStore write, 02-09 export serialization, 02-10 sync shadow, 02-11 verification, Phase 6 AITransactionLogDB consumers]

# Tech tracking
tech-stack:
  added: [] # no new dependencies — built on existing TraceRedactor module + vitest
  patterns:
    - "Stable-signature swap: replacing a module body while keeping the exported signature byte-identical gives zero caller churn (debugLog.ts untouched)"
    - "Write-boundary redaction hook (R-10/D-16): redactSensitive is the field-level hook every Phase-2 sink (ErrorStore, journal, export) imports at its write boundary — consumers wired per-plan in 02-04/02-06/02-09"
    - "Vault-envelope guard: isVaultEnvelope() returns {salt, iv, ciphertext} byte-array shapes structurally unchanged so already-encrypted data is never re-redacted (RESEARCH Pattern 6 design note)"

key-files:
  created:
    - src/core/security/redactSensitive.ts
    - tests/core/security/redactSensitive.test.ts
  modified:
    - src/core/security/TraceRedactor.ts

key-decisions:
  - "Password-like keys (password/secret/token/authorization, normalized lowercase+alphanumeric-only) are DROPPED wholesale — the key is absent from the result, never present as a masked value (A-05/D-16, T-2-02-02)"
  - "apiKey values are redacted inline, NOT dropped (D-16 explicit distinction) — the fixture's apiKey field is asserted as '[REDACTED]' present, while password is asserted absent"
  - "Vault ciphertext envelope ({salt, iv, ciphertext} with byte-array fields) passes through redactSensitive structurally unchanged via the exported isVaultEnvelope guard (T-2-02-03, RESEARCH Pattern 6)"
  - "TraceRedactor keeps its exported redact(s: string): string signature byte-identical — the pass-through placeholder body is replaced without touching debugLog.ts or any caller"

patterns-established:
  - "Pattern 1: O.13 verbatim regex list as module-level REDACTION_PATTERNS const — never invent patterns; spec lines 6686-6694 are the canonical source, kept in sync"
  - "Pattern 2: field-level redaction with normalized-key matching — lowercase + strip non-alphanumerics before set membership, so API_KEY/api-key/API Key all match"
  - "Pattern 3: tests build input from the shared 02-01 fixture builder (D-20/21) — same deterministic scenario the integration paths use"

requirements-completed: [STORAGE-01, STORAGE-03]

coverage:
  - id: D1
    description: "TraceRedactor real body — the six Appendix O.13 patterns (sk-, key-, Bearer, JSESSIONID, sysparm_ck, g_ck) replace every match with the literal [REDACTED] token; pass-through placeholder gone; exported signature stable"
    requirement: STORAGE-03
    verification:
      - kind: unit
        ref: "tests/core/security/redactSensitive.test.ts#redacts every message the shared fixture carries, never leaving the original substring"
        status: pass
      - kind: other
        ref: "grep -c REDACTION_PATTERNS src/core/security/TraceRedactor.ts == 3; grep -c '\\[REDACTED\\]' == 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "redactSensitive field-level redaction — recursive string scrubbing, password-like key DROP (absent, never masked), apiKey redacted inline, vault envelope structural passthrough via isVaultEnvelope"
    requirement: STORAGE-03
    verification:
      - kind: unit
        ref: "tests/core/security/redactSensitive.test.ts#drops the password-like key (absent, never masked) and redacts sibling fields inline"
        status: pass
      - kind: unit
        ref: "tests/core/security/redactSensitive.test.ts#returns the {salt, iv, ciphertext} envelope structurally unchanged"
        status: pass
      - kind: other
        ref: "grep -c 'export function redactSensitive' == 1; grep -c SENSITIVE_FIELD_KEYS >= 1; grep -c isVaultEnvelope >= 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Redaction behavior proven via the shared 02-01 buildRedactionFixture builder — 7 tests covering string scrubbing (all six patterns), field-level DROP, nested recursion, envelope passthrough, and the error-message routing precedent"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/security/redactSensitive.test.ts — 7 tests pass, imports buildRedactionFixture from tests/fixtures (D-21)"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 2: Redaction Before Persist Summary

**Real redaction shipped (D-16/R-10): TraceRedactor's pass-through placeholder replaced with the verbatim Appendix O.13 six-pattern body scrubbing every string to [REDACTED] (zero caller churn — debugLog untouched), plus the new redactSensitive field-level hook that DROPS password-like fields, redacts apiKey inline, and passes the vault ciphertext envelope through untouched — proven by 7 tests built on the shared 02-01 redaction fixture**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-09T03:28:29Z
- **Completed:** 2026-08-09T03:35:20Z
- **Tasks:** 3
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- **TraceRedactor real body:** replaced the Phase-1 pass-through placeholder with `REDACTION_PATTERNS` — the six O.13 patterns verbatim (sk-…, key-…, Bearer … case-insensitive, JSESSIONID=…, sysparm_ck=…, g_ck=…) — with a reduce that replaces every match with the literal `[REDACTED]` token. Signature `redact(s: string): string` byte-identical, so debugLog and every caller need zero changes (verified: debugLog.ts diff is empty).
- **redactSensitive.ts (D-16):** field-level redaction for storage-bound values. Strings → TraceRedactor.redact; plain objects → recursive per enumerable own string property with normalized-key (lowercase + strip non-alphanumerics) set membership against exported `SENSITIVE_FIELD_KEYS` ({password, secret, token, authorization}) → DROPPED wholesale (key absent, never masked — A-05); apiKey redacted inline (not dropped); arrays → recurse per element; primitives/non-plain objects → unchanged.
- **Vault-envelope guard (T-2-02-03):** exported `isVaultEnvelope()` recognizes `{ salt, iv, ciphertext }` with byte-array-like fields and returns such values structurally unchanged — already-encrypted ciphertext is never re-redacted (RESEARCH Pattern 6 design note).
- **7-test suite via the shared fixture:** all tests build input from `buildRedactionFixture` (02-01, D-20/21) — proving O.13 scrubbing with original-substring never surviving, the DROP contract (password key absent, apiKey '[REDACTED]' present), nested recursion, envelope passthrough + non-envelope rejection, and the string-form error-message routing precedent ErrorStore/journal will use.
- **Full suite green:** 185 tests pass (178 baseline + 7 new); typecheck, eslint, and prettier clean; the hook is ready for its Phase-2 consumers (WriteJournalDB 02-04, ErrorStore 02-06, export 02-09).

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace TraceRedactor pass-through body with the O.13 regex body** - `d008de9` (feat)
2. **Task 2: Create redactSensitive.ts — field-level redaction with password DROP** - `6013c3c` (feat)
3. **Task 3: redactSensitive.test.ts — the redaction fixture proves patterns, DROP, and envelope passthrough** - `7728641` (test)

## Files Created/Modified

- `src/core/security/TraceRedactor.ts` - Modified. Real body: `REDACTION_PATTERNS` (O.13 verbatim, six patterns) + reduce to `[REDACTED]`; TODO(security-phase) placeholder note removed; header now states this is the canonical R-10 body sourced from Appendix O.13
- `src/core/security/redactSensitive.ts` - Created. `redactSensitive(value: unknown): unknown` + exported `SENSITIVE_FIELD_KEYS` (dropped-key set) + exported `isVaultEnvelope()` guard; header cites §16.5 + D-16 + RESEARCH Pattern 6
- `tests/core/security/redactSensitive.test.ts` - Created. 7 tests across 4 describe blocks covering the plan's 4 required cases

## Decisions Made

- **DROP set = {password, secret, token, authorization}:** password-like keys are dropped wholesale (key absent) — never masked, because masking would leak the value's shape into storage (A-05 / T-2-02-02, D-16)
- **apiKey redacted inline:** explicitly NOT in the drop set — the fixture asserts `apiKey: '[REDACTED]'` present while `password` is asserted absent (the plan's "apikey is redacted inline not dropped" distinction)
- **Envelope passthrough over re-redaction:** the {salt, iv, ciphertext} byte-array shape short-circuits before field iteration — re-running patterns over encrypted bytes is harmless but wasteful, and structural identity is preserved (T-2-02-03)
- **Non-plain objects pass through:** redactSensitive recurses only into plain objects and arrays; class instances/Dates/etc. are returned unchanged (the storage-bound contract is JSON-ish plain data)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Style] Prettier format drift on two new files**
- **Found during:** Task 3 verification (`prettier --check` in the plan `<verification>` chain)
- **Issue:** `redactSensitive.ts` and `redactSensitive.test.ts` failed `prettier --check` (multi-line boolean chains collapsed by the 100-col print width)
- **Fix:** Ran `prettier --write` on both files — formatting only, zero behavior change; tests re-run green afterward
- **Files modified:** src/core/security/redactSensitive.ts, tests/core/security/redactSensitive.test.ts
- **Verification:** `prettier --check` clean; `pnpm vitest run tests/core/security/redactSensitive.test.ts` 7/7 pass
- **Committed in:** `7728641` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 style)
**Impact on plan:** No scope creep; the fix brought the new files into the verify:phase-2 prettier gate. All behavior-shaping decisions (DROP set contents, apiKey inline handling, envelope passthrough) followed the plan exactly as written.

## Issues Encountered

- None. The Task 1 acceptance grep `from '@/core/security/TraceRedactor'` counts 2 after Task 2 — expected: the new redactSensitive.ts imports TraceRedactor (the plan's own Task 2 read_first lists it as "the string primitive it builds on"). The pre-existing caller baseline (debugLog.ts only) is unchanged and untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The hook exists before its sinks:** redactSensitive + the real TraceRedactor body ship now (D-16), so 02-04 (WriteJournalDB persist), 02-06 (ErrorStore write), and 02-09 (export serialization) only add consumers — each carries its own redaction-before-write acceptance check (T-2-02-04).
- **Callers of the integration path:** the shared buildRedactionFixture from 02-01 is proven against the real redaction behavior — the WorkspacePersistence integration test and the redaction fixture consumers can import the same builders.
- **No blockers.** Full suite 185/185 green; typecheck/eslint/prettier clean.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created/modified files verified on disk: `src/core/security/TraceRedactor.ts`, `src/core/security/redactSensitive.ts`, `tests/core/security/redactSensitive.test.ts`, `02-02-SUMMARY.md`
- Commits verified in git log: `d008de9` (Task 1), `6013c3c` (Task 2), `7728641` (Task 3)
- Full verification: `pnpm typecheck` clean, eslint clean, prettier clean, full vitest suite 185/185 green (178 baseline + 7 new)
- Caller baseline: debugLog.ts byte-identical (git diff empty); the +1 import count is the new redactSensitive.ts consumer
