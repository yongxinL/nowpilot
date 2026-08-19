# ADR-STACK-02 — Add `unlimitedStorage` permission at Phase 2

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** George Li (product owner / architect)
- **Decides:** RESEARCH-RECONCILIATION.md REQ-R06 / §F
- **Related:** STACK.md ("If IndexedDB ships" pattern), PITFALLS.md P2/P15, spec §16.4, spec §15.1, Appendix G

## Context

Phase 2 introduces IndexedDB (`idb@^8`) for message/note/memory bodies, WriteJournal, and the AITransactionLog. Without the `unlimitedStorage` permission, the extension origin is subject to the browser's default quota and eviction policy, which can evict IndexedDB data under storage pressure. `navigator.storage.persist()` is **not** a reliable substitute in extensions.

The spec's manifest permission list (§16.4) and the canonical `wxt.config.ts` manifest (Appendix G) do **not** currently declare `unlimitedStorage`. Adding it is therefore a spec-scope change, and it is also a Chrome Web Store review signal (permissions must map to features — PITFALLS P15), so it is recorded here.

## Decision

**Add `"unlimitedStorage"` to the manifest `permissions` array at Phase 2**, when IndexedDB first ships — not earlier (least-privilege: the permission has no purpose until IndexedDB exists). The permission exempts the extension origin (IndexedDB included) from quota and eviction.

Both permission lists are updated: §16.4 and the Appendix G `wxt.config.ts` block. Phase 19 CWS review-readiness (REQ-R21 / PITFALLS P15) must include `unlimitedStorage` in the used-vs-declared permission audit and justify it in the store listing (durable local-first notes/memory store).

## Consequences

- **Positive:** durable IndexedDB bodies survive storage pressure; aligns with the local-first "your notes never silently vanish" promise.
- **Negative:** one additional declared permission → slightly larger CWS review surface; must be justified in the privacy policy + listing.
- **Spec impact:** amend §16.4 permission list and Appendix G manifest to include `unlimitedStorage` (effective Phase 2). The Phase 1 build does not require it.

## Verification

- Manifest declares `unlimitedStorage` from Phase 2 onward; Phase 1 manifest does **not** (least-privilege).
- Phase 19 permission-audit script: `unlimitedStorage` is in the used-and-declared set (IndexedDB code present), not in the unused set.
- Soak test (Phase 19): >10 MB IndexedDB write survives a browser restart without eviction.
