import { z } from 'zod';
import { getDb, NowPilotDbOpenError } from './NowPilotDB';
import { debugLog } from '../log/debugLog';
import { redactSensitive } from '../security/redactSensitive';

/**
 * ErrorStore — the durable, bounded, redacted failure record (D2-21, §15.1,
 * §20.4).
 *
 * §15.1 names the store: "ErrorStore (debug only, FIFO max 100)". D2-21 defines
 * it as "durable redacted record for migration, persistence, degraded-mode and
 * recovery failures", and §20.4 makes it the destination for
 * `IDB_MIGRATION_FAILED` — the migration failure is recorded **and** degraded
 * mode is entered. This module is the store's repository; the `errors` object
 * store itself is created by 02-02's migrator (`keyPath: 'id'`, index
 * `by-occurred` on `occurredAt`).
 *
 * **Five rules this module exists to keep:**
 *
 *   1. **Redacted before persistence.** Every context object is passed through
 *      `redactSensitive` — the single choke point — *and* through a
 *      payload-stripping walk that drops `message`/`stack` keys, so a raw
 *      exception payload can never reach the store. A record carries a
 *      `SCREAMING_SNAKE` code, integer timestamps and safe identifiers only:
 *      never a message body, credential, page content or whole state object.
 *   2. **Bounded (FIFO max 100).** `recordError` evicts the oldest records
 *      beyond `ERROR_STORE_MAX_RECORDS` in the same transaction as the insert;
 *      `cleanupErrors` re-enforces the bound and additionally removes resolved
 *      records older than the retention window.
 *   3. **Validated at the boundary.** The strict Zod schema rejects a malformed
 *      or over-wide record (a code outside `SCREAMING_SNAKE`, a non-integer
 *      timestamp, an unknown field) with a typed result — never stored data.
 *   4. **Idempotent resolution.** `resolveError` is success-shaped and writes
 *      nothing when the record is absent or already resolved; it never produces
 *      a second record or a stack of resolutions.
 *   5. **Total and throw-free.** No operation throws into its caller. When the
 *      database cannot be opened the module logs `ERROR_STORE_UNAVAILABLE` and
 *      returns a typed failure — it never attempts a doomed write, because the
 *      §19.10 degraded path is `debugLog` plus the caller's notice and
 *      in-memory operation (the single-database topology's accepted cost,
 *      D2-24/OQ-1).
 */

/** §15.1's FIFO bound: the ErrorStore holds at most this many records. */
export const ERROR_STORE_MAX_RECORDS = 100;

/** A resolved record older than this window is removed by `cleanupErrors`. */
export const ERROR_STORE_RESOLVED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The closed resolution union. Resolving is a classification, not free text —
 * a free-form resolution string would be one more place a value could hide.
 */
export const ERROR_RESOLUTIONS = ['auto-recovered', 'retried', 'dismissed', 'superseded'] as const;

export type ErrorResolution = (typeof ERROR_RESOLUTIONS)[number];

/** The durable error record. Every field is a code, a counter or a safe id. */
export interface ErrorRecord {
  id: string;
  /** A canonical `SCREAMING_SNAKE` code (`IDB_MIGRATION_FAILED`, …). */
  code: string;
  /** Integer milliseconds. */
  occurredAt: number;
  /** How many times the failing operation has been attempted. */
  attempts: number;
  resolved: boolean;
  /** The closed classification when `resolved`, otherwise `null`. */
  resolution: ErrorResolution | null;
  /** A context object that has already passed through `redactSensitive`. */
  context?: Record<string, unknown>;
}

/** The canonical §C.2 code shape — the only shape a record's `code` may take. */
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export const errorRecordSchema = z
  .object({
    id: z.string().min(1).max(256),
    code: z.string().min(1).max(64).regex(CODE_PATTERN),
    occurredAt: z.number().int().nonnegative(),
    attempts: z.number().int().nonnegative(),
    resolved: z.boolean(),
    resolution: z.enum(ERROR_RESOLUTIONS).nullable(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type ErrorStoreFailureCode =
  | 'ERROR_STORE_INVALID_RECORD'
  | 'ERROR_STORE_UNAVAILABLE'
  | 'ERROR_STORE_WRITE_FAILED'
  | 'ERROR_STORE_READ_FAILED';

export type RecordErrorResult =
  | { ok: true; record: ErrorRecord }
  | { ok: false; code: ErrorStoreFailureCode };

export type ListErrorsResult =
  | { ok: true; records: ErrorRecord[] }
  | { ok: false; code: ErrorStoreFailureCode };

export type ResolveErrorResult =
  | { ok: true; changed: boolean }
  | { ok: false; code: ErrorStoreFailureCode };

export type CleanupErrorsResult =
  | { ok: true; removed: number }
  | { ok: false; code: ErrorStoreFailureCode };

const INVALID_RECORD_CODE: ErrorStoreFailureCode = 'ERROR_STORE_INVALID_RECORD';
const UNAVAILABLE_CODE: ErrorStoreFailureCode = 'ERROR_STORE_UNAVAILABLE';
const WRITE_FAILED_CODE: ErrorStoreFailureCode = 'ERROR_STORE_WRITE_FAILED';
const READ_FAILED_CODE: ErrorStoreFailureCode = 'ERROR_STORE_READ_FAILED';

/** The record keys a raw exception payload would arrive under. */
const EXCEPTION_PAYLOAD_KEYS = new Set(['message', 'stack']);

/**
 * The redacted reason string for a caught error. IndexedDB rejects with a
 * `DOMException`, which is not `instanceof Error` in every environment, so the
 * name is read structurally — never the message.
 */
function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return typeof error;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Drop every `message`/`stack` key, at any depth. `redactSensitive` removes
 * values stored under a recognised sensitive **name**; this walk removes the
 * two names a caught exception's payload always arrives under, so "no raw
 * exception payload" is structural rather than a caller convention.
 */
function stripExceptionPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripExceptionPayload);
  if (!isPlainObject(value)) return value;
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (EXCEPTION_PAYLOAD_KEYS.has(key.toLowerCase())) continue;
    clone[key] = stripExceptionPayload(value[key]);
  }
  return clone;
}

/** Redact, then strip the exception-payload keys. Never throws. */
function sanitiseContext(context: Record<string, unknown>): Record<string, unknown> {
  const stripped = stripExceptionPayload(redactSensitive(context));
  return isPlainObject(stripped) ? stripped : {};
}

/** The typed failure for a database that cannot be opened. Never a doomed write. */
function unavailable(error: unknown): { ok: false; code: ErrorStoreFailureCode } {
  const reason = error instanceof NowPilotDbOpenError ? error.code : errorName(error);
  debugLog(
    UNAVAILABLE_CODE,
    'ErrorStore is unavailable; the failure cannot be recorded durably',
    { reason },
  );
  return { ok: false, code: UNAVAILABLE_CODE };
}

/** Validate one record read out of the store. Never logs record content. */
function validateRecord(
  candidate: unknown,
): { ok: true; record: ErrorRecord } | { ok: false; code: ErrorStoreFailureCode } {
  const parsed = errorRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    debugLog(INVALID_RECORD_CODE, 'ErrorStore record failed schema validation', {
      issueCount: parsed.error.issues.length,
    });
    return { ok: false, code: INVALID_RECORD_CODE };
  }
  return { ok: true, record: parsed.data };
}

/** The caller-supplied half of a record; the derived half is filled here. */
export interface RecordErrorInput {
  /** Optional safe id. A caller with a deterministic key (a stage name) passes one. */
  id?: string;
  code: string;
  occurredAt?: number;
  attempts?: number;
  context?: Record<string, unknown>;
}

/** A monotonic suffix so two records in the same millisecond cannot collide. */
let recordSequence = 0;

/**
 * Persist one failure. The context is redacted before it touches the database,
 * the record is validated at the boundary, and the FIFO bound is enforced in
 * the same transaction as the insert.
 */
export async function recordError(input: RecordErrorInput): Promise<RecordErrorResult> {
  const occurredAt = input.occurredAt ?? Date.now();
  const sanitised = input.context === undefined ? undefined : sanitiseContext(input.context);
  const candidate = {
    id: input.id ?? `err_${occurredAt}_${(recordSequence += 1)}`,
    code: input.code,
    occurredAt,
    attempts: input.attempts ?? 1,
    resolved: false,
    resolution: null,
    ...(sanitised === undefined ? {} : { context: sanitised }),
  };

  const validated = validateRecord(candidate);
  if (!validated.ok) return validated;
  const record = validated.record;

  let db;
  try {
    db = await getDb();
  } catch (error) {
    return unavailable(error);
  }

  try {
    const tx = db.transaction('errors', 'readwrite');
    const store = tx.objectStore('errors');
    await store.put(record);

    // The bound is part of the write, not a later sweep: evict the oldest
    // records beyond the cap, ascending through the `by-occurred` index.
    const count = await store.count();
    let toEvict = count - ERROR_STORE_MAX_RECORDS;
    let cursor = await store.index('by-occurred').openCursor();
    while (cursor && toEvict > 0) {
      await cursor.delete();
      toEvict -= 1;
      cursor = await cursor.continue();
    }

    await tx.done;
    return { ok: true, record };
  } catch (error) {
    debugLog(WRITE_FAILED_CODE, 'ErrorStore record write failed', { reason: errorName(error) });
    return { ok: false, code: WRITE_FAILED_CODE };
  }
}

/**
 * List records newest-first, bounded by `limit` (default: the FIFO cap).
 * Every record is re-validated on the way out, so a malformed record is a typed
 * failure rather than silently accepted data.
 */
export async function listErrors(
  limit: number = ERROR_STORE_MAX_RECORDS,
): Promise<ListErrorsResult> {
  let db;
  try {
    db = await getDb();
  } catch (error) {
    return unavailable(error);
  }

  try {
    const tx = db.transaction('errors', 'readonly');
    const raw = await tx.objectStore('errors').index('by-occurred').getAll();
    await tx.done;

    const records: ErrorRecord[] = [];
    for (const candidate of raw) {
      const validated = validateRecord(candidate);
      if (!validated.ok) return validated;
      records.push(validated.record);
    }

    // The index yields ascending `occurredAt`; the list is newest-first.
    return { ok: true, records: records.reverse().slice(0, Math.max(0, limit)) };
  } catch (error) {
    debugLog(READ_FAILED_CODE, 'ErrorStore list read failed', { reason: errorName(error) });
    return { ok: false, code: READ_FAILED_CODE };
  }
}

/**
 * Resolve one record. Idempotent: an absent or already-resolved record is a
 * success-shaped no-op that writes nothing — one record, never a stack.
 */
export async function resolveError(
  id: string,
  resolution: ErrorResolution,
): Promise<ResolveErrorResult> {
  const parsedResolution = z.enum(ERROR_RESOLUTIONS).safeParse(resolution);
  if (!parsedResolution.success) {
    debugLog(INVALID_RECORD_CODE, 'ErrorStore rejected a resolution outside the closed union', {});
    return { ok: false, code: INVALID_RECORD_CODE };
  }

  let db;
  try {
    db = await getDb();
  } catch (error) {
    return unavailable(error);
  }

  try {
    const tx = db.transaction('errors', 'readwrite');
    const store = tx.objectStore('errors');
    const raw = await store.get(id);

    if (raw === undefined) {
      await tx.done;
      return { ok: true, changed: false };
    }

    const validated = validateRecord(raw);
    if (!validated.ok) {
      await tx.done;
      return validated;
    }

    if (validated.record.resolved) {
      await tx.done;
      return { ok: true, changed: false };
    }

    await store.put({ ...validated.record, resolved: true, resolution: parsedResolution.data });
    await tx.done;
    return { ok: true, changed: true };
  } catch (error) {
    debugLog(WRITE_FAILED_CODE, 'ErrorStore resolution failed', { reason: errorName(error) });
    return { ok: false, code: WRITE_FAILED_CODE };
  }
}

/**
 * Enforce the bound and remove resolved records older than the retention
 * window. `now` is injectable so the retention behaviour is deterministic in
 * tests without fake timers.
 */
export async function cleanupErrors(
  options: { now?: number } = {},
): Promise<CleanupErrorsResult> {
  const now = options.now ?? Date.now();
  const cutoff = now - ERROR_STORE_RESOLVED_RETENTION_MS;

  let db;
  try {
    db = await getDb();
  } catch (error) {
    return unavailable(error);
  }

  try {
    const tx = db.transaction('errors', 'readwrite');
    const store = tx.objectStore('errors');
    const all = await store.index('by-occurred').getAll();

    let removed = 0;
    const beyondCap = Math.max(0, all.length - ERROR_STORE_MAX_RECORDS);

    for (let index = 0; index < all.length; index += 1) {
      const validated = validateRecord(all[index]);
      if (!validated.ok) {
        await tx.done;
        return validated;
      }

      const record = validated.record;
      const overBound = index < beyondCap;
      const stale = record.resolved && record.occurredAt < cutoff;
      if (!overBound && !stale) continue;

      await store.delete(record.id);
      removed += 1;
    }

    await tx.done;
    return { ok: true, removed };
  } catch (error) {
    debugLog(WRITE_FAILED_CODE, 'ErrorStore cleanup failed', { reason: errorName(error) });
    return { ok: false, code: WRITE_FAILED_CODE };
  }
}
