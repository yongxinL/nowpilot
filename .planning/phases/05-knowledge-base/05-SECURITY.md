---
phase: 05
slug: knowledge-base
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-02
---

# Phase 5 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| markdown content → LinkParser regex | Untrusted user-authored markdown enters regex; regex is read-only extraction, no eval/code execution | note content (private) |
| Note content → MiniSearch index | Text content enters MiniSearch for indexing; no script execution path — `<mark>` is the only markup a snippet can contain (WR-07) | note content (private) |
| Note content → cosine similarity | User-authored text tokenized for bag-of-words; no HTML/script execution path | note text (private) |
| MemoryEngine.retrieve() → ContextItem[] → ContextOptimizer | Memory data enters AI prompt pipeline; ContextTrustPolicy gates trust/sensitivity (Phase 4b contract); sensitivity:'secret' rejected by ContextItemSchema.refine | memory records (public/private/confidential) |
| MemoryEngine.write() → IndexedDB | Write guarded by BroadcastBus primary election (MEM-02); WriteJournal ensures crash consistency | memory records (private) |
| LLM summarization → ConversationMemoryStore | LLM output stored as summary text; treated as untrusted data; prompt-delimiter injection blocked (WR-06) | conversation text (private) |
| MemoryEngine → PersonaInjector → system prompt | Memory data injected into AI system prompts; np_persona validated via PersonaProfileSchema (WR-08); XSS mitigated by PortableMarkdown rendering (Phase 1) | persona config (public) |
| verify:phase-5 script → test execution | Test runner executes in Node.js; no browser extension APIs active — fake-indexeddb + mocks | none |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | LinkParser regex | low | accept | Regex captures text only between `[[` and `]]` — no eval, no dynamic code execution (LinkParser.ts:9,23). Worst case: garbage title becomes unresolved. See Accepted Risks Log. | closed |
| T-05-02 | Tampering | NotesDB.save() — note content injection | medium | mitigate | Zod boundary validation (`NoteSchema.parse`, NotesDB.ts:57 → VALIDATION_ERROR); no raw HTML execution path in notes layer; snippet builder HTML-escapes all content (escapeHtml + placeholder-token restore, MiniSearchNoteIndex.ts:49-51,96-99 — WR-07 stored-XSS defense); downstream rendering via PortableMarkdown+DOMPurify (Phase 1). | closed |
| T-05-03 | Information Disclosure | MiniSearchNoteIndex — JSON persistence | low | accept | Index stored as plain JSON in IndexedDB; sandboxed per-extension, user's own browser. See Accepted Risks Log. | closed |
| T-05-04 | Denial of Service | NoteGraph.computeSimilarity — N^2 computation | low | accept | Similarity computed on-demand for getRelatedNotes, never eagerly; capped top-10 (NoteGraph.ts:134,147). See Accepted Risks Log. | closed |
| T-05-05 | Spoofing | MemoryEngine.isPrimarySurface() | high | mitigate | BroadcastBus primary election verified before every write — `isPrimarySurface(surfaceId)` (BroadcastBus.ts:52-54) compared against this instance's surfaceId (MemoryEngine.ts:150-152); secondary surfaces reject with NOT_PRIMARY_SURFACE BEFORE any IndexedDB mutation or journal entry (MemoryEngine.ts:276-282); elections broadcast on PRIMARY_SURFACE_ELECTED so all contexts converge (BroadcastBus.ts:29-44, WR-04); production-wired via initializeKnowledgeBase (bootstrap:31-46). | closed |
| T-05-06 | Tampering | UserMemoryStore — LLM writes facts | high | mitigate | D-05 write boundary in MemoryEngine.write() `callerOrigin` guard: ai-pipeline callers writing semantic/preference rejected with WRITE_BOUNDARY_VIOLATION (MemoryEngine.ts:264-273); only working/episodic (conversation summaries) writable by AI; user facts/preferences require user-action. Store-level guard, tested. | closed |
| T-05-07 | Information Disclosure | MemoryRecord sensitivity → ContextItem | medium | mitigate | MemoryRecord.sensitivity inherits directly to ContextItem.sensitivity (MemoryEngine.ts:217); ContextItemSchema.refine rejects sensitivity:'secret' — secret items cannot become ContextItems (ContextItem.ts:40-41); confidential excluded from cloud prompts by ContextOptimizer (Phase 4b D-09). | closed |
| T-05-08 | Tampering | Confidence mutation during retrieval | medium | mitigate | D-07 source-based immutable confidence: assigned once from CONFIDENCE_MAP on creation, preserved on update (UserMemoryStore.ts:65); MemoryScorer reads, never writes confidence; incrementUseCount updates only useCount + lastUsedAt (UserMemoryStore.ts:119-130); test asserts confidence unchanged. | closed |
| T-05-09 | Repudiation | Memory writes without WriteJournal | medium | mitigate | MemoryEngine.write() wraps all IndexedDB mutations in WriteJournal createEntry/commitEntry with record payload for replay (MemoryEngine.ts:308-321); interrupted entries recover via executor registry + replayJournal at startup (bootstrap:52-89, WR-05); WORKSPACE_UPDATED broadcast on commit. | closed |
| T-05-10 | Tampering | LLM summarization — prompt injection via message content | medium | mitigate | Message content treated as untrusted in summarization prompt; sanitizeExcerpt strips `</data-source>` and redacts standalone `Summary:` lines (ConversationMemoryStore.ts:76-84); DELIMITER_ERROR invariant assertion refuses to call the model unless exactly one delimiter pair remains (ConversationMemoryStore.ts:241-249, WR-06); summary ≤500 chars, never auto-applied as facts. | closed |
| T-05-11 | Information Disclosure | PersonaInjector — sensitive preferences in system prompt | low | accept | np_persona is user-authored public identity; sensitivity 'public' by default; user controls content via Phase 7 UI. See Accepted Risks Log. | closed |
| T-05-12 | Denial of Service | verify:phase-5 — test suite runtime | low | accept | Integration tests use fake-indexeddb (in-memory), no real LLM calls; no external service dependency. See Accepted Risks Log. | closed |
| T-05-SC | Tampering | npm installs (minisearch, idb, zustand, zod) | high | mitigate | Package Legitimacy Audit (RESEARCH.md) — all [ASSUMED] verdicts; no new packages in Phase 5 (git diff 5341818~1..HEAD -- package.json: no dependency changes). | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01 | LinkParser regex is read-only text extraction — no eval, no code execution path. Malformed wikilinks degrade to unresolved titles, which the UI surfaces as clickable "create note" affordances. Residual risk: garbage titles in unresolvedLinks. | Phase 05 plan (T-05-01 disposition) | 2026-08-02 |
| AR-05-02 | T-05-03 | MiniSearch index persisted as JSON in IndexedDB. Chrome extension storage is sandboxed per-extension; content is the user's own note text visible only in their browser. | Phase 05 plan (T-05-03 disposition) | 2026-08-02 |
| AR-05-03 | T-05-04 | getRelatedNotes computes hybrid similarity on demand, capped at top-10 results. Acceptable for <5000 notes; phases 5a/7 may add caching. Residual risk: query latency at very large note counts. | Phase 05 plan (T-05-04 disposition) | 2026-08-02 |
| AR-05-04 | T-05-11 | Persona config (np_persona) is user-authored public identity injected into system prompts. Sensitivity 'public' by default; the user decides what enters the persona via the Phase 7 UI. Not a data-leak vector. | Phase 05 plan (T-05-11 disposition) | 2026-08-02 |
| AR-05-05 | T-05-12 | verify:phase-5 runs in-memory (fake-indexeddb), no real LLM calls, ~15s runtime. No external service dependency; DoS surface limited to developer machine CI. | Phase 05 plan (T-05-12 disposition) | 2026-08-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-02 | 13 | 13 | 0 | gsd-security-auditor (State B — run from artifacts) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02
