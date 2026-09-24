import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDb, getDb, __test__ } from '../../../src/core/storage/NowPilotDB';
import { __test__ as migratorTest } from '../../../src/core/storage/IndexedDBMigrator';
import {
  ERROR_STORE_MAX_RECORDS,
  ERROR_STORE_RESOLVED_RETENTION_MS,
  cleanupErrors,
  errorRecordSchema,
  listErrors,
  recordError,
  resolveError,
  type ErrorRecord,
} from '../../../src/core/storage/ErrorStore';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * ErrorStore suite — plan 02-05 Task 1 (D2-21, §15.1, §20.4).
 *
 * The store's contract in nine named cases: a migration-failure record and a
 * degraded-mode record persist with their canonical codes and integer
 * timestamps; redaction runs before persistence; a raw exception payload never
 * reaches the store; a malformed record is rejected at the boundary; resolution
 * is idempotent; the FIFO bound evicts oldest-first; cleanup removes resolved
 * records past the retention window and re-enforces the bound; and an
 * unavailable database yields a typed failure rather than a doomed write or a
 * throw.
 *
 * The sentinel is the repository's synthetic body/credential literal — never a
 * real value — and the absence assertions are paired with a non-vacuity case
 * that plants the sentinel in the store and expects the scan to find it.
 */

const SENTINEL = 'synthetic-body-DO-NOT-LEAK-error-store-4b81de';
const SENTINEL_KEY = 'sk-secret-DO-NOT-LEAK-error-store-9c02fa';

/** Every record the store currently holds, raw — bypasses the module's schema. */
async function rawRecords(): Promise<unknown[]> {
  const db = await getDb();
  return db.getAll('errors');
}

/** The same serialisation the phase's absence assertions use. */
async function serialisedStore(): Promise<string> {
  return JSON.stringify(await rawRecords());
}

function record(id: string, occurredAt: number, overrides: Partial<ErrorRecord> = {}): ErrorRecord {
  return {
    id,
    code: 'IDB_MIGRATION_FAILED',
    occurredAt,
    attempts: 1,
    resolved: false,
    resolution: null,
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
  clearLogs();
  __test__.reset();
  migratorTest.resetLastMigrationResult();
});

afterEach(() => {
  __test__.setMigrationFailure(null);
  closeDb();
});

describe('ErrorStore — bounded, redacted, idempotently resolvable failure records', () => {
  it('persists a migration-failure record with its canonical code and an integer timestamp', async () => {
    const occurredAt = 1_700_000_000_000;
    const result = await recordError({
      code: 'IDB_MIGRATION_FAILED',
      occurredAt,
      context: { stage: 'destination-written', sourceKey: 'np_store' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const listed = await listErrors();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;

    expect(listed.records).toHaveLength(1);
    const stored = listed.records[0];
    expect(stored.code).toBe('IDB_MIGRATION_FAILED');
    expect(stored.occurredAt).toBe(occurredAt);
    expect(Number.isInteger(stored.occurredAt)).toBe(true);
    expect(stored.attempts).toBe(1);
    expect(stored.resolved).toBe(false);
    expect(stored.resolution).toBeNull();
    expect(stored.context).toEqual({ stage: 'destination-written', sourceKey: 'np_store' });
  });

  it('persists a degraded-mode record', async () => {
    const result = await recordError({ code: 'IDB_BLOCKED', context: { currentVersion: 1 } });

    expect(result.ok).toBe(true);
    const listed = await listErrors();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.records.map((entry) => entry.code)).toEqual(['IDB_BLOCKED']);
  });

  it('redacts the context before persistence — the sentinel never reaches the store', async () => {
    const result = await recordError({
      code: 'IDB_MIGRATION_FAILED',
      context: {
        apiKey: SENTINEL_KEY,
        nested: { token: SENTINEL_KEY, stage: 'source-sanitised' },
        list: [{ secret: SENTINEL_KEY }],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.context).toEqual({
      apiKey: '[REDACTED]',
      nested: { token: '[REDACTED]', stage: 'source-sanitised' },
      list: [{ secret: '[REDACTED]' }],
    });

    const serialised = await serialisedStore();
    expect(serialised).toContain('[REDACTED]');
    expect(serialised).not.toContain(SENTINEL_KEY);
    expect(serialised).not.toContain(SENTINEL_KEY.slice(0, 10));
    expect(serialised).not.toContain(SENTINEL_KEY.slice(-6));

    // The log ring buffer carries the code and the reason only.
    const logs = JSON.stringify(getRecentLogs());
    expect(logs).not.toContain(SENTINEL_KEY);
    for (const entry of getRecentLogs()) {
      expect(entry.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('strips a raw exception payload — no message or stack is ever persisted', async () => {
    const result = await recordError({
      code: 'IDB_MIGRATION_FAILED',
      context: {
        message: SENTINEL,
        stack: `Error: ${SENTINEL}\n    at somewhere`,
        nested: { message: SENTINEL, stack: SENTINEL, stage: 'destination-verified' },
        list: [{ message: SENTINEL, id: 's_1' }],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.context).toEqual({
      nested: { stage: 'destination-verified' },
      list: [{ id: 's_1' }],
    });

    const serialised = await serialisedStore();
    expect(serialised).not.toContain(SENTINEL);
    expect(serialised).not.toContain('at somewhere');
    expect(JSON.stringify(getRecentLogs())).not.toContain(SENTINEL);
  });

  it('rejects a malformed or over-wide record at the boundary and stores nothing', async () => {
    // The strict schema rejects a non-SCREAMING_SNAKE code, a non-integer
    // timestamp, a negative attempt count and an unknown field.
    expect(errorRecordSchema.safeParse(record('a', 1, { code: 'lowercase' })).success).toBe(false);
    expect(errorRecordSchema.safeParse(record('a', 1.5)).success).toBe(false);
    expect(errorRecordSchema.safeParse(record('a', 1, { attempts: -1 })).success).toBe(false);
    expect(errorRecordSchema.safeParse({ ...record('a', 1), extra: 'nope' }).success).toBe(false);
    expect(errorRecordSchema.safeParse(record('a', 1)).success).toBe(true);

    const rejected = await recordError({ code: 'not-a-canonical-code' });
    expect(rejected).toEqual({ ok: false, code: 'ERROR_STORE_INVALID_RECORD' });

    const empty = await recordError({ code: '' });
    expect(empty).toEqual({ ok: false, code: 'ERROR_STORE_INVALID_RECORD' });

    expect(await rawRecords()).toHaveLength(0);
  });

  it('resolves idempotently — a second call writes nothing and never stacks resolutions', async () => {
    await recordError({ id: 'err-resolve', code: 'IDB_MIGRATION_FAILED', occurredAt: 10 });

    const first = await resolveError('err-resolve', 'retried');
    expect(first).toEqual({ ok: true, changed: true });

    // A second call with a different classification must not overwrite the
    // first: `changed: false` and the stored resolution is unchanged.
    const second = await resolveError('err-resolve', 'dismissed');
    expect(second).toEqual({ ok: true, changed: false });

    const listed = await listErrors();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.records).toHaveLength(1);
    expect(listed.records[0].resolved).toBe(true);
    expect(listed.records[0].resolution).toBe('retried');

    // An absent record is also a success-shaped no-op.
    expect(await resolveError('err-absent', 'retried')).toEqual({ ok: true, changed: false });
    expect(await rawRecords()).toHaveLength(1);
  });

  it('enforces the FIFO bound of 100 and evicts oldest-first', async () => {
    const base = 1_700_000_000_000;
    const overflow = 5;

    for (let index = 0; index < ERROR_STORE_MAX_RECORDS + overflow; index += 1) {
      const written = await recordError({
        id: `err_${String(index).padStart(3, '0')}`,
        code: 'IDB_MIGRATION_FAILED',
        occurredAt: base + index,
      });
      expect(written.ok).toBe(true);
    }

    const listed = await listErrors();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;

    expect(listed.records).toHaveLength(ERROR_STORE_MAX_RECORDS);
    const ids = listed.records.map((entry) => entry.id);
    for (let index = 0; index < overflow; index += 1) {
      expect(ids).not.toContain(`err_${String(index).padStart(3, '0')}`);
    }
    // Newest-first.
    expect(listed.records[0].id).toBe(`err_${ERROR_STORE_MAX_RECORDS + overflow - 1}`);
    expect(await rawRecords()).toHaveLength(ERROR_STORE_MAX_RECORDS);
  });

  it('cleanup removes resolved records past the retention window', async () => {
    const now = 1_700_000_000_000;
    const stale = now - ERROR_STORE_RESOLVED_RETENTION_MS - 1;

    const db = await getDb();
    await db.put('errors', record('err-stale-resolved', stale, { resolved: true, resolution: 'retried' }));
    await db.put('errors', record('err-stale-open', stale));
    await db.put('errors', record('err-recent-resolved', now - 1, { resolved: true, resolution: 'dismissed' }));

    const cleaned = await cleanupErrors({ now });
    expect(cleaned).toEqual({ ok: true, removed: 1 });

    const listed = await listErrors();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.records.map((entry) => entry.id).sort()).toEqual([
      'err-recent-resolved',
      'err-stale-open',
    ]);
  });

  it('cleanup re-enforces the bound independently of the insert path', async () => {
    const now = 1_700_000_000_000;
    const overflow = 3;

    const db = await getDb();
    for (let index = 0; index < ERROR_STORE_MAX_RECORDS + overflow; index += 1) {
      await db.put('errors', record(`bound_${String(index).padStart(3, '0')}`, now + index));
    }

    const bounded = await cleanupErrors({ now });
    expect(bounded).toEqual({ ok: true, removed: overflow });
    expect(await rawRecords()).toHaveLength(ERROR_STORE_MAX_RECORDS);
  });

  it('never throws when the database cannot be opened — a typed failure instead of a doomed write', async () => {
    __test__.setMigrationFailure(() => {
      throw new Error(`injected migration failure ${SENTINEL}`);
    });

    const recorded = await recordError({ code: 'IDB_MIGRATION_FAILED', context: { stage: 'discovered' } });
    expect(recorded).toEqual({ ok: false, code: 'ERROR_STORE_UNAVAILABLE' });

    expect(await listErrors()).toEqual({ ok: false, code: 'ERROR_STORE_UNAVAILABLE' });
    expect(await resolveError('err-anything', 'retried')).toEqual({
      ok: false,
      code: 'ERROR_STORE_UNAVAILABLE',
    });
    expect(await cleanupErrors()).toEqual({ ok: false, code: 'ERROR_STORE_UNAVAILABLE' });

    const codes = getRecentLogs().map((entry) => entry.code);
    expect(codes).toContain('ERROR_STORE_UNAVAILABLE');
    expect(JSON.stringify(getRecentLogs())).not.toContain(SENTINEL);
  });

  it('keeps the sentinel-absence scan live — a planted sentinel is found', async () => {
    // Non-vacuity: the scan the previous cases rely on does detect a sentinel
    // that really is in the store, so those cases cannot pass by accident. The
    // planted record also carries an unknown field, which is what the strict
    // read boundary must reject.
    const db = await getDb();
    const planted = { ...record('err-planted', 1), leaked: SENTINEL } as unknown as ErrorRecord;
    await db.put('errors', planted);

    expect(await serialisedStore()).toContain(SENTINEL);

    // And the strict read boundary rejects it rather than handing it back.
    expect(await listErrors()).toEqual({ ok: false, code: 'ERROR_STORE_INVALID_RECORD' });
  });
});
