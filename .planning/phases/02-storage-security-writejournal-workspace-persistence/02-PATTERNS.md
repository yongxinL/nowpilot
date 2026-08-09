# Phase 2: Storage, Security, WriteJournal, Workspace Persistence — Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 19 target files (13 create + 6 modify)
**Analogs found:** 14 / 19 (5 have no in-repo analog — RESEARCH provides verified patterns)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/storage/Setting.ts` | store (KV wrapper) | CRUD | `src/core/registry/AddonSettingsStore.ts` + `src/core/theme/ThemeStore.ts` | role-match (write-through + sanitize; sync-area from ThemeStore) |
| `src/core/storage/EncryptedStorage.ts` | utility (crypto primitive) | transform | RESEARCH Pattern 3 (verified probe) | no-in-repo analog |
| `src/core/storage/WriteJournal.ts` | service | event-driven (steps) | spec Appendix O.11 (lines 6601–6634) verbatim | spec-analog (no in-repo file) |
| `src/core/storage/IndexedDBMigrator.ts` | utility (migration runner) | batch/transform | RESEARCH Pattern 2 (raw-open + wrap, verified) | no-in-repo analog |
| `src/core/security/KeyVault.ts` | service | CRUD + state machine | `src/core/ai/ProviderRegistry.ts` (singleton + gate + listeners) | role-match |
| `src/core/security/redactSensitive.ts` | utility | transform | `src/core/security/TraceRedactor.ts` (module shape; will be replaced) + spec O.13 | role-match |
| `src/core/storage/ChatHistoryDB.ts` | model (idb store) | CRUD | RESEARCH Pattern 1 (DBSchema + openDB, verified) | no-in-repo analog |
| `src/core/storage/MemoryDB.ts` | model (idb store) | CRUD | RESEARCH Pattern 1 | no-in-repo analog |
| `src/core/storage/NotesDB.ts` | model (idb store) | CRUD | RESEARCH Pattern 1 | no-in-repo analog |
| `src/core/storage/ErrorStore.ts` | model (idb store) | CRUD (FIFO) | RESEARCH Pattern 1 + `debugLog.ts` redaction sink (R-10) | no-in-repo analog |
| `src/core/utils/RateLimiter.ts` | utility (token bucket) | event-driven | `ProviderRegistry.ts` (per-instance keyed class) | role-match (shape only) |
| `src/core/http/Requester.ts` | service | request-response | `src/core/runtime/BroadcastBus.ts` `emit()` (sendMessage + catch → debugLog) | role-match |
| `src/core/storage/ImportExport.ts` (+1 deviation) | service | batch + file-I/O (ZIP) | RESEARCH Pattern 7 (fflate zipSync/unzipSync verified) | no-in-repo analog |
| `src/core/workspace/WorkspaceStore.ts` (**modify**) | store | CRUD | **itself** (D-06: rewire `update()` through journal; keep sanitizeStored/writeStorage) | exact |
| `src/core/security/TraceRedactor.ts` (**modify**) | utility | transform | **itself** (replace pass-through body with O.13 regexes) | exact |
| `src/core/error/errorCodes.ts` (**modify**) | config | — | **itself** (extend IN PLACE; canonicalize into spec C.2) | exact |
| `src/core/theme/ThemeStore.ts` (**modify**) | store | CRUD | **itself** (rewire setMode/setPack through Setting.ts sync-first, D-15) | exact |
| `tests/setup.ts` (**modify**) | config (test env) | — | **itself** (add `import 'fake-indexeddb/auto'` + IDB reset) | exact |
| `tests/isolation/check-content-bundle.mjs` (**modify**) | config (gate) | — | **itself** (add `idb`/`fflate` forbidden tokens) | exact |
| `package.json` (**modify**) | config | — | **itself** (add `verify:phase-2`; per spec §24 line 3666) | exact |

**Test files (new, per §18 + RESEARCH validation map):** `tests/core/storage/{Setting,EncryptedStorage,WriteJournal,IndexedDBMigrator,ChatHistoryDB,NotesDB,MemoryDB,ErrorStore,ImportExport}.test.ts`, `tests/core/security/{KeyVault,redactSensitive}.test.ts`, `tests/core/utils/RateLimiter.test.ts`, `tests/core/http/Requester.test.ts`, `tests/core/workspace/WorkspacePersistence.test.ts` (integration, imports SAME fixture builders as unit tests — D-21), plus `tests/fixtures/` (6 named typed builders: `vault-roundtrip`, `cross-install`, `journal-recovery`, `migration`, `quota-shadow`, `redaction`). Test analog: `tests/core/workspace/WorkspaceStore.test.ts` (fakeBrowser + afterEach reset pattern).

---

## Pattern Assignments

### `src/core/storage/Setting.ts` (store, CRUD) — per-key permissioned KV wrapper

**Analog:** `src/core/registry/AddonSettingsStore.ts` (write-through) + `src/core/theme/ThemeStore.ts` (sync area + read-validate).

**Imports + module shape** (AddonSettingsStore.ts lines 9–14):
```typescript
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
export const NP_ADDON_SETTINGS_KEY = 'np_addon_settings';
```

**Write-through adapter — never throws** (AddonSettingsStore.ts lines 49–58):
```typescript
async function writeStorage(settings: Record<string, Record<string, unknown>>): Promise<void> {
  try {
    await chrome.storage.local.set({ [NP_ADDON_SETTINGS_KEY]: settings });
  } catch (err) {
    debugLog(ERROR_CODES.ADDON_SETTINGS, 'failed to write np_addon_settings', {
      error: err instanceof Error ? err : undefined,
      module: 'AddonSettingsStore',
    });
  }
}
```

**Adaptation notes:**
- Add a **per-key permission table** (D-09): `key → { area: 'local'|'sync'|'session', encrypted?: boolean, writeAllowed?: boolean }`; `np_schema_version`, `np_workspace`, `np_providers`, `np_addon_settings` → local; `np_theme`/`np_theme_pack`/`np_language` → sync; `np_jsessionid`/`np_sysparm_ck`/`np_token_ttl`/`np_active_stream`/`np_workspace_primary` → **declared only, no accessors** (D-11).
- **Serialized writes** (spec §13 line 1791): promise-chain mutex — never two `Setting<T>` keys concurrently. RESEARCH Pattern 4 (Setting.ts section).
- **Migrate-on-read** (D-10): at init, read `np_schema_version`; normalize old KV shapes via the per-key sanitizer (generalize `sanitizeStored` — see WorkspaceStore lines 68–87).
- **Sync-quota shadow** (D-15): sync area writes get try-sync → catch → `debugLog(ERROR_CODES.SYNC_QUOTA_EXCEEDED, ...)` → write same key to local; reads sync-first-then-local; promote-and-delete-shadow on successful sync write; debounce cosmetic keys. Use ThemeStore's `isValidMode` read-validate idiom (lines 46–48, 72–74).
- **onChanged propagation** reuses the remove-then-add listener (T-1-11) pattern — AddonSettingsStore lines 76–86 / ThemeStore lines 85–104.

### `src/core/storage/EncryptedStorage.ts` (utility, transform) — AES-GCM primitive

**No in-repo analog.** Use RESEARCH Pattern 3 (verified in jsdom-align) verbatim:

```typescript
// RESEARCH Pattern 3 — verified in the project's exact test stack
const subtle = crypto.subtle;
const baseKey = await subtle.importKey('raw', new TextEncoder().encode(installSecret + extensionId),
  'PBKDF2', false, ['deriveKey']);
const derived = await subtle.deriveKey(
  { name: 'PBKDF2', salt: new Uint8Array(16), iterations: 100_000, hash: 'SHA-256' },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, derived, new TextEncoder().encode('sk-abc'));
const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, derived, ct);   // auth-tag mismatch → throws (D-03)
```

**Adaptation notes:**
- Envelope shape per §15.2 / D-02: `{ salt: 16B, iv: 12B, ciphertext }` per key; `encrypt(plaintext) → { salt, iv, ciphertext }`, `decrypt(envelope) → plaintext`.
- `decrypt()` **throws** typed `VAULT_DECRYPT_FAILED` (D-03) — catch in KeyVault; never auto-wipe.
- Fully async (`crypto.subtle` is async-only). NEVER derive from `navigator.userAgent` (§15.2 line 1983).
- Import pattern: follow module style of `TraceRedactor.ts` (small single-purpose module, header comment citing spec §15.2).

### `src/core/storage/WriteJournal.ts` (service, event-driven) — runJournaled / recoverJournal

**Spec-analog:** Appendix O.11 (lines 6601–6634) — usable as-is with adaptations. **Type analog:** `src/types/workspace.ts` (per-domain types file precedent — the spec's own O.11 imports `WriteJournalEntry` from `@/types/storage`, so create `src/types/storage.ts`; do NOT put these in `harness.ts`).

**Core pattern** (Appendix O.11 lines 6601–6634, verbatim contract):
```typescript
export interface JournalStep {
  name: string;
  apply(): Promise<void>;      // MUST be idempotent (safe to run twice on replay)
  rollback(): Promise<void>;
}
export async function runJournaled(
  entry: WriteJournalEntry, steps: JournalStep[], persist: (e: WriteJournalEntry) => Promise<void>,
): Promise<void> {
  entry.status = 'applying'; entry.attempts++; await persist(entry);
  const done: JournalStep[] = [];
  try {
    for (const s of steps) { await s.apply(); entry.steps.push({ name: s.name, status: 'completed' }); done.push(s); await persist(entry); }
    entry.status = 'completed'; await persist(entry);
  } catch (e: any) {
    debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'rolling back', { id: entry.id, step: done.at(-1)?.name });
    for (const s of done.reverse()) { try { await s.rollback(); } catch (r: any) { debugLog(ERROR_CODES.WRITE_JOURNAL_ROLLBACK_FAILED, r?.message ?? 'rollback', { id: entry.id }); } }
    entry.status = 'rolled-back'; await persist(entry);
    throw e;
  }
}
export async function recoverJournal(load: () => Promise<WriteJournalEntry[]>, replay: (e: WriteJournalEntry) => Promise<void>): Promise<void> {
  for (const e of await load()) { if (e.status === 'applying' || e.status === 'pending') await replay(e); }
}
```

**Types (Appendix C lines 4594–4607 + §20.3 line 3186):** `WriteJournalEntry { id, operation: WriteJournalOperation, status: 'pending'|'applying'|'completed'|'failed'|'rolled-back', createdAt, updatedAt, attempts, targetIds: Record<string,string>, steps: [{name, status, error?}] }`. `WriteJournalOperation` = the **locked 11-op union verbatim** (§20.3 lines 3186–3197) — only `'update-workspace'` wired in Phase 2 (D-05), rest declared-but-unwired.

**Adaptation notes (D-06/D-07):**
- **`update-workspace` step order** (§20.3 lines 3200–3207): (1) create entry `status='pending'`; (2) write `chrome.storage.local.np_workspace`; (3) emit BroadcastBus WORKSPACE_UPDATED; (4) mark `status='completed'`. Step 3 reuses `WorkspaceSync.publishSnapshot` (lines 184–195) — `broadcastBus.emit(MessageType.WORKSPACE_UPDATED, { state, from })`.
- **Idempotency key** (§20.2 line 3179): `workspaceId + version` → `targetIds: { workspaceId, version }`.
- **Replay is workspace-scoped** (D-07): `replay()` applies the M.3 scope gate — a recovered write for a different `workspaceId` is skipped (same guard as WorkspaceStore lines 167–173). **Unknown-op replay = skip + debugLog, never throw** (forward-compat).
- Journal entry persistence lives in **WriteJournalDB** (IndexedDB, `entries` store per §15.1 line 1964) — see the idb store pattern below.

### `src/core/storage/IndexedDBMigrator.ts` (utility, batch) — raw-open + wrap()

**No in-repo analog. RESEARCH Pattern 2 is the VERIFIED critical pattern** (the one non-obvious decision; idb `openDB` with a throwing upgrade leaks an unhandled rejection in fake-indexeddb → vitest exits 1):

```typescript
// RESEARCH Pattern 2 — verified clean (exit 0, both paths, atomic rollback)
import { wrap, type IDBPDatabase } from 'idb';
type Migration = (db: IDBDatabase, tx: IDBTransaction, oldV: number, newV: number) => void;
function migratorOpen<T>(name: string, targetVersion: number, migrations: Migration[]): Promise<IDBPDatabase<T>> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, targetVersion);
    req.onupgradeneeded = (ev) => {
      const db = req.result, tx = req.transaction!, oldV = ev.oldVersion, newV = ev.newVersion;
      for (const m of migrations) m(db, tx, oldV, newV); // SYNC dispatch; a throw aborts atomically
    };
    req.onsuccess = () => resolve(wrap(req.result));
    req.onerror = () => reject(req.error);
    req.onblocked = () => {};
  });
}
```

**Adaptation notes (D-12/D-13/D-14, §20.4):**
- Keep `IndexedDBMigration { fromVersion, toVersion, description, migrate(db, tx): Promise<void> }` verbatim (§20.4 lines 3211–3218); the runner dispatches `migrate(wrap(db), wrap(tx))` synchronously — **never await inside the upgrade callback** (transaction auto-closes; Pitfall 2). Data-carry via **IDBRequest chaining** (`getAll().onsuccess → put`).
- **Failure path:** migration throws → openDB rejects `AbortError` (original message swallowed) → migrator catches → `debugLog(ERROR_CODES.IDB_MIGRATION_FAILED, …)` → record to ErrorStore → **degraded mode**: read-only for the affected DB (reads still work at v(n-1); writes blocked with typed error) + degraded state (`degraded: { db, reason }[]` module-level) for the Phase-7 banner. In-memory fallback REJECTED (D-12).
- Seed with the synthetic v1→v2 fixture (adds a store + adds an index + carries data; D-13).

### `src/core/security/KeyVault.ts` (service, CRUD + state machine) — installSecret + PROVIDER_KEY_UNREADABLE

**Analog:** `src/core/ai/ProviderRegistry.ts` — lazy singleton + listener Set + gate predicate (lines 16–88):

```typescript
// ProviderRegistry.ts lines 79–88 — lazy singleton (copy this shape)
let singleton: ProviderRegistry | null = null;
export function getProviderRegistry(): ProviderRegistry {
  if (singleton === null) singleton = new ProviderRegistry();
  return singleton;
}
// lines 24–44 — subscribe/notify with listener isolation (Golden Rule 9)
subscribe(listener): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
// lines 64–66 — gate predicate (D-04: 'configure later' routing reuses this)
hasActiveProvider(): boolean { return this.activeProviderId !== undefined; }
```

**Adaptation notes (D-02/D-04):**
- installSecret lifecycle: `crypto.getRandomValues(new Uint8Array(32))` → base64 → `chrome.storage.local` `np_install_secret` via **read-then-write-if-absent** (race-safe; "already present" authoritative; immutable once set). Never in sync, never in exports (D-01/D-02).
- Derived key: PBKDF2(installSecret + `chrome.runtime.id`, salt, 100000, SHA-256) → AES-GCM-256 (delegates to EncryptedStorage). `chrome.runtime.id` in fakeBrowser is the deterministic `"test-extension-id"` → deterministic tests.
- `PROVIDER_KEY_UNREADABLE` state: `decrypt()` VAULT_DECRYPT_FAILED / missing installSecret / tampered ciphertext all converge on **one state + one code**; provider surfaces as unconfigured ("Key required — re-enter", enabled=false) → routes to the ProviderRegistry gate = onboarding "configure later" (D-04). **No auto-wipe, no auto-regenerate.** Wipe is user-initiated only.
- Error path shape: `debugLog(ERROR_CODES.VAULT_DECRYPT_FAILED, ...)` (Golden Rule 9) — never throw raw.

### `src/core/security/redactSensitive.ts` (utility, transform) — field-level redaction

**Analog:** `src/core/security/TraceRedactor.ts` (module shape; pass-through to be replaced) + spec O.13 (lines 6686–6694) regex list:

```typescript
// PRODUCT_SPEC Appendix O.13 (lines 6686-6694) — TraceRedactor real body
const REDACTION_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]+/g, /key-[A-Za-z0-9_-]+/g, /Bearer\s+[A-Za-z0-9._-]+/gi,
  /JSESSIONID=[^;\s]+/gi, /sysparm_ck[=:]\s*[^&\s]+/gi, /g_ck[=:]\s*[^&\s]+/gi,
];
export function redact(value: string): string {
  return REDACTION_PATTERNS.reduce((s, re) => s.replace(re, '[REDACTED]'), value);
}
```

**Adaptation notes (D-16):**
- `redactSensitive(value: unknown): unknown` — **field-level** for storage-bound objects; recursively redact string fields; **DROPPED not masked** for password-like values (never `[REDACTED]` a password — omit the field).
- The vault ciphertext itself must NOT be re-redacted (already encrypted) — redactSensitive operates on plaintext-before-encryption and non-secret metadata.
- **Consumers in Phase 2:** ErrorStore.write, journal persist (`WriteJournalEntry.steps[].error`, `targetIds`), export serialization (D-17), every debugLog call (already routes through TraceRedactor — stable signature means no caller churn).

### The four IndexedDB stores (model, CRUD) — ChatHistoryDB / NotesDB / MemoryDB / ErrorStore

**No in-repo analog. RESEARCH Pattern 1 (verified)** is the template for all four:

```typescript
// RESEARCH Pattern 1 — verified against idb 8.0.3
import { openDB, type DBSchema } from 'idb';
interface ChatDB extends DBSchema {
  sessions: { key: string; value: ChatSession };
  messages: { key: string; value: ChatMessage; indexes: { 'by-session': string } };
}
const db = await openDB<ChatDB>('ChatHistoryDB', 1, {
  upgrade(db) {
    db.createObjectStore('sessions', { keyPath: 'id' });
    const msgs = db.createObjectStore('messages', { keyPath: 'id' });
    msgs.createIndex('by-session', 'sessionId');
  },
});
await db.put('messages', { id: 'm1', sessionId: 's1', role: 'user', content: 'hi', timestamp: 1 });
const rows = await db.getAllFromIndex('messages', 'by-session', 's1');
```

**Per-store data models (spec §21 + §15.1 — verbatim, no invented shapes):**
- **ChatHistoryDB** (§21.1 lines 3329–3353): `sessions` store (ChatSession `{id,title,created,updated,starred,preview}` keyPath `id`) + `messages` store (ChatMessage `{id,sessionId,role:'system'|'user'|'assistant'|'tool',content,timestamp,metadata?}`).
- **NotesDB** (§21.2 lines 3357–3384): `notes` (Note with LLM-Wiki optional fields) + `concepts` (`{slug,label,summary,noteIds[],aliases[],updatedAt}`) — plus `getNoteByTitle()` (§15.1).
- **MemoryDB** (§21.3/§21.4): `messages` keyPath **`[conversationId, seq]`** (MemoryMessage), `userFacts` (Fact `{id,content,confidence,source,created}`), `conversationSummaries`.
- **ErrorStore** (§15.1 line 1963): FIFO max 100, debug only, **redaction-before-write** (R-10) — every entry's message fields pass through TraceRedactor.redact / redactSensitive before put; sink for `IDB_MIGRATION_FAILED`.

**Adaptation notes:**
- Each store declares a numeric `DB_VERSION` and opens through the IndexedDBMigrator (raw-open) so migrations stay uniform — or plain `openDB` for the initial create with no migration history. The RESEARCH verdict: migrator uses raw open for version-change; happy-path initial open may use idb `openDB` with a non-throwing upgrade.
- Every catch → `debugLog` (Golden Rule 9); never throw from write boundaries.

### `src/core/utils/RateLimiter.ts` (utility, event-driven) — per-instance token bucket

**Analog (shape only):** `ProviderRegistry.ts` — per-instance class keyed by addonId, dependency-free (imports only `@/core/error`). Internals are agent discretion (§10.7): token bucket per addonId instance; exports a factory (`getRateLimiter(addonId)`) or constructor; functional primitive — add-on consumers land Phase 8.

### `src/core/http/Requester.ts` (service, request-response) — PROXY_FETCH wrapper

**Analog:** `BroadcastBus.emit()` (lines 63–80) — the canonical `browser.runtime.sendMessage` + `.catch → debugLog` fire-and-forget pattern; and `RuntimeEnvelope`-shaped messaging. Requester wraps `chrome.runtime.sendMessage({ type: 'PROXY_FETCH', addonId, url, method, headers?, body?, credentials? })` (Appendix C ProxyFetchRequest lines 4611–4620) with a 25s timeout (discretion) and returns the `ProxyFetchResponse` shape (`{ok,status,body,error?}`, lines 4621–4626). Every rejection → `debugLog` (Golden Rule 9).

### `src/core/storage/ImportExport.ts` (+1 documented deviation, service, batch+file-I/O)

**No in-repo analog. RESEARCH Pattern 7 (verified):** `zipSync`/`unzipSync`/`strToU8`/`strFromU8` from `fflate` (approved stack §7) roundtrip cleanly in jsdom-align.

**Contract (D-17/D-18):**
- Canonical format: JSON (inspectable/diffable/sanitizable); ZIP via fflate for full-vault multi-group exports.
- Groups mirror export-data `{ scopes: string[] }` (spec line 1598): `chat-history | notes | memory | workspace | settings`; each group **sanitized with redactSensitive before serialization**; **no secret material ever** (D-01 — np_providers ciphertext excluded).
- Manifest: `{ exportedAt, appVersion, schemaVersion }`.
- Restore = **per-group MERGE/upsert by id** (existing wins by default; "restore overwrites" toggle) — never wipe-and-replace (D-18). Full-vault ZIP restore runs journaled (restore-batch-style op via runJournaled).
- Do NOT fold into Setting.ts (research Q1 recommendation: standalone file).

---

## Shared Patterns

### 1. chrome.storage write-through adapter — never throws (Golden Rule 9)
**Sources:** `WorkspaceStore.ts` lines 90–99, `AddonSettingsStore.ts` lines 49–58.
**Apply to:** Setting.ts, WorkspaceStore journal step 2, KeyVault installSecret write, ThemeStore rewire (D-15 shadow machinery).
```typescript
try {
  await chrome.storage.local.set({ [KEY]: value });
} catch (err) {
  debugLog(ERROR_CODES.STORE_WRITE, 'failed to write', {
    error: err instanceof Error ? err : undefined,
    module: '<ModuleName>',
  });
}
```

### 2. sanitizeStored — T-1-13 inbound gate (never merge raw storage)
**Source:** `WorkspaceStore.ts` lines 68–87 (shape-check → field-validate → unknown keys dropped). **Apply to:** Setting.ts migrate-on-read (D-10) for `np_workspace`, `np_providers`, `np_addon_settings`; journal replay scope gate (D-07).

### 3. debugLog + canonical error codes (Golden Rule 9)
**Sources:** `debugLog.ts` lines 25–39 (signature + redaction), `errorCodes.ts` lines 7–58 (registry shape). **Apply to: EVERY Phase-2 catch.** Extend `errorCodes.ts` IN PLACE with: `VAULT_DECRYPT_FAILED`, `PROVIDER_KEY_UNREADABLE`, `IDB_MIGRATION_FAILED`, `SYNC_QUOTA_EXCEEDED`, `WRITE_JOURNAL_FAILED`, `WRITE_JOURNAL_ROLLBACK_FAILED` (+ canonicalize into spec Appendix C.2, lines 5013–5100 — CONTEXT requires both). New codes follow the block-comment grouping style of the existing file.

### 4. remove-then-add onChanged listener (T-1-11)
**Sources:** `WorkspaceStore.ts` lines 101–109 + 188–192; `ThemeStore.ts` lines 59 + 100–104. **Apply to:** Setting.ts, ThemeStore rewire. Module-level `let listener: OnChangedListener | null` — survives fakeBrowser.reset() between tests.

### 5. R-10 redaction at every write boundary
**Sources:** `debugLog.ts` line 28 (already routes through TraceRedactor), spec §16.5 lines 2044–2046. **Apply to:** ErrorStore.write, WriteJournal persist, debugLog, export serialization. TraceRedactor keeps its stable `redact(s: string): string` signature (no caller churn) — only the body changes to the O.13 regexes.

### 6. WORKSPACE_UPDATED emission inside the journaled write
**Source:** `WorkspaceSync.ts` lines 184–195 (`broadcastBus.emit(MessageType.WORKSPACE_UPDATED, { state, from, mirror })`); MessageType registry `WORKSPACE_UPDATED` exists (MessageType.ts line 23). **Apply to:** WriteJournal `update-workspace` step 3 (D-06, agent discretion on exact payload).

### 7. Lazy singleton + listener Set
**Source:** `ProviderRegistry.ts` lines 79–88 (singleton) + 24–44 (subscribe/notify with listener try/catch). **Apply to:** KeyVault, RateLimiter, ImportExport.

### 8. fake-indexeddb test harness
**Source:** `tests/setup.ts` (structure — beforeEach fakeBrowser.reset lines 77–79). **Apply to:** add `import 'fake-indexeddb/auto';` at top; per-test IDB isolation (`indexedDB = new IDBFactory()` or fresh DB name per test — RESEARCH line 225). `crypto.subtle` + `structuredClone` already present in jsdom-align — **zero extra polyfills** (verified). Test-file pattern: `tests/core/workspace/WorkspaceStore.test.ts` lines 10–13 (imports), 28–36 (reset helpers + afterEach).

### 9. Fixture builders (D-20/D-21) — new `tests/fixtures/`
Deterministic typed builders (seeded randomness, fixed IDs/timestamps; NO real getRandomValues/Date.now), parameterized on edges (workspaceId, version, secret), edge variants first-class. Same builders imported by unit AND the WorkspacePersistence integration test. Never imported from `src/`.

---

## No Analog Found

Files with no close in-repo match (planner should use RESEARCH.md patterns — all empirically verified in this project's exact vitest/jsdom-align stack):

| File | Role | Data Flow | Reason / Pattern Source |
|------|------|-----------|-------------------------|
| `src/core/storage/EncryptedStorage.ts` | utility | transform | No crypto exists yet. RESEARCH Pattern 3 (AES-GCM + PBKDF2 probe). |
| `src/core/storage/IndexedDBMigrator.ts` | utility | batch | No IndexedDB exists yet. RESEARCH Pattern 2 (raw-open + wrap — the phase's key landmine). |
| `src/core/storage/ChatHistoryDB.ts` / `MemoryDB.ts` / `NotesDB.ts` / `ErrorStore.ts` | model | CRUD | No idb stores exist. RESEARCH Pattern 1 (DBSchema + openDB). |
| `src/core/storage/ImportExport.ts` | service | batch + file-I/O | No import/export exists. RESEARCH Pattern 7 (fflate zipSync/unzipSync). |
| `src/core/storage/WriteJournal.ts` | service | event-driven | Spec Appendix O.11 IS the reference implementation — use verbatim with D-05/06/07 adaptations. |

**Type placement note (planner decision):** spec O.11 imports `WriteJournalEntry` from `@/types/storage` (line 6592). Precedent: `src/types/workspace.ts` (per-domain types file, §21.5 verbatim). Create `src/types/storage.ts` for `WriteJournalEntry` + `WriteJournalOperation` (Appendix C lines 4594–4607, §20.3 lines 3186–3197) rather than extending `src/types/harness.ts` (which is §28.2 harness-track only). Chat/Note/Memory message shapes may live next to their stores or in `src/types/` — follow the §21 section header comment style of `src/types/workspace.ts` lines 1–5.

---

## Metadata

**Analog search scope:** `src/core/**` (workspace, registry, security, error, runtime, ai, theme), `tests/**` (setup, environments, core/workspace, isolation), `.planning/PRODUCT_SPEC_v0_1.md` (§15/§16/§18/§20/§21/Appendices C/C.2/M/O.11/O.13), `02-CONTEXT.md`, `02-RESEARCH.md` (incl. empirical probe results).
**Files scanned:** 10 in-repo files read in full + 6 spec ranges + 2 research files.
**Pattern extraction date:** 2026-08-09
**Key empirical findings carried in:** fake-indexeddb upgrade-abort landmine → raw-open migrator pattern; crypto.subtle/structuredClone available in jsdom-align; fflate clean; `chrome.runtime.id` deterministic in fakeBrowser.
