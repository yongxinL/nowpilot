# Architecture Research

**Domain:** Chrome MV3 extension with multi-surface shared state (side panel + standalone tab), local-first AI assistant + knowledge base
**Researched:** 2026-08-19
**Confidence:** HIGH — platform-behavior claims cross-checked against Chrome official docs; MEDIUM — community best-practice claims

> **Scope note.** The product architecture is LOCKED by the authoritative spec (§8 architecture design, §13 concurrency rules, §20 runtime state models, §26 PageContentService). This document does NOT propose a different architecture. It validates the locked design against known-good external patterns, documents the hard technical patterns the architecture depends on, and flags ordering risks in the §18 sequence.

## 1. Locked-Spec Validation (Verdict Table)

Every locked decision below was checked against external platform documentation and ecosystem practice. The verdict is: **the locked architecture matches known-good patterns** — with one storage-rate-limit flag (§4, §5) and one ordering risk (§6).

| Locked spec decision | External known-good pattern | Verdict |
|---|---|---|
| MV3 non-persistent SW; durable state in `chrome.storage.local`, never in worker globals (§8.1, codebase constraint) | Chrome docs: SW dies after 30 s idle / 5 min single-request; "the single most common MV3 bug is treating it like a long-lived process"; migrate all global state to storage | ✅ Validated |
| No AI/IndexedDB/EventSource/setInterval in background SW; PROXY_FETCH wrapped in 25 s `Promise.race` (§0.2, §5.2, §13) | w3c/webextensions #1014 documents silent SW truncation of long AI work with no error signal; only WebSocket (Chrome 116+) extends SW lifetime, not EventSource; streams belong in UI contexts | ✅ Validated — and the spec is *stricter* than the platform, which is correct |
| BroadcastBus primary election: CAS on `np_workspace_primary` in `chrome.storage.session` + 3 s heartbeat + 2 missed → re-election + standalone tie-break (§13, §20.11) | Standard leader-election pattern: shared-storage compare-and-set lease + heartbeat + miss-count re-election (pubkey/broadcast-channel `createLeaderElection` uses Web Locks + fallback; sse-coordinator uses BroadcastChannel leader election to share one stream across tabs) | ✅ Validated — CAS-on-session-storage + heartbeat lease is the textbook single-writer pattern |
| Storage partitioning (§15.1): session = tokens/active-stream/election; local = metadata + settings; IndexedDB = message/note/memory bodies; sync = theme/language | Community practice: session for transient coordination, local for small persisted state with coalesced writes, IndexedDB past ~5 MB / for key-range queries; sync reserved for <100 KB prefs. Message bodies never in `chrome.storage.local` ✅ (10 MB cap + write-rate limit) | ✅ Validated |
| AI SSE streams run in side panel / standalone view, not the SW; streams survive SW restart (§5.2, §19.6) | `EventSource` cannot send POST bodies or auth headers (all 4 spec providers need both) → `fetch` + `ReadableStream` is the canonical pattern; the existing `aiProvider.ts` already does this | ✅ Validated |
| Content script extraction-only, ISOLATED world, < 50 KB bundle (§5.6, §22.1); Defuddle NOT bundled into content script — panel-side `DOMParser` + `<base href>` restore + `Defuddle(full).parse()` (§26.4) | Community target: content scripts < 50 KB; CWS review scrutinizes large bundles; Defuddle docs confirm core/full/node bundles, opt-in markdown (0.19.x), and that `parseAsync` may hit third-party APIs (FxTwitter) — `useAsync:false` + sync `parse()` is exactly the documented privacy-safe path | ✅ Validated |
| MiniSearch: ephemeral per-tab page index (§26.5) + persistent notes index (§27/§8.2), never shared | MiniSearch 7.2.0: sub-millisecond queries, thousands of docs indexed in tens of ms, ~6 KB gzipped, memory linear — spec target (< 50 ms @ 1,000 notes) has huge headroom; JSON serialization enables snapshot/restore | ✅ Validated |
| RAG without vector embeddings: MiniSearch lexical retrieval + LLM synthesis/rerank ("Ask notes", §27); no embeddings in v0.1 (§3.2) | "RAG without embeddings" is a recognized architecture (DigitalOcean, Unstructured): lexical/BM25 retrieval + optional LLM rerank is the standard pipeline for jargon/ID/code-heavy corpora — exactly a ServiceNow support corpus. BM25 is competitive with dense on exact-term queries and gives auditable retrieval trails | ✅ Validated — well-matched to domain; embeddings can be layered later (RRF fusion) without pipeline rebuild |

## 2. System Overview (locked §8, annotated with runtime boundaries)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                 Chrome Browser — one extension origin                    │
├──────────────────────────────┬───────────────────────────────────────────┤
│  Background SW (ephemeral)   │  Side Panel (persistent while open)       │
│  ───────────────────────     │  ───────────────────────────────────      │
│  BackgroundRouter (typed     │  AI runtime: ProviderRouter/AgentOrch./   │
│  onMessage dispatcher)       │    Planner→Executor→Renderer (SSE fetch)  │
│  LifecycleManager            │  MemoryEngine + IndexedDB (bodies)        │
│  KeepAliveManager (alarms)   │  AITransactionLog + TraceRedactor         │
│  CookieSessionStore          │  WorkspaceStore (Zustand) instance        │
│  CORSProxy (PROXY_FETCH)     │  BroadcastBus peer (election participant) │
│  WorkspaceRouter (tab dedupe)│  PageContentService: DefuddleStrategy     │
│  ── NO AI, NO IndexedDB ──   │    (parses content-script HTML payloads)  │
│                              │                                           │
│                              │  Standalone view (persistent tab)         │
│                              │  ───────────────────────────────────      │
│                              │  Same core services as Side Panel +       │
│                              │  LLM-Wiki (NoteTagger/QA/FileSync) +      │
│                              │  Options + Diagnostics                    │
│                              │  WorkspaceStore instance (election peer)  │
│                              │  NotesDB/MemoryDB/WriteJournalDB (IDB)    │
├──────────────────────────────┴───────────────────────────────────────────┤
│  Content Scripts (ISOLATED, <50 KB, extraction-only, no UI)              │
│  ContentScriptHost (bridge) · SPANavigationWatcher · PageContextBridge   │
│  ── strips DOM, stamps base URL, sends payload → panel (RuntimeEnvelope) │
├──────────────────────────────────────────────────────────────────────────┤
│  Shared primitives (cross-context)                                       │
│  chrome.storage.session: np_workspace_primary, np_active_stream, tokens  │
│  chrome.storage.local:   np_workspace, np_providers, np_flags, …         │
│  chrome.storage.sync:    np_theme, np_theme_pack, np_language            │
│  IndexedDB (side panel + standalone): ChatHistoryDB, NotesDB, MemoryDB,  │
│    ErrorStore, WriteJournalDB, AITransactionLogDB, notes_backup_config   │
│  BroadcastChannel: np_theme, np_workspace (cross-surface pub/sub)        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries (validated against §8.2, not reinvented)

| Component | Owns | Talks to (direction) | Never does |
|---|---|---|---|
| Background SW | Router, alarms, context menus, cookies, PROXY_FETCH, workspace tab dedupe | Content scripts ← (bridge); surfaces ← (PROXY_FETCH responses); WorkspaceRouter → `chrome.tabs` | LLM/MCP streams, IndexedDB, `setInterval`, EventSource (§0.2) |
| Side Panel | AI runtime + streaming, MCP, ContextOptimizer, MemoryEngine, transaction log, IndexedDB, Defuddle parsing | Provider APIs → (fetch SSE); content scripts ← (extraction envelopes); Standalone → (BroadcastBus election + WORKSPACE_UPDATED; WorkspaceRouter) | Notes full workspace, Options, filesystem sync (§8.3) |
| Standalone view | Same core services as panel + LLM-Wiki + Options + Diagnostics | Provider APIs →; content scripts ←; Side Panel ← (BroadcastBus); File System Access API → | (nothing panel-exclusive) |
| Content script | Page context, SPA nav events, stripped-HTML payloads, (Phase 17: SN tokens via MAIN-world script) | Panel/Standalone/Background → (RuntimeEnvelope) | Render UI, touch host DOM beyond read, bundle Defuddle (§26.4) |
| WorkspaceStore | Cross-surface state: workspaceId, conversationId, activeProvider, pinnedTabs, currentPageContext, activeSurface, version | `chrome.storage.local.np_workspace` (persist) · BroadcastBus (WORKSPACE_UPDATED/heartbeat) | Derive memory bodies; write outside single-writer rule |
| PageContentService | Layered extraction, per-tab cache (LRU 20), coalescing, redaction, MiniSearch page index | Content script ← (payload); ContextOptimizer →; add-ons (strategy registry) | Persist cache/index; run in content script; auto-extract unsubscribed tabs (§26.4a) |
| MessageBus / EventBus / BroadcastBus | Typed envelope routing (runtime), in-surface sync events, cross-surface pub/sub | All contexts (envelope + ResponseEnvelope) | Handle "must not throw" — swallow + log |
| MemoryEngine + IDB stores | Conversation/user/preference memory, notes, write journal, transaction logs | Primary surface only (writes) | Write from secondary surface (§13 single-writer) |

## 3. Data Flows (explicit direction)

### 3.1 Workspace state (primary-election flow — the heart of multi-surface sharing)

```
every surface on mount (sidepanel | standalone)
   │
   ├─ hydrateFromStorage() / hydrateFromURL()  (local np_workspace; URL params)
   │
   ▼
BroadcastBus election: CAS write np_workspace_primary {tabId, surface, electedAt}
   │  (storage session key is the atomic tie-breaker; standalone wins ties)
   ▼
state = primary | secondary
   │ primary: writes memory/notes/chat-history bodies; persists np_workspace
   │ secondary: mirror read-only; never writes memory (§13)
   │
   ├─ every setState → persist() (local) → WORKSPACE_UPDATED {state, from} on np_workspace channel
   │      │ secondary applies last-write-wins by state.version (Appendix M.3)
   │      ▼
   ├─ heartbeat every 3 s on np_workspace channel
   │      │ primary misses 2 (≈6 s) → re-election; closed tab → auto-promotion ≤ 3 s (§13)
   │      ▼
   └─ surface close (beforeunload) → release lease → next surface promotes (§19.14)
```

Direction rule: **state flows surface → storage → BroadcastChannel → other surfaces**. No surface reads another surface's in-memory store; the BroadcastBus message carries the whole state and consumers apply version-gated last-write-wins.

### 3.2 Chat streaming (never through the SW)

```
Composer (panel/standalone) → useStreamingLLM (aborts prior stream first — §13)
   → AgentOrchestrator → Planner → Executor → Renderer   [one AbortController, §13]
   → ProviderRouter (no provider switch after first token — §13)
   → ProviderAdapter → fetch(POST, stream:true) → ReadableStream → SSE line parser
   → chunk → onChunk → Zustand message append → IndexedDB (batch ≤5 s / 10 msgs)
   → np_active_stream {conversationId, operationId} in storage.session (recovery — §19.6)
```
The SW is never on this path. If the SW restarts mid-stream, the stream continues in the surface (§19.6); on surface re-open, `AITransactionLog.markAborted(operationId)` recovers (§20.6 `ActiveStreamState`).

### 3.3 Page extraction (thin content script → fat panel parse)

```
Navigation (wxt:locationchange / tabs.onUpdated)
   → lightweight live context (title/url/meta) always sent — tiny payload
   → full extraction ONLY when a surface is subscribed (active on tab or pinned — §26.4a)
   → content script: pre-stripped clone (no script/style/noscript/svg/cross-origin iframe;
     form action removed; password values omitted), base URL stamped, ≤2 MB cap (§26.6)
   → RuntimeEnvelope → panel/standalone
   → DOMParser → inject <base href> → Defuddle(full).parse() (markdown:true,
     useAsync:false — privacy) → TraceRedactor → cache + lazy MiniSearch index
   → subscribed-tab re-extract on nav; unsubscribed = mark-stale only; evict pair together (§26.4a)
```

### 3.4 Message envelope routing (existing scaffold, §20.1)

```
producer → createEnvelope(type, operationId, …) → MessageBus.dispatch
   → single chrome.runtime.onMessage listener → isEnvelope guard → Promise.allSettled(handlers)
   → ResponseEnvelope {ok} | {ok:false, error} back to producer
```
Background SW currently listens for raw `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` (codebase gap vs §8.1 `BackgroundRouter` typed dispatch — Phase 1 should converge these onto envelopes).

## 4. Known-Good Patterns the Architecture Depends On

### Pattern 1: SW as a stateless event router (never a stateful process)

**What:** The SW registers listeners synchronously at module load, wakes on events, persists everything to `chrome.storage`, and tolerates being killed at any moment (`workerState` cold-start → ready → degraded → shutting-down, §20.5).
**When:** Every MV3 extension with background work.
**Trade-offs:** Nothing in memory survives; every handler must be re-entrant. Cost is small for this product because all heavy work (AI, IDB) deliberately lives in surfaces.
**Enforcement note:** KeepAliveManager must recreate alarms + context menus on every startup (`onInstalled` *and* `onStartup`) — alarms survive SW termination (Chrome 120 lowered min period to 30 s), timers do not.

### Pattern 2: sendMessage vs connect — discrete events vs streams

**What:** `runtime.sendMessage` for one-shot request/response (envelope dispatch); `runtime.connect` ports for repeated or bidirectional flows and disconnect detection.
**When:** NowPilot's surface↔surface coordination uses BroadcastChannel (broadcast), surface→SW uses sendMessage (PROXY_FETCH, session ops); content-script → panel extraction uses sendMessage with the 2 MB cap documented (§26.6, no chunking protocol).
**Gotchas (all verified against platform docs):**
- `onMessage` async responses require `return true` from the **synchronous** path of the listener — an `async` listener returns a Promise and breaks the channel. `MessageBus.init` (single listener, `Promise.allSettled`) must keep this discipline.
- Ports die when the SW terminates or the extension updates → "Extension context invalidated"; any port consumer needs `onDisconnect` + reconnect.
- Only the first `sendResponse` across multiple listeners wins.
- Chrome 114+: opening a port no longer resets SW timers; sending on a long-lived channel does. Do not rely on ports for keepalive.

### Pattern 3: Single-writer election = storage CAS + heartbeat lease (locked §13)

**What:** A shared, atomic storage key is the election arbiter, not in-memory state: surfaces CAS-write `np_workspace_primary`, heartbeat every 3 s, 2 missed → re-election, standalone wins ties. Only the primary writes memory/notes/chat bodies; secondaries mirror.
**Why it works:** `chrome.storage.session` writes are atomic per key and visible to every extension context (same origin); the lease expires by heartbeat, not by explicit release, so a closed panel can't block promotion (§19.14). This is the same shape as pubkey's `createLeaderElection` (Web Locks + fallback) minus the library — appropriate, because the spec also needs the tie-break policy and versioned workspace state.
**Failure mode to guard:** duplicate primaries under CPU saturation / timer throttling (known leader-election edge). Mitigation: version check on every memory write (locked §19.12: last-write-wins with version check) plus `WorkspaceCoordinationState.error('ELECTION_TIMEOUT')` surfaced to diagnostics.

### Pattern 4: Storage partitioning — session for coordination, IDB for bodies, coalesced local writes

**What (§15.1):** session (≈10 MB, cleared on browser close): tokens, active stream, election key. local (10 MB; ~120 writes/min limit): settings, workspace metadata, conversation metadata. sync (100 KB total, 8 KB/item): theme + language only. IndexedDB (≈60 % of disk, no published rate limit): all message/note/memory bodies + journals.
**⚠️ Rate-limit flag (the one real risk found):** `chrome.storage.local` is throttled to roughly **120 writes/min** — the most common MV3 production bug is writing on every mutation. Appendix M's `WorkspaceStore.persist()` fires on every `setState`, and `np_workspace` is small, so risk is low (workspace updates are user-paced, not event-paced) — but Phase 1/2 should **debounce/coalesce `np_workspace` persists** (e.g. 250–500 ms trailing debounce with flush-on-beforeunload) and assert the write rate in `WorkspacePersistence.test.ts`. Heartbeats go to session storage (no published rate limit) so they are safe.
**Access note:** `storage.session` is not visible to content scripts unless `setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS')` is called (background-side). NowPilot does not need content-script session access (tokens flow via envelopes) — leave the default.

### Pattern 5: SSE streaming via fetch + ReadableStream in UI contexts

**What:** `fetch` with `stream:true` and a `ReadableStream` reader + line parser for `data:` frames (existing `streamChatResponse`). `EventSource` is unusable here: GET-only, no auth headers, no body — all four providers need POST + `Authorization`.
**Why in the surface, not the SW:** only WebSocket extends SW lifetime (Chrome 116); a long SSE through the SW dies silently mid-generation (w3c/webextensions #1014). The spec's placement (panel/standalone own the stream, SW never touches it) is the known-good pattern. `np_active_stream` in session storage + `markAborted` recovery is the standard crash-recovery addition.

### Pattern 6: Extraction pipeline — serialization in the content script, parsing in the panel

**What (§26):** content script only strips + serializes (cheap, keeps bundle tiny); Defuddle parsing happens panel-side on a detached `DOMParser` doc with the base URL restored from a stamped header. `useAsync:false` + sync `parse()` prevents Defuddle's third-party API fallbacks (FxTwitter) — a silent outbound fetch would violate the privacy contract.
**Why it's correct:** Defuddle 0.19.x documents exactly this hazard and this opt-out; the full bundle (math + markdown) is too heavy for a 50 KB content bundle but free in the panel bundle. Detached-doc caveat (no layout, no base href) is the documented reason the content script must stamp the effective base URL.

### Pattern 7: Lexical retrieval + LLM rerank (RAG without embeddings)

**What (§27 "Ask notes"):** MiniSearch (BM25/TF-IDF inverted index, ~6 KB gzip) retrieves top-k note chunks → LLM synthesizes a grounded answer with citations.
**Why it's the right call here:** support-engineering queries are exact-term-heavy (error codes, error messages, instance IDs, KB article numbers) — the failure mode of dense embeddings. Lexical gives high precision + auditable trails; the LLM rerank covers paraphrase gaps. No embedding model, no GPU, no data leaving the machine. Headroom: if paraphrase recall ever hurts, add hybrid retrieval (BM25 + embeddings fused with RRF) — an additive change, not a rebuild (this is the documented upgrade path for BM25 pipelines).

## 5. Anti-Patterns to Avoid

### Anti-Pattern 1: persist-on-every-mutation to `chrome.storage.local`
**What people do:** write the whole store on each `setState` (Appendix M does this for `np_workspace`).
**Why it's wrong:** the ~120 writes/min throttle silently drops writes; queues corrupt without errors.
**Do this instead:** coalesce (trailing debounce + flush on `beforeunload`/`visibilitychange`), batch key writes, and keep per-message bodies in IndexedDB (already locked). Add a rate assertion test in Phase 2.

### Anti-Pattern 2: keepalive tricks to make the SW immortal
**What people do:** heartbeat loops, port-to-content-script keepalive, abusing `waitUntil`.
**Why it's wrong:** Chrome's policy only sanctions continuous keepalive for enterprise/edu; community keepalive (alarm chunking, offscreen docs) works but fights the platform and breaks on updates. w3c #1014 shows the cost: silent truncation of long work.
**Do this instead:** the spec's design — SW does only short, race-bounded work (25 s PROXY_FETCH), alarms for periodic work, and everything long-lived lives in surfaces.

### Anti-Pattern 3: full extraction on every navigation
**What people do:** extract every page on `tabs.onUpdated` or on every SPA nav.
**Why it's wrong:** Defuddle parse + MiniSearch index on every page = CPU/memory cost on pages users never ask about, and violates the read-only + cost-effective posture.
**Do this instead:** the locked subscription model (§26.4a): lightweight context always; full extraction only for subscribed/pinned tabs; unsubscribed tabs are mark-stale only; per-tab LRU of 20 with paired cache+index eviction.

### Anti-Pattern 4: letting Defuddle's async extractors run
**What people do:** use `parseAsync()` or omit `useAsync:false` — Defuddle then fetches third-party APIs (FxTwitter) for SPA pages.
**Why it's wrong:** silent outbound network call breaks "no data leaves the machine" (§6.1) and the no-custom-UA invariant (§0.2).
**Do this instead:** locked call shape (§26.4) — `defuddle/full`, `markdown:true`, `useAsync:false`, sync `parse()`, version pinned to 0.19.x (upstream itself says "pin a version" — it's actively developed).

### Anti-Pattern 5: dual-writer memory (split brain)
**What people do:** both surfaces write IndexedDB memory stores; last writer wins nondeterministically.
**Why it's wrong:** interleaved seq keys, lost updates, duplicated eviction.
**Do this instead:** locked single-writer election (§13) + version check on every memory write (§19.12) + WriteJournal idempotency keys (§20.2). Secondary surfaces mirror read-only.

## 6. Build-Order Implications (§18 sequence — flag, don't contradict)

The §18 order (`acquire → store → understand → display → extend → harden`) is consistent with the dependency structure below. Three flags:

**Flag A — Content-script envelope contract (Phase 1 vs Phase 6).** Phase 1 ships `content/core.content.ts` (extraction-only) and the RuntimeEnvelope; Phase 6 ships PageContentService with the *payload* protocol (pre-stripped clone, base-URL stamp, 2 MB cap, `truncated:true`). **Risk:** Phase 1's content bridge may ship a throwaway payload shape that Phase 6 must rework. **Mitigation:** in Phase 1, define the envelope message types for `PAGE_LIVE_CONTEXT` (title/url/meta — always-on) and `PAGE_EXTRACTION_REQUESTED` / `PAGE_HTML_PAYLOAD` (on-demand, with `baseUrl`, `truncated` fields reserved) even though the heavy strategies land in Phase 6. This is a type-level contract, not an implementation dependency — the Phase 6 planner then only fills in strategy logic.

**Flag B — Election infrastructure (Phase 1) vs enforcement (Phase 2+).** The election state machine (§20.11) and WorkspaceSync heartbeat must exist in Phase 1 (handoff correctness), but the single-writer *enforcement* (only primary writes memory/notes bodies) cannot be tested until Phase 2 introduces IndexedDB stores. **Risk:** the Phase 1 election code hard-codes "primary = writes everything" and the Phase 2 storage layer isn't wired into the election result. **Mitigation:** Phase 1 exposes `WorkspaceCoordinationState` + a `isPrimaryWriter()` predicate on WorkspaceStore; Phase 2's MemoryEngine/NoteTagger gate their write paths on that predicate. Keep the predicate interface stable; enforcement is additive.

**Flag C — Streaming plumbing (Phase 3) touches Phase 1 runtime.** `np_active_stream` (session) + AbortController threading + `markAborted` recovery (§19.6) are Phase 3 scope, but the Phase 1 `MessageBus`/`RuntimeEnvelope`/`OperationId` are their transport. **Risk:** low — envelope + OperationId already exist in the scaffold. **Mitigation:** none needed beyond the Phase 3 plan reusing `OperationId` for stream correlation instead of minting a new id scheme.

**No-flag zones (confirmed dependency-clean):** MiniSearch (Phase 8 notes index, Phase 6 ephemeral page index) shares one engine import but never shares storage (§26.5 note) — clean. LLM-Wiki (Phase 9) correctly depends on Phase 8 + Phase 6 + Phase 3 per §27. Add-ons (Phase 17) registering the `servicenow-api` strategy into the Phase 6 strategy registry is a clean extension point (§26.2 reserves the id in Phase 6).

### Suggested build order (dependency view of §18)

```
Phase 1  MV3 runtime + shells + workspace (BroadcastBus, election, handoff)   [Flag A, B]
   ↓
Phase 2  Storage + WriteJournal + workspace persistence (coalesced writes)    [Flag B resolves]
   ↓
Phase 3  AI runtime + streaming (fetch SSE, abort, np_active_stream)          [Flag C]
   ↓
Phase 4  Agent reliability/evidence → Phase 5 context-adaptive execution
   ↓
Phase 6  PageContentService (Defuddle panel-side + cache + page index)        [Flag A resolves]
   ↓
Phase 8  Notes + Memory + MiniSearch (persistent notes index) → Phase 9 LLM-Wiki (RAG)
   ↓
Phases 10–19: governance, diagnostics, evaluation, collaboration, UX, add-ons, hardening
```

## 7. Scaling Considerations

| Scale | Architecture adjustments |
|---|---|
| 0–1k notes / 1–20 pinned tabs | Locked design as-is. MiniSearch queries sub-ms; Defuddle parse is the only hot path and is on-demand + cached (LRU 20) |
| 1k–10k notes | MiniSearch memory grows linearly — fine (in-memory inverted index ≈ fraction of corpus size); keep wikilink autocomplete target (< 50 ms p95 at ≤ 5,000 notes, §22.1). Notes index rebuild on v4 migration (tags/summary fields) is one-time — plan an idle-time rebuild |
| 10k+ notes | Rebuild/persist the notes index snapshot (MiniSearch `loadJSON`) instead of re-indexing on boot; consider offloading index build to an idle task. Still no server needed |

**First bottleneck:** IndexedDB write batching for chat history (§22.1: ≤ 5 s or 10 messages, whichever first) — the streaming path must batch, not write per chunk. **Second:** Defuddle parse on very large pages (2 MB cap + `truncated:true` already bound it; per-tab cache prevents repeat cost).

**What breaks first (realistic):** the `chrome.storage.local` write throttle under bursty workspace updates (Flag: coalesce in Phase 1/2), and SW restart churn during active streams (already mitigated by surface-owned streams + `np_active_stream` recovery).

## 8. Integration Points

| Boundary | Communication | Notes |
|---|---|---|
| Surface ↔ Surface | BroadcastChannel (`np_theme`, `np_workspace`) + `storage.session` election key | One-way broadcast; version-gated last-write-wins |
| Surface ↔ SW | `runtime.sendMessage` envelope → `BackgroundRouter`; PROXY_FETCH response envelope | SW never initiates to surfaces except `onStartup` alarm/context-menu recreation |
| Content script ↔ Surfaces | RuntimeEnvelope over `runtime.sendMessage` (or `tabs.sendMessage` from surface on demand) | 2 MB payload cap, no chunking (§26.6); payload shape frozen in Phase 1 (Flag A) |
| Surfaces → AI providers | `fetch` POST + SSE via ReadableStream, from surface context only | CSP `connect-src` whitelist (§16.3/codebase wxt.config) |
| SW → service-now.com | CORSProxy PROXY_FETCH (25 s race) with cookie session | Tokens in `storage.session`; per-configure host grant via optional permissions (§16.4) |
| Surfaces → Filesystem (Phase 9) | File System Access API (`showDirectoryPicker` handle) | No manifest permission needed; fire-and-forget writes with 50 ms debounce (§13) |

## Sources

- Chrome for Developers — *Extension service worker lifecycle* (30 s idle / 5 min single-request; alarms; port behaviors Chrome 105–120) — official docs, HIGH
- Chrome for Developers — *Longer extension service worker lifetimes* (Chrome 110 event-timer changes) — official, HIGH
- Chrome for Developers — *Message passing* (sendMessage vs connect, `return true`, port disconnect semantics) — official, HIGH
- Chrome for Developers — *chrome.storage reference* (area quotas, unlimitedStorage, session access levels) — official, HIGH
- Chrome for Developers — *Content scripts* (isolated world, accessible API subset) — official, HIGH
- dev.to/notearthian, BulkMD, palancar.net — storage-area comparisons incl. ~120 writes/min local throttle and session-for-coordination practice — community, MEDIUM
- pubkey/broadcast-channel — `createLeaderElection` (Web Locks + fallback, duplicate-leader edge) — MEDIUM
- github.com/john-athan/sse-coordinator — single SSE across tabs via BroadcastChannel leader election — MEDIUM
- w3c/webextensions#1014 — AI in MV3 SW: silent truncation, 30 s/5 min limits — MEDIUM
- kepano/defuddle (GitHub + npm 0.19.1) — bundles, `useAsync:false`, opt-in markdown, work-in-progress pinning warning — HIGH (primary source)
- lucaong/minisearch (GitHub, DeepWiki benchmarks) — sub-ms queries, linear memory, JSON snapshot/restore — HIGH
- DigitalOcean / Unstructured / SumGuy — RAG without embeddings: BM25 + LLM rerank pipelines, RRF hybrid upgrade path — MEDIUM
- **Locked spec:** `.planning/PRODUCT_SPEC_v0_1.md` §5, §8, §13, §15, §19, §20, §22, §26, §27, Appendix M — authoritative

---

*Architecture research for: NowPilot (multi-surface MV3 shared-state patterns)*
*Researched: 2026-08-19*
