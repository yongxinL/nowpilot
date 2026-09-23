# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Research

**Researched:** 2026-09-23
**Domain:** Chrome MV3 extension persistence — encrypted credential vault, IndexedDB schema + migrator, WriteJournal crash-safe multi-store writes, legacy `np_store` migration, cross-surface writer election
**Confidence:** HIGH for codebase/contract facts and for the `idb`/`fake-indexeddb` behaviour (executed locally this session); MEDIUM for platform/WebCrypto and `chrome.storage.session` facts (documented sources, not executed in a real Chrome)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

> **Decision-ID convention:** decisions in this file are prefixed `D2-` to stay unambiguous against Phase 1's `D-01…D-16` (several of which this phase builds on directly).

#### Credential Vault — scope (KeyVault / EncryptedStorage / CredentialStorePort)

- **D2-01:** **Vault API only — no UI credential wiring in Phase 2.** Phase 2 ships the complete secure credential-storage foundation (KeyVault, EncryptedStorage, typed CredentialStorePort, credential envelope versioning, creation, replacement, deletion, presence checks, migration boundaries, redacted errors/diagnostics, tamper/corruption handling, synthetic-credential security tests). It must NOT wire the onboarding API-key field or the deferred Options credential fields to persistent storage. Rationale (operator): fixture-generated success must never cause a real user credential to be stored, because that conflates four distinct states — (1) credential input accepted by the UI, (2) credential encrypted and stored, (3) credential validated by the provider, (4) provider runtime ready. Phase 2 implements and verifies state 2 at the storage-contract level with synthetic credentials; Phase 3 implements the production flow across states 1–4. — **Reversibility:** reversible — wiring is additive in Phase 3 and no UI path writes credentials in Phase 2.
- **D2-02:** **Phase 2 UI behaviour for credentials.** The fixture-backed onboarding credential step keeps the API-key value in component memory only: never passed to CredentialStorePort, never persisted, never sent over RuntimeEnvelope or BroadcastBus, never logged or in diagnostics, cleared at the approved lifecycle boundaries. Options credential controls remain disabled or deferred. The UI MAY show a non-interactive capability notice (e.g. "Secure credential storage is installed. Provider credential setup and validation will be enabled in the provider integration phase."). It must NOT show "Credential stored" / "Provider connected" / "Provider validated" / "Provider ready" unless the corresponding production operation actually completed.
- **D2-03:** **CredentialStorePort contract (frozen for Phase 3).** Supports the canonical equivalents of: store credential; replace credential; retrieve credential for an authorised consumer; check credential presence; delete credential; inspect envelope/schema version without exposing plaintext; report typed redacted failures. Must NOT expose: list-all-plaintext credentials; export credential; reveal credential preview; retrieve from presentation components; generic arbitrary-secret storage without an approved namespace and policy. Presentation components must not import KeyVault or EncryptedStorage directly. — **Reversibility:** costly — Phase 3 provider flows and tests build on this contract; changing it after consumers exist touches every credential path.
- **D2-04:** **DEC-OP-08 sequencing clarification (not a break).** Phase 1 removed unsafe legacy plaintext credentials. Phase 2 delivers and verifies secure credential-storage capability. Phase 3 asks users to re-enter credentials through the production provider setup flow, validates them, and stores them securely through the Phase 2 CredentialStorePort. The user-facing re-entry event therefore occurs in Phase 3, immediately before secure storage and real provider validation complete as one coherent operation. Record as a sequencing clarification that prevents real credentials from being stored through a fixture-backed success path.
- **D2-05:** **Phase 3 ownership contract (inherited constraint).** Phase 3 must wire both approved credential-entry surfaces (onboarding, Options provider configuration) with this flow: user enters credential → credential remains transient → real provider validation through the approved Requester and ProviderRouter → validation succeeds → credential stored through CredentialStorePort → transient input cleared → provider metadata records configured/validated state without the secret. On validation failure: do not persist the credential; keep or clear transient input per approved UX; return a redacted canonical error; do not mark the provider ready.
- **D2-06:** **Phase 2 credential verification (synthetic sentinel values only).** Verify: plaintext never reaches persistent storage; encrypted envelopes contain required version metadata; unique IV per operation; identical plaintext produces different envelopes; authorised round-trip succeeds through CredentialStorePort; malformed envelopes fail closed; tampered ciphertext / IV / tag / version / authenticated metadata / wrong key fail closed; replacement makes the old value inaccessible; deletion is idempotent; no plaintext in logs, messages, diagnostics, exports, snapshots, evidence, WorkspaceState, WriteJournal, or general application storage; Side Panel and Standalone presentation components cannot directly retrieve credentials; fixture-backed onboarding never calls CredentialStorePort; no provider network request occurs.

#### Legacy message migration & ChatHistoryDB cutover

- **D2-07:** **Migrate existing `np_store` message bodies — do not discard prototype-origin data.** On first Phase 2 startup, perform a one-time, journaled, idempotent migration from legacy `np_store` chat data into ChatHistoryDB. Do not retain message bodies in `np_store` after their migration has been durably verified. — **Reversibility:** costly — the source sanitisation deletes bodies from `np_store`; undoing needs the destination read-back + a reverse migration.
- **D2-08:** **Target storage split.** After migration, `np_store` may retain only approved lightweight application metadata. ChatHistoryDB owns conversations, message bodies, message ordering, message metadata, timestamps, role/message type, approved attachment references, approved workflow/execution references. `np_store` must NOT retain user/assistant/system/tool-result bodies, extracted page content, attachments or large payloads, hidden reasoning, or credential/secret data. If a lightweight conversation index is required, store it in the approved metadata location — `.planning/product/PRODUCT_SPEC.md` §15.1 assigns this to `np_conversation_meta` (`ConversationMeta[]`, LRU 10 active + 100 archived), NOT to `np_store`; the Option-3 redacted-index-in-`np_store` variant was explicitly not chosen because no authoritative contract assigns it there.
- **D2-09:** **Migration protocol stages (journal steps).** Use WriteJournal to coordinate the cross-store migration with explicit, restart-safe stages: `discovered` → `validated` → `destination-write-started` → `destination-written` → `destination-verified` → `source-sanitised` → `completed`. **Canonical mapping:** `WriteJournalEntry.status` stays within the canonical union `pending | applying | completed | failed | rolled-back` (Appendix C); the seven stages are `steps[].name` values. Do NOT claim atomicity across `chrome.storage.local` and IndexedDB — they are separate persistence systems. Use deterministic journal stages, idempotency keys, and authoritative destination read-back instead. — **Reversibility:** costly — stage names persist inside journal entries across restarts; renaming later needs a journal migration.
- **D2-10:** **Per-conversation migration procedure.** For each recognised legacy conversation: (1) validate the legacy record against a recognised schema; (2) derive or preserve the canonical conversation ID; (3) derive stable message IDs from approved existing identifiers or a deterministic migration mapping; (4) validate each message before writing; (5) write conversation + messages into ChatHistoryDB within an IndexedDB transaction where possible; (6) read destination records back; (7) verify expected conversation ID, message count, ordering, message IDs, approved metadata, and body integrity using an in-memory comparison without logging body content; (8) only after successful destination verification, rewrite the legacy `np_store` record without message bodies; (9) confirm through read-back that bodies are absent from `np_store`; (10) mark the journal entry completed.
- **D2-11:** **Source sanitisation.** On destination verification success: remove message bodies from `np_store`; remove obsolete nested message structures; preserve only approved non-body metadata required by the canonical schema; bump the `np_store` schema version; write the migration-complete marker. Do NOT retain a backup copy of message bodies in another `chrome.storage` key. Do NOT include message bodies in migration journals, logs, diagnostics, errors, telemetry, exports, screenshots, test results, or verification evidence.
- **D2-12:** **Migration failure behaviour.** If validation, destination writing, read-back, or source sanitisation fails: do not mark migration complete; do not silently discard data; do not delete the affected source body before destination verification; preserve enough journal state to resume safely; return a redacted typed error; continue or stop per the approved migration failure policy; never log message text. If source sanitisation fails after destination verification: retain the journal stage showing destination verified; retry sanitisation idempotently; do not create duplicate ChatHistoryDB messages. If both a verified destination record and an unsanitised legacy source are found: treat the destination as already migrated; do not duplicate it; complete source sanitisation using the existing journal record.
- **D2-13:** **Unsupported or malformed records.** Unsupported legacy schema: do not guess structure; do not remove the source record; record a redacted migration failure; quarantine/preserve per the canonical recovery policy; present a safe recovery notice if required. Malformed individual messages: do not silently drop them; record the affected conversation and message identifier only; never record body content; follow the canonical partial-failure policy. A decision to discard unrecoverable data requires a separate operator checkpoint.
- **D2-14:** **Migration idempotency.** Safe when: it runs once; it runs multiple times; the extension reloads mid-migration; the service worker stops mid-migration; destination writing completes but source sanitisation does not; source sanitisation completes but the completion marker is delayed; only some conversations were migrated; destination records already exist. Use stable migration IDs and deterministic destination keys. Do not depend on process memory for migration progress.
- **D2-15:** **Required migration tests (synthetic conversations/bodies only).** No legacy history; one conversation with one message; one conversation with many messages; many conversations; empty conversation; duplicate migration execution; interrupted destination write; destination transaction failure; destination read-back failure; source sanitisation failure; service-worker restart between every journal stage; already-migrated destination; partially migrated installation; malformed conversation; malformed message; unsupported schema version; timestamp and ordering preservation; stable IDs; no duplicate messages; schema-version update; migration completion marker; redacted errors and logs. After successful migration verify: all expected bodies exist in ChatHistoryDB; no bodies remain in `np_store`; no bodies in WriteJournal; no duplicate conversations/messages; authorised lightweight metadata intact; rerunning migration performs no destructive change; normal application reads use ChatHistoryDB rather than the legacy source.
- **D2-16:** **Migration evidence.** Include: synthetic fixture description; source record counts; destination record counts; migration-stage results; source-sanitisation result; idempotency result; schema versions before and after. Do not include synthetic message text unless the fixture is explicitly non-sensitive and the evidence contract requires it; prefer hashes or record identifiers only when permitted and useful.
- **D2-17:** **ChatHistoryDB is authoritative for persisted conversations and message bodies.** Preserve existing component-facing store contracts where compatible, but replace the persistence implementation beneath them. **Read path on application/workspace initialisation:** (1) initialise ChatHistoryDB; (2) run or resume the approved legacy migration; (3) hydrate conversation metadata and message records asynchronously; (4) validate every record at the database boundary; (5) apply the hydrated projection to the chat store; (6) expose an explicit hydration status; (7) prevent legacy `np_store` message bodies from being used as a runtime fallback. Do not read message bodies from `np_store` after the Phase 2 cutover. — **Reversibility:** one-way — once production reads/writes are cut over and the source sanitised, reverting storage authority requires a full data migration and breaks the §15.1 published contract that later phases (3/8/9/15) build on.
- **D2-18:** **Hydration states (freeze explicit store-level states).** `idle` | `hydrating` | `ready` | `empty` | `failed` | `recovery required` — use canonical existing identifiers if already defined. Components may keep rendering approved empty/fixture/loading/error presentations through the existing store contract. Do not redesign the Chat interface in Phase 2. Do not present `empty` before hydration completes. Do not treat a database error as empty conversation history.
- **D2-19:** **Write path.** Route all authorised Phase 2 conversation/message persistence through ChatHistoryDB and the approved WriteJournal contract — including writes produced by migration, fixture-backed shell operations authorised to persist, conversation metadata changes within Phase 2 scope, and tests of the production persistence contract. Do not implement real AI message sending, provider streaming, tool results, or production response generation (Phase 3 connects provider-generated messages to this same contract). Each write must define: stable operation ID; conversation ID; message ID where applicable; schema version; expected journal stage; idempotency behaviour; acknowledgement; retry and recovery behaviour; redacted failure result. Never place message bodies inside WriteJournal records if the canonical contract requires references/operation metadata only.
- **D2-20:** **Store boundary, scope, fixtures, failure, transactions.** The chat store may hold the in-memory rendering projection, but ChatHistoryDB remains the persistence authority; the store must not become a second durable database. Preserve compatible component APIs (conversation list, active conversation, messages for the active conversation, hydration status, persistence status, typed error/recovery state) and adapt APIs where necessary to remove synchronous persistence assumptions. Components must not access IndexedDB directly, construct transactions, read legacy `np_store`, manipulate WriteJournal, decide migration state, or swallow persistence failures. **Includes:** ChatHistoryDB schema, DB open/upgrades, conversation and message repositories, asynchronous hydration, journaled persistence, legacy migration, source sanitisation, restart recovery, failure/corruption handling, store integration, deterministic contract + integration tests. **Excludes:** real message sending, provider requests, model execution, streaming, cancellation, provider retries, tool/MCP message production, final Chat UI integration and visual acceptance. **Fixtures:** fixture Chat states may remain for visual development but must be clearly separated from production hydration — never written into ChatHistoryDB automatically, never mistaken for migrated data, never overriding persisted conversations, never marking hydration successful, never in production diagnostics/exports; tests inject fixtures through explicit test adapters only. **Failure:** on ChatHistoryDB init/hydration failure — typed redacted error; no legacy-body fallback; no silent empty history; no discarding source migration data; preserve recoverable journal state; expose the approved recovery action; keep unrelated surfaces operational where safe. One malformed conversation follows the approved partial-failure policy, identifies the record by safe ID only, never logs the body, never silently deletes. **IndexedDB transaction rules:** keep transactions short and self-contained; all reads/writes inside the appropriate transaction; never open a transaction then await unrelated async work (transactions auto-commit when no requests remain); prepare/validate data before opening the write transaction; use `readonly` for hydration/read-back, `readwrite` for bounded mutations, `versionchange` only for schema upgrades; WriteJournal coordinates across persistence systems without pretending IndexedDB and `chrome.storage` share one atomic transaction. **Acceptance:** migrated bodies exist in ChatHistoryDB; `np_store` no longer contains bodies; normal store hydration reads from ChatHistoryDB; authorised writes pass through the journaled persistence contract; components keep working through the store abstraction; loading/empty/failure/ready are distinguishable; restart recovery is deterministic; Phase 3 can write provider-generated messages through the same persistence interface without another storage redesign.

#### IndexedDB store scope, migrator framework, topology

- **D2-21:** **Phase 2 ships only IndexedDB stores with active Phase 2 consumers: ChatHistoryDB, WriteJournalDB, ErrorStore.** Do NOT create MemoryDB or NotesDB stores, schemas, repositories, indexes, fixtures or placeholder APIs — MemoryDB is Phase 8, NotesDB is Phase 9 (per current ROADMAP; use the exact owning phases if numbering changes). Their owning phases must define record shape, indexes/query patterns, retention, deletion/recovery, privacy classification, redaction, import/export, migration requirements, repository boundaries, and UI/service consumers. Do not add inert repository code; do not let later phases write Notes/Memory records into ChatHistoryDB as a temporary workaround. **ChatHistoryDB** = authoritative persistence for conversation records, message records, bodies, ordering metadata, timestamps, approved workflow metadata, approved attachment references, migration provenance where required; Phase 2 owns its initial schema, object stores, indexes, repository APIs, async hydration, journaled writes, legacy migration, restart recovery, corruption/unsupported-version handling, and normal read cutover. **WriteJournalDB** = durable operation log for approved multi-step writes and cross-store migrations; journal records may include only the minimum operation metadata (operation identity/type, target store/repository, affected safe record identifiers, current stage, schema version, retry count, timestamps, acknowledgement state, redacted error code, recovery metadata); must NOT contain credential plaintext, encrypted credential payloads unless explicitly required by the canonical contract, message bodies, note bodies, page content, attachment bodies, hidden reasoning, or complete WorkspaceState objects; operations must be idempotent, restart-safe, replay-safe, bounded, schema-versioned, redacted, and testable with deterministic failure injection. **ErrorStore** = durable redacted record for migration, persistence, degraded-mode and recovery failures (required by §20.4's `IDB_MIGRATION_FAILED` → degraded mode); store only approved safe fields (error ID, canonical error code, severity, operation ID, safe entity ID, subsystem, schema version, recovery status, retry status, occurrence/resolved timestamps, correlation ID, redacted summary); do NOT store message bodies, note bodies, page content, API keys/tokens, ciphertext where it does not serve recovery, request/response bodies, provider payloads, tool/MCP payloads, user-authored content, stack traces containing sensitive values, or arbitrary exception serialization; must have retention rules, bounded record count or approved cleanup policy, redaction before write, safe export rules, idempotent resolution updates, deterministic degraded-mode behaviour; a runtime exception must not automatically be persisted in raw form. **Traceability:** if PRODUCT_SPEC §18 appears to require MemoryDB/NotesDB in Phase 2, record the conflict and this operator decision in Phase 2 CONTEXT.md; do not silently edit the spec during implementation. — **Reversibility:** costly — the migrator framework and store topology become the base later phases extend; changing them later means re-versioning every database.
- **D2-22:** **IndexedDBMigrator framework (Phase 2 deliverable).** A reusable, tested framework supporting: integer database schema versions; ordered upgrade steps; old-version → new-version routing; object-store creation; index creation; object-store and index existence checks; upgrade failure and abort handling; blocked-upgrade handling; version-change connection handling; idempotent data migration where applicable; redacted migration results; deterministic test adapters; unsupported-version errors. IndexedDB uses the version supplied at open time to determine schema, and schema changes happen in the `upgradeneeded` flow; versions are integers, so use an explicit ordered integer-version strategy. Later phases add stores through new schema versions rather than modifying Phase 2 migrations retroactively (e.g. Phase 2 establishes the initial version + active stores; Phase 8 adds Memory stores in a new version; Phase 9 adds Notes stores in a later version). The planner must use canonical project database names, versions and store identifiers rather than inventing names from this example.
- **D2-23:** **DONE-when "Migration from v1 → v2 fixture passes" = the test-only v1→v2 IndexedDB upgrade fixture ONLY.** The Migrator framework's future-store fixture (a later phase adding a store without changing Phase 2 migrations) is the v1→v2 evidence; it must be test-only and must not create production Memory or Notes stores. The `np_store` → ChatHistoryDB legacy extraction migration is verified separately under D2-07…D2-16 and is not counted as this criterion.
- **D2-24:** **Database topology.** Follow the canonical architecture for whether ChatHistoryDB, WriteJournalDB and ErrorStore are separate physical IndexedDB databases or named object stores inside an approved shared database. Do not infer from the `DB` suffix alone that each must be physically separate. If canonical documents do not define the topology, the planner must research and lock the decision before implementation. The topology decision must consider: transaction boundaries; upgrade coordination; blocked upgrades; lifecycle ownership; failure isolation; retention; migration ordering; service-worker and UI-surface access; future Notes and Memory additions. Regardless of topology, repositories must remain logically separated.
- **D2-25:** **Required store/schema/migrator verification.** **Schema:** fresh DB creation; required Phase 2 stores exist; MemoryDB/NotesDB stores do NOT exist; indexes match canonical schema; schema versions are integers and ordered; repeated open does not recreate/corrupt stores; blocked upgrade handled safely; version-change connections close/recover correctly. **ChatHistoryDB:** empty/one/many conversation hydration; message ordering; journaled writes; np_store migration; authoritative read-back; restart recovery; no legacy message-body fallback. **WriteJournalDB:** operation creation; stage progression; idempotent replay; interrupted-operation recovery; duplicate operation handling; redaction; no body/secret persistence; bounded cleanup or compaction. **ErrorStore:** migration-failure recording; degraded-mode recording; redaction before persistence; safe resolution; retention/cleanup; no sensitive content; malformed error rejection. **Migrator:** upgrade from every supported prior version; no-op open at current version; aborted upgrade; failed index creation; partial data transformation failure; deterministic retry; future-store migration fixture proving a later phase can add a store without changing Phase 2 migrations (test-only; no production Memory/Notes stores).

#### Requester + RateLimiter deferral & verification-gate correction

- **D2-26:** **Defer both `src/core/http/Requester.ts` and `src/core/utils/RateLimiter.ts` to Phase 3.** Do not create placeholder implementations merely to satisfy the §18 Phase 2 Create list or an existing path-based verification expectation. Phase 2 performs no authorised production network request and must not implement: provider request queues, HTTP timeout policies, provider retry/backoff, `Retry-After` handling, authenticated provider requests, proxy fetch, or production external fetch wrappers. Phase 3 builds them together with their first real consumers (ProviderRouter, provider adapters, real credential validation, model discovery, streaming, cancellation, timeout handling, safe retry policy, provider-specific rate limiting) so their contracts derive from real provider requirements rather than guesses. — **Reversibility:** reversible — deferral only moves the work; no Phase 2 artifact depends on them.
- **D2-27:** **Phase 3 acceptance requirements (inherited constraint).** **Requester:** AbortSignal propagation from the caller; internal timeout cancellation; canonical 25-second PROXY_FETCH timeout where that rule applies; distinction between caller cancellation and timeout; typed redacted errors; response validation; bounded response-body handling; credential injection outside presentation components; no secrets in URLs/logs/diagnostics/errors/evidence; retry-policy hooks rather than unconditional retries; testable time and fetch adapters. Use AbortController (or an approved equivalent) to cancel the underlying fetch and response-body processing — do NOT implement timeout through `Promise.race` alone because that can leave the underlying request running. Retries must not be enabled generically; the design must distinguish safe/idempotent vs unsafe/non-idempotent requests, network failures, timeouts, explicit cancellation, HTTP 429, HTTP 5xx, permanent HTTP 4xx, and provider-specific retry instructions. **RateLimiter:** per provider or per approved client instance; never a global shared limiter across unrelated providers; deterministic under fake time; cancellation-aware; independent of presentation components; compatible with provider-supplied cooldown information; free from module-level mutable singleton state; explicit about queue limits and overflow behaviour; respect approved provider/HTTP response policy (e.g. `Retry-After`) instead of assuming one universal window. **Integration:** provider validation uses Requester; ProviderRouter applies the correct limiter; cancellation propagates through every layer; credentials retrieved through CredentialStorePort only; retries do not duplicate unsafe operations; logs/diagnostics remain redacted.
- **D2-28:** **Correct `verify:phase-2` to live Phase 2 suites.** The existing `tests/core/utils` expectation is a stale trace from the §18 Phase 2 Create list; correct the gate rather than creating unused files or meaningless tests. The corrected gate must verify live Phase 2 suites for: encrypted storage; KeyVault; CredentialStorePort; ChatHistoryDB; migrations; WriteJournal; workspace persistence; writer election; stale-writer rejection; cross-surface contract simulation; restart and crash recovery. Do not leave an empty-directory requirement; do not add a dummy `RateLimiter.test.ts`; do not weaken the gate. Replace the stale path expectation with concrete Phase 2 suite and artifact expectations, and keep the path-resolution preflight failing when a required Phase 2 suite is missing or misspelled (the Phase 1 `verify:phase-1` self-derived preflight is the pattern to reuse).
- **D2-29:** **Source conflict + operator resolution (recorded, not silently patched).** Record the conflict: PRODUCT_SPEC §18 Phase 2 Create list mentions Requester and RateLimiter; the Phase 2 ROADMAP goal and completion criteria do not require outbound HTTP; the first production consumers belong to Phase 3; therefore both are deferred to Phase 3 and the Phase 2 verification path is corrected accordingly. Update the appropriate planning surfaces — Phase 2 CONTEXT.md, Phase 2 decision traceability, Phase 2 VALIDATION.md, Phase 2 plans, Phase 3 roadmap canonical references / inherited constraints, Phase 3 requirement or task mapping, and verification-gate documentation. Do NOT silently edit the canonical Product Specification during Phase 2; record a documentation follow-up with an owner instead.

#### Deferred-verify coverage — WINDOWS #5 (handoff) and #8 (onboarding)

- **D2-30:** **Two dedicated Phase 2 integration suites on one shared, minimal two-surface test harness.** Create (1) a dedicated cross-surface handoff integration suite for WINDOWS #5; (2) a dedicated two-live-surface onboarding integration suite for WINDOWS #8. Use existing canonical test paths/naming conventions chosen by the planner; do NOT place all coverage into the older Phase 1 test files; do NOT build the full four-surface concurrency harness unless a Phase 2 requirement explicitly needs it. **Shared harness** instantiates: one simulated Side Panel runtime; one simulated Standalone runtime; independent surface stores; stable surface and workspace identities; the real RuntimeEnvelope validator; the real message and event contracts; a deterministic BroadcastBus adapter; the real workspace persistence repository; the real writer-election implementation; deterministic clock and heartbeat control; deterministic tab/focus/reload/lifecycle adapters; restart and crash simulation; Phase 2 database adapters; synthetic-only CredentialStorePort support. The harness must use production schemas, validators, state machines, persistence repositories, election logic, journal logic, migration functions and error identifiers. Mock only environmental boundaries: Chrome tabs, Chrome Side Panel APIs, BroadcastChannel transport, `chrome.storage`, IndexedDB failure injection, time, browser lifecycle. Do not duplicate production election, persistence, migration, or handoff logic inside the harness.
- **D2-31:** **Suite A — WINDOWS #5 handoff contract (clauses).** Cold Standalone target initialisation; target-ready notification before transfer; ready/transfer/acknowledgement ordering; acknowledgement required before reporting success; reuse and focus of an existing Standalone target; duplicate-tab prevention; stable workspace and request identifiers; idempotent duplicate requests; safe handoff projection; composer-draft transfer; no complete WorkspaceState broadcast; no credential or secret in URL, envelope, message, journal, or log; timeout behaviour; bounded retry; rejection of invalid source/target; rejection of unsupported schema versions; persistence and authoritative read-back where required; crash between handoff stages; reload and recovery; failure preserving the original writer; stale-writer rejection after election becomes authoritative. Map every relevant WINDOW #5 and STATE.md clause to a named test. **This suite satisfies Phase 2 automated contract coverage only — it does not close the deferred final Real-Chrome WINDOW #5 observation.**
- **D2-32:** **Suite B — WINDOWS #8 onboarding contract (clauses).** Standalone-first onboarding state; Side Panel joining while onboarding is active; exactly one authoritative onboarding attempt; no competing flow controller; non-secret completion-state persistence; completion in one surface updating the other; update without a page reload; duplicate completion idempotency; cancellation; recovery after one surface closes; schema-version handling; no false provider-ready state; no real provider call; fixture validation remains separate from credential-storage status; API-key input remains local to the originating presentation controller; no API key in workspace state; no API key in BroadcastBus or RuntimeEnvelope; no API key in WriteJournal; no API key in general `chrome.storage` data; no API key in logs, diagnostics, errors, snapshots, or evidence; synthetic credentials reach CredentialStorePort only in tests that explicitly exercise the vault contract; onboarding UI completion remains distinct from credential stored / credential validated / provider ready. Map every relevant WINDOW #8 and STATE.md clause to a named test. **This suite satisfies Phase 2 automated security and coordination coverage only — it does not close the deferred final Real-Chrome WINDOW #8 observation.**
- **D2-33:** **KeyVault and ChatHistoryDB relationships in the suites.** Do not make the handoff suite initialise the full KeyVault merely because it exists in Phase 2; it must instead prove the handoff payload cannot contain a credential. The onboarding suite may use the real CredentialStorePort and KeyVault-backed test implementation only for synthetic credential boundary tests. Because Phase 2 does not wire production onboarding credential entry to the vault: normal onboarding-flow tests remain fixture-backed; vault tests invoke CredentialStorePort directly through an authorised application test adapter; no test may imply fixture validation stores a real credential. Use the real ChatHistoryDB contract only where workspace restoration or handoff requires persisted conversation identity and authorised message hydration; do not populate unnecessary history in every test; use minimal synthetic records to verify persistence survives restart, handoff references resolve correctly, message bodies are not included in handoff envelopes, and production reads use ChatHistoryDB instead of legacy `np_store`.
- **D2-34:** **Writer-election coverage in Phase 2.** Cover: initial writer assignment; writer epoch generation; compare-and-set success; compare-and-set conflict; stale-writer rejection; heartbeat renewal; heartbeat expiry; one-surface closure; failed handoff retaining the existing writer; successful handoff changing authority only after the approved persistence and acknowledgement conditions; mirror-state activation through authoritative election state. Do not expand Phase 2 into the complete Option-3 matrix unless ROADMAP/REQUIREMENTS.md explicitly requires two Side Panels + two Standalones and every promotion permutation; record the broader matrix as a later integration or release-hardening test requirement if not required for Phase 2 acceptance.
- **D2-35:** **Test architecture + gate + traceability.** Prefer: one shared harness; focused scenario builders; deterministic fake time; synthetic secrets; explicit failure injection; one named test per acceptance clause; clear arrange/act/assert; no arbitrary sleeps; no live network; no real Chrome dependency; no test-ordering dependency; complete cleanup after each test. Each suite must be independently runnable; the complete Phase 2 verification gate must run both suites together, and the path-resolution preflight must fail if either suite is missing or misspelled. Maintain a traceability mapping: WINDOW #5 clause → handoff integration test → production contract → Phase 2 requirement → verification evidence; WINDOW #8 clause → onboarding integration test → production contract → Phase 2 requirement → verification evidence. Keep WINDOWS #5 and #8 open after the automated suites pass: record Phase 2 automated contract coverage = PASS; Phase 15 Real-Chrome acceptance = still deferred; Phase 19 release gate = must fail if the human observations remain open.

### the agent's Discretion

- **IndexedDB DB_VERSION numbering** — initial version integers per database, provided versions are integers, ordered, and later phases extend rather than rewrite Phase 2 migrations (D2-22).
- **Database topology implementation** — separate databases vs named object stores, researched and locked before implementation per D2-24's criteria.
- **Exact `np_store` schema version and surviving field list** — the bump and sanitised projection mechanics, keeping the Phase-1 allow-list rebuild pattern (`PERSISTED_BLOB_FIELDS`, `npStoreMigrate`).
- **Test paths and suite naming** — follow existing `tests/core/**` mirroring conventions; suite names must be concrete and referenced by the corrected `verify:phase-2`.
- **Election implementation details within spec pins** — CAS/heartbeat mechanics, epoch representation, mirror-state activation wiring of `MirrorBanner` (D-12 requires Phase 2 to connect it to authoritative election state), subject to §13/§20.11 pins (session-storage election key, 3 s heartbeat, 2 missed heartbeats → re-election, Standalone tie-break).
- **Dependency additions** — `idb ^8` (spec-pinned §7.5) and a deterministic IndexedDB test double (e.g. `fake-indexeddb`) as devDependency; manifest `unlimitedStorage` addition (spec-pinned at Phase 2, ADR-STACK-02) via `wxt.config.ts`.
- **Vault internals** — envelope serialization shape, salt/IV handling, and error-code naming within §15.2 and §C.2 canonical code conventions.
- **Documentation follow-up owner** — who owns the PRODUCT_SPEC §18 Create-list inconsistency note (D2-29); record the follow-up rather than editing the spec.

### Deferred Ideas (OUT OF SCOPE)

- **Requester + RateLimiter** → Phase 3 (D2-26), with Phase 3 acceptance lists inherited (D2-27).
- **Production credential entry, validation, re-entry flow (onboarding + Options)** → Phase 3 (D2-01, D2-04, D2-05).
- **Real AI message sending, provider streaming, cancellation, tool/MCP messages** → Phase 3 (D2-20 scope boundary).
- **MemoryDB** → Phase 8; **NotesDB** → Phase 9 (D2-21), added through the Phase 2 IndexedDBMigrator framework.
- **Full four-surface concurrency matrix** (two Side Panels + two Standalones, all promotion permutations) → later integration/release-hardening test requirement if not required for Phase 2 acceptance (D2-34).
- **Real-Chrome WINDOWS #5 / #7 / #8 closure** → Phase 15 consolidated acceptance cycle; Phase 19 release gate must fail while any remain open.
- **PRODUCT_SPEC §18 Phase 2 Create-list inconsistency correction** → documentation follow-up with an owner (D2-29); not edited during Phase 2.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-02 | Storage/security foundation — encrypted keys, IndexedDB stores, WriteJournal, idempotent migrations, workspace persistence — §15, §16, §20; §18 Phase 2 DONE-when | Mapped below to the four ROADMAP success criteria; every one of them has a concrete, executable verification path in `## Validation Architecture` |

### ROADMAP success criteria → research support

| # | Success criterion | Research support |
|---|-------------------|------------------|
| 1 | WriteJournal recovery test passes — an interrupted write recovers to a consistent state | §20.3 operation union + Appendix O.11 reference implementation (`runJournaled` / `recoverJournal`) quoted verbatim; canonical `WriteJournalEntry` shape; 7 migration stage names; idempotency-key mapping; journal entry persistence in the shared DB; replay/rollback semantics; failure-injection seam |
| 2 | API key encryption round-trip passes (AES-GCM per §15.2); no message body appears in `chrome.storage.local` | §15.2 derivation + envelope design (PBKDF2 100 000 / SHA-256 → AES-GCM-256, per-key 16-byte salt, 12-byte IV, AAD-bound metadata); `chrome.runtime.id` injection requirement; `np_install_secret` lifecycle; `np_store` v3 allow-list rebuild that drops `sessions`/message bodies; source-level + runtime absence assertions |
| 3 | Migration v1→v2 fixture passes (D2-23: test-only IndexedDB upgrade fixture ONLY); IndexedDB writes use single transactions for consistent stores | Migrator design over `openDB`'s single `versionchange` transaction; `IDBPDatabase`/`IDBPTransaction` types from `idb ^8`; existence-check + idempotency rules; the test-only v2 future-store fixture; executed `idb`/`fake-indexeddb` probe results including the auto-commit `InvalidStateError` |
| 4 | Workspace state persists across page reload and cross-surface handoff; `pnpm run verify:phase-2` passes | `np_workspace` persistence through the existing debounced adapter; `np_workspace_primary` election in `chrome.storage.session` (read-back-verified CAS, 3 s heartbeat, 2-miss re-election, Standalone tie-break); corrected `verify:phase-2` composition + self-derived preflight; the two-surface harness |

## Summary

Phase 2 is the persistence and coordination foundation the rest of the roadmap builds on. Three of its four success criteria are already fully determined by canonical contracts that exist in-repo or in the spec (§15.2, §20.2–§20.4, §20.11, Appendix C, Appendix M, Appendix O.11); the remaining work is (a) locking the two decisions the spec leaves open — IndexedDB topology and the integer `DB_VERSION` axis — (b) designing the KeyVault envelope around a WebCrypto reading of §15.2, and (c) building the two-surface test harness that converts WINDOWS #5/#8 from Real-Chrome observations into deterministic in-process contract suites.

This session executed a local probe of `idb@8.0.3` + `fake-indexeddb@6.2.5` and confirmed every behaviour the migrator depends on: versioned `openDB` upgrades with `oldVersion` branching, `blocked`/`blocking` callbacks, `VersionError` on downgrade, `deleteDB` blocked reporting, additive index creation on an existing store, and the transaction auto-commit `InvalidStateError` when an unrelated `await` sits inside a transaction. It also confirmed two environment facts that shape the test plan: `structuredClone` **is** available in the project's vitest 3.2.7 + jsdom 25.0.1 environment (so no `core-js` polyfill is needed), and both `indexedDB` and `chrome.storage.session` are **absent** from `tests/setup.ts` today (so both must be added before any Phase 2 implementation task can be verified). Finally, it reproduced the D2-28 defect: `pnpm run verify:phase-2` currently runs **2 files / 22 tests** and exits 0 while silently ignoring three non-existent path filters.

The two highest-value research outcomes are negative findings that would otherwise have surfaced late. First, `chrome.storage` has **no atomic compare-and-set**, so the §13/§20.11 election must be implemented as read → validate → write → read-back-verify with `electedAt` doubling as the epoch, and the election write must **not** go through the existing 300 ms-debounced `chromeStorageAdapter` (a debounced write cannot be read back immediately, which the CAS requires). Second, the real `BroadcastBus` cannot deliver a message between two simulated surfaces inside one test process — its `INSTANCE_ID` is module-level and its own-echo suppression drops the message — so the D2-30 harness must inject a deterministic transport adapter rather than rely on the shipped bus.

**Primary recommendation:** one physical IndexedDB database holding named object stores (`sessions`, `messages`, `entries`, `errors`) at `DB_VERSION = 1`, with a `chat_*`-free canonical naming decision recorded as a locked decision plus a spec follow-up; a `KeyVault` whose `extensionId` and storage area are injected (production default `chrome.runtime.id`); a `WriteJournal` that follows Appendix O.11 verbatim with the seven D2-09 stages pre-seeded as `steps[].name`; an election whose CAS is read-back-verified over `chrome.storage.session` written directly (never debounced); and a single shared two-surface harness in `tests/harness/` feeding two dedicated integration suites.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential encryption/decryption (KeyVault, EncryptedStorage) | Extension page (Side Panel / Standalone / Options) — `src/core/security/**` | — | `crypto.subtle` needs a secure context; extension pages qualify. Presentation components must never import these modules (D2-03) |
| Credential storage contract (CredentialStorePort) | Service/port layer — `src/services/ports/**` | Extension page consumers | Port is the only consumer-facing surface; authorised consumers only (D2-03) |
| Chat/message persistence authority | IndexedDB (extension page) — `src/core/storage/ChatHistoryDB.ts` | Zustand store (in-memory rendering projection only) | §0.2 forbids IndexedDB from the background SW; D2-20 forbids the store becoming a second durable database |
| Journaled multi-store writes | IndexedDB — `src/core/storage/WriteJournal.ts` + `entries` store | `chrome.storage.local` (for `update-workspace`) | §20.3's `update-workspace` order spans both systems; the journal coordinates, never claims one transaction (D2-09) |
| Legacy `np_store` → ChatHistoryDB migration | Extension page startup path | `chrome.storage.local` (source + sanitisation), WriteJournalDB (stages) | Needs IndexedDB ⇒ cannot run in the SW; must be restart-safe via journal, never process memory (D2-14) |
| `np_workspace` persistence | `chrome.storage.local` via the existing debounced adapter | Zustand WorkspaceStore (in-memory) | §15.1 pins the key; Appendix M.3 pins last-write-wins by `version` |
| Writer election / authority | `chrome.storage.session` (`np_workspace_primary`) written **directly, undebounced** | Surfaces' writer-state store → `MirrorBanner` | §13/§20.11; CAS needs immediate read-back. The background SW is **not** an election participant |
| Hydration state exposure | Zustand chat store (`idle`…`recovery required`) | Components (read-only consumption) | D2-18/D2-20: components consume status through the store contract and never touch IndexedDB |
| Failure recording (degraded mode) | IndexedDB `errors` store + `debugLog` + `notification.error` | UI notice | §20.4 `IDB_MIGRATION_FAILED`; §19.10 `IDB_BLOCKED`. Never records raw exception payloads (D2-21) |
| Handoff protocol | BroadcastBus channel `np_workspace` (Phase-1 protocol, unchanged) | Election (authority), ChatHistoryDB (persisted conversation identity) | Phase 2 adds authority semantics; it does not redesign the ready/transfer/ack protocol (D2-31) |
| Onboarding completion record | `chrome.storage.local` (`np_onboarding`, schema v2) | `chrome.storage.onChanged` propagation | Existing Phase-1 mechanism; Phase 2 adds single-controller coordination (D2-32) |
| Manifest permission (`unlimitedStorage`) | Build config (`wxt.config.ts`) | Build-inspection gate | Spec-pinned at Phase 2 (ADR-STACK-02); the Phase-1 manifest gate pins the permission array and must move in the same change |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | `8.0.3` (spec-pinned `^8`, §7.5) | Typed IndexedDB wrapper: `openDB`, `IDBPDatabase`, `IDBPTransaction`, `blocked`/`blocking`/`terminated` callbacks, `deleteDB` | The only storage dependency the spec names; §20.4's `IndexedDBMigration` interface is written in its types (`IDBPDatabase`, `IDBPTransaction`) |
| `zustand` + `immer` (already installed) | `^5.0.0` / `^11.1.18` | Chat store hydration projection, workspace store, writer-state store | Existing store shape (`create<T>()(persist(immer(...)))`) is the established pattern; Phase 2 removes `sessions` from the persisted projection and adds async hydration |
| `zod` (already installed) | `^4.4.3` | Record validation at the database boundary, `WriteJournalEntry` schema, `WorkspaceCoordinationState` schema, handoff/election envelope schemas | §0.3 requires a Zod schema at every public module boundary; `WorkspaceState.ts` already establishes the strict-schema pattern |
| WebCrypto (`crypto.subtle`) | Platform | PBKDF2 → AES-GCM-256 credential envelope | §15.2 mandates it; never hand-roll crypto |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | `6.2.5` | Deterministic in-memory IndexedDB test double (`devDependency`) | Register once in `tests/setup.ts`; reset per test with `new IDBFactory()` |
| `chrome.storage.session` | Platform | `np_workspace_primary` election record | Phase 2 only; requires a new `tests/setup.ts` mock (absent today) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `idb` | Raw `IDBDatabase` + `promisifyRequest` helpers | Rejected: §7.5 pins `idb ^8`, and §20.4's migration interface is typed with `idb`'s types |
| `fake-indexeddb` | `jsdom`'s (non-existent) IndexedDB, `indexeddbshim`, a hand-written double | Rejected: `indexeddb-shim` needs a real SQLite/native backend and is not deterministic; a hand-written double cannot model transaction auto-commit or `blocked`/`blocking` faithfully. `fake-indexeddb` reproduced every behaviour the migrator depends on, including the `InvalidStateError` auto-commit pitfall |
| `core-js/stable/structured-clone` polyfill (the documented jsdom workaround) | — | **Not needed**: executed probe confirms `structuredClone` is already a function in the project's vitest + jsdom environment |
| Debounced `chromeStorageAdapter` for the election | Direct `chrome.storage.session` read/write | The adapter's 300 ms debounce makes immediate read-back verification impossible, which the CAS requires. Use the adapter for `np_workspace` only |
| One physical DB (recommended) | Three physical DBs (`ChatHistoryDB`, `WriteJournalDB`, `ErrorStore`) | The three-DB shape gives real failure isolation for `IDB_MIGRATION_FAILED` recording, but conflicts with the single-version-axis reading of §20.4's "v4 migration" and D2-22's "Phase 8 adds Memory stores in a new version". See `## Open Questions` OQ-1 |

**Installation:**

```bash
pnpm add idb@^8
pnpm add -D fake-indexeddb@^6
```

**Version verification** (executed this session):

```bash
npm view idb version          # → 8.0.3   (latest; published 2025-05-07)
npm view fake-indexeddb version # → 6.2.5 (latest; published 2025-11-07)
```

Neither package is currently installed in `node_modules` (verified by direct path lookup). `idb` has no `engines`/`peerDependencies` constraint; `fake-indexeddb` declares `engines.node >= 18` (project runs Node v24.21.0). Both are ESM+CJS with bundled `.d.ts`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `idb` | npm | first published 2018; latest 2025-05-07 | 19,054,591/wk | `github.com/jakearchibald/idb` | OK | Approved |
| `fake-indexeddb` | npm | first published 2016; latest 2025-11-07 | 4,909,803/wk | `github.com/dumbmatter/fakeIndexedDB` | OK | Approved (devDependency) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Both verdicts come from `gsd-tools query package-legitimacy check --ecosystem npm idb fake-indexeddb` (`verdict: "OK"`, `postinstall: null`, `deprecated: false` for both). `idb` is additionally named by the canonical spec §7.5 and by §20.4's typed interface, and `fake-indexeddb` is documented as the intended test double in the project's own reference docs — so both are `[VERIFIED: npm registry]` rather than `[ASSUMED]`.

No `postinstall` scripts on either package (checked directly in the legitimacy signals).

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────── Browser (Chrome MV3) ───────────────────────┐
                       │                                                                     │
  user opens Side Panel│                                    user opens Standalone tab        │
        │              │                                              │                      │
        ▼              │                                              ▼                      │
┌──────────────────┐   │                              ┌───────────────────────────┐          │
│ Side Panel       │   │                              │ Standalone                │          │
│ (sidepanel.html) │   │                              │ (standalone.html)         │          │
│  surface runtime │   │                              │  surface runtime          │          │
└────────┬─────────┘   │                              └────────────┬──────────────┘          │
         │             │                                           │                         │
         │  BOTH surfaces run the same startup sequence             │                         │
         ▼             │                                           ▼                         │
   ┌───────────────────────────────────────────────────────────────────────────┐             │
   │ 1. open shared IndexedDB (DB_VERSION)  ── idb openDB ──▶ migrator          │             │
   │      ├─ upgradeneeded?  run ordered IndexedDBMigration[] in the            │             │
   │      │   single versionchange transaction                                  │             │
   │      ├─ blocked(older conn)? ─▶ IDB_BLOCKED notice + in-memory degrade      │             │
   │      ├─ blocking(newer wants in)? ─▶ close connection, re-open             │             │
   │      └─ upgrade aborted? ─▶ IDB_MIGRATION_FAILED ─▶ errors store + notice   │             │
   │ 2. WriteJournal.recoverJournal(load pending|applying, replay)               │             │
   │      └─ resume legacy migration at its recorded stage, or replay the write  │             │
   │ 3. Legacy np_store migration (once, journaled, 7 stages)                    │             │
   │      np_store (chrome.storage.local)  ──extract──▶ sessions + messages      │             │
   │           │                                              │                  │             │
   │           │ sanitise (bodies removed)                    ▼                  │             │
   │           └──────────────▶ np_store v3 (metadata only)   ChatHistoryDB      │             │
   │                            + np_conversation_meta        (sessions,messages)│             │
   │ 4. Async hydration ─▶ validate each record ─▶ apply projection to chat store│             │
   │      status: idle → hydrating → ready | empty | failed | recovery required  │             │
   └───────────┬───────────────────────────────────────────────────────────────┘             │
               │                                                                             │
               ▼                                                                             │
   ┌───────────────────────────────────────────────────────────────────────────┐             │
   │ 5. Writer election (per surface, undebounced)                              │             │
   │      chrome.storage.session.np_workspace_primary                           │             │
   │      read ─▶ validate freshness ─▶ write {tabId,surface,electedAt} ─▶      │             │
   │      read-back-verify ─▶ primary | mirror | election-in-progress | error    │             │
   │      heartbeat every 3 s; 2 missed ⇒ re-election; Standalone tie-break      │             │
   └───────────┬───────────────────────────────────────────────────────────────┘             │
               │                                                                             │
               ▼                                                                             │
   ┌───────────────────────────────────────────────────────────────────────────┐             │
   │ 6. Authorised writes (Phase 2: migration + fixtures + metadata only)        │             │
   │      create WriteJournalEntry(status=pending) ─▶ apply steps (idempotent)   │             │
   │      ─▶ persist entry after each step ─▶ status=completed                   │             │
   │      failure ⇒ rollback applied steps ⇒ status=rolled-back (redacted)       │             │
   │      update-workspace: entry ─▶ np_workspace ─▶ BroadcastBus emit ─▶ entry  │             │
   └───────────┬───────────────────────────────────────────────────────────────┘             │
               │                                                                             │
               ▼                                                                             │
   ┌───────────────────────────────────────────────────────────────────────────┐             │
   │ Credential vault (Phase 2: API only, no UI wiring)                          │             │
   │   CredentialStorePort.store(providerId, secret)                             │             │
   │      ─▶ KeyVault: PBKDF2(utf8(installSecret + chrome.runtime.id), salt,     │             │
   │         100000, SHA-256) ─▶ AES-GCM-256(plaintext, iv, AAD=envelope meta)   │             │
   │      ─▶ chrome.storage.local: np_install_secret + encrypted envelope        │             │
   │   retrieve/delete/presence/version-inspect ─▶ typed redacted failures       │             │
   │   Onboarding credential field stays in component memory (D2-02)             │             │
   └───────────────────────────────────────────────────────────────────────────┘             │
                                                                                             │
  Background SW: NEVER opens IndexedDB (§0.2). Not an election participant.                  │
  Phase 2 adds no networking: CSP stays `connect-src 'none'`.                                 │
                       └─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── core/
│   ├── security/
│   │   ├── KeyVault.ts                 # PBKDF2→AES-GCM envelope create/open/replace/delete/version
│   │   └── redactSensitive.ts          # §18 Create list; redaction before ErrorStore/journal/log writes
│   ├── storage/
│   │   ├── Setting.ts                  # §18 Create list; serialized single-key writes (install secret)
│   │   ├── EncryptedStorage.ts         # §15.2 crypto primitives + envelope codec (KeyVault's crypto layer)
│   │   ├── WriteJournal.ts             # Appendix O.11 runJournaled/recoverJournal + entry schema
│   │   ├── IndexedDBMigrator.ts        # D2-22 framework + the Phase 2 migration table
│   │   ├── NowPilotDB.ts               # topology: one openDB handle, DB_VERSION, store names, adapters
│   │   ├── ChatHistoryDB.ts            # sessions/messages repositories, read-back verification
│   │   ├── ErrorStore.ts               # redacted failure records, FIFO 100, idempotent resolution
│   │   ├── legacyChatMigration.ts      # np_store → ChatHistoryDB, 7 journal stages, sanitisation
│   │   └── legacyCredentialCleanup.ts  # (Phase 1, unchanged)
│   ├── workspace/
│   │   ├── WorkspacePersistence.ts     # np_workspace read/write through the debounced adapter
│   │   ├── WriterElection.ts           # session-storage CAS, heartbeat, epochs, stale-writer rejection
│   │   └── WorkspaceStore.ts           # (Phase 1) SWAP POINT: PHASE1_WRITER_STATE → election state
│   └── onboarding/
│       └── onboardingStateStore.ts     # (Phase 1) + single-controller coordination for W8
├── services/ports/
│   └── credentialStorePort.ts          # Phase 1 interface → extended to the D2-03 contract
└── store/
    └── useExtensionStore.ts            # np_store v3 projection + async hydration + hydration status

tests/
├── harness/
│   └── twoSurface.ts                   # D2-30 shared harness (NOT a test file)
├── core/
│   ├── security/{KeyVault,redactSensitive}.test.ts
│   ├── storage/{EncryptedStorage,IndexedDBMigrator,WriteJournal,ChatHistoryDB,ErrorStore,
│   │            legacyChatMigration,NowPilotDB}.test.ts
│   └── workspace/{WorkspacePersistence,WriterElection}.test.ts
└── integration/
    ├── workspaceHandoff.integration.test.ts    # Suite A — WINDOWS #5 (D2-31)
    └── onboardingTwoSurface.integration.test.ts # Suite B — WINDOWS #8 (D2-32)
```

`tests/harness/twoSurface.ts` must not match vitest's default test glob (it does not — only `*.test.*` files are collected) and must be importable by both integration suites so each is independently runnable (D2-35).

### Pattern 1: One physical database, named object stores, one integer version axis

**What:** A single `openDB(DB_NAME, DB_VERSION, { upgrade, blocked, blocking, terminated })` handle for the whole extension origin, holding `sessions`, `messages`, `entries` (journal), `errors`. Logical repositories (`ChatHistoryDB`, `WriteJournalDB`, `ErrorStore`) stay separate modules over one handle.

**Why (D2-24's criteria, answered):**

| Criterion | One shared DB | Three physical DBs |
|---|---|---|
| Transaction boundaries | `sessions` + `messages` in one `readwrite` transaction — required by §13 and D2-20. Journal `entries` can also join a destination transaction if a later phase wants true atomicity | Same, within each DB; journal↔destination can never be one transaction |
| Upgrade coordination | One `versionchange` event, one ordered migration table, one `blocked` path | Three version axes, three blocked paths, and a cross-DB ordering problem |
| Blocked upgrades | One window; §19.10 degrade covers all stores at once | Three independent windows; a blocked journal DB would leave history writable *unjournaled* — a correctness hazard |
| Lifecycle ownership | One handle per surface, closed once on unload | Three handles to track, close and re-open |
| Failure isolation | Weak: a failed open/migration loses ErrorStore too. Mitigation: `debugLog` + in-memory degrade + the `storage.migrationFailed` notice, exactly as §19.10 prescribes | Strong: ErrorStore still records `IDB_MIGRATION_FAILED` |
| Retention | Per-store policies (errors FIFO 100, journal compaction) are store-level, not DB-level — no loss | Same |
| Migration ordering | One monotonic axis: Phase 2 = v1, later phases bump. Matches §20.4's single "v4 migration" and D2-22's "Phase 8 adds Memory stores in a new version" | §20.4's "add the `notes_backup_config` object store" becomes incoherent (you cannot add a *store* to a *different* database by migrating this one) |
| SW/UI access | SW opens nothing (§0.2) in either shape | Same |
| Future Memory/Notes | Phase 8 adds stores at v2/v3; Phase 9 lands v4 (§20.4) | Each new store group needs its own database name — none is canonical |

**Decision to lock:** one database, `DB_VERSION = 1` in Phase 2. Reserve v4 for §20.4's `notes_backup_config` + Note-field migration (Phase 9); v2/v3 are Phase 8's Memory additions.

**Naming.** No canonical database name exists anywhere in `PRODUCT_SPEC.md` (verified by grep for `openDB(`, `dbName`, "database name" — no hits), so one must be locked here and recorded as a documentation follow-up in the same spirit as D2-29. Recommendation: database `np_db` (the `np_` prefix is the project's canonical storage namespace per `.planning/codebase/CONVENTIONS.md`), object stores named from §15.1's own store-level identifiers: `sessions`, `messages`, `entries`; plus `errors` for ErrorStore (§15.1 gives ErrorStore no store-level name). Record the chosen names in the plan's decision traceability; D2-25's "MemoryDB/NotesDB stores do NOT exist" check becomes an assertion over `db.objectStoreNames`.

**Canonical schema (recommended):**

```ts
// src/core/storage/NowPilotDB.ts
export const DB_NAME = 'np_db';        // locked here — no canonical name in the spec
export const DB_VERSION = 1;           // Phase 2 initial; v4 reserved by §20.4 for Phase 9

export interface NowPilotDB extends DBSchema {
  sessions: { key: string; value: ChatSessionRecord; indexes: { 'by-updated': number } };
  messages: { key: [string, number]; value: MessageRecord; indexes: { 'by-session': string } };
  entries:  { key: string; value: WriteJournalEntry; indexes: { 'by-status': string } };
  errors:   { key: string; value: ErrorRecord; indexes: { 'by-occurred': number } };
}
```

`messages` uses a composite `keyPath: ['sessionId', 'seq']`, which mirrors §15.1's `MemoryDB.messages` keyPath `[conversationId, seq]` and satisfies §20.2's `sessionId + seq` idempotency key directly.

### Pattern 2: IndexedDBMigrator over `idb`'s single versionchange transaction

**What:** An ordered `IndexedDBMigration[]` table (`{ fromVersion, toVersion, description, migrate(db, tx) }`, verbatim §20.4) executed inside `openDB`'s `upgrade` callback. Because IndexedDB runs **one** `versionchange` transaction for a multi-version jump, every applicable step runs in that same `tx`; a step must therefore use the supplied `tx`/`db` and never open its own transaction.

```ts
// Source: PRODUCT_SPEC §20.4 (verbatim interface) + executed idb@8.0.3 probe
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(db: IDBPDatabase, tx: IDBPTransaction): Promise<void>;
}

const MIGRATIONS: IndexedDBMigration[] = [v1InitialPhase2Stores];

const db = await openDB<NowPilotDB>(DB_NAME, DB_VERSION, {
  async upgrade(database, oldVersion, newVersion, tx) {
    for (const m of MIGRATIONS) {
      if (m.toVersion <= oldVersion) continue;         // already applied
      await m.migrate(database, tx);                   // uses tx — never db.transaction()
    }
  },
  blocked(_current, blockedVersion) { recordBlockedOpen(blockedVersion); },   // §19.10 → IDB_BLOCKED
  blocking() { closeForUpgrade(); },                                           // release the old version
  terminated() { markConnectionDead(); },                                      // re-open on next use
});
```

**Rules:**
- **Existence checks are mandatory** for idempotency: `db.objectStoreNames.contains(name)`, `tx.objectStore(name).indexNames.contains(name)`. `db.createObjectStore` throws `ConstraintError` if the store already exists — never rely on the version alone.
- **Never let `upgrade` throw unhandled.** Executed probe: a throwing `upgrade` rejects `openDB` with `AbortError` **and** emits a separate unhandled rejection. Wrap the migration run, capture a redacted result, then rethrow so the transaction aborts deliberately; the caller maps `AbortError` → `IDB_MIGRATION_FAILED`.
- **Opening below the current version rejects with `VersionError`** (probe-verified) → map to an unsupported-version error, never a retry.
- **Opening at the current version is a no-op** — the upgrade callback does not run (probe-verified). Assert this: it is D2-25's "repeated open does not recreate/corrupt stores".

### Pattern 3: Test-only v1→v2 future-store fixture (D2-23)

**What:** A fixture migration table `[v1InitialPhase2Stores, v2FutureStoreFixture]` used **only** in `tests/core/storage/IndexedDBMigrator.test.ts`, where `v2FutureStoreFixture` creates a synthetic store (e.g. `future_probe`) at `toVersion: 2`.

**What it proves:** a later phase can add a store without editing the v1 migration — the Phase 2 acceptance reading of "Migration from v1 → v2 fixture passes".

**Assertions:**
1. After the upgrade, `future_probe` exists **and** every v1 store still exists with its pre-upgrade data intact (no data loss on upgrade).
2. The production `MIGRATIONS` table contains no Memory or Notes store names, and its only entry is `toVersion: 1` (D2-25's "MemoryDB/NotesDB stores do NOT exist").
3. `v1InitialPhase2Stores` is byte-identical before and after the fixture run (the fixture must not modify Phase 2 migrations).
4. A second open at v2 runs no migration (no-op idempotency).

### Pattern 4: KeyVault envelope (§15.2 read through WebCrypto)

**What:** The spec's `PBKDF2(installSecret + extensionId, salt, 100000, SHA-256) → AES-GCM-256` maps onto WebCrypto as: **base key material** = UTF-8 bytes of `installSecret + extensionId`; **PBKDF2 salt** = the per-key random 16-byte salt; derived key = AES-GCM-256, non-extractable, `['encrypt','decrypt']`.

```ts
// Source: MDN SubtleCrypto.deriveKey PBKDF2 example + §15.2 parameters
async function deriveKey(installSecret: string, extensionId: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(installSecret + extensionId), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}
```

**Envelope shape (recommended — `the agent's Discretion`, "vault internals"):**

```ts
interface CredentialEnvelopeV1 {
  v: 1;                                    // envelope version — D2-06 requires version metadata
  providerId: ProviderId;                  // canonical provider namespace
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: 100000 };
  alg: 'AES-GCM-256';
  salt: string;                            // base64, 16 bytes, fresh per store/replace
  iv: string;                              // base64, 12 bytes, fresh per encryption operation
  ciphertext: string;                      // base64 (includes the GCM tag)
}
```

**Authenticated metadata (recommended):** pass `additionalData: utf8(JSON.stringify({ v, providerId, alg, kdf }))` to `encrypt`/`decrypt`. Tampering with the version, provider, algorithm or iteration count then fails the GCM tag check — satisfying D2-06's "tampered … version / authenticated metadata … fail closed" without inventing a signature scheme.

**Tamper behaviour:** AES-GCM authenticates ciphertext + IV + AAD, so a wrong key or any tampering rejects with `OperationError` rather than returning garbage. Map **every** `OperationError` to one redacted failure code — deliberately indistinguishable between "wrong key" and "tampered envelope".

**Requirements the design must carry:**
- `installSecret` = 32 random bytes from `crypto.getRandomValues`, stored base64 in `np_install_secret`. Pin the encoding in the module (base64 of the raw 32 bytes) — the concatenation must be byte-deterministic across surfaces.
- **`chrome.runtime.id` is undefined in the test environment** (executed probe) — `extensionId` and the storage area must be injected dependencies with a production default of `chrome.runtime.id`. Never `navigator.userAgent` (§15.2).
- Fresh salt + IV per operation ⇒ identical plaintext produces different envelopes (D2-06).
- Never log or return plaintext; `retrieve` is reachable only through `CredentialStorePort` for an authorised consumer (D2-03).

### Pattern 5: WriteJournal — Appendix O.11 verbatim + the 7 migration stages

```ts
// Source: PRODUCT_SPEC Appendix O.11 (verbatim) + §20.3
export interface JournalStep { name: string; apply(): Promise<void>; rollback(): Promise<void>; }
export async function runJournaled(
  entry: WriteJournalEntry, steps: JournalStep[],
  persist: (e: WriteJournalEntry) => Promise<void>,
): Promise<void>            // status applying → steps → completed; catch ⇒ rollback applied steps ⇒ rolled-back
export async function recoverJournal(
  load: () => Promise<WriteJournalEntry[]>, replay: (e: WriteJournalEntry) => Promise<void>,
): Promise<void>            // startup: replay every pending | applying entry
```

**Canonical entry shape (Appendix C, verbatim):**

```ts
export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;
  steps: Array<{ name: string; status: 'pending' | 'completed' | 'failed'; error?: string }>;
}
```

**Recommendations:**
- **Pre-seed all seven stage names as `pending`** at entry creation, then flip each to `completed`. O.11's reference *pushes* completed steps; pre-seeding is a deliberate divergence that makes a restart able to distinguish "stage not reached" from "stage reached" — which D2-09's "explicit, restart-safe stages" and D2-12's "retain the journal stage showing destination verified" both require. Record the divergence in the plan.
- **Stage names verbatim:** `discovered`, `validated`, `destination-write-started`, `destination-written`, `destination-verified`, `source-sanitised`, `completed`. `status` stays in the canonical union.
- **`id` = the §20.2 idempotency key** (`update-workspace` → `workspaceId + version`; save chat message → `sessionId + seq`), so a duplicate operation finds the existing entry instead of creating a second one. Store affected safe record identifiers in `targetIds`.
- **Bounded:** keep all non-terminal entries plus the newest N terminal entries; compact on startup after recovery; never delete a non-terminal entry (D2-21 "bounded, schema-versioned").
- **No bodies/secrets:** validate every entry with a strict Zod schema at the write boundary and assert the serialised entry contains no body-shaped value (the same technique the Phase-1 `np_store` projection tests already use).

### Pattern 6: Writer election without an atomic CAS

**Pinned by §13 / §15.1 / §20.11:** election key `np_workspace_primary` in `chrome.storage.session`; record `{ tabId, surface, electedAt }`; startup compare-and-set; heartbeat every 3 s; 2 missed heartbeats ⇒ re-election; Standalone tie-break; `WorkspaceCoordinationState` union as written.

**The constraint the spec does not state:** `chrome.storage` exposes no atomic compare-and-set. Recommendation — **read → validate → write → read-back-verify**:

```ts
// Candidate protocol (mirror-state activation is Phase 2's D-12 carry-forward)
async function elect(): Promise<ElectionOutcome> {
  const now = Date.now();
  const current = await readPrimary();                        // chrome.storage.session.get
  if (current && !isStale(current, now) && !isSelf(current)) return { kind: 'secondary', current };
  const mine = { tabId: myTabId(), surface: mySurface, electedAt: now };
  await chrome.storage.session.set({ np_workspace_primary: mine });   // NOT debounced
  const readBack = await readPrimary();
  return sameIdentity(readBack, mine) && readBack.electedAt === mine.electedAt
    ? { kind: 'primary', epoch: mine.electedAt }
    : { kind: 'secondary', current: readBack };
}
```

- **`electedAt` doubles as the writer epoch.** Each election and each 3 s heartbeat re-mints it, so the record's `electedAt` is simultaneously the election epoch and the liveness timestamp — no new field, so §15.1's pinned record shape is preserved.
- **Stale-writer rejection** = immediately before any authoritative write, re-read the record and accept only when its identity is mine **and** its `electedAt` is not newer than my last refresh. A writer whose heartbeat lapsed (record `electedAt` is newer because another surface re-elected) is rejected with a typed error and demotes to `mirror`. This tolerates the primary's own heartbeat interleaving with an in-flight write.
- **Standalone tie-break** = the deterministic ordering key `(electedAt, surfacePriority)` where `standalone > sidepanel`; a conflicting record with equal `electedAt` resolves in the Standalone's favour.
- **Missed heartbeats** = `now - record.electedAt > 2 * 3000` ⇒ the record is stale and any surface may elect.
- **The write must be undebounced.** The existing `chromeStorageAdapter` applies a 300 ms trailing debounce (with a pending-write read-through); a debounced election write cannot be read back immediately, so the CAS would always lose. Write `chrome.storage.session` directly. (CONTEXT's "Reusable Assets" suggests reusing the adapter — correct for `np_workspace`, wrong for the election. Record this divergence.)
- **The background SW is not a participant.** §13 names only the two surfaces; a closed surface simply stops heartbeating and the other surface promotes itself. Single-surface operation is `WorkspaceCoordinationState.state === 'solo'`.

### Pattern 7: `np_store` v3 allow-list rebuild + legacy chat migration

**Current state (read this session, verbatim):** `NP_STORE_SCHEMA_VERSION = 2`; `partialize` drops `activeSession`, `activeAttachments`, `availableTabs`; `npStoreMigrate` rebuilds from `PERSISTED_BLOB_FIELDS = ['config','sessions','activeSessionId','prompts','writeHistory','notes']`; `merge` normalises every collection and re-seats the in-memory fields.

**Recommended v3 projection:** drop `sessions` and `activeSessionId` from `PERSISTED_BLOB_FIELDS`; keep `config`, `prompts`, `writeHistory`, `notes`. Rationale:
- `sessions[].messages[].content` is the message-body problem this phase exists to fix.
- `sessions[].preview` is `msg.content.slice(0, 50)` — a **body excerpt** and therefore forbidden by D2-08 (it has no canonical home: §21.3's `ConversationMeta` has no `preview`).
- `sessions[].title` is metadata and **does** have a canonical home: `ConversationMeta.title` in `np_conversation_meta` (§15.1/§21.3).
- `activeSessionId` has no canonical home either; the active conversation is derivable from the most-recent `ConversationMeta.lastAccessed`. Record this as a decision to lock (or keep the id in `np_conversation_meta` ordering).
- `notes` and `writeHistory` carry prototype payloads but are **not** chat data and **not** Phase 2's to move (NotesDB is Phase 9, D2-21). Leave them in `np_store` and record the deferral so Phase 9 owns it — do **not** silently drop user data.

**Migration stages map onto the D2-09 names one-for-one:**

| D2-09 stage | Concrete action |
|---|---|
| `discovered` | read `np_store`, parse, normalise through `npStoreMigrate`, count recognised conversations |
| `validated` | validate each conversation/message against the recognised legacy schema; record malformed records by safe id only |
| `destination-write-started` | open the `readwrite` transaction for `sessions` + `messages` |
| `destination-written` | write all conversations + messages in that one transaction; `await tx.done` |
| `destination-verified` | `readonly` read-back: conversation id, message count, ordering, ids, approved metadata, body integrity compared in memory — never logged |
| `source-sanitised` | rewrite `np_store` at schema v3 without bodies; read back to confirm absence |
| `completed` | terminal journal status |

**Completion marker (recommended):** the journal entry's `completed` status **plus** the `np_store` schema bump. D2-11 asks for both a version bump and a "migration-complete marker"; the journal entry is the durable, restart-safe marker and lives in the store built for exactly that. No new `chrome.storage` key is invented. (Alternative if the planner prefers a source-side marker: a `chatMigrationSchemaVersion` stamp inside the `np_store` blob added to the allow-list — record whichever is chosen.)

**Idempotency:** deterministic destination keys (`sessionId` from the legacy `session.id`; `seq` from the array index; message `id` from the legacy id or `mig:<sessionId>:<seq>`). Re-running finds the existing destination records and skips the write; a verified destination + unsanitised source completes sanitisation using the existing entry (D2-12).

### Anti-Patterns to Avoid

- **Awaiting unrelated work inside a transaction.** Executed probe reproduced `InvalidStateError` on the operation after a `setTimeout` await. Prepare and validate everything before opening a `readwrite` transaction; use `readonly` for hydration and read-back.
- **Debouncing the election write.** See Pattern 6.
- **Reusing the real `BroadcastBus` for the two-surface harness.** Its `INSTANCE_ID` is module-level and its own-echo suppression drops in-process cross-surface messages; `tests/setup.ts`'s mock only delivers to *other* channel objects. Inject a deterministic transport (D2-30 explicitly sanctions this).
- **Creating Memory/Notes stores "for later".** D2-21 forbids inert stores; the migrator fixture must use a synthetic name.
- **Throwing from inside `upgrade` without a handler.** Probe-verified double failure mode (rejection **and** unhandled rejection).
- **Journaling every streaming chunk.** `updateLastAssistantMessage` appends a chunk per token; the write path journals at message boundaries, and Phase 3 owns streaming-to-persistence.
- **Treating a database error as an empty conversation history.** D2-18/D2-20 forbid it explicitly; `empty` is only ever reached from a successful hydration that found nothing.
- **`chrome.storage.session.setAccessLevel`.** Not needed: extension pages and the SW are trusted contexts by default, and Phase 2 has no content-script consumer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB request/transaction plumbing | `IDBRequest` promisification, cursor loops, transaction bookkeeping | `idb@8` `openDB` / `IDBPDatabase` / `IDBPTransaction` | §7.5 pins it; §20.4's interface is typed in it; it models `blocked`/`blocking`/`terminated` correctly |
| IndexedDB in tests | a hand-written in-memory double, or mocking the repositories | `fake-indexeddb@6` + `new IDBFactory()` per test | Reproduced every behaviour the migrator depends on, including transaction auto-commit; a repository mock would make the suite vacuous |
| Authenticated encryption | any custom cipher, MAC-then-encrypt, XOR, `btoa` obfuscation | `crypto.subtle` AES-GCM with AAD | §15.2 mandates AES-GCM; GCM already authenticates ciphertext+IV+AAD |
| Key derivation | a home-made KDF, a fixed salt, `Date.now()` as salt | `crypto.subtle.deriveKey` PBKDF2 with a fresh 16-byte salt | Spec-pinned parameters; MDN's canonical PBKDF2→AES-GCM recipe |
| Cross-store write atomicity | pretending `chrome.storage` and IndexedDB share a transaction, or an "atomic" multi-DB write | WriteJournal (O.11) + idempotent steps + authoritative read-back | D2-09 forbids the atomicity claim; replay-safety is what actually delivers consistency |
| Cross-surface mutual exclusion | `navigator.locks`, `Atomics.wait`, a module-level flag | `chrome.storage.session` record + read-back-verified CAS + heartbeats | §13/§20.11 pin the mechanism; module-level state cannot coordinate two documents |
| Secret redaction | ad-hoc `String.replace` per call site | one `redactSensitive.ts` applied at every persistence/log boundary | D2-21 requires redaction **before** write; a single choke point is auditable |
| Deterministic time in tests | `vi.useFakeTimers()` sprinkled per test, `setTimeout` sleeps | one harness clock seam (`advanceHeartbeat()`, `advanceDebounce()`) | D2-35 forbids arbitrary sleeps and test-order dependence |
| Legacy-blob schema rebuilding | a deny-list filter over the stored blob | the Phase-1 allow-list rebuild pattern (`pickFields` + `PERSISTED_*_FIELDS`) | A removed field must not be carried forward; the allow-list makes that structural |

**Key insight:** every problem in this phase that looks like it needs new machinery already has a canonical, spec-pinned answer — `idb` for IndexedDB, WebCrypto for the vault, O.11 for the journal, `chrome.storage.session` + read-back verification for the election, and the Phase-1 allow-list rebuild for `np_store`. The genuinely new engineering is the *wiring* (topology, migrator table, envelope codec, election protocol, harness) and the *verification* (the two integration suites, the corrected gate).

## Runtime State Inventory

> This phase performs a one-way data migration, so runtime state is inventoried even though no source file is renamed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) `chrome.storage.local.np_store` — a zustand-persist JSON string containing `sessions[].messages[].content` (message bodies), `sessions[].preview` (50-char body excerpt), `sessions[].title`, `activeSessionId`, plus `config`/`prompts`/`writeHistory`/`notes`. (2) `chrome.storage.local.np_install_secret` — does not exist yet; Phase 2 creates it. (3) `chrome.storage.local.np_onboarding` — exists at schema v2, non-secret, unchanged by Phase 2. (4) No IndexedDB databases exist yet (Phase 2 creates `np_db`). | **Data migration** (bodies → ChatHistoryDB; `title` → `np_conversation_meta`; `preview`/`activeSessionId` dropped) **plus** code edit (the v3 allow-list + cutover). Legacy `notes`/`writeHistory` payloads are **left in place** and deferred to Phase 9 — record the deferral, do not drop |
| **Live service config** | None. Phase 2 performs no production networking (D2-26) and configures no external service. Verified: `wxt.config.ts` has no service keys; no provider/MCP/webhook configuration exists in Phase 1. | None |
| **OS-registered state** | None — a browser extension registers nothing at OS level. Verified: no `launchd`/`systemd`/scheduler artifacts, no `pm2` ecosystem file in the repo. | None |
| **Secrets and env vars** | (1) `np_install_secret` (new, Phase 2) — generated once, read by every surface's KeyVault. (2) Recognised legacy plaintext credential **field names** (`apiKey`, `token`, `accessToken`, `secret`, `openAiKey`, `geminiKey`) — already destroyed in place by Phase 1's `legacyCredentialCleanup`; the names remain in `LEGACY_SECRET_FIELDS` as the deletion/scan surface and must **not** be restated in new modules (`src/types/index.ts`'s comment forbids it). (3) No `.env` file, no CI secret, no `SOPS` key. | Code edit only. The install secret must be created **before** the first credential write and must be read-back-verified (two surfaces can race on first install) |
| **Build artifacts** | (1) `.output/chrome-mv3/manifest.json` — regenerated by `wxt build`; will gain `unlimitedStorage`. (2) `tests/isolation/generated-manifest.test.ts`'s `AUTHORISED_PERMISSIONS` constant — pins `['sidePanel','storage','tabs']` and **will fail** the moment the permission is added. (3) `verify:phase-1` runs `tests/isolation`, so the Phase-1 gate breaks in the same change. | Code edit: update `wxt.config.ts` **and** the gate constant **and** the `wxt.config.ts` prohibition comment in one change; re-run `pnpm run build:ext` before the manifest gate can pass |

**The canonical question — after every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?** The legacy `np_store` blob is the only runtime system holding pre-Phase-2 state, and it is handled by the journaled migration. There is no live service, no OS registration, and no installed artifact carrying a stale identifier.

## Common Pitfalls

### Pitfall 1: The debounced storage adapter silently breaks the election CAS

**What goes wrong:** The election reuses `chromeStorageAdapter` (as CONTEXT's "Reusable Assets" suggests), writes `{ tabId, surface, electedAt }`, then reads back — and reads back the **pending** value from the adapter's in-memory map, not what actually landed. Worse, in the real extension the read-back races the 300 ms trailing debounce, so both surfaces can believe they won.
**Why it happens:** `chromeStorageAdapter.setItem` defers the write and `getItem` short-circuits to the pending map for the same key. That is correct behaviour for a store, and wrong for a compare-and-set.
**How to avoid:** write `chrome.storage.session` directly for the election; keep the adapter for `np_workspace` only. Assert in the election suite that no debounce timer is involved (drive fake timers and prove the record is visible immediately).
**Warning signs:** an election test that passes with `vi.useFakeTimers()` but fails with real timers; both surfaces reporting `primary`.

### Pitfall 2: `chrome.storage` has no atomic compare-and-set

**What goes wrong:** A naive `get` → compare → `set` sequence loses under interleaving, so two surfaces both elect themselves and both write to `np_workspace`.
**Why it happens:** `chrome.storage` offers only whole-object `get`/`set`/`remove` — there is no CAS primitive, and the surfaces are separate documents.
**How to avoid:** the read → validate → write → **read-back-verify** protocol in Pattern 6, plus stale-writer rejection at every authoritative write (re-read immediately before writing). The read-back is what turns a lost race into a detectable loss.
**Warning signs:** a stale-writer rejection test that never exercises a *newer* `electedAt`; heartbeat tests that never advance time past two intervals.

### Pitfall 3: Transaction auto-commit after an unrelated `await`

**What goes wrong:** a repository reads inside a `readwrite` transaction, awaits a validation helper / timer / storage read, then writes — and the write throws `InvalidStateError`.
**Why it happens:** an IndexedDB transaction commits as soon as no requests are pending at the end of a microtask checkpoint. **Executed probe reproduced this exactly** under `fake-indexeddb`: `"autoCommitPitfall": "InvalidStateError: An operation was called on an object on which it is not allowed or at a time when it is not allowed."`
**How to avoid:** prepare and validate everything *before* opening the transaction; keep all reads/writes inside it; `await tx.done` for writes. This is D2-20's transaction rule verbatim.
**Warning signs:** a `readwrite` transaction containing an `await` on anything that is not an `idb` request.

### Pitfall 4: A throwing `upgrade` produces two failure signals

**What goes wrong:** the migrator lets a migration throw, the test asserts `openDB` rejects, and the suite still fails on an unhandled rejection (or, in the extension, an unhandled error surfaces in the console).
**Why it happens:** **executed probe:** `openDB` rejects with `AbortError: A request was aborted…` **and** a separate `unhandledRejection: "AbortError"` is emitted from the internal transaction abort.
**How to avoid:** catch inside the migrator, record a redacted result, then rethrow deliberately so the abort is intentional; in failure-injection tests attach a temporary `unhandledRejection` guard or inject the failure through the migrator's own seam rather than by throwing from `upgrade`.
**Warning signs:** flaky "unhandled rejection" noise in the migrator suite; a migration failure that produces no `IDB_MIGRATION_FAILED` record.

### Pitfall 5: `blocking` never closes the old connection, so the upgrade hangs forever

**What goes wrong:** a second surface holding an open connection at the old version blocks the first surface's upgrade. `openDB`'s promise never settles; the surface appears hung with no notice.
**Why it happens:** IndexedDB will not run a `versionchange` transaction while any older-version connection is open, and a connection that never calls `close()` in `blocking` blocks indefinitely.
**How to avoid:** implement **both** callbacks — `blocking` closes this connection (after releasing in-flight work) so the newer version can proceed; `blocked` surfaces `IDB_BLOCKED` and degrades to in-memory (§19.10) rather than waiting. **Probe-verified:** `blocked(currentVersion=1, blockedVersion=2)` fires on the requesting connection and `blocking(1, 2)` fires on the holding connection; `held.close()` then lets the v2 open complete.
**Warning signs:** a test that only asserts the `blocked` callback; no `blocking` handler anywhere in `src/`.

### Pitfall 6: Reusing the real `BroadcastBus` in the two-surface harness

**What goes wrong:** the harness instantiates two simulated surfaces in one process, surface A publishes a handoff envelope, and surface B never receives it — so every cross-surface test fails for a reason unrelated to the code under test.
**Why it happens:** `src/core/runtime/BroadcastBus.ts` keeps a module-level `channels` map and a module-level `INSTANCE_ID`; both surfaces share one `BroadcastChannel` object, the `tests/setup.ts` mock only delivers to *other* channel objects, and `isOwnEcho` would drop the message anyway.
**How to avoid:** inject a deterministic transport. `HandoffTransport` is already an injectable dependency of both handoff controllers (`createHandoffInitiator`/`createHandoffTarget` take `transport?`), and D2-30 explicitly sanctions mocking "BroadcastChannel transport". Keep the *real* publish→validate path covered by the existing `tests/core/workspace/WorkspaceHandoff.test.ts` case, which already solves this with `vi.resetModules()` + a second module instance.
**Warning signs:** a harness that imports `BroadcastBus` directly and asserts a delivery.

### Pitfall 7: Body-derived legacy fields smuggled past the sanitiser

**What goes wrong:** the migration moves message bodies to ChatHistoryDB, removes `sessions[].messages`, and leaves `sessions[].preview` (a 50-char body excerpt) and an auto-derived `title` (the first 35 characters of the first message) in `np_store` — so "no message body appears in `chrome.storage.local`" is technically violated.
**Why it happens:** `useExtensionStore` derives `title` and `preview` from message content (`msg.content.slice(0, 35)` / `.slice(0, 50)`), so both *look* like metadata.
**How to avoid:** treat `preview` as a body (drop it — no canonical home) and `title` as metadata (move it to `ConversationMeta.title` per §21.3). Assert the sanitised blob contains no substring of any synthetic body, and separately assert `preview` is gone.
**Warning signs:** a sanitiser test that only checks `messages` is absent.

### Pitfall 8: `fake-indexeddb` state leaking between tests

**What goes wrong:** test 2 hydrates conversations test 1 created, and assertions about "empty history" fail depending on file order.
**Why it happens:** the double keeps state per `IDBFactory` instance; without a reset, every test shares one.
**How to avoid:** register `fake-indexeddb/auto` once in `tests/setup.ts`, expose a `__resetIndexedDB()` helper (the existing `__chromeStorageMap` / `__broadcast` helper convention), and call it in `beforeEach` alongside the storage-map clear. Close every handle in `afterEach`.
**Warning signs:** a suite that passes alone and fails in the full run (D2-35 forbids test-order dependence).

### Pitfall 9: The Phase-1 manifest gate breaks the Phase-1 verification script

**What goes wrong:** adding `unlimitedStorage` to `wxt.config.ts` makes `tests/isolation/generated-manifest.test.ts` case 2 fail, which makes `verify:phase-1` fail on a completed, signed-off phase.
**Why it happens:** `AUTHORISED_PERMISSIONS = ['sidePanel', 'storage', 'tabs']` is asserted by sorted deep-equal, and `verify:phase-1` runs `tests/isolation`.
**How to avoid:** move the config, the gate constant and the `wxt.config.ts` prohibition comment together in one change; re-run `pnpm run build:ext` first (the gate reads `.output/chrome-mv3/manifest.json` and fails rather than skips when the artifact is missing); record the cross-phase gate edit as an authorised change in the phase's change-control trail.
**Warning signs:** a plan that adds the permission without naming the gate file.

### Pitfall 10: Onboarding presents twice because there is no single controller

**What goes wrong:** the Standalone opens the onboarding flow, then the Side Panel opens and presents it again — two competing flows, two completion writes, and WINDOWS #8's "exactly one authoritative onboarding attempt; no competing flow controller" clause is unverifiable.
**Why it happens:** Phase 1's gate (`useOnboardingGate` → `shouldPresentOnboarding`) is evaluated **per surface** and has no coordination; each surface independently decides to present.
**How to avoid:** gate presentation on authoritative writer state — only `primary`/`solo` presents; `mirror`/`election-pending` must not present a competing flow and must render the mirrored completion state. Wire it through the same election that Pattern 6 establishes. Record this as a locked design decision (it is required by D2-32, not optional).
**Warning signs:** a Suite B that asserts completion propagation but never asserts "exactly one flow presented".

### Pitfall 11: `IDB_BLOCKED` degrade silently loses the failure record

**What goes wrong:** the DB cannot open, the code tries to write `IDB_BLOCKED` into the ErrorStore in that same DB, and the record is lost — leaving only a console line.
**Why it happens:** with one shared database, an open failure takes ErrorStore with it.
**How to avoid:** the degraded path must be `debugLog` (redacted) + the persistent `notification.error({ duration: 0 })` notice + in-memory operation, exactly as §19.10 and the UI-SPEC's surface 4 prescribe. Only write to ErrorStore when a connection is actually available. Accept and record this as the known cost of the single-database topology.
**Warning signs:** a degraded-mode test that asserts an ErrorStore record when the DB never opened.

### Pitfall 12: Secret-shaped test values leaking into fixtures or logs

**What goes wrong:** a credential test asserts a round trip and the sentinel ends up in a fixture, a journal entry or a `debugLog` context.
**Why it happens:** the natural way to write the test is to reuse one literal everywhere.
**How to avoid:** follow the existing pattern (`'sk-secret-DO-NOT-LEAK-XYZ123'` then assert *absence* of that literal in every persisted surface), and assert the journal entry, the ErrorStore record and the `debugLog` ring buffer contain no sentinel. D2-06 and D2-32 both require these absences by name.
**Warning signs:** a vault test with no `not.toContain(SENTINEL)` assertion.

## Code Examples

All snippets below are either verbatim from canonical sources or **executed this session** (probe output quoted).

### Executed probe: environment facts (`npx vitest run tests/__probe__/env.probe.test.ts`, probe file deleted afterwards)

```
{"structuredClone":"function","indexedDB":"undefined","IDBKeyRange":"undefined",
 "crypto":"object","subtle":"object","TextEncoder":"function","BroadcastChannel":"function"}
```

`chrome.storage.session` and `chrome.runtime.id` are both absent (undefined) from `tests/setup.ts` today.

### Executed probe: `idb@8.0.3` + `fake-indexeddb@6.2.5` (`node probe2.mjs`)

```
globals: {"indexedDB":"object","IDBKeyRange":"function","structuredClone":"function"}
newFactory: {"open":"function","databases":"function"}
version: 2
stores: ["messages","sessions"]
indexes: ["by-updated"]
noopUpgradeRan: false
autoCommitPitfall: "InvalidStateError: An operation was called on an object on which it is not allowed or at a time when it is not allowed. ..."
correctPattern: 2
```

```
unhandledRejection: "AbortError "
A_openDB_rejected_with: "AbortError: A request was aborted, for example through a call to IDBTransaction.abort."
A_survived: true
B_blockedArgs: [1,2]
B_afterClose: {"version":2,"stores":["x","y"]}
```

```
C_blockedArgs: [1,2]
C_blockingArgs: [1,2]
C_version: 2
D_lowerVersionError: "VersionError"
E_deleteBlocked: 1
E_deleted: true
F_databases: ["blk2@2"]
G_indexes: ["by-title"]
```

### Executed probe: the current `verify:phase-2` defect

```
$ npx vitest run tests/core/storage tests/core/security tests/core/utils \
    tests/core/workspace/WorkspacePersistence.test.ts
 Test Files  2 passed (2)
      Tests  22 passed (22)
exit=0
```

Three of the four declared filters do not exist; vitest silently ignores them and the gate is green.

### Opening, upgrading and the blocked/blocking pair

```ts
// Source: Context7 /jakearchibald/idb — openDB callbacks + executed probe
const db = await openDB<NowPilotDB>(DB_NAME, DB_VERSION, {
  upgrade(database, oldVersion) {
    if (oldVersion < 1) {
      database.createObjectStore('sessions', { keyPath: 'id' })
        .createIndex('by-updated', 'updated');
      database.createObjectStore('messages', { keyPath: ['sessionId', 'seq'] })
        .createIndex('by-session', 'sessionId');
      database.createObjectStore('entries', { keyPath: 'id' })
        .createIndex('by-status', 'status');
      database.createObjectStore('errors', { keyPath: 'id' })
        .createIndex('by-occurred', 'occurredAt');
    }
  },
  blocked(currentVersion, blockedVersion) { /* §19.10: IDB_BLOCKED + in-memory degrade */ },
  blocking() { db.close(); },   // release so the newer version can open
  terminated() { /* mark dead; re-open on next use */ },
});
```

### Correct vs incorrect transaction usage

```ts
// INCORRECT — reproduced as InvalidStateError by the executed probe
const tx = db.transaction('messages', 'readwrite');
const existing = await tx.store.get([sessionId, seq]);
const validated = await someAsyncValidator(existing);   // unrelated await → tx auto-commits
await tx.store.put(record);                             // throws InvalidStateError
await tx.done;

// CORRECT — validate before opening; all requests inside; await tx.done
const validated = someSyncValidator(record);
const tx = db.transaction(['sessions', 'messages'], 'readwrite');
await tx.objectStore('sessions').put(sessionRecord);
await tx.objectStore('messages').put(messageRecord);
await tx.done;
```

### Test-double registration and per-test reset

```ts
// tests/setup.ts — recommended addition
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const resetIndexedDB = (): void => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
};
(globalThis as any).__resetIndexedDB = resetIndexedDB;

// chrome.storage.session — absent today; the election suite cannot run without it
const chromeStorageSession = /* Map-backed, same shape as local/sync */;
(globalThis as any).chrome.storage.session = chromeStorageSession;

// chrome.storage.onChanged — only created ad hoc inside ThemeSync tests today;
// the two-surface harness needs a shared dispatcher both surfaces subscribe to
```

### Deterministic two-surface transport (harness)

```ts
// tests/harness/twoSurface.ts — a deterministic HandoffTransport, per D2-30
export function createLoopbackTransport(): HandoffTransport {
  const listeners: Array<(v: unknown) => void> = [];
  return {
    publish(envelope) { for (const l of [...listeners]) l(structuredClone(envelope)); },
    subscribe(listener) { listeners.push(listener); return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); }; },
  };
}
```

### KeyVault envelope round trip

```ts
// Source: MDN SubtleCrypto PBKDF2→AES-GCM recipe + §15.2 parameters
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const aad = new TextEncoder().encode(JSON.stringify({ v: 1, providerId, alg: 'AES-GCM-256', kdf: KDF }));
const key = await deriveKey(installSecret, extensionId, salt);
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, utf8(plaintext));
// decrypt: same key, same iv, same aad — any mismatch or tamper ⇒ OperationError ⇒ one redacted code
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `fake-indexeddb` bundled a `structuredClone` polyfill | The polyfill was removed in v5; jsdom users must supply one | v5 (2023) | **Not needed here** — probe confirms the project's vitest+jsdom already exposes `structuredClone` |
| `idb` v7 (with a `-with-src` tag) | `idb` v8.0.3 | 2025-05 | Current; no API change affecting this phase's usage |
| `chrome.storage.session` 1 MB | 10 MB (`QUOTA_BYTES = 10485760`) | Chrome 112 | The election record is tiny; irrelevant in practice, but the docs' "1 MB in Chrome 111 and earlier" is stale for any target ≥112 |
| `chrome.storage.session` exposed to content scripts | Default `TRUSTED_CONTEXTS`; `setAccessLevel()` opts in | Chrome 102 | Phase 2 needs no `setAccessLevel` call — extension pages and the SW are trusted |
| `Spin` for loading content areas | `Skeleton` for content areas; `Spin` inline/in-button only | Phase-1 UI-SPEC | Hydration `hydrating` must render `Skeleton` (UI-SPEC surface 1) |
| AntD v5 `notification({ message, btn })` | AntD v6 `notification({ title, description, actions })` | Phase-1 UI-SPEC | All Phase-2 notices use the v6 prop names |

**Deprecated/outdated:**
- `useExtensionStore` persisting `sessions`/message bodies in `np_store` — the exact thing Phase 2 removes (D2-07/D2-17).
- `PHASE1_WRITER_STATE` / `isPrimaryWriter()` in `WorkspaceStore.ts` — the documented Phase-2 SWAP POINT; Phase 2 replaces it with authoritative election state.
- The inline literal `Switched to Standalone.` and the inline `aria-label` in `MirrorBanner.tsx` — the UI-SPEC calls the literal a defect and replaces both with `t('workspace.mirroringNotice')` / `t('workspace.mirrorRefocusA11y')`.
- `.planning/codebase/CONVENTIONS.md` and `CONCERNS.md` are **partly stale** (they reference `vite.config.ts`, `src/main.tsx`, `ThemeProvider.tsx`, `src/services/aiProvider.ts`, a `WorkspaceStore` persist at line 148, "zod never imported", and "ErrorBoundary never mounted" — all superseded by Phase 1). Treat them as background, verify against live code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | One physical IndexedDB database is the topology D2-24 should lock (spec leaves it open) | Standard Stack, Pattern 1, OQ-1 | Medium — a three-DB shape changes the migrator table, the `blocked` handling and every repository's open path; the version axis becomes three axes |
| A2 | The database name `np_db` and store names `sessions`/`messages`/`entries`/`errors` are acceptable canonical identifiers (no canonical name exists in the spec) | Pattern 1 | Low–Medium — a rename before Phase 8 is cheap while nothing else consumes the names; record it in decision traceability |
| A3 | `electedAt` can serve as the writer epoch without adding a field to §15.1's pinned `{ tabId, surface, electedAt }` record | Pattern 6 | Medium — if the planner prefers an explicit `epoch` counter the record shape diverges from §15.1 and needs a recorded extension |
| A4 | `preview` must be dropped and `title` moved to `ConversationMeta`; `activeSessionId` is dropped from `np_store` | Pattern 7 | Medium — dropping `preview` loses a UI affordance the prototype had; the planner must confirm with the UI-SPEC/§12 state matrix |
| A5 | The legacy `notes`/`writeHistory` payloads stay in `np_store` untouched (NotesDB is Phase 9) | Pattern 7, Runtime State Inventory | Low — D2-21 forbids NotesDB in Phase 2, so leaving them is the only compliant option; but it must be recorded so Phase 9 owns the move |
| A6 | The migration-complete marker is the journal entry's `completed` status plus the `np_store` version bump, not a new `chrome.storage` key | Pattern 7 | Low–Medium — D2-11 asks for a marker; if the reviewer wants a source-side stamp, add it to the allow-list |
| A7 | `WriteJournalOperation` needs a new `'migrate-legacy-conversations'` member (the canonical union has no migration operation) | OQ-2 | Medium — §0.2 forbids inventing type names; the extension must be recorded as a spec follow-up, not applied silently |
| A8 | `src/core/storage/Setting.ts` should ship with a real Phase 2 consumer (the install secret) rather than being deferred | OQ-3 | Low — it is on the §18 Phase 2 Create list and is not covered by any deferral; D2-26's rule of thumb only bites if no consumer exists |
| A9 | Onboarding single-controller coordination is implemented by gating presentation on authoritative writer state | Pitfall 10, OQ-4 | Medium — D2-32 requires the clause; the mechanism is `the agent's Discretion` and the planner may choose another (e.g. an onboarding-specific lock record) |
| A10 | `chrome.storage.session` is readable/writable from Side Panel, Standalone and the SW with no `setAccessLevel` call | Pattern 6 | Low — documented default `TRUSTED_CONTEXTS` covers extension pages and the SW |
| A11 | The exact §15.2 concatenation is `utf8(installSecretBase64 + extensionId)` used as PBKDF2 base key material | Pattern 4 | Medium — any other byte reading (e.g. raw-byte concat of a decoded secret) is equally valid; it must be **pinned once** in the module and asserted by a golden test, because changing it later orphans every stored envelope |

## Open Questions

1. **OQ-1 — IndexedDB topology: one database or three?**
   - What we know: §20.4 speaks of a single `v4 migration` that *adds an object store*; D2-22 says Phase 8 "adds Memory stores in a new version" and Phase 9 "adds Notes stores in a later version"; D2-21/D2-25 call the units "stores". This reads as one versioned schema.
   - What's unclear: the spec never names a database, and §15.1's flat list puts `ErrorStore`, `WriteJournalDB`, `AITransactionLogDB` and `notes_backup_config` at the same level as the `*DB` entries.
   - Recommendation: **lock one physical database** (`np_db`, `DB_VERSION = 1`, stores `sessions`/`messages`/`entries`/`errors`) and record the failure-isolation trade-off (ErrorStore unavailable when the DB cannot open ⇒ `debugLog` + notice + in-memory degrade per §19.10). If the operator prefers isolation, the fallback is a separate `ErrorStore` database — record it as an explicit extension with its own version axis.

2. **OQ-2 — No canonical `WriteJournalOperation` member for the legacy migration.**
   - What we know: §20.3's union is closed and contains no migration operation; D2-09/D2-10 require the migration to be journaled with seven stages; D2-21 says journal records carry "operation identity/type".
   - What's unclear: whether to extend the canonical union or to give the migration its own operation identity outside it.
   - Recommendation: **add `'migrate-legacy-conversations'` to the union** (additive, no rename) and record it as a spec follow-up with an owner in the same pattern as D2-29. Do not silently edit `PRODUCT_SPEC.md`.

3. **OQ-3 — Is `src/core/storage/Setting.ts` in Phase 2 scope?**
   - What we know: it is on §18's Phase 2 Create list; no D2 decision defers it (D2-26 defers only Requester/RateLimiter); §13 requires serialized settings writes.
   - What's unclear: whether it has a real Phase 2 consumer, given D2-26's rule of thumb against placeholder files.
   - Recommendation: **implement it with a real consumer** — `np_install_secret` creation is exactly the serialized-write problem §13 describes (two surfaces can race on first install). If the planner cannot name a consumer, record an explicit deferral instead of shipping an unused module.

4. **OQ-4 — What implements WINDOWS #8's "exactly one authoritative onboarding attempt"?**
   - What we know: Phase 1's gate is per-surface; `np_onboarding` + `chrome.storage.onChanged` handle completion propagation but not presentation coordination.
   - What's unclear: the mechanism (writer-state gating vs a dedicated onboarding lock record).
   - Recommendation: gate on authoritative writer state (only `primary`/`solo` presents) so there is one coordination mechanism rather than two; the Suite B tests must name the clause.

5. **OQ-5 — `np_conversation_meta` ownership and LRU.**
   - What we know: §15.1 assigns the conversation index there with "LRU 10 active + 100 archived"; §15.3 puts LRU eviction in MemoryEngine (Phase 8); D2-08 requires the index and forbids it living in `np_store`.
   - What's unclear: whether Phase 2 writes the LRU fields (`status`, `lastAccessed`) and enforces the caps, or only the index.
   - Recommendation: Phase 2 writes `ConversationMeta` records with `status: 'active'` and maintains `lastAccessed`/`messageCount`; **eviction** (the 10/100 caps and `evict-conversation` journaling) stays Phase 8's, per §15.3. Record the boundary so Phase 8 does not re-derive it.

6. **OQ-6 — Where is the install secret generated?**
   - What we know: it must exist before the first credential write; two surfaces can start simultaneously; the background SW may use `chrome.storage.local` and `crypto` (only IndexedDB/AI/EventSource are banned there).
   - What's unclear: SW install-time generation vs lazy create-on-first-use with read-back verification.
   - Recommendation: **lazy create-on-first-use with read-back verification** (mirroring the election's CAS shape) inside `Setting.ts`, so the vault works identically in every context and in tests; the SW may additionally seed it on install for a faster first write, but the vault must not depend on that.

7. **OQ-7 — Does the corrected `verify:phase-2` include `tests/isolation`?**
   - What we know: the manifest changes (`unlimitedStorage`), the new `src/core/security/**` modules must respect surface isolation, and `banned-imports.test.ts` scans `package.json` (neither new package is banned).
   - Recommendation: **yes** — include `tests/isolation` so the manifest gate and the isolation gates run in the Phase 2 gate; that also forces the `AUTHORISED_PERMISSIONS` update to happen in the same change rather than being discovered later.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, tests, tooling | ✓ | v24.21.0 | — |
| pnpm | install, scripts | ✓ | 11.22.0 (`packageManager`) | — |
| TypeScript | `tsc --noEmit` in every gate | ✓ | ~5.8.2 | — |
| vitest | all suites | ✓ | 3.2.7 | — |
| jsdom | test environment | ✓ | 25.0.1 | — |
| `crypto.subtle` (WebCrypto) | KeyVault/EncryptedStorage | ✓ (probe: `crypto.subtle` is an object in the vitest env; extension pages are secure contexts) | platform | — |
| `structuredClone` | `fake-indexeddb` v5+ under jsdom | ✓ (probe) | Node 24 global | `core-js/stable/structured-clone` (documented workaround — not needed) |
| `idb` | migrator + repositories | ✗ | — | **Install required**: `pnpm add idb@^8` (spec-pinned §7.5) |
| `fake-indexeddb` | IndexedDB test double | ✗ | — | **Install required**: `pnpm add -D fake-indexeddb@^6` |
| `indexedDB` global in tests | any IndexedDB suite | ✗ (probe: `undefined`) | — | Provided by `fake-indexeddb/auto` once installed |
| `chrome.storage.session` in tests | election suites | ✗ (probe: `undefined`) | — | **Add a mock to `tests/setup.ts`** |
| `chrome.storage.onChanged` in tests | onboarding propagation, `np_workspace` sync | ✗ (only created ad hoc inside ThemeSync tests) | — | **Add a shared dispatcher to `tests/setup.ts`** |
| `chrome.runtime.id` in tests | KeyVault derivation | ✗ (probe: `undefined`) | — | Inject `extensionId` (production default `chrome.runtime.id`) |
| Chrome browser (real) | WINDOWS #5/#8 Real-Chrome closure | n/a — **deliberately out of scope** | — | Phase 15 consolidated cycle owns it; Phase 19 gate must fail while open |
| Network access | — | n/a — Phase 2 performs none | — | CSP stays `connect-src 'none'` |

**Missing dependencies with no fallback:**
- `idb` and `fake-indexeddb` must be installed before any Phase 2 implementation task can compile or be verified.
- `tests/setup.ts` must gain the `fake-indexeddb` registration + reset helper, a `chrome.storage.session` mock, and a `chrome.storage.onChanged` dispatcher **before** the first Wave-1 implementation task.

**Missing dependencies with fallback:**
- `chrome.runtime.id` — replaced by an injected `extensionId` parameter (this is also the correct production shape, since the vault must be testable).

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json`, so this section is included (absent = enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.7 + jsdom 25.0.1, `globals: true`, `@testing-library/react` 16 for components |
| Config file | `vitest.config.ts` (environment `jsdom`, `setupFiles: ['./tests/setup.ts']`, alias `@` → `src`) |
| Quick run command | `npx vitest run tests/core/security tests/core/storage tests/core/workspace/WorkspacePersistence.test.ts tests/core/workspace/WriterElection.test.ts` |
| Full suite command | `pnpm run verify:phase-2` (after the D2-28 correction) |

No coverage provider is installed; no snapshot tests exist; no jest-dom matchers (use native assertions). Type checking is part of every gate (`tsc --noEmit` runs first).

### Phase Requirements → Test Map

CORE-02's four ROADMAP success criteria expanded into the suites D2-25/D2-28 require.

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|--------------|
| CORE-02 / SC-1 | WriteJournal: operation creation, stage progression, idempotent replay, interrupted-operation recovery, duplicate handling, rollback, redaction, no body/secret persistence, bounded compaction | unit + integration | `npx vitest run tests/core/storage/WriteJournal.test.ts` | ❌ Wave 0 |
| CORE-02 / SC-2 | AES-GCM round trip; envelope version metadata; unique IV; identical plaintext ⇒ different envelopes; malformed/tampered ciphertext/IV/tag/version/AAD/wrong-key fail closed; replace makes old value inaccessible; delete idempotent | unit | `npx vitest run tests/core/security/KeyVault.test.ts tests/core/storage/EncryptedStorage.test.ts` | ❌ Wave 0 |
| CORE-02 / SC-2 | No message body (or body-derived `preview`) in `chrome.storage.local`; no plaintext in logs/journal/ErrorStore/WorkspaceState | unit (absence assertions + source-level scan) | `npx vitest run tests/core/store/useExtensionStore.test.ts tests/core/storage/legacyChatMigration.test.ts` | ⚠️ extend existing |
| CORE-02 / SC-2 | CredentialStorePort: store/replace/retrieve-for-authorised-consumer/presence/delete/version-inspect/typed redacted failures; presentation components cannot import KeyVault | unit + source-level isolation scan | `npx vitest run tests/core/security/credentialStorePort.test.ts` | ❌ Wave 0 |
| CORE-02 / SC-3 | Migrator: fresh create; stores exist; Memory/Notes stores do NOT exist; indexes match; integer ordered versions; repeated open is a no-op; blocked upgrade safe; versionchange close/recover; aborted upgrade; failed index creation; partial transformation failure; deterministic retry; **test-only v1→v2 future-store fixture** | unit + integration | `npx vitest run tests/core/storage/IndexedDBMigrator.test.ts tests/core/storage/NowPilotDB.test.ts` | ❌ Wave 0 |
| CORE-02 / SC-3 | ChatHistoryDB: empty/one/many hydration; ordering; single-transaction conversation+message write; authoritative read-back; restart recovery; no legacy-body fallback | unit + integration | `npx vitest run tests/core/storage/ChatHistoryDB.test.ts` | ❌ Wave 0 |
| CORE-02 / SC-3 | Legacy migration: no history; 1×1; 1×many; many; empty conversation; duplicate run; interrupted destination write; transaction failure; read-back failure; sanitisation failure; restart between **every** stage; already-migrated destination; partially migrated install; malformed conversation; malformed message; unsupported schema; timestamp/ordering preservation; stable ids; no duplicates; schema bump; completion marker; redacted errors/logs | integration (table-driven over the 7 stages) | `npx vitest run tests/core/storage/legacyChatMigration.test.ts` | ❌ Wave 0 |
| CORE-02 / SC-3 | ErrorStore: migration-failure recording; degraded-mode recording; redaction before write; safe resolution; retention/cleanup; malformed-record rejection | unit | `npx vitest run tests/core/storage/ErrorStore.test.ts` | ❌ Wave 0 |
| CORE-02 / SC-4 | Workspace persistence: `np_workspace` round trip, reload survival, version monotonicity, last-write-wins by version, cross-surface handoff persistence | unit + integration | `npx vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ Wave 0 (referenced by the stale gate, does not exist) |
| CORE-02 / SC-4 | Writer election: initial assignment; epoch generation; CAS success; CAS conflict; stale-writer rejection; heartbeat renewal; heartbeat expiry; one-surface closure; failed handoff retains the writer; successful handoff changes authority only after persistence+ack; mirror-state activation | unit + integration | `npx vitest run tests/core/workspace/WriterElection.test.ts` | ❌ Wave 0 |
| CORE-02 / D2-31 | Suite A — WINDOWS #5 handoff contract: 22 named clauses over the shared harness | integration | `npx vitest run tests/integration/workspaceHandoff.integration.test.ts` | ❌ Wave 0 |
| CORE-02 / D2-32 | Suite B — WINDOWS #8 onboarding contract: 22 named clauses incl. all secret-absence assertions | integration | `npx vitest run tests/integration/onboardingTwoSurface.integration.test.ts` | ❌ Wave 0 |
| CORE-02 / D2-28 | Gate composition + self-derived path preflight; manifest carries `unlimitedStorage`; no Phase-1 gate regression | gate | `pnpm run verify:phase-2` | ⚠️ rewrite existing script |
| CORE-02 / §16.4 | Manifest: exactly the authorised permission set including `unlimitedStorage`; CSP unchanged at `connect-src 'none'`; no `content_scripts` key | build-inspection | `npx vitest run tests/isolation/generated-manifest.test.ts` (after `pnpm run build:ext`) | ⚠️ update constant |

**Not in the map (deliberately):** `tests/core/utils/RateLimiter.test.ts` — deferred to Phase 3 (D2-26/D2-28). No placeholder, no dummy test.

### Sampling Rate

- **Per task commit:** the quick run command above (the focused suites the task touched) — must stay under ~30 s.
- **Per wave merge:** `npx vitest run tests/core/security tests/core/storage tests/core/workspace tests/integration tests/isolation tests/core/store` — the full Phase 2 surface without the unrelated repo suites.
- **Phase gate:** `pnpm run verify:phase-2` green (tsc + preflight + every Phase 2 suite) before `/gsd-verify-work`. Note the gate must be run **after** `pnpm run build:ext` because the manifest gate fails (never skips) when `.output/chrome-mv3/manifest.json` is absent — the plan must sequence the build before the gate.

### Wave 0 Gaps

Test infrastructure that must exist **before** any implementation task can be verified:

- [ ] `package.json` — add `idb@^8` (dependency) and `fake-indexeddb@^6` (devDependency).
- [ ] `tests/setup.ts` — `import 'fake-indexeddb/auto'`, a `__resetIndexedDB()` helper backed by `new IDBFactory()`, a Map-backed `chrome.storage.session` mock, and a shared `chrome.storage.onChanged` dispatcher (both surfaces subscribe to the same emitter).
- [ ] `tests/harness/twoSurface.ts` — the D2-30 shared harness: two simulated surface runtimes, independent stores, stable identities, a deterministic loopback transport, a deterministic clock/heartbeat seam, deterministic tab/focus/reload adapters, restart/crash simulation, Phase 2 DB adapters, synthetic-only CredentialStorePort support. Not a test file; imported by both integration suites.
- [ ] `tests/core/security/` — new directory (currently absent): `KeyVault.test.ts`, `EncryptedStorage.test.ts`, `credentialStorePort.test.ts`, `redactSensitive.test.ts`.
- [ ] `tests/core/storage/` — add `NowPilotDB.test.ts`, `IndexedDBMigrator.test.ts`, `ChatHistoryDB.test.ts`, `WriteJournal.test.ts`, `ErrorStore.test.ts`, `legacyChatMigration.test.ts`.
- [ ] `tests/core/workspace/` — add `WorkspacePersistence.test.ts` (referenced by the stale gate but missing) and `WriterElection.test.ts`.
- [ ] `tests/integration/` — new directory: `workspaceHandoff.integration.test.ts`, `onboardingTwoSurface.integration.test.ts`.
- [ ] `package.json` `verify:phase-2` — rewrite with an explicit path list **plus** the self-derived preflight copied from `verify:phase-1` (`node -e` path-resolution check over the script's own declared paths, exiting 1 with the missing paths named).
- [ ] `tests/isolation/generated-manifest.test.ts` — update `AUTHORISED_PERMISSIONS` to include `unlimitedStorage` in the same change as `wxt.config.ts`.
- [ ] `tests/core/store/useExtensionStore.test.ts` — extend for the v3 projection (`sessions`/`activeSessionId` gone, `preview` gone, bodies absent) and the async-hydration contract.

### Traceability artefacts the plan must carry (D2-35)

- WINDOW #5 clause → handoff integration test name → production contract → Phase 2 requirement → evidence.
- WINDOW #8 clause → onboarding integration test name → production contract → Phase 2 requirement → evidence.
- WINDOWS #5 and #8 stay `open` after the automated suites pass: record "Phase 2 automated contract coverage = PASS", "Phase 15 Real-Chrome acceptance = deferred", "Phase 19 release gate must fail while open".

## Security Domain

> `security_enforcement` is not disabled in `.planning/config.json`, so this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 2 authenticates nobody; provider credential validation is Phase 3 (D2-05) |
| V3 Session Management | Partial | `chrome.storage.session` holds the election record only (in-memory, cleared on browser close). ServiceNow session tokens are Phase 17 and must never enter `chrome.storage.local` (§0.2) |
| V4 Access Control | **Yes** | `CredentialStorePort` is the only credential surface for authorised consumers; presentation components must not import `KeyVault`/`EncryptedStorage` (D2-03); writer-election authority gates who may write (`primary`/`solo` only) |
| V5 Input Validation | **Yes** | Strict Zod schemas at every boundary: DB record validation on hydration (D2-17 step 4), `WriteJournalEntry` on every journal write, handoff envelopes (already strict), `WorkspaceCoordinationState`, the credential envelope on open, and the legacy-record schema during migration (D2-10 step 1) |
| V6 Cryptography | **Yes** | `crypto.subtle` only — PBKDF2 (100 000, SHA-256) → AES-GCM-256, fresh 16-byte salt and 12-byte IV, AAD-bound envelope metadata. **Never hand-roll.** No `navigator.userAgent` (§15.2). Non-extractable derived keys |
| V7 Error Handling & Logging | **Yes** | Redaction before every persistence/log write (`redactSensitive.ts` + D2-21's ErrorStore rules); typed redacted failures; no stack traces with sensitive values; no arbitrary exception serialisation persisted |
| V8 Data Protection | **Yes** | Message bodies only in IndexedDB (§15.1/§0.2); no bodies in journals, ErrorStore, logs, diagnostics, evidence (D2-11/D2-16); `unlimitedStorage` requested without widening `connect-src` |
| V9 Communications | No | Phase 2 performs no production network request; CSP stays `connect-src 'none'` |
| V10 Malicious Code | Partial | No remote code, no `eval`, no `innerHTML` (existing banned-import gates cover it) |
| V11 Business Logic | **Yes** | Migration idempotency and failure semantics (D2-12/D2-14); replay-safe journal steps; no success claim without destination read-back |
| V12 Files & Resources | No | File System Access is Phase 9 and Standalone-only |
| V13 API & Web Service | No | Phase 3 |
| V14 Configuration | **Yes** | Manifest least-privilege with a recorded, gate-enforced permission addition |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|--------------------|
| Plaintext credential persisted (regression of the Phase-1 defect) | Information disclosure | Vault-only writes; strict envelope type with nowhere to put plaintext; absence assertions over every persisted surface (D2-06) |
| Credential/body leaked into logs, journals, ErrorStore or evidence | Information disclosure | `redactSensitive.ts` at every persistence boundary; field-name-only reporting (the Phase-1 `legacyCredentialCleanup` pattern); sentinel-absence tests |
| Ciphertext/IV/tag/version/AAD tampering or wrong key | Tampering | AES-GCM authenticates ciphertext+IV+AAD; every failure maps to one indistinguishable redacted code |
| Envelope downgrade (an old `v` silently accepted) | Tampering | `v` is inside the AAD, so a changed version fails the tag; the reader also refuses an unknown version explicitly |
| Message body surviving in `chrome.storage.local` as `preview`/auto-title | Information disclosure | Treat `preview` as a body (drop it) and `title` as metadata (move to `np_conversation_meta`); assert no body substring survives |
| Replay / duplicate journaled write creating duplicate messages | Tampering / repudiation | Deterministic idempotency keys (§20.2), idempotent `apply()`, deterministic destination keys, read-back verification before marking complete |
| Stale writer mutating `np_workspace` after another surface took over | Tampering | Read-back-verified CAS + stale-writer rejection on every authoritative write |
| Two surfaces running two onboarding flows and storing two completions | Tampering | Single-controller gating on authoritative writer state; idempotent completion writes (OQ-4) |
| Migration data loss (bodies deleted before verification) | Data loss / denial of service | Sanitise **only** after destination read-back verification (D2-10 step 8); never retain a backup copy (D2-11); quarantine unsupported records rather than guessing (D2-13) |
| `IDB_BLOCKED` / `IDB_MIGRATION_FAILED` silent data loss | Denial of service | Typed failure + persistent notice + in-memory degrade (§19.10); ErrorStore record when a connection is available; never present a failure as `empty` |
| Quota exhaustion silently stopping persistence | Denial of service | `unlimitedStorage` at Phase 2 (ADR-STACK-02); bounded ErrorStore (FIFO 100) and journal compaction; surfaced typed errors rather than swallowed flush failures |
| Journal or ErrorStore as an exfiltration channel | Information disclosure | Strict entry schemas + `targetIds` (safe identifiers only); no bodies, ciphertext, page content, hidden reasoning or whole `WorkspaceState` (D2-21) |
| Cross-context message forgery | Spoofing | Existing Phase-1 guard (`sender.id !== chrome.runtime.id` → reject) unchanged; the harness must exercise the real validator |
| Service-worker contamination (IndexedDB/AI in the SW) | Elevation of privilege | §0.2 hard rule; the SW is not an election or DB participant; existing isolation gates plus the new modules' import boundaries |

## Sources

### Primary (HIGH confidence)

- **Executed locally this session** — `idb@8.0.3` + `fake-indexeddb@6.2.5` probe (`node probe2.mjs`, `probe3.mjs`, `probe4.mjs` in a scratch dir): `openDB` upgrade branching, `blocked`/`blocking`/`terminated` callbacks, `VersionError` on downgrade, `deleteDB` blocked, additive index creation, transaction auto-commit `InvalidStateError`, throwing-upgrade `AbortError` (+ unhandled rejection), no-op reopen, `databases()`.
- **Executed locally this session** — `npx vitest run tests/__probe__/env.probe.test.ts` (probe file removed afterwards): `structuredClone` present, `indexedDB`/`IDBKeyRange`/`chrome.storage.session`/`chrome.runtime.id` absent.
- **Executed locally this session** — `npx vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts` → 2 files / 22 tests / exit 0 (the D2-28 defect).
- **Read verbatim this session** — `src/store/useExtensionStore.ts` (persist config, `NP_STORE_SCHEMA_VERSION`, `PERSISTED_*_FIELDS`, `npStoreMigrate`, `merge`/`partialize`), `src/core/workspace/WorkspaceStore.ts` (`PHASE1_WRITER_STATE`, `WorkspaceMirrorState`, no persist), `src/core/workspace/WorkspaceState.ts` (strict schema, three version axes), `src/core/workspace/handoff/protocol.ts` (ready/transfer/ack, URL allowlist, injectable `HandoffTransport`), `src/core/workspace/handoff/useWorkspaceHandoff.ts`, `src/core/workspace/WorkspaceRouter.ts`, `src/core/theme/chromeStorageAdapter.ts` (300 ms debounce, `__test__` seams), `src/core/onboarding/onboardingStateStore.ts`, `src/core/storage/legacyCredentialCleanup.ts`, `src/core/runtime/BroadcastBus.ts` (`INSTANCE_ID`, `_sender`), `src/core/log/debugLog.ts`, `src/components/common/MirrorBanner.tsx`, `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/background.ts`, `src/services/ports/credentialStorePort.ts`, `src/types/index.ts`, `tests/setup.ts`, `tests/core/workspace/WorkspaceHandoff.test.ts`, `tests/isolation/generated-manifest.test.ts`, `package.json`, `wxt.config.ts`, `vitest.config.ts`.
- **Read verbatim this session** — `.planning/product/PRODUCT_SPEC.md` §0.2, §7.5, §13, §15.1–§15.3, §16.2–§16.5, §18 Phase 2, §19.8/§19.10/§19.12, §20.2–§20.4/§20.11, §21.3/§21.5, §24, Appendix C (`WriteJournalEntry`, C.2 error codes), Appendix M, Appendix O.11.
- **Context7 `/jakearchibald/idb`** — `openDB` signature + callbacks, `upgrade(db, oldVersion, newVersion, tx, event)`, `deleteDB` blocked, transaction lifetime / auto-commit / `tx.done`.
- **Context7 `/dumbmatter/fakeindexeddb`** — `fake-indexeddb/auto`, `new IDBFactory()` reset, the jsdom `structuredClone` note (v5+).
- `gsd-tools query package-legitimacy check --ecosystem npm idb fake-indexeddb` → both `OK`.

### Secondary (MEDIUM confidence)

- `developer.chrome.com/docs/extensions/reference/api/storage` — `storage.session` in-memory semantics, `QUOTA_BYTES 10485760`, `setAccessLevel`, `TRUSTED_CONTEXTS` default.
- `developer.mozilla.org/Web/API/SubtleCrypto/deriveKey` and `/encrypt` — PBKDF2 100 000/SHA-256 → AES-GCM-256, 16-byte salt, 12-byte IV, secure-context requirement, GCM authentication behaviour.
- Chromium-extensions group thread — trusted vs untrusted contexts, `setAccessLevel` scoped to `storage.session` only.
- In-repo maps: `.planning/codebase/CONVENTIONS.md`, `TESTING.md`, `STRUCTURE.md`, `CONCERNS.md` (partly stale — verified against live code where it mattered).

### Tertiary (LOW confidence)

- Community write-ups on extension key-management patterns (used only to sanity-check the envelope shape; every design decision above is anchored to §15.2 and MDN instead).

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — `idb` is spec-pinned and both packages were executed locally; versions confirmed against the npm registry; both pass the legitimacy gate.
- Architecture: **HIGH** for the migrator, WriteJournal, `np_store` cutover and election mechanics (canonical contracts + executed probes + verbatim source reads); **MEDIUM** for the topology lock and the `electedAt`-as-epoch reading, which the spec leaves open and which are recorded as locked recommendations with their trade-offs (A1, A3, OQ-1).
- Pitfalls: **HIGH** — every pitfall is either reproduced by an executed probe (transaction auto-commit, throwing upgrade, blocked/blocking), read verbatim in the source (debounce read-through, module-level `INSTANCE_ID`, per-surface onboarding gate, the manifest gate constant), or a direct restatement of a canonical rule (D2-20 transactions, §0.2 SW ban).

**Research date:** 2026-09-23
**Valid until:** 2026-10-23 (30 days — the stack is pinned and stable; re-verify only if `idb`/`fake-indexeddb` majors move or the PRODUCT_SPEC is revised)

