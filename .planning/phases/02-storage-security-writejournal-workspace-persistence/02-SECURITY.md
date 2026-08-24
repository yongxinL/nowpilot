---
phase: 02
slug: storage-security-writejournal-workspace-persistence
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-24
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| journal replay → chrome.storage.local | Boot `recoverWorkspaceJournal` writes the recovered `np_workspace` blob into `chrome.storage.local`. The value is the verbatim current blob re-read from the same store (idempotent restoration), not attacker-controlled input. | workspace metadata (non-secret) |
| surface↔surface (BroadcastChannel `np_workspace`) | Election heartbeats and workspace updates cross the BroadcastChannel between sidepanel and standalone. Any surface on the channel can emit a `WORKSPACE_HEARTBEAT`; the demotion rule trusts the `surface` field. | workspaceId, surface name (non-secret) |
| extension ↔ chrome.storage.local | Encrypted API keys persisted at rest. `np_providers` holds AES-GCM ciphertext only; plaintext never written. | encrypted secrets |
| extension ↔ WebCrypto | Key derivation + AES-GCM-256 encrypt/decrypt in UI contexts. | key material (in-memory only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01-SC | Tampering | idb / fake-indexeddb installs | high | mitigate | Package Legitimacy Audit completed; both packages OK, no `postinstall`, versions re-queried from registry (VAI-04) | closed |
| T-02-01-01 | Tampering | tests/setup.ts mocks | low | accept | Mock fidelity best-effort by design; residual divergence surfaces as test failures | closed |
| T-02-02-01 | Information Disclosure | plaintext API keys at rest (CONCERNS finding) | critical | mitigate | AES-GCM-256 via WebCrypto (KeyVault + EncryptedStorage); `np_store` partialize empties secret fields; `np_providers` ciphertext-only; inspection gate asserts substring absence in storage map | closed |
| T-02-02-02 | Information Disclosure | secret leakage into logs / ErrorStore | medium | mitigate | redactSensitive() runs at every persist/log boundary (D-39/§16.5); key values never passed to debugLog | closed |
| T-02-02-03 | Tampering | persisted ciphertext | medium | mitigate | AES-GCM authenticated encryption — decrypt rejects on any modification; wrong-key/tamper rejection test | closed |
| T-02-02-04 | Availability | key loss on reinstall | high | accept | D-29 user-locked one-way trade-off: no rotation/recovery/export in v0.1; `np_install_secret` never duplicated (documented, accepted) | closed |
| T-02-02-05 | Information Disclosure | stored key echoed into Options field/aria/hint/copy | medium | mitigate | UI-SPEC masked-field contract: plaintext pre-fill removed, placeholder only, never-echo backstop test | closed |
| T-02-02-06 | Tampering | key derivation instability | medium | mitigate | stable inputs only (installSecret + chrome.runtime.id per §15.2); navigator.userAgent forbidden | closed |
| T-02-03-01 | Denial of Service | unbounded request lifetime | low | mitigate | 25s default timeout via AbortController (matches PROXY_FETCH per §10.7); timeout path unit-tested | closed |
| T-02-03-02 | Denial of Service | rate-limit bypass / throttling absence | low | mitigate | optional injected per-instance RateLimiter (D-37); acquire() gate precedes fetch; RATE_LIMITED surfaced with canonical code | closed |
| T-02-03-03 | Information Disclosure | error context leaking request/secret details | low | mitigate | classification keeps only code + generic message; no body echo; no consumers until Phase 3 (residual seam accepted — revisit at Phase 3) | closed |
| T-02-04-01 | Tampering | IDB upgrade replay / duplicate store creation | medium | mitigate | conditional `if (oldVersion < N)` blocks + skip-if-present guards; v1→v2 fixture proves idempotency (Pitfall 8) | closed |
| T-02-04-02 | Denial of Service | IDB quota/eviction of large bodies | medium | mitigate | `unlimitedStorage` permission (REQ-R06/ADR-STACK-02) exempts the origin | closed |
| T-02-04-03 | Denial of Service | blocked/failed DB migration blocking extension | medium | mitigate | IDB_BLOCKED / IDB_MIGRATION_FAILED → ErrorStore + degraded mode: only failed DB disabled, other stores continue (D-41) | closed |
| T-02-04-04 | Information Disclosure | sensitive context persisted in ErrorStore | low | mitigate | redactSensitive at the ErrorStore write boundary (D-39/§16.5); debug-only store | closed |
| T-02-04-05 | Tampering | session-storage cap overflow (unlimitedStorage misread) | low | accept | `unlimitedStorage` does not lift the session 10MB cap (Pitfall 7); np_workspace_primary records stay tiny — documented in wxt.config comment | closed |
| T-02-05-01 | Availability | SW suspension mid-write loses workspace state | high | mitigate | pending→applying→completed journal ordering (O.11) + recoverWorkspaceJournal on boot (plan 02-07/02-08); idempotent replay; rollback on step failure — proven by SW-kill recovery test (criterion 1) and corrected Test 5/Test 1 | closed |
| T-02-05-02 | Information Disclosure | message bodies or user content in journal entries | medium | mitigate | entries are metadata-only (D-33); schema carries id/operation/status/attempts/steps/createdAt only | closed |
| T-02-05-03 | Integrity | recovery replay ordering skew | low | mitigate | journal-entry writes are immediate (bypass debounce) so recovery sees exact ordering (D-34) | closed |
| T-02-05-04 | Availability | residual ≤300ms debounce crash window | low | accept | documented residual (T-01-12): flush hooks cover beforeunload/visibilitychange; hard crash inside the window may leave entry 'applying' and replay next boot | closed |
| T-02-05-05 | Integrity | dual workspace keys (np_workspace_store vs np_workspace) diverging | low | mitigate | one-time legacy-key lift (read→write→verify→delete) makes np_workspace the sole key; idempotent and tested | closed |
| T-02-06-01 | Spoofing | stale/false election primary record | medium | mitigate | electedAt freshness check + 2-miss re-election + CAS on np_workspace_primary; record lives in session — §20.11 rules unit-tested | closed |
| T-02-06-02 | Denial of Service | silent storage write loss (quota/rate-limit) | high | mitigate | classifyStorageError → STORAGE_QUOTA / STORAGE_RATE_LIMIT → ErrorStore + debugLog; never swallowed (REQ-R07/D-39); D-22 debounce keeps steady-state ≤30/min (asserted in plan 02-07) | closed |
| T-02-06-03 | Spoofing | lone-surface heartbeat ambiguity | low | mitigate | solo detection via session-record freshness (Pitfall 4); 1-surface and 2-surface cases unit-tested | closed |
| T-02-06-04 | Integrity | invented error codes breaking the closed-set audit | medium | mitigate | exactly two additions (STORAGE_QUOTA, STORAGE_RATE_LIMIT); election errors reuse WORKSPACE_ELECTION_TIMEOUT / WORKSPACE_STORAGE_UNAVAILABLE; grep audit in verification | closed |
| T-02-07-01 | Integrity | secondary surface overwriting primary state (write conflict) | medium | mitigate | election-gated persist: non-primary setItem no-ops (D-27); mirror-only semantics asserted in integration test | closed |
| T-02-07-02 | Availability | workspace state loss on reload / handoff / SW suspension | high | mitigate | journaled persist (pending→completed) + recoverWorkspaceJournal on boot + legacy-key lift; reload and handoff paths asserted with no message loss (success criterion 5); UAT verified live reload | closed |
| T-02-07-03 | Integrity | legacy np_workspace_store blob divergence after the key rename | low | mitigate | one-time lift (read→write→verify→delete) idempotent and adapter-owned (plan 02-05); canonical np_workspace key only | closed |
| T-02-07-04 | Information Disclosure | storage errors surfaced to the user UI | low | mitigate | UI-SPEC contract: STORAGE_QUOTA/STORAGE_RATE_LIMIT/IDB_MIGRATION_FAILED → ErrorStore + debugLog only | closed |
| T-02-07-05 | Denial of Service | write-rate blowup exceeding chrome.storage throttle | medium | mitigate | D-43 budget: heartbeat 20/min + journal immediate + debounce 300ms; ≤30/min steady-state assertion in integration test | closed |
| T-02-08-01 | Tampering / Integrity | np_workspace crash recovery (CR-01) | high | mitigate | `recoverWorkspaceJournal` re-applies the CURRENT stored np_workspace value verbatim (idempotent) instead of reconstructing an empty placeholder; proven by corrected Test 5 / Test 1 driving the real boot path | closed |
| T-02-08-02 | Data integrity (crash mid-recovery) | runJournaled + persistEntry | medium | mitigate | runJournaled transitions pending→applying→completed and rolls back on step failure; entry stays in WriteJournalDB so a crash mid-recovery replays next boot (idempotent apply) | closed |
| T-02-08-03 | Spoofing | recovered np_workspace value | low | accept | recovery source is the local chrome.storage area the extension owns; compromised local store is out of threat model scope (D-29) | closed |
| T-02-08-04 | DoS / write-rate | recovery write burst | low | accept | recovery replays at most a handful of pending entries once at boot, through the 300ms debounced adapter, well under D-43 ≤30/min budget | closed |
| T-02-08-SC | Tampering | npm installs (no new deps) | low | mitigate | No new package installed by this plan; package-legitimacy gate N/A | closed |
| T-02-09-01 | Spoofing | `WORKSPACE_HEARTBEAT.surface` field | medium | mitigate | demotion only to `secondary` (read-only mirror, D-27) — never grants write access; no privilege escalation; heartbeat workspaceId not trusted by any Phase 2 consumer | closed |
| T-02-09-02 | Tampering | session record `np_workspace_primary` | high | mitigate | Election CAS + 6s stale threshold re-elect on tampered/stale record; fix does not weaken this; heartbeat publish is additive; self-suppression by instance id prevents observing own heartbeat as foreign | closed |
| T-02-09-03 | DoS | heartbeat flood on `np_workspace` | low | accept | one heartbeat per 3s tick per primary/solo surface (≤ 1/3s/surface), far under throttle; in-memory broadcast, no persistence cost | closed |
| T-02-09-04 | Information Disclosure | workspaceId in heartbeat payload | low | accept | workspaceId is a non-secret coordination identifier already present in np_workspace; not a credential | closed |
| T-02-09-SC | Tampering | npm installs (no new deps) | low | mitigate | No new package installed by this plan; package-legitimacy gate N/A | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|-----------|-----------|-------------|------|
| AR-02-01 | T-02-01-01 | Mock fidelity best-effort by design; divergence surfaces as test failures, not silent production risk | Phase 2 planning | 2026-08-24 |
| AR-02-02 | T-02-02-04 | D-29 user-locked trade-off: key loss on reinstall accepted — no rotation/recovery/export in v0.1; np_install_secret never duplicated | Phase 2 planning (D-29) | 2026-08-24 |
| AR-02-03 | T-02-04-05 | unlimitedStorage does not lift session 10MB cap; np_workspace_primary records stay tiny | Phase 2 planning (Pitfall 7) | 2026-08-24 |
| AR-02-04 | T-02-05-04 | Residual ≤300ms debounce crash window accepted; flush hooks cover beforeunload/visibilitychange; entry replays next boot | Phase 2 planning (T-01-12) | 2026-08-24 |
| AR-02-05 | T-02-08-03 | Recovery source is the locally-owned chrome.storage area; compromised store out of scope (D-29) | Phase 2 gap planning | 2026-08-24 |
| AR-02-06 | T-02-08-04 | Recovery write burst is at most a handful of entries once at boot, within D-43 budget | Phase 2 gap planning | 2026-08-24 |
| AR-02-07 | T-02-09-03 | Heartbeat rate ≤1/3s/surface far under throttle; in-memory broadcast | Phase 2 gap planning | 2026-08-24 |
| AR-02-08 | T-02-09-04 | workspaceId is a non-secret coordination identifier, not a credential | Phase 2 gap planning | 2026-08-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-24 | 42 | 42 | 0 | gsd-security-auditor (L1 grep-depth, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-24

**L1 spot-checks performed:** EncryptedStorage AES-GCM ciphertext + secrets-inspection gate (T-02-02-01); `recoverWorkspaceJournal` re-applies current value (T-02-08-01); `notifyWorkspaceHeartbeat` published in `runHeartbeatTick` (T-02-09-02); STORAGE_QUOTA/STORAGE_RATE_LIMIT classification (T-02-06-02). `pnpm run verify:phase-2` green (tsc + 109 tests). UAT: 1/1 passed (live reload state restore, no scroll jump).