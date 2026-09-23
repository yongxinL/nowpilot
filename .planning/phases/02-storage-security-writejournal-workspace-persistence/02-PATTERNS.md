# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 41 (14 new source, 12 modified source/config, 15 new/extended test files)
**Analogs found:** 38 / 41 (3 with no direct analog — see § No Analog Found)

> Every analog path below was verified with `git ls-files -- <path>` (non-empty = tracked).
> No gitignored mirror path is named anywhere in this file.

---

## File Classification

### New source files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/security/KeyVault.ts` | service (crypto vault) | transform + CRUD | `src/core/storage/legacyCredentialCleanup.ts` (result union, redaction-by-construction, total/throw-free) | role-match |
| `src/core/security/redactSensitive.ts` | utility | transform | `src/core/storage/legacyCredentialCleanup.ts` (field-names-only reporting, `sanitizeNode`) | exact |
| `src/core/storage/Setting.ts` | service | CRUD (serialized single-key write) | `src/core/onboarding/onboardingStateStore.ts` (read → migrate → write → read-back) | exact |
| `src/core/storage/EncryptedStorage.ts` | utility (crypto primitives + envelope codec) | transform | `src/core/workspace/WorkspaceState.ts` (strict Zod envelope + never-throwing parse) | role-match |
| `src/core/storage/WriteJournal.ts` | service | event-driven / batch (staged multi-step writes) | `src/core/storage/legacyCredentialCleanup.ts` (idempotent stages) + `src/core/workspace/handoff/protocol.ts` (state machine + injectable deps) | partial |
| `src/core/storage/IndexedDBMigrator.ts` | framework | batch (ordered upgrade steps) | `src/core/workspace/WorkspaceState.ts` `migrateWorkspaceState` (ordered, throw-free, total, deterministic) | role-match |
| `src/core/storage/NowPilotDB.ts` | provider (singleton handle) | request-response | `src/core/runtime/BroadcastBus.ts` (module-level lazy singleton + teardown) | partial |
| `src/core/storage/ChatHistoryDB.ts` | repository | CRUD | `src/core/onboarding/onboardingStateStore.ts` (typed read result + Zod at boundary) | role-match |
| `src/core/storage/ErrorStore.ts` | repository | CRUD (bounded FIFO) | `src/core/log/debugLog.ts` (bounded ring buffer) + `legacyCredentialCleanup.ts` (redacted codes) | role-match |
| `src/core/storage/legacyChatMigration.ts` | service | batch + cross-store I/O | `src/core/storage/legacyCredentialCleanup.ts` | exact |
| `src/core/workspace/WorkspacePersistence.ts` | repository | CRUD | `src/core/onboarding/onboardingStateStore.ts` + `chromeStorageAdapter` | exact |
| `src/core/workspace/WriterElection.ts` | service | event-driven (CAS + heartbeat) | `src/core/workspace/handoff/protocol.ts` (injectable deps + typed results) + `onboardingStateStore.ts` (read-back-verify) | role-match |
| `tests/harness/twoSurface.ts` | test harness (not a test) | event-driven | `tests/core/workspace/WorkspaceHandoff.test.ts` (injectable `transport`) + `tests/setup.ts` (`__broadcast`) | role-match |
| `src/core/workspace/handoff/composerDraft.ts` — **unchanged**; named only because the harness must carry its contract | store | request-response | — | n/a |

### Modified source / config files

| Modified File | Role | Data Flow | Analog | Match Quality |
|---------------|------|-----------|--------|---------------|
| `src/services/ports/credentialStorePort.ts` | port | request-response | itself (v1 → D2-03 contract); `providerValidationPort.ts` for the port shape | exact (self) |
| `src/store/useExtensionStore.ts` | store | CRUD + async hydration | itself (v2 → v3 allow-list rebuild) | exact (self) |
| `src/core/workspace/WorkspaceStore.ts` | store | event-driven | itself (`PHASE1_WRITER_STATE` → election state) | exact (self) |
| `src/core/onboarding/onboardingStateStore.ts` | store | event-driven | itself (+ single-controller gate) | exact (self) |
| `src/components/common/MirrorBanner.tsx` | component | request-response (render) | itself (activation wiring only) | exact (self) |
| `src/entrypoints/sidepanel/main.tsx` | entrypoint | request-response | itself (+ hydration status) | exact (self) |
| `src/entrypoints/standalone/main.tsx` | entrypoint | request-response | `src/entrypoints/sidepanel/main.tsx` | exact |
| `wxt.config.ts` | config | — | itself (`permissions` array) | exact (self) |
| `package.json` | config | — | itself (`verify:phase-1` self-derived preflight) | exact (self) |
| `tests/setup.ts` | test infra | — | itself (chrome.storage mock block) | exact (self) |
| `tests/isolation/generated-manifest.test.ts` | test (gate) | — | itself (`AUTHORISED_PERMISSIONS`) | exact (self) |
| `tests/core/store/useExtensionStore.test.ts` | test | — | itself | exact (self) |

### New test files

| New File | Role | Data Flow | Analog | Match Quality |
|----------|------|-----------|--------|---------------|
| `tests/core/security/KeyVault.test.ts` | test | — | `tests/core/storage/legacyCredentialCleanup.test.ts` (sentinel-absence assertions) | exact |
| `tests/core/security/EncryptedStorage.test.ts` | test | — | `tests/core/storage/legacyCredentialCleanup.test.ts` | exact |
| `tests/core/security/credentialStorePort.test.ts` | test | — | `tests/core/storage/legacyCredentialCleanup.test.ts` + `tests/isolation/cross-entrypoint-imports.test.ts` (source-level scan) | role-match |
| `tests/core/security/redactSensitive.test.ts` | test | — | `tests/core/storage/legacyCredentialCleanup.test.ts` | exact |
| `tests/core/storage/NowPilotDB.test.ts` | test | — | `tests/core/storage/chromeStorageAdapter.test.ts` (`__test__` seams + `beforeEach` reset) | role-match |
| `tests/core/storage/IndexedDBMigrator.test.ts` | test | — | `tests/core/storage/chromeStorageAdapter.test.ts` | role-match |
| `tests/core/storage/ChatHistoryDB.test.ts` | test | — | `tests/core/storage/chromeStorageAdapter.test.ts` | role-match |
| `tests/core/storage/WriteJournal.test.ts` | test | — | `tests/core/storage/legacyCredentialCleanup.test.ts` (idempotence assertions) | exact |
| `tests/core/storage/ErrorStore.test.ts` | test | — | `tests/core/storage/legacyCredentialCleanup.test.ts` | exact |
| `tests/core/storage/legacyChatMigration.test.ts` | test | — | `tests/core/storage/legacyCredentialCleanup.test.ts` (idempotence + absence) | exact |
| `tests/core/workspace/WorkspacePersistence.test.ts` | test | — | `tests/core/onboarding/onboardingStateStore.test.ts` | role-match |
| `tests/core/workspace/WriterElection.test.ts` | test | — | `tests/core/workspace/WorkspaceHandoff.test.ts` (fake timers + advanceTimersByTimeAsync) | exact |
| `tests/integration/workspaceHandoff.integration.test.ts` | test (integration) | — | `tests/core/workspace/WorkspaceHandoff.test.ts` | exact |
| `tests/integration/onboardingTwoSurface.integration.test.ts` | test (integration) | — | `tests/core/workspace/WorkspaceHandoff.test.ts` + `tests/core/onboarding/onboardingStateStore.test.ts` | role-match |

---

## Pattern Assignments

### 1. `src/core/storage/legacyChatMigration.ts` (service, batch + cross-store I/O) — **the primary Phase 2 analog**

**Analog:** `src/core/storage/legacyCredentialCleanup.ts`

This is the closest analog in the repo for a one-way, in-place, journaled, redacted, idempotent `chrome.storage.local` migration. Copy its structure almost wholesale.

**Module doc + import block** (lines 1-2):
```typescript
import { debugLog } from '../log/debugLog';
```
Note the JSDoc block (lines 3-40): it states the *rules the module exists to keep*, the operator authorisation for the destructive step, and the failure semantics. Every Phase 2 migration module must carry the same header — D2-07…D2-14 need their rules stated where the code is.

**Named constants + typed failure code** (lines 51-74):
```typescript
export const LEGACY_SECRET_FIELDS = ['apiKey', 'token', 'accessToken', 'secret', 'openAiKey', 'geminiKey'] as const;
export const CLEANUP_SCHEMA_VERSION = 1;
const CLEANUP_VERSION_FIELD = 'plaintextCleanupSchemaVersion';
const PROVIDER_CONFIG_STORAGE_KEY = 'np_store';
const CLEANUP_FAILED_CODE = 'LEGACY_CREDENTIAL_CLEANUP_FAILED';
```
For Phase 2: `NP_STORE_SCHEMA_VERSION = 3`, `MIGRATION_STAGES` (the 7 D2-09 names) as a `const` tuple, and one `SCREAMING_SNAKE` failure code.

**Idempotence short-circuit — the exact mechanism D2-14 needs** (lines 141-143):
```typescript
if (raw[CLEANUP_VERSION_FIELD] === CLEANUP_SCHEMA_VERSION) {
  return { value: raw, found: false, removedFields: [] };
}
```
Phase 2's equivalent is "already-migrated destination / completed journal entry → skip the walk". Note the comment above it: the short-circuit is what keeps a service-worker wake cheap and side-effect-free.

**Allow-list rebuild, never a deny-list filter** (lines 93-114) — `sanitizeNode` builds a clone and **never reads** a matched key's value:
```typescript
function sanitizeNode(node: unknown, removed: Set<string>, seen: Set<object>): unknown {
  if (Array.isArray(node)) {
    if (seen.has(node)) return undefined;   // cyclic input → acyclic, serialisable output
    seen.add(node);
    return node.map((entry) => sanitizeNode(entry, removed, seen));
  }
  if (!isPlainObject(node)) return node;
  if (seen.has(node)) return undefined;
  seen.add(node);

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(node)) {
    if (isLegacySecretField(key)) {
      removed.add(key);          // NAME only — the value is deliberately never read
      continue;
    }
    clone[key] = sanitizeNode(node[key], removed, seen);
  }
  return clone;
}
```
**D2-11's source sanitisation must use this exact shape**: a body key is *dropped without its value ever being read*, so a body cannot leak into the sanitised record, a report, a log or an error.

**Total, throw-free entry point with a typed result union** (lines 130-154, 169-217):
```typescript
export async function runLegacyCredentialCleanup(): Promise<
  { ok: true } | { ok: false; code: string }
> {
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
    return { ok: true };   // no extension storage in this context — soft success
  }
  try {
    const stored = (await chrome.storage.local.get(PROVIDER_CONFIG_STORAGE_KEY)) as
      | Record<string, unknown> | undefined;
    const raw = stored?.[PROVIDER_CONFIG_STORAGE_KEY];
    if (raw === undefined || raw === null) return { ok: true };

    const wasSerialised = typeof raw === 'string';
    let parsed: unknown = raw;
    if (wasSerialised) {
      try { parsed = JSON.parse(raw as string); }
      catch { return { ok: true }; }   // unparseable → left exactly as-is, never partially rewritten
    }
    const { value, found, removedFields } = sanitizeLegacyProviderConfig(parsed);
    if (!found) return { ok: true };
    await chrome.storage.local.set({
      [PROVIDER_CONFIG_STORAGE_KEY]: wasSerialised ? JSON.stringify(value) : value,
    });
    debugLog('LEGACY_CREDENTIALS_REMOVED', 'Legacy plaintext credential fields removed', {
      removedFields, schemaVersion: CLEANUP_SCHEMA_VERSION,   // NAMES only
    });
    return { ok: true };
  } catch (error) {
    debugLog(CLEANUP_FAILED_CODE, 'Legacy plaintext credential cleanup failed', {
      reason: error instanceof Error ? error.name : typeof error,
    });
    return { ok: false, code: CLEANUP_FAILED_CODE };
  }
}
```

**Five rules to carry into `legacyChatMigration.ts` verbatim:**
1. Read → parse → migrate → write back **only when something changed**.
2. `wasSerialised` round-trip: preserve the stored representation (zustand `persist` stores a JSON string).
3. Never partially rewrite a value the migration cannot recognise (D2-13 quarantine).
4. Every catch logs `error.name`/`typeof error` — never the value, never `error.message` from a crypto path.
5. Report field **names / safe ids** only; never a value, length, prefix, suffix, digest or derived fragment.

**Stage names (D2-09, exact):** `discovered` → `validated` → `destination-write-started` → `destination-written` → `destination-verified` → `source-sanitised` → `completed`. These are `steps[].name` values; `WriteJournalEntry.status` stays in the canonical union.

---

### 2. `src/core/security/KeyVault.ts` + `src/core/storage/EncryptedStorage.ts` (service/utility, transform + CRUD)

**Analogs:** `src/core/storage/legacyCredentialCleanup.ts` (redaction discipline) + `src/core/workspace/WorkspaceState.ts` (strict envelope schema + typed failure codes)

**Result-union + typed error-code shape** — from `WorkspaceState.ts` lines 96-104:
```typescript
export type WorkspaceStateParseErrorCode =
  | 'not_an_object' | 'unknown_field' | 'unsupported_schema_version' | 'invalid_shape';

export type WorkspaceStateParseResult =
  | { ok: true; value: WorkspaceState }
  | { ok: false; code: WorkspaceStateParseErrorCode };
```
KeyVault must mirror this: `{ ok: true; ... } | { ok: false; code: KeyVaultErrorCode }`. D2-06 requires **one indistinguishable redacted code** for every AES-GCM `OperationError` (wrong key *and* tampered envelope), so the code union must not distinguish them.

**Classify a library error into a typed code, never surface it** — `WorkspaceState.ts` lines 211-219:
```typescript
function classify(error: z.ZodError): WorkspaceStateParseErrorCode {
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') return 'unknown_field';
  }
  for (const issue of error.issues) {
    if (issue.path[0] === 'schemaVersion') return 'unsupported_schema_version';
  }
  return 'invalid_shape';
}
```

**Strict envelope schema, `.strict()` load-bearing** — `WorkspaceState.ts` lines 149-166:
```typescript
export const workspaceStateSchema = z
  .object({
    schemaVersion: z.literal(WORKSPACE_STATE_SCHEMA_VERSION),
    workspaceId: identifierSchema,
    /* … */
  })
  .strict();
```
`CredentialEnvelopeV1` uses the same shape: `z.literal(1)` for `v`, bounded base64 string fields for `salt` / `iv` / `ciphertext`, `z.enum(['PBKDF2'])`, `z.literal(100000)`. A malformed envelope fails closed at the schema before any crypto call.

**Never-throwing parse wrapper** — `WorkspaceState.ts` lines 226-237:
```typescript
export function parseWorkspaceState(value: unknown): WorkspaceStateParseResult {
  const normalised = normaliseUnknown(value);   // JSON string → object, else pass through
  if (!isPlainObject(normalised)) return { ok: false, code: 'not_an_object' };
  const parsed = workspaceStateSchema.safeParse(normalised);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, code: classify(parsed.error) };
}
```

**Crypto parameters (§15.2, pinned — do not re-derive):**
- Base key material: `utf8(installSecretBase64 + extensionId)`; PBKDF2 `{ iterations: 100_000, hash: 'SHA-256' }`.
- Derived key: AES-GCM-256, `extractable: false`, `['encrypt', 'decrypt']`.
- Salt 16 bytes **fresh per store/replace**; IV 12 bytes **fresh per encryption operation**.
- `additionalData` = `utf8(JSON.stringify({ v, providerId, alg, kdf }))` — this is what makes D2-06's "tampered version / authenticated metadata fail closed" true without a signature scheme.
- `extensionId` and the storage area are **injected dependencies** with a production default of `chrome.runtime.id` (it is `undefined` in vitest). Never `navigator.userAgent`.
- `installSecret` = 32 random bytes, base64-encoded, in `np_install_secret`.

**Redaction-by-construction** — the rule from `legacyCredentialCleanup.ts` lines 20-25 applies unchanged: the vault's diagnostics may report *envelope version, providerId, failure code* — never plaintext, ciphertext, salt, IV, key material, length, prefix or digest.

---

### 3. `src/core/storage/Setting.ts` (service, CRUD serialized single-key writes)

**Analog:** `src/core/onboarding/onboardingStateStore.ts`

**Storage-availability guard + typed read result** (lines 166-184):
```typescript
function hasLocalStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
}

async function readStoredValues(): Promise<Record<string, unknown> | null> {
  if (!hasLocalStorage()) return {};
  try {
    return (await chrome.storage.local.get([ONBOARDING_STORAGE_KEY, LEGACY_ONBOARDING_FLAG_KEY])) as Record<string, unknown>;
  } catch (error) {
    debugLog('ONBOARDING_STORAGE_READ_FAILED', 'chrome.storage.local.get failed', {
      reason: error instanceof Error ? error.name : typeof error,
    });
    return null;   // null = the read itself failed — distinct from "missing"
  }
}
```

**Write with the same catch-and-log discipline** (lines 186-195):
```typescript
async function writeStoredRecord(record: OnboardingState): Promise<void> {
  if (!hasLocalStorage()) return;
  try {
    await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: record });
  } catch (error) {
    debugLog('ONBOARDING_STORAGE_WRITE_FAILED', 'chrome.storage.local.set failed', {
      reason: error instanceof Error ? error.name : typeof error,
    });
  }
}
```

**Read → re-migrate → merge → write (the serialized-write shape OQ-6 needs)** (lines 273-291):
```typescript
export async function writeOnboardingState(
  partial: Partial<OnboardingState>,
): Promise<OnboardingState> {
  const values = await readStoredValues();
  const existing = values ? migrateOnboardingState(values[ONBOARDING_STORAGE_KEY], undefined) : null;
  const next: OnboardingState = {
    ...(existing ?? createInitialOnboardingState()),
    ...partial,
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
  };
  await writeStoredRecord(next);
  return next;
}
```
`Setting.ts` uses this same read-merge-write shape for `np_install_secret`, **plus** the read-back verification OQ-6 requires (two surfaces can race on first install): write → `get` → compare the byte-identical base64 value → only then report success; on mismatch, re-read and adopt the winner rather than overwriting it.

**Module-function registry + typed port shape** — `src/services/ports/providerValidationPort.ts` is the sibling port to copy for the extended `CredentialStorePort`. `src/core/messaging/MessageBus.ts` lines 9-26 is the repo's canonical module-function registry (`Map<Key, Set<Handler>>` + an unsubscribe return).

---

### 4. `src/core/storage/IndexedDBMigrator.ts` (framework, batch ordered upgrade)

**Analog:** `src/core/workspace/WorkspaceState.ts` `migrateWorkspaceState` — the repo's reference for an ordered, throw-free, total, deterministic migration.

**Ordered, throw-free, total, deterministic** (lines 252-279):
```typescript
export function migrateWorkspaceState(persisted: unknown, persistedVersion: number): WorkspaceState {
  void persistedVersion;
  const base = migrationBase();
  const source = normaliseUnknown(persisted);
  if (!isPlainObject(source)) return base;

  const candidate: Record<string, unknown> = { ...base, schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION };
  for (const field of MIGRATABLE_FIELDS) {
    if (field in source) candidate[field] = source[field];
  }
  const whole = workspaceStateSchema.safeParse(candidate);
  if (whole.success) return whole.data;

  const salvaged: Record<string, unknown> = { ...base, schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION };
  for (const field of MIGRATABLE_FIELDS) {
    const single = workspaceStateSchema.safeParse({ ...base, schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION, [field]: candidate[field] });
    if (single.success) salvaged[field] = candidate[field];
  }
  const final = workspaceStateSchema.safeParse(salvaged);
  return final.success ? final.data : base;
}
```
Two properties to carry into the migrator: (a) an invalid single step must not discard the rest (per-step salvage); (b) migrating the output again is a no-op (deterministic base, no clock read — see lines 298-311).

**Interface verbatim from §20.4** (RESEARCH Pattern 2):
```typescript
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(db: IDBPDatabase, tx: IDBPTransaction): Promise<void>;
}
```
Rules the migrator must enforce: `m.toVersion <= oldVersion → continue`; **existence checks are mandatory** (`db.objectStoreNames.contains(name)`, `tx.objectStore(name).indexNames.contains(name)`) because `createObjectStore` throws `ConstraintError` on a re-run; never let `upgrade` throw unhandled (catch → record a redacted result → rethrow deliberately); `VersionError` on a below-current open maps to an unsupported-version error, never a retry; an open at the current version is a no-op.

**Test-only v1→v2 fixture (D2-23):** a fixture table `[v1InitialPhase2Stores, v2FutureStoreFixture]` where `v2FutureStoreFixture` creates a synthetic store (`future_probe`) at `toVersion: 2`. Assert: the new store exists, every v1 store survives with pre-upgrade data intact, the production `MIGRATIONS` table has no Memory/Notes names and only `toVersion: 1`, `v1InitialPhase2Stores` is unmodified by the fixture run, and a second open at v2 runs nothing.

---

### 5. `src/core/storage/NowPilotDB.ts` (provider, singleton handle)

**Analog:** `src/core/runtime/BroadcastBus.ts` — the repo's module-level lazy singleton with explicit teardown.

**Lazy singleton + teardown** (lines 9-15, 43-68, 70-80):
```typescript
const channels = new Map<string, BroadcastChannelEntry>();

function getBroadcastChannel(name: string): BroadcastChannelEntry {
  if (!channels.has(name)) {
    const bc = new BroadcastChannel(name);
    const entry: BroadcastChannelEntry = { channel: name, listeners: new Set(), bc };
    bc.onmessage = (event: MessageEvent) => { /* … */ };
    channels.set(name, entry);
  }
  return channels.get(name)!;
}

export function subscribe<T>(channel: string, listener: BroadcastListener<T>): () => void {
  const entry = getBroadcastChannel(channel);
  entry.listeners.add(listener as BroadcastListener);
  return () => {
    entry.listeners.delete(listener as BroadcastListener);
    if (entry.listeners.size === 0) { entry.bc.close(); channels.delete(channel); }
  };
}
```
`NowPilotDB.ts` mirrors this with one `IDBPDatabase` handle + one `openDB` promise, plus `blocked` / `blocking` / `terminated` callbacks. **Do not** copy the debounce from `chromeStorageAdapter` — see § Shared Patterns → "Never debounce the election".

**Surface isolation note:** `BroadcastBus` is import-safe from the background SW; `NowPilotDB` must **not** be. §0.2 forbids IndexedDB in the background SW. Verify the new modules against `tests/isolation/cross-entrypoint-imports.test.ts`.

---

### 6. `src/core/storage/ChatHistoryDB.ts` (repository, CRUD) + `ErrorStore.ts` (repository, bounded FIFO)

**Analogs:** `src/core/onboarding/onboardingStateStore.ts` (typed read results) + `src/core/log/debugLog.ts` (bounded buffer)

**Bounded ring buffer with FIFO eviction** — `debugLog.ts` lines 8-31:
```typescript
const MAX_LOG_ENTRIES = 200;
const logEntries: LogEntry[] = [];

export function debugLog(code: string, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = { code, message, context, timestamp: Date.now() };
  logEntries.push(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) logEntries.shift();
  console.debug(`[${code}] ${message}`, context ?? '');
}

export function getRecentLogs(count = 50): LogEntry[] { return logEntries.slice(-count); }
export function clearLogs(): void { logEntries.length = 0; }
```
`ErrorStore` is the durable form of this: `MAX_ERROR_RECORDS = 100`, FIFO eviction on insert, `clearLogs`-equivalent for tests. The `code` field is the `SCREAMING_SNAKE` canonical code (e.g. `IDB_MIGRATION_FAILED`, `WRITE_JOURNAL_FAILED`, `NP_STORE_REHYDRATE_FAILED`).

**Typed read outcome with an explicit `unknown` state** — `onboardingStateStore.ts` lines 80-100:
```typescript
export type OnboardingUnknownReason = 'missing' | 'incompatible' | 'unreadable';
export type OnboardingReadResult =
  | { status: 'ok'; state: OnboardingState }
  | { status: 'unknown'; reason: OnboardingUnknownReason };

export function shouldPresentOnboarding(result: OnboardingReadResult): boolean {
  return !(result.status === 'ok' && result.state.uiComplete);
}
```
ChatHistoryDB's hydration result must mirror this three-way distinction (`missing` ≠ `unreadable` ≠ `incompatible`). D2-18/D2-20: a database error must never collapse into `empty`.

**Transaction discipline (executed-probe-verified pitfall):** prepare and validate **before** opening a `readwrite` transaction; keep every request inside it; `await tx.done` for writes. An unrelated `await` inside a transaction auto-commits it and the next operation throws `InvalidStateError`.
```typescript
// CORRECT
const validated = someSyncValidator(record);
const tx = db.transaction(['sessions', 'messages'], 'readwrite');
await tx.objectStore('sessions').put(sessionRecord);
await tx.objectStore('messages').put(messageRecord);
await tx.done;
```

**Hydration states (D2-18, exact identifiers):** `idle` | `hydrating` | `ready` | `empty` | `failed` | `recovery required`.

---

### 7. `src/core/storage/WriteJournal.ts` (service, staged multi-step writes)

**Analogs:** `src/core/storage/legacyCredentialCleanup.ts` (idempotent stages + redacted codes) + `src/core/workspace/handoff/protocol.ts` (injectable deps + typed results + state machine)

**Injectable dependencies with production defaults** — `protocol.ts` lines 462-466:
```typescript
export function createHandoffInitiator(deps: HandoffInitiatorDeps): HandoffInitiator {
  const transport = deps.transport ?? handoffTransport;
  const requestId = deps.requestId ?? createHandoffRequestId();
  const timeoutMs = deps.timeoutMs ?? HANDOFF_TIMEOUT_MS;
  const maxRetries = Math.max(0, deps.maxRetries ?? HANDOFF_MAX_RETRIES);
```
`WriteJournal` takes `{ persist, now, clock }` seams the same way, so deterministic failure injection (D2-25) needs no mocking of IndexedDB itself.

**Idempotent duplicate handling — the exact D2-14 shape** — `protocol.ts` lines 683-692:
```typescript
if (appliedRequestIds.has(envelope.requestId)) {
  // Idempotent duplicate: acknowledge again, never apply twice.
  transport.publish({ type: 'HANDOFF_ACK', requestId: envelope.requestId,
    appliedSchemaVersion: HANDOFF_SCHEMA_VERSION, result: { ok: true } });
  return;
}
```
`WriteJournal` does this with the §20.2 idempotency key as `entry.id` (`update-workspace` → `workspaceId + version`; save chat message → `sessionId + seq`): a duplicate operation **finds** the existing entry rather than creating a second one.

**Canonical entry shape (Appendix C, verbatim):**
```typescript
export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;      // safe identifiers ONLY
  steps: Array<{ name: string; status: 'pending' | 'completed' | 'failed'; error?: string }>;
}
```
**Pre-seed all seven stage names as `pending` at creation**, then flip each to `completed` (deliberate divergence from O.11's push-completed — it is what lets a restart distinguish "not reached" from "reached"). `targetIds` carries safe record identifiers only — **never** bodies, ciphertext, page content, hidden reasoning or a whole `WorkspaceState`.

**Rollback / recovery:** `runJournaled` → `status: applying` → steps → `completed`; catch ⇒ roll back applied steps ⇒ `rolled-back`. `recoverJournal(load, replay)` at startup replays every `pending | applying` entry. Bound the store: keep all non-terminal entries + the newest N terminal entries; compact on startup after recovery; **never delete a non-terminal entry**.

---

### 8. `src/core/workspace/WorkspacePersistence.ts` (repository, CRUD)

**Analogs:** `src/core/onboarding/onboardingStateStore.ts` + `src/core/theme/chromeStorageAdapter.ts`

Reuse the adapter — do **not** invent a second one (CONTEXT "Reusable Assets" is correct here):

**`np_workspace` read/write goes through the debounced adapter** (`chromeStorageAdapter.ts` lines 126-171), so `WorkspacePersistence` is a thin typed wrapper: parse with `parseWorkspaceState` → validate → write the serialised `WorkspaceState` under `np_workspace`; on read, `migrateWorkspaceState` is throw-free and total, so a corrupt blob yields a safe state rather than an exception.

**Lifecycle flush already exists** — `chromeStorageAdapter.ts` lines 101-124:
```typescript
export function flushPendingWrites(): Promise<void> { return performFlush(); }

function installLifecycleFlush(): void {
  if (_lifecycleInstalled) return;
  if (typeof window === 'undefined') return;
  _lifecycleInstalled = true;
  const flush = () => { void flushPendingWrites(); };
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
```

**Last-write-wins by `version`** (Appendix M.3) is already expressible: `WorkspaceState.version` is the monotonic write counter (`WorkspaceState.ts` lines 90-93) and `WorkspaceStore.ts` bumps it in every mutator (lines 97-123). `WorkspacePersistence` compares `version` before applying a persisted record over an in-memory one.

**Cross-surface propagation:** `subscribeToOnboardingState` (`onboardingStateStore.ts` lines 300-318) is the template for an `np_workspace` `chrome.storage.onChanged` subscriber:
```typescript
export function subscribeToOnboardingState(
  listener: (result: OnboardingReadResult) => void,
): () => void {
  if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) return () => {};
  const handler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== 'local') return;
    if (!(ONBOARDING_STORAGE_KEY in changes) && !(LEGACY_ONBOARDING_FLAG_KEY in changes)) return;
    void readOnboardingState().then(listener);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => { chrome.storage.onChanged.removeListener(handler); };
}
```

---

### 9. `src/core/workspace/WriterElection.ts` (service, CAS + heartbeat) + `WorkspaceStore.ts` swap

**Analogs:** `src/core/workspace/handoff/protocol.ts` (state machine + injectable deps) + `src/core/onboarding/onboardingStateStore.ts` (read-back-verify) + `WorkspaceStore.ts` itself

**The swap point is already documented in the source** — `WorkspaceStore.ts` lines 42-58:
```typescript
/**
 * The **Phase-1 writer adapter** (D-12). …
 * Phase 2 replaces this adapter with authoritative election state
 * (CAS + heartbeat over the writer channel) and only then may a surface render
 * read-only mirroring.
 */
export const PHASE1_WRITER_STATE: WorkspaceWriterState = 'primary';
export function isPrimaryWriter(): boolean { return PHASE1_WRITER_STATE === 'primary'; }
export function isMirrorState(state: WorkspaceWriterState): state is WorkspaceMirrorState {
  return state !== 'primary';
}
```
**Do not change the frozen vocabulary** — `WorkspaceMirrorState` (`mirror | election-pending | handoff-pending | handoff-failed | writer-unavailable`, lines 23-28) and `WORKSPACE_WRITER_STATES` (lines 33-40) are the contract `MirrorBanner` consumes. Phase 2 adds a **new** authoritative source and wires it in; it does not rename or extend the union.

**Read → validate → write → read-back-verify** (RESEARCH Pattern 6) — the `onboardingStateStore` read-back shape generalised:
```typescript
async function elect(): Promise<ElectionOutcome> {
  const now = Date.now();
  const current = await readPrimary();                     // chrome.storage.session.get
  if (current && !isStale(current, now) && !isSelf(current)) return { kind: 'secondary', current };
  const mine = { tabId: myTabId(), surface: mySurface, electedAt: now };
  await chrome.storage.session.set({ np_workspace_primary: mine });   // NOT debounced
  const readBack = await readPrimary();
  return sameIdentity(readBack, mine) && readBack.electedAt === mine.electedAt
    ? { kind: 'primary', epoch: mine.electedAt }
    : { kind: 'secondary', current: readBack };
}
```
Pinned parameters: election key `np_workspace_primary` in `chrome.storage.session`; record `{ tabId, surface, electedAt }`; heartbeat every **3 s**; **2 missed heartbeats** (`now - record.electedAt > 2 * 3000`) ⇒ stale, any surface may elect; Standalone tie-break = `(electedAt, surfacePriority)` with `standalone > sidepanel`; `electedAt` doubles as the writer epoch. The background SW is **not** a participant.

**Stale-writer rejection:** immediately before any authoritative write, re-read the record and accept only when its identity is mine **and** its `electedAt` is not newer than my last refresh. Reject with a typed error and demote to `mirror`.

---

### 10. `src/services/ports/credentialStorePort.ts` (port) — extend, do not replace

**Analog:** itself. Current content (lines 1-18):
```typescript
import type { ProviderId } from '../../types';

export interface CredentialStorePort {
  isConfigured(providerId: ProviderId): Promise<boolean>;
  store(providerId: ProviderId, credential: string): Promise<{ ok: true } | { ok: false; code: string }>;
}
```
Extend to the D2-03 contract: `store` / `replace` / `retrieve` (authorised consumer) / `isConfigured` / `delete` / `inspectEnvelopeVersion`. Keep the result-union style. **Must NOT** expose list-all, export, preview, or a generic arbitrary-secret store. Presentation components must not import `KeyVault`/`EncryptedStorage` — assert with a source-level scan modelled on `tests/isolation/cross-entrypoint-imports.test.ts` lines 74-114 (`walkSourceFiles` + `IMPORT_SPEC_RE`).

---

### 11. `src/store/useExtensionStore.ts` (store) — v2 → v3 cutover

**Analog:** itself. The three pieces that change, verbatim:

**`partialize` — the projection** (lines 543-550):
```typescript
partialize: (state) => {
  const { activeSession, activeAttachments, availableTabs, ...rest } = state;
  return rest;
},
```

**The allow-list constants — v3 drops `sessions` and `activeSessionId`** (lines 598-639):
```typescript
const PERSISTED_BLOB_FIELDS = [
  'config', 'sessions', 'activeSessionId', 'prompts', 'writeHistory', 'notes',
] as const;

const PERSISTED_CONFIG_FIELDS = [ /* … */ ] as const;
const PERSISTED_PROVIDER_FIELDS = ['id','name','isConfigured','enabled','useCustomProxy','proxyUrl','models'] as const;
const PERSISTED_MODEL_FIELDS = ['id', 'name', 'enabled', 'isCustom'] as const;
```
**v3:** remove `'sessions'` and `'activeSessionId'` from `PERSISTED_BLOB_FIELDS`; keep `config`, `prompts`, `writeHistory`, `notes` (the last two are deferred to Phase 9 — **record the deferral, never silently drop user data**). `sessions[].preview` is a body excerpt and must not survive anywhere; `sessions[].title` is metadata and moves to `ConversationMeta.title` in `np_conversation_meta`.

**Allow-list rebuild, never a deny-list filter** (lines 641-651, 673-699):
```typescript
function pickFields(record: unknown, fields: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  if (!record || typeof record !== 'object' || Array.isArray(record)) return picked;
  const source = record as Record<string, unknown>;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) picked[field] = source[field];
  }
  return picked;
}

export function npStoreMigrate(persisted: unknown, version: number): unknown {
  void version;   // The rebuild is version-independent: it is total and idempotent.
  if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) return {};
  const blob = pickFields(persisted, PERSISTED_BLOB_FIELDS);
  const config = pickFields(blob.config, PERSISTED_CONFIG_FIELDS);
  if (config.providers && typeof config.providers === 'object' && !Array.isArray(config.providers)) {
    const providers: Record<string, unknown> = {};
    for (const [providerKey, detail] of Object.entries(config.providers as Record<string, unknown>)) {
      const provider = pickFields(detail, PERSISTED_PROVIDER_FIELDS);
      if (Array.isArray(provider.models)) {
        provider.models = (provider.models as unknown[]).map((model) => pickFields(model, PERSISTED_MODEL_FIELDS));
      }
      providers[providerKey] = provider;
    }
    config.providers = providers;
  }
  blob.config = config;
  return blob;
}
```

**`merge` normalisation + `onRehydrateStorage` failure visibility** (lines 559-593):
```typescript
merge: (persisted, current) => {
  const merged = { ...current, ...(persisted as Partial<ExtensionState>) };
  merged.sessions = asArray<ChatSession>(merged.sessions);
  merged.prompts = asArray<PromptItem>(merged.prompts);
  /* … */
  merged.activeSession = computeActiveSession(merged.sessions, merged.activeSessionId);
  merged.activeAttachments = [];
  merged.availableTabs = [];
  return merged;
},
onRehydrateStorage: () => (_state, error) => {
  if (error) debugLog('NP_STORE_REHYDRATE_FAILED', String(error));
},
```
**v3 additions:** a `hydrationStatus` field (`idle | hydrating | ready | empty | failed | recovery required`), asynchronous hydration from ChatHistoryDB replacing the synchronous `sessions` read, and a typed redacted error/recovery state. **A database error must never resolve to `empty`.**

**Numbering warning already in the source** (lines 554-556): the zustand-persist `version` counter is **separate** from the IndexedDB `DB_VERSION`. Do not conflate them.

---

### 12. `tests/setup.ts` (test infra) — Wave 0 additions

**Analog:** itself. The chrome.storage mock block is the template for the two new mocks.

**Map-backed mock + `__`-prefixed global seam** (lines 46-95):
```typescript
const chromeStorage = new Map<string, string>();

const chromeStorageLocal = {
  get: vi.fn((keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> => {
    if (keys === undefined || keys === null) return Promise.resolve(Object.fromEntries(chromeStorage));
    if (typeof keys === 'string') {
      const val = chromeStorage.get(keys) ?? null;
      return Promise.resolve({ [keys]: val });
    }
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {};
      for (const k of keys) result[k] = chromeStorage.get(k) ?? null;
      return Promise.resolve(result);
    }
    return Promise.resolve({ ...(keys as Record<string, unknown>) });
  }),
  set: vi.fn((items: Record<string, unknown>): Promise<void> => {
    for (const [key, value] of Object.entries(items)) chromeStorage.set(key, value as string);
    return Promise.resolve();
  }),
  remove: vi.fn(/* … */),
  clear: vi.fn(/* … */),
};

(globalThis as any).__chromeStorageLocal = chromeStorageLocal;
(globalThis as any).__chromeStorageMap = chromeStorage;
```

**The chrome.storage assembly point** (lines 139-145) — extend this object with `session`:
```typescript
if (!(globalThis as any).chrome) { (globalThis as any).chrome = {} as typeof chrome; }
(globalThis as any).chrome.storage = {
  local: chromeStorageLocal as any,
  sync: chromeStorageSync as any,
};
```

**BroadcastChannel mock + `__broadcast` injection seam** (lines 148-197):
```typescript
const broadcastChannels = new Map<string, any[]>();

vi.stubGlobal('BroadcastChannel', class {
  /* … postMessage dispatches to OTHER channel instances with the same name … */
});

(globalThis as any).__broadcast = (channelName: string, data: unknown): void => {
  const instances = broadcastChannels.get(channelName) ?? [];
  for (const instance of instances) {
    if (instance.onmessage) instance.onmessage(new MessageEvent('message', { data }));
  }
};
```

**Wave 0 additions (all four are blockers — no Phase 2 implementation task is verifiable without them):**
1. `import 'fake-indexeddb/auto'` + `const resetIndexedDB = () => { (globalThis as any).indexedDB = new IDBFactory(); }; (globalThis as any).__resetIndexedDB = resetIndexedDB;` (a fresh `IDBFactory` per test — the double keeps state per instance).
2. `chrome.storage.session` — a third Map-backed area assembled into the object above (the election suite cannot run without it).
3. `chrome.storage.onChanged` — a **shared** dispatcher both surfaces subscribe to (today it is only created ad hoc inside `ThemeSync` tests).
4. `__chromeStorageSessionMap` alongside `__chromeStorageMap` for sentinel-absence scans.

---

### 13. `tests/harness/twoSurface.ts` (test harness, not a test file)

**Analog:** `tests/core/workspace/WorkspaceHandoff.test.ts`

**A deterministic loopback transport — the sanctioned D2-30 shape** (RESEARCH, and the injectable seam already exists at `protocol.ts` lines 219-232):
```typescript
export interface HandoffTransport {
  publish(envelope: HandoffEnvelope): void;
  subscribe(listener: (value: unknown) => void): () => void;
}
```
```typescript
export function createLoopbackTransport(): HandoffTransport {
  const listeners: Array<(v: unknown) => void> = [];
  return {
    publish(envelope) { for (const l of [...listeners]) l(structuredClone(envelope)); },
    subscribe(listener) {
      listeners.push(listener);
      return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); };
    },
  };
}
```
**Do not import `BroadcastBus` directly and assert a delivery** — its `INSTANCE_ID` is module-level (`BroadcastBus.ts` lines 12-15) and its own-echo suppression (lines 27-41) drops in-process cross-surface messages. `createHandoffInitiator` / `createHandoffTarget` already accept `transport?` (lines 438, 650) — use that seam.

**Microtask flush helper instead of arbitrary sleeps** (lines 81-83):
```typescript
const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};
```

**Outbound-message observation via a `publish` spy** (lines 85-95):
```typescript
function publishedOf(spy: ReturnType<typeof vi.spyOn>, type: string): HandoffEnvelope[] {
  return spy.mock.calls
    .filter(([channel, payload]) =>
      channel === CHANNEL && typeof payload === 'object' && payload !== null &&
      (payload as { type?: string }).type === type)
    .map(([, payload]) => payload as HandoffEnvelope);
}
```

**Deterministic time seam** — the repo uses `vi.useFakeTimers()` (line 291) + `await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS)` (lines 419, 440, 454). The harness exposes `advanceHeartbeat()` / `advanceDebounce()` wrappers over these so no test hard-codes a duration.

**Real-bus coverage stays in the existing Phase-1 suite** (lines 670-760) via `vi.resetModules()` + a second module instance. The new harness does **not** duplicate that.

**Harness inventory (D2-30):** one simulated Side Panel runtime + one simulated Standalone runtime; independent surface stores; stable surface/workspace identities; the **real** `validateEnvelope` and handoff validators; a deterministic transport; the real workspace persistence repository; the real `WriterElection`; deterministic clock/heartbeat; deterministic tab/focus/reload/lifecycle adapters; restart/crash simulation; Phase 2 DB adapters; synthetic-only `CredentialStorePort` support. Mock **only** environmental boundaries: Chrome tabs, Side Panel APIs, `BroadcastChannel`, `chrome.storage`, IndexedDB failure injection, time, browser lifecycle.

**Location constraint:** `tests/harness/twoSurface.ts` must not match vitest's default `*.test.*` glob (it does not) and must be importable by both suites independently.

---

### 14. Storage/security test suites — `tests/core/{security,storage}/*.test.ts`

**Analogs:** `tests/core/storage/legacyCredentialCleanup.test.ts` + `tests/core/storage/chromeStorageAdapter.test.ts`

**Synthetic sentinel + absence assertions (D2-06/D2-32 require these by name)** — `legacyCredentialCleanup.test.ts` lines 28-34:
```typescript
const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';
const STORAGE_KEY = 'np_store';
const CLEANUP_VERSION_FIELD = 'plaintextCleanupSchemaVersion';

/** The chrome.storage.local mock's backing map (see `tests/setup.ts`). */
const storageMap = () => (globalThis as any).__chromeStorageMap as Map<string, unknown>;
```

**Scan every persisted surface for the sentinel** (lines 103-114):
```typescript
function serialisedStorage(): string {
  return JSON.stringify({
    local: Array.from(storageMap().entries()),
    session: Array.from(sessionMap.entries()),
    localStorage: Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.getItem(localStorage.key(i) as string)),
    sessionStorage: Array.from({ length: sessionStorage.length }, (_, i) =>
      sessionStorage.getItem(sessionStorage.key(i) as string)),
  });
}
```
Then assert `expect(serialisedStorage()).not.toContain(SENTINEL)` **and** the same absence in the `debugLog` ring buffer (`getRecentLogs()`), the journal entry, the ErrorStore record, the handoff envelope and the URL.

**A local storage-area stand-in when the setup mock lacks one** (lines 116-120) — the pattern to copy for `chrome.storage.session` until Wave 0 adds it globally:
```typescript
const sessionMap = new Map<string, unknown>();
function installSessionArea(): void {
  (chrome.storage as unknown as Record<string, unknown>).session = { /* Map-backed get/set/remove/clear */ };
}
```

**`__test__` seam reset in `beforeEach`** — `chromeStorageAdapter.test.ts` lines 10-16:
```typescript
beforeEach(() => {
  const map = (globalThis as any).__chromeStorageMap;
  if (map) map.clear();
  vi.clearAllMocks();
  __test__.resetPendingState();
});
```
Every Phase 2 IndexedDB suite adds `(globalThis as any).__resetIndexedDB()` and closes every handle in `afterEach`.

---

### 15. `tests/core/workspace/WriterElection.test.ts` (test, event-driven)

**Analog:** `tests/core/workspace/WorkspaceHandoff.test.ts` (fake timers) + `tests/core/storage/chromeStorageAdapter.test.ts` (`__test__` reset)

Cover the D2-34 list as named cases: initial assignment; epoch generation; CAS success; CAS conflict; stale-writer rejection (**with a *newer* `electedAt`** — Pitfall 2's warning sign); heartbeat renewal; heartbeat expiry (**advance past two intervals**); one-surface closure; failed handoff retaining the existing writer; successful handoff changing authority only after persistence + ack; mirror-state activation. Assert explicitly that **no debounce timer is involved** (drive fake timers and prove the record is visible immediately) — Pitfall 1.

---

### 16. `tests/integration/*.integration.test.ts` (two suites)

**Analog:** `tests/core/workspace/WorkspaceHandoff.test.ts`

Suite A (`workspaceHandoff.integration.test.ts`, D2-31) and Suite B (`onboardingTwoSurface.integration.test.ts`, D2-32) each map **one named test per clause**. Suite A's chat-identity assertions use the real `ChatHistoryDB` contract with minimal synthetic records (D2-33): persistence survives restart, handoff references resolve, **message bodies are not in the handoff envelope**, production reads use ChatHistoryDB. Suite A must **not** initialise the full KeyVault — it proves the handoff payload *cannot* contain a credential instead.

Suite B is fixture-backed for the normal flow; vault boundary tests invoke `CredentialStorePort` directly through an authorised application test adapter. Suite B's "exactly one authoritative onboarding attempt" case gates on writer state (`primary`/`solo` presents; `mirror`/`election-pending` must not) — Pitfall 10.

Both suites: independently runnable; no arbitrary sleeps; no live network; no real Chrome; no test-order dependency; complete cleanup after each test. Keep WINDOWS #5/#8 `open` after they pass.

---

### 17. Config + gates

**`wxt.config.ts`** (lines 36-47, 65-72) — add `'unlimitedStorage'` to `permissions`, and update the prohibition comment in the same change:
```typescript
permissions: ['sidePanel', 'storage', 'tabs'],
host_permissions: ['*://*.service-now.com/*', '*://support.servicenow.com/*'],
/* … */
content_security_policy: {
  extension_pages: "script-src 'self'; object-src 'self'; connect-src 'none'",
},
```

**`tests/isolation/generated-manifest.test.ts`** — the constant that **will fail** the moment the permission is added (line 44) and the sorted deep-equal that makes an extra permission a red test (lines 110-117):
```typescript
const AUTHORISED_PERMISSIONS = ['sidePanel', 'storage', 'tabs']; // wxt.config.ts `permissions` (least privilege, D-19a)
```
```typescript
expect([...(manifest.permissions as string[])].sort()).toEqual([...AUTHORISED_PERMISSIONS].sort());
```
And the fail-never-skip loader (lines 69-88) — a build-inspection test that passes without the build is the defect it exists to prevent. **Move `wxt.config.ts`, this constant and the comment together in one change, after `pnpm run build:ext`.**

**`package.json`** — the self-derived path preflight to reuse (line 17, `verify:phase-1`):
```json
"verify:phase-1": "tsc --noEmit && node -e 'const s=require(\"./package.json\").scripts[\"verify:phase-1\"];const paths=[...new Set(s.match(/(?:tests\\/[\\w./-]+|scripts\\/[\\w.-]+)/g)||[])];const fs=require(\"fs\");const missing=paths.filter(p=>!fs.existsSync(p));if(missing.length){console.error(\"verify:phase-1: unresolved declared path(s): \"+missing.join(\", \"));process.exit(1)}console.log(\"verify:phase-1: \"+paths.length+\" declared path(s) resolve\")' && vitest run …"
```
The current `verify:phase-2` (line 18) is the **defect**: three of its four filters do not exist and vitest silently ignores them (executed probe: 2 files / 22 tests / exit 0):
```json
"verify:phase-2": "tsc --noEmit && vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts",
```
Rewrite with the same `node -e` preflight shape + concrete Phase 2 suite paths (including `tests/isolation` per OQ-7). **No dummy `RateLimiter.test.ts`** — D2-26/D2-28.

---

### 18. Entrypoints + `MirrorBanner` (hydration + election wiring)

**Analog:** `src/entrypoints/sidepanel/main.tsx` (lines 43-96, 176-205) for the provider-chain and gate composition:
```typescript
const SidePanelRoot: React.FC = () => {
  const mode = useThemeStore((state) => state.mode);
  const pack = useThemeStore((state) => state.pack);
  useThemeSync();
  const config = getAntdConfig({ mode, pack: resolveThemePack(pack), compact: true });
  return (
    <XProvider {...config}>
      <AntdApp style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <ErrorBoundary><SidePanelSurface /></ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
};
```
Phase 2 adds the async-hydration kick-off + hydration-status rendering through the **existing store contract** — no Chat redesign (D2-18/D2-20). `hydrating` renders `Skeleton` (UI-SPEC surface 1), never `Spin`.

**`MirrorBanner.tsx`** is activated by authoritative election state only (D-12 carry-forward). Its final copy/visual treatment is Phase 15; Phase 2 wires the state, not the design. All notices use AntD v6 prop names (`notification({ title, description, actions })`).

---

## Shared Patterns

### Result unions — every expected runtime failure
**Source:** `src/core/workspace/WorkspaceState.ts` lines 102-104; `src/core/storage/legacyCredentialCleanup.ts` lines 169-171; `src/core/runtime/RuntimeEnvelopeValidation.ts` lines 173-175
**Apply to:** every Phase 2 module
```typescript
export type WorkspaceStateParseResult =
  | { ok: true; value: WorkspaceState }
  | { ok: false; code: WorkspaceStateParseErrorCode };
```
```typescript
Promise<{ ok: true } | { ok: false; code: string }>
```
Throw only for programmer errors. Migrations are **throw-free and total**.

### Strict Zod schema at every boundary
**Source:** `src/core/workspace/WorkspaceState.ts` lines 149-166; `src/core/runtime/RuntimeEnvelopeValidation.ts` lines 41-130; `src/core/workspace/handoff/protocol.ts` lines 122-133
**Apply to:** DB record validation on hydration, `WriteJournalEntry` on every journal write, `CredentialEnvelopeV1` on open, `WorkspaceCoordinationState`, the legacy-record schema during migration
```typescript
export const workspaceStateSchema = z.object({ /* … */ }).strict();
```
`.strict()` is load-bearing: an unknown field is a typed failure, never silently accepted data.

### SCREAMING_SNAKE debug codes + redaction by construction
**Source:** `src/core/log/debugLog.ts` lines 11-27; `src/core/storage/legacyCredentialCleanup.ts` lines 206-217
**Apply to:** every catch in every new module
```typescript
debugLog(CLEANUP_FAILED_CODE, 'Legacy plaintext credential cleanup failed', {
  reason: error instanceof Error ? error.name : typeof error,   // never the value
});
```
Canonical codes this phase emits: `WRITE_JOURNAL_FAILED`, `IDB_MIGRATION_FAILED`, `IDB_BLOCKED`, `NP_STORE_REHYDRATE_FAILED`, plus one code per new failure path. **Never** log a body, credential, ciphertext, salt, IV, page content or hidden reasoning — and never a length/prefix/suffix/digest of one.

### Storage availability guard
**Source:** `src/core/storage/legacyCredentialCleanup.ts` lines 172-176; `src/core/onboarding/onboardingStateStore.ts` lines 166-168
**Apply to:** every module touching `chrome.storage`
```typescript
if (typeof chrome === 'undefined' || !chrome?.storage?.local) return { ok: true };
```
A non-extension context (a plain page, a test without the mock) is a soft success, never a throw.

### `__test__` namespace for test seams
**Source:** `src/core/theme/chromeStorageAdapter.ts` lines 231-247
**Apply to:** every new stateful module needing test control (DB handle reset, clock seam, failure injection)
```typescript
export const __test__ = {
  setTimerFactory(factory: typeof timerFactory): void { timerFactory = factory; },
  resetPendingState(): void { /* … */ },
  getPendingSize(): number { return pendingWrites.size; },
};
```
Production code must never import `__test__`.

### Module-function registries
**Source:** `src/core/messaging/MessageBus.ts` lines 9-26, 82-116
**Apply to:** any registry-shaped module this phase adds
```typescript
const handlers = new Map<EnvelopeType, Set<MessageHandler>>();

export function register<T = unknown>(type: EnvelopeType, handler: MessageHandler<T>): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler as MessageHandler);
  return () => { /* … */ };
}
```
An `init()` guard prevents double listener registration; `isInitialized()` is the observable.

### Never debounce the election — **divergence from CONTEXT's "Reusable Assets"**
**Source:** `src/core/theme/chromeStorageAdapter.ts` lines 127-139, 141-158
`setItem` defers and `getItem` short-circuits to the in-memory `pendingWrites` map. That is correct for a store and **wrong for a compare-and-set**: the read-back would read the pending value, not what landed, and in the real extension it races the 300 ms trailing debounce — both surfaces can believe they won.
**Rule:** `chromeStorageAdapter` for `np_workspace` only; **direct `chrome.storage.session`** for `np_workspace_primary`. Record the divergence.

### Surface isolation + background-SW exclusion
**Source:** `tests/isolation/cross-entrypoint-imports.test.ts` lines 74-114, 139-168; `.planning/product/PRODUCT_SPEC.md` §0.2
Shared infra lives in `src/core/**`, `src/types/**`, `src/services/**`, `src/components/common/**`; `chat/**` ↔ `standalone/**` never cross-import. **No IndexedDB in the background SW** — `src/entrypoints/background.ts` registers exactly three things and must gain none. `idb` and `fake-indexeddb` are not on the banned list (`tests/isolation/banned-imports.test.ts` lines 46-50: `tailwind`, `shadcn`, `@radix-ui`, `framer-motion`).

### Test architecture (D2-35)
One shared harness; focused scenario builders; deterministic fake time (`vi.useFakeTimers()` + `advanceTimersByTimeAsync`); synthetic secrets (`'sk-secret-DO-NOT-LEAK-XYZ123'`); explicit failure injection; one named test per acceptance clause; clear arrange/act/assert; **no arbitrary sleeps**; no live network; no real Chrome; no test-ordering dependency; complete cleanup after each test.

---

## No Analog Found

Files with no close match in the codebase — the planner must use the RESEARCH.md patterns and the canonical spec contracts instead.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/storage/WriteJournal.ts` (journal semantics) | service | event-driven | No journal / multi-step-write / replay machinery exists. Appendix O.11 is the reference implementation; `legacyCredentialCleanup.ts` contributes only the idempotence + redaction discipline, and `protocol.ts` only the injectable-deps + typed-result shape |
| `src/core/storage/IndexedDBMigrator.ts` (the `idb` open/upgrade plumbing) | framework | batch | No IndexedDB code exists anywhere in `src/` today. §20.4's `IndexedDBMigration` interface is verbatim; the executed `idb@8.0.3` + `fake-indexeddb@6.2.5` probe results in RESEARCH § Code Examples are the behavioural reference |
| `src/core/workspace/WriterElection.ts` (the CAS/heartbeat protocol) | service | event-driven | No cross-surface mutual-exclusion code exists. §13/§20.11 pin the record and timings; RESEARCH Pattern 6 is the protocol. `WorkspaceStore.ts` lines 42-58 document the exact swap point and the frozen vocabulary to preserve |

---

## Metadata

**Analog search scope:** `src/core/**`, `src/store/**`, `src/services/**`, `src/types/**`, `src/entrypoints/**`, `tests/**`, `package.json`, `wxt.config.ts`, `vitest.config.ts`

**Files scanned:** 34 read directly (every analog above verified with `git ls-files -- <path>`); 12 additional files located and sized but not read (their contracts are already established by the 34)

**Key divergences to record in the plans:**
1. **Election write must not use `chromeStorageAdapter`** — its 300 ms debounce makes read-back verification impossible (CONTEXT's "Reusable Assets" suggests reuse; correct for `np_workspace`, wrong for the election).
2. **`WriteJournal` pre-seeds all seven stages as `pending`** rather than O.11's push-completed — required by D2-09's restart-safety and D2-12's "retain the stage showing destination verified".
3. **The two-surface harness injects a deterministic transport** rather than using the shipped `BroadcastBus` (module-level `INSTANCE_ID` + own-echo suppression drop in-process cross-surface messages).
4. **`src/core/storage/Setting.ts` ships with a real consumer** (`np_install_secret` creation) per OQ-3 — not a placeholder.
5. **No `WriteJournalOperation` canonical member for the legacy migration** (OQ-2) — add `'migrate-legacy-conversations'` additively and record it as a spec follow-up (D2-29 pattern).

**Pattern extraction date:** 2026-09-24
