# ADR-0001 — Background-serialised workspace election

**Status:** Proposed — awaiting operator approval (2026-09-19)
**Phase:** 01 — Runtime, Shells, and Workspace
**Supersedes:** the direct multi-context election write model in the originally
approved Phase 01 `DESIGN.md` Section 6 (Phase 01 decision 6), which permitted
Side Panel and Standalone to write `np_workspace_election` directly and
concurrently.

## Context

Phase 01's approved election module (`src/core/workspace/WorkspaceElection.ts`)
performed a non-atomic read-then-write on `chrome.storage.session`:

1. read `np_workspace_election`;
2. if absent/invalid, build a fresh record and persist it;
3. return `acquired`.

`chrome.storage` exposes no atomic compare-and-swap. Two extension contexts (for
example two Side Panels, or a Side Panel and a Standalone) that both observe an
absent/invalid record can both persist a record and both believe they are the
writer. The controller review of Task 13 reproduced two raw election writes and
a losing claimant that also returned `acquired`. That authorises two live
writers, which is a Task 13 STOP condition and conflicts with the Phase 01
invariant in `DESIGN.md` Section 6: "never two authorised writers".

The originally approved design also stated "background is not owner/broker",
which removed the only context that could act as a serialisation point.

## Decision

The background service worker becomes the **narrow serialisation authority** for
operations that change the elected workspace writer.

The previous absolute rule:

> background is not owner/broker

is replaced by:

> background is not a workspace owner or ordinary mutation broker. The background
> is the narrow serialisation authority for operations that change the elected
> workspace writer.

The background remains prohibited from acting as:

- workspace owner;
- workspace writer;
- ordinary workspace mutation broker;
- owner of workspace content;
- provider or MCP runtime;
- IndexedDB owner;
- long-lived in-memory source of truth.

Side Panel and Standalone remain the only eligible workspace writers. Ordinary
workspace mutations continue to flow through the elected UI-surface writer and
must not pass through the background election arbiter.

### Serialisation mechanism

The background election arbiter uses one explicit FIFO promise queue (or an
equivalent exclusive executor). Asynchronous runtime-message handlers are not
assumed to run serially; every election-changing request is enqueued whole.

For every election-changing request the arbiter must:

1. validate the sender and `RuntimeEnvelope` at the boundary;
2. enqueue the complete election operation;
3. read the latest election record from `chrome.storage.session` only after all
   earlier queued election operations have completed;
4. validate the persisted record;
5. evaluate the request against the latest writer identity, election epoch,
   committed version, and handoff state;
6. reject stale, duplicate (non-idempotent), unauthorised, or conflicting
   requests;
7. construct exactly one complete next election record;
8. increment the election epoch monotonically when ownership changes;
9. persist the complete record;
10. read back and validate the persisted record;
11. return success only after persistence verification;
12. release the queue for the next request.

The arbiter must never authorise a writer from a stale record read before an
earlier queued election operation completed.

### Persistence and restart

`chrome.storage.session` remains the authoritative browser-session election
record. The queue is a concurrency-control mechanism only, never durable state.

- Every decision is reconstructed from persisted session state.
- No decision relies on background globals after a service-worker restart.
- Persistence failure or read-back mismatch fails closed; success is never
  reported before persistence is verified.
- The same successful ownership epoch is never issued to two claimants.
- The committed workspace version is preserved through restart and recovery.

### Canonical contract

**Arbiter module:** `src/core/workspace/WorkspaceElectionArbiter.ts` (background
context only).

**Serial executor:**

```ts
export interface ElectionSerialExecutor {
  runExclusive<T>(operation: () => Promise<T>): Promise<T>;
}
export function createElectionSerialExecutor(): ElectionSerialExecutor;
```

**Arbiter:**

```ts
export interface WorkspaceElectionArbiterDependencies {
  storage: ValidatedStorage;
  now(): number;
  executor?: ElectionSerialExecutor;
}
export interface WorkspaceElectionArbiter {
  handle(request: WorkspaceElectionRequestPayload): Promise<WorkspaceElectionResponsePayload>;
}
export function createWorkspaceElectionArbiter(
  deps: WorkspaceElectionArbiterDependencies,
): WorkspaceElectionArbiter;
```

**Message types** (extend the closed registry in `MessageType.ts`; the registry
grows from 11 to 13 entries):

| MessageType | Payload schema | Allowed sources | Target |
|---|---|---|---|
| `workspace.election.request` | `WorkspaceElectionRequestPayload` | `sidepanel`, `standalone` | `background` |
| `workspace.election.response` | `WorkspaceElectionResponsePayload` | `background` | `sidepanel`, `standalone` |

**Request payload:**

```ts
type WorkspaceElectionOperation = 'claim' | 'relinquish' | 'handoff-commit';
type WorkspaceElectionClaimReason = 'initial' | 'stale-recovery' | 'fallback';

interface WorkspaceElectionRequestPayload {
  requestId: OperationId;
  operation: WorkspaceElectionOperation;
  requesterInstanceId: InstanceId;
  requesterWriterType: WorkspaceWriterType;
  committedVersion: number; // int >= 0
  reason?: WorkspaceElectionClaimReason; // claim only
  expectedEpoch?: number; // int >= 0; optimistic guard
  targetInstanceId?: InstanceId; // handoff-commit only
  targetWriterType?: WorkspaceWriterType; // handoff-commit only
}
```

**Response payload:**

```ts
interface WorkspaceElectionResponsePayload {
  requestId: OperationId;
  accepted: boolean;
  record?: ElectionRecord; // present and authoritative when accepted
  code?: ErrorCode; // present when not accepted (rejected or failed)
}
```

`accepted: true` carries the authoritative election record as persisted (after
read-back verification). `accepted: false` carries exactly one canonical code:
`WORKSPACE_ELECTION_REJECTED` for stale/unauthorised/conflicting/
non-idempotent requests, or `WORKSPACE_ELECTION_FAILED` for persistence or
read-back verification failure.

The RuntimeEnvelope carrying the response must set `correlationId` equal to the
request envelope `id` (not the payload `requestId`), `source: 'background'`, and
`target` equal to the requesting surface.

### Durable election-request idempotency

- Every `WorkspaceElectionRequestPayload` contains `requestId: OperationId`.
- `requestId` is stable across retries of the same logical election operation; a
  retry must not receive a newly generated `requestId`.
- Completed election-changing requests are persisted inside the existing
  `np_workspace_election` record as a bounded recent-request ledger,
  `ElectionRecord.recentCompletedRequests: ElectionIdempotencyRecord[]`. No
  additional storage key is added.
- The ledger retention limit is exactly **32** entries, ordered oldest to newest.
  After completing a request the arbiter removes any existing entry with the same
  `requestId`, appends the authoritative completed result, and retains only the
  newest 32 entries.
- Before applying an election-changing request the arbiter searches the ledger by
  `requestId`: a matching `requestId` with an equal fingerprint returns the
  persisted result without applying the operation again; a matching `requestId`
  with a different fingerprint fails closed with
  `WORKSPACE_ELECTION_REJECTED`; an absent `requestId` is evaluated as a new
  request.
- A duplicate request with the same `requestId` and identical operation data
  returns the previously persisted authoritative result without incrementing the
  epoch again, repeating relinquish, replaying handoff commit, changing writer
  identity, or reporting a different result.
- Fingerprint equality covers every operation-defining field and is independent
  of property ordering; it compares named fields directly and never compares an
  ad hoc `JSON.stringify` output.
- Every ledger entry is schema-validated; the ledger is bounded and never grows
  without limit. Ledger entries do not recursively embed an `ElectionRecord`.
- Exact fields, the retention algorithm, and the failure behaviour are defined in
  `DESIGN.md` Section 6 and `PLAN.md` task T13C.

### Idempotency boundary

- Exact duplicate recognition is guaranteed for the **32 most recently completed
  election-changing requests within the browser session**.
- Requests older than the retained window are not guaranteed to be recognised as
  duplicates.
- UI clients must not intentionally reuse an expired `requestId`.
- Ordinary transient retries reuse the original `requestId`; a new logical
  operation always receives a new `requestId`.
- The design does not claim unlimited historical deduplication.

### Background listener compatibility

The background runtime must not depend on returning a Promise from
`chrome.runtime.onMessage`.

1. The listener is registered synchronously at service-worker module evaluation.
2. For a valid election request the listener calls the async arbiter, delivers
   the arbiter result through `sendResponse`, and returns the literal `true`
   synchronously to keep the channel open.
3. Rejection and unexpected failure are returned as a schema-valid
   `WorkspaceElectionResponsePayload` with the canonical failure code.
4. Every accepted valid request receives exactly one response.
5. Every rejected valid request receives exactly one response.
6. An untrusted sender or a schema-invalid envelope fails closed and receives no
   response; it never receives an election result.
7. The listener never calls `sendResponse` twice for one request.

Promise-returning `onMessage` behaviour is not used unless a future approved
design raises the minimum Chrome version and explicitly authorises it.

### Sender and target restrictions

| MessageType | Allowed source | Required target |
|---|---|---|
| `workspace.election.request` | `sidepanel` or `standalone` | `background` |
| `workspace.election.response` | `background` | the requesting surface only |

The response also requires `correlationId` equal to the request envelope `id`.

Rejected at the boundary with `RUNTIME_SENDER_REJECTED` or
`RUNTIME_ENVELOPE_INVALID` as applicable:

- wildcard-target election requests;
- background-originated election requests;
- responses sent with target `*`;
- responses targeted at a surface other than the requester;
- any source or target mismatch.

### Queue lifecycle

`ElectionSerialExecutor` guarantees FIFO serialisation only within the current
service-worker lifetime. It is a concurrency-control mechanism, not durable
state. Correctness across a worker restart comes from the persisted election
record, the persisted bounded idempotency metadata, monotonic epoch validation,
reconstructing each decision from storage, and persistence read-back before
success. The design does not claim the in-memory queue survives restart.

**New `ErrorCode` values** (appended to the closed registry):

- `WORKSPACE_ELECTION_REJECTED` — stale, unauthorised, conflicting, or
  non-idempotent (same `requestId`, different data) election request.
- `WORKSPACE_ELECTION_FAILED` — persistence failure or read-back verification
  failure.

No new `DiagnosticEvent` is introduced.

**UI client:** `WorkspaceElection` (existing path) is refactored to a
read/request client. `read()`/`isWriter()` remain; `claim(reason)` and
`relinquish()` send a `workspace.election.request` envelope and resolve the
matching `workspace.election.response` by `correlationId`; the payload
`requestId` is retained across retries for durable idempotency. The client never
writes `np_workspace_election` directly.

**Backend listener injection (T22):** the background runtime registers a
`BackgroundElectionMessageListener` with the Chrome signature
`(message, sender, sendResponse) => boolean | void`; the arbiter result is
delivered through `sendResponse` after the queued operation completes.

### Consequences

- Election is serialised by a single background executor; simultaneous valid
  claims produce exactly one writer.
- The background now imports a workspace-core module (the arbiter). This does not
  violate the MV3 isolation rules: the arbiter imports no React/Ant Design,
  provider SDK, MCP SDK, or IndexedDB, and it does not perform ordinary workspace
  mutations, provider/MCP streaming, or IndexedDB access.
- A per-request round trip is added to election-changing operations.
- Tasks 14, 16, 22, 24, 25, 26, and 28 in Phase 01 `PLAN.md` are affected; a new
  corrective task (T13C) is inserted between T13 and T14.
- The direct multi-context election write model is superseded and retained as
  decision history only.

## Test obligations

The amended Phase 01 `PLAN.md` must include deterministic tests proving:

1. two simultaneous valid initial claims produce exactly one successful writer;
2. the losing claimant receives the canonical rejection
   (`WORKSPACE_ELECTION_REJECTED`);
3. the successful writer is persisted before success is returned;
4. two successful ownership changes never receive the same epoch;
5. epochs increase monotonically;
6. a stale claim cannot overwrite a newer writer;
7. a non-writer cannot relinquish ownership;
8. duplicate election requests with the same `requestId` and identical data are
   idempotent, including after a simulated service-worker restart, and do not
   increment the epoch, repeat relinquish, replay handoff commit, change writer
   identity, or report a different result;
9. reuse of a `requestId` with different operation data fails closed with
   `WORKSPACE_ELECTION_REJECTED`;
10. handoff commit and fallback claim cannot both succeed;
11. stale Standalone recovery is serialised against a live handoff;
12. persistence failure produces no successful writer;
13. persisted-record read-back mismatch fails closed;
14. a fresh arbiter over the same session storage reconstructs decisions from
    persisted state after restart;
15. ordinary workspace mutations bypass the background election arbiter;
16. exactly one active writer remains after every tested interleaving;
17. the background election listener returns literal `true` synchronously for an
    election request, delivers the response only after the queued operation
    completes, sends exactly one response per valid request, and produces one
    canonical failure response for a persistence error or unexpected exception;
18. an untrusted sender or schema-invalid envelope receives no response;
19. response `correlationId` equals the request envelope `id` and response
    `target` is the requesting surface only, with wildcard/background-originated
    requests and mis-targeted responses rejected;
20. duplicate request A remains idempotent after request B completes;
21. the newest 32 requests are retained;
22. the oldest request is evicted when a 33rd request completes;
23. replay within the retained window returns the prior result;
24. replay does not increment the epoch;
25. the same `requestId` with a different fingerprint is rejected;
26. ledger ordering is deterministic (oldest to newest) and contains no
    duplicate `requestId`;
27. replacement of an existing `requestId` does not create a duplicate entry;
28. a service-worker restart preserves the 32-entry ledger;
29. a malformed or oversized persisted ledger fails closed or is normalised
    exactly as defined by the amended design.

## Operator approval

This ADR is effective only after operator approval and the separate planning
commit `docs(phase-01): serialise workspace election in background`.
