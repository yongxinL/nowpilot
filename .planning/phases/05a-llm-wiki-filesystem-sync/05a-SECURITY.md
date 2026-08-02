---
phase: 05a
slug: llm-wiki-filesystem-sync
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-02
---

# Phase 05a — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| app → backup filesystem | untrusted external files (user-edited .md, files created by other tools) live on the same disk the app writes; lastModified/frontmatter can be tampered or stale | note content + YAML frontmatter (.md) |
| NotesDB write paths → EventBus → NoteFileSync cleanup | delete/rename events carry note identity (title/categoryPath) used to compute filesystem paths; a stale or fabricated payload could delete the wrong file | note identity fields |
| LLM output → NoteQA citations | the LLM is untrusted for factual claims about note identity (noteId/title) — only snippet data derived from the actual index is authoritative | citation objects |
| regression gate | a red baseline must never be committed — fixes that break pre-existing tests fail the gate | test suite state |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05a-01 | Tampering | NoteFileSync.syncNote collision guard (CR-02) | high | mitigate | frontmatter-id ownership check — `selectTargetFile`/`collideFileName` never overwrite a file whose frontmatter id differs (tests NoteFileSync.test.ts L1225/L1263) | closed |
| T-05a-02 | Tampering | NoteFileSync.persistHandle/loadPersistedHandle (CR-01) | high | mitigate | native handles persisted via structured clone; snapshot only for test doubles; UAT-verified in real Chrome — handle survived IndexedDB + extension restart, permission granted, post-restart writes without re-selection | closed |
| T-05a-03 | Tampering | syncNote external-change guard (D-11) | medium | mitigate | 2s tolerance + ownership check preserved; newer external file never overwritten — write falls through to a suffixed file | closed |
| T-05a-04 | Spoofing | NoteFileSync owned-file tracking (WR-04) | low | mitigate | lastSyncedFileName written via updateSyncState alongside lastSyncedAt; reused only when owned file not externally modified | closed |
| T-05a-05 | DoS | scheduleSync debounce (WR-01) | low | mitigate | per-note timer map prevents burst saves from silently dropping backups | closed |
| T-05a-06 | Tampering | NotesDB.remove() → note:deleted → handleNoteDelete | medium | mitigate | payload carries identity read from the fetched note BEFORE deletion; ownership-aware cleanup (c11f541 — resolves the collided-note deletion blocker); pending debounce cancelled | closed |
| T-05a-07 | Repudiation | note:renamed emission | low | mitigate | diff computed against persisted note inside the single save() path — no duplicate/missing events, no emit when unchanged | closed |
| T-05a-08 | Spoofing | NoteQA markerless fallback citations (WR-05) | medium | mitigate | citations rebuilt from snippets[referenceNumber-1] — LLM-supplied noteId/title/relevantSnippet never enter Citation[] | closed |
| T-05a-09 | Tampering | staleness timestamps (WR-03) | low | mitigate | diff-writer stamps only on APPLIED tags/summary changes; create path leaves timestamps unset — no false 'enriched' claims | closed |
| T-05a-10 | Tampering | regression gate (verify:phase-5a) | medium | mitigate | full gate green post-fixes: tsc clean + 150/150 tests across 9 files; isolation re-run rules out ordering flakiness | closed |
| T-05a-11 | Spoofing | deferred-items.md handoff | low | mitigate | every Phase 7 item recorded with concrete owner surface; backstop rows keep `verification: backstop` → human_needed rather than silent pass | closed |
| T-05a-SC | Tampering | npm/pip/cargo installs | low | accept | no new package installs in any plan — all changes are edits to existing source/test files | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-05a-01 | T-05a-SC (01/02/03) | Gap-closure plans introduce zero new dependencies — all changes are edits to existing source/test files (no supply-chain surface added) | planner (plan-time) | 2026-08-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-02 | 11 | 11 | 0 | the agent (L1 artifact verification, short-circuit: register_authored_at_plan_time=true, asvs_level=1, threats_open=0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02
