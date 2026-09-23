# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 2-Storage, Security, WriteJournal, Workspace Persistence
**Areas discussed:** Credential vault wiring, Legacy message migration, Requester + RateLimiter, Deferred-verify coverage, IndexedDB store scope, v1→v2 migration interpretation

---

## Credential vault wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Vault API only | Ship KeyVault/EncryptedStorage + typed CredentialStorePort; onboarding stays fixture-backed; Phase 3 wires re-entry with real validation | ✓ |
| Vault + onboarding write | Also persist onboarding API-key entry into KeyVault now, validation still fixture-backed | |
| Vault + onboarding + Options | Also re-enable the deferred Options credential fields | |

**User's choice:** Vault API only, with an extensive locked contract (CredentialStorePort surface, synthetic-only verification matrix, DEC-OP-08 sequencing clarification, Phase 3 ownership flow).
**Notes:** A fixture-generated success must never cause a real credential to be stored — four states must stay distinct (input accepted / encrypted+stored / validated / runtime ready). Presentation components must not import KeyVault or EncryptedStorage directly. UI may show a non-interactive capability notice; must not claim stored/connected/validated/ready.

---

## Legacy message migration

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate existing bodies | One-time journaled idempotent extraction into ChatHistoryDB, then sanitise np_store | ✓ |
| Start clean — drop bodies | No data carry-over; stop persisting sessions | |
| Migrate + keep redacted index | Migrate bodies but keep a redacted conversation index in np_store | |

**User's choice:** Migrate, with a full protocol: 7 named journal stages, per-conversation procedure, destination read-back verification, source sanitisation + np_store schema bump, failure/malformed/idempotency policy, required tests, evidence rules.
**Notes:** Option 3 explicitly not chosen — no authoritative contract assigns a redacted index to np_store; §15.1 assigns lightweight conversation metadata to `np_conversation_meta`. Do not claim atomicity across chrome.storage.local and IndexedDB.

## ChatHistoryDB read/write cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Store cutover | Store hydration/read path uses ChatHistoryDB; component contracts preserved; explicit hydration states | ✓ |
| DB layer only | Ship DB + migration; no read wiring (violates "normal reads use ChatHistoryDB") | |
| Full chat cutover | Also message-send/write path and UI async states | |

**User's choice:** Store cutover with hydration states (`idle`, `hydrating`, `ready`, `empty`, `failed`, `recovery required`), journaled write path, store-boundary rules, scope includes/excludes, fixture separation, failure behaviour, IndexedDB transaction rules, required tests, acceptance criteria.
**Notes:** ChatHistoryDB is the persistence authority; the store is an in-memory rendering projection only. Phase 3 writes provider-generated messages through the same contract.

---

## Requester + RateLimiter

| Option | Description | Selected |
|--------|-------------|----------|
| Include both | Build Requester + RateLimiter + tests in Phase 2 per §18 Create list | |
| RateLimiter only | Ship RateLimiter (verify:phase-2 path) and defer Requester | |
| Requester only | Ship the HTTP foundation and defer RateLimiter | |
| Defer both | Move both to Phase 3; correct the verification gate | ✓ |

**User's choice:** Defer both to Phase 3. No placeholder implementations. Phase 2 performs no authorised production network request.
**Notes:** Correct `verify:phase-2` to live Phase 2 suites (no empty dirs, no dummy tests, no weakened gate, keep path preflight). Record the spec/roadmap conflict as an operator resolution and a documentation follow-up — do not edit PRODUCT_SPEC during Phase 2. Phase 3 inherits explicit Requester/RateLimiter/integration acceptance requirements (AbortController over Promise.race; retry policy distinctions; per-instance limiter; Retry-After policy).

---

## Deferred-verify coverage (WINDOWS #5 / #8)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated two-surface suites | One shared minimal harness + a handoff suite and an onboarding suite over production contracts | ✓ |
| Extend Phase 1 suites | Add the new clauses into existing Phase 1 test files | |
| Full multi-surface harness | Include the §19.8/§19.12 four-surface matrix | |

**User's choice:** Dedicated suites on one shared harness (production schemas/validators/state machines/persistence/election/journal/migrations; mock only environmental boundaries). Full clause lists for Suite A (#5) and Suite B (#8); KeyVault/ChatHistoryDB usage rules; writer-election coverage list; test architecture rules; traceability mapping; WINDOWS stay open.
**Notes:** Do not build the Option-3 four-surface matrix unless a Phase 2 requirement demands it — record it as later integration/release-hardening. Both suites must run in the Phase 2 gate and be covered by the path preflight.

---

## IndexedDB store scope

| Option | Description | Selected |
|--------|-------------|----------|
| ChatHistory + WriteJournal + Error only | Ship stores with active Phase 2 consumers; defer MemoryDB/NotesDB to Phases 8/9 | ✓ |
| Include MemoryDB + NotesDB schemas | Create inert migrator-ready stores now | |
| Full §18 storage set | Full storage foundation with repository APIs | |

**User's choice:** Option 1, with detailed per-store contracts (ChatHistoryDB authority, WriteJournalDB metadata-only records, ErrorStore redacted/bounded/retention rules), the IndexedDBMigrator framework requirements, database-topology research requirement, transaction rules, and verification matrix.
**Notes:** Do not create MemoryDB/NotesDB stores, schemas, repositories, indexes, fixtures or placeholder APIs. Later phases add stores through new schema versions rather than modifying Phase 2 migrations. If §18 appears to require MemoryDB/NotesDB in Phase 2, record the conflict and this operator decision — do not silently edit the spec.

## v1→v2 migration interpretation

| Option | Description | Selected |
|--------|-------------|----------|
| Both | IndexedDB v1→v2 upgrade fixture AND the np_store extraction migration | |
| IndexedDB v1→v2 only | Test-only future-store upgrade fixture is the DONE-when evidence | ✓ |
| np_store migration only | The np_store extraction is the DONE-when evidence | |

**User's choice:** IndexedDB v1→v2 only. The np_store extraction migration is verified separately under its own decision.

---

## the agent's Discretion

- IndexedDB DB_VERSION numbering (integer, ordered; later phases extend).
- Database topology (separate DBs vs named stores) — research and lock before implementation.
- Exact np_store schema version and surviving field list (allow-list rebuild pattern).
- Test paths and suite naming (existing conventions).
- Election implementation details within §13/§20.11 pins; MirrorBanner activation wiring.
- Dependency additions: `idb ^8`, deterministic IndexedDB test double; `unlimitedStorage` manifest addition.
- Vault internals within §15.2 and §C.2 conventions.
- Documentation follow-up owner for the §18 Create-list inconsistency.

## Deferred Ideas

- Requester + RateLimiter → Phase 3.
- Production credential entry/validation/re-entry → Phase 3.
- Real AI message sending/streaming/cancellation/tool messages → Phase 3.
- MemoryDB → Phase 8; NotesDB → Phase 9.
- Full four-surface concurrency matrix → later integration/release-hardening.
- Real-Chrome WINDOWS #5/#7/#8 closure → Phase 15 consolidated cycle; Phase 19 gate fails while open.
- PRODUCT_SPEC §18 Create-list correction → documentation follow-up with owner.
- MirrorBanner final copy/visual treatment → Phase 15.
