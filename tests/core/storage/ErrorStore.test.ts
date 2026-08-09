// tests/core/storage/ErrorStore.test.ts — §15.1 ErrorStore contract (FIFO max
// 100, debug-only) + R-10/D-16 redaction-before-write + the D-12
// IDB_MIGRATION_FAILED sink. Builds input from the 02-01 shared fixture
// builder (buildRedactionFixture — D-20/21). Runs in the default jsdom-align
// environment with a fresh IDBFactory per test (RESEARCH Pattern 8).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { buildRedactionFixture } from '../../fixtures/index';
import {
  ERROR_STORE_MAX_ENTRIES,
  getErrors,
  recordMigrationFailure,
  writeError,
} from '@/core/storage/ErrorStore';
import { ERROR_CODES } from '@/core/error/errorCodes';

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  indexedDB = new IDBFactory(); // RESEARCH Pattern 8: fresh IndexedDB per test
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('ErrorStore — FIFO cap', () => {
  it('keeps at most 100 entries and drops the oldest beyond the cap', async () => {
    // Capture the ids of the FIRST 5 written entries as they are written (each
    // write makes itself the newest, so getErrors(1) returns its id).
    const firstFiveIds: string[] = [];
    for (let i = 0; i < ERROR_STORE_MAX_ENTRIES + 5; i++) {
      await writeError(`CODE_${i}`, `message ${i}`);
      if (i < 5) {
        const newest = await getErrors(1);
        firstFiveIds.push(newest[0].id);
      }
    }

    const visible = await getErrors();
    expect(visible).toHaveLength(ERROR_STORE_MAX_ENTRIES);
    // the 5 oldest (first-written) are gone, the newest is present
    expect(firstFiveIds.every((id) => !visible.some((e) => e.id === id))).toBe(true);
    expect(visible[0].message).toBe(`message ${ERROR_STORE_MAX_ENTRIES + 4}`);
  });

  it('getErrors returns newest-first and honors the limit argument', async () => {
    for (let i = 0; i < 5; i++) {
      await writeError(`CODE_${i}`, `message ${i}`);
    }

    const limited = await getErrors(2);
    expect(limited).toHaveLength(2);
    expect(limited[0].message).toBe('message 4'); // newest first
    expect(limited[1].message).toBe('message 3');
  });
});

describe('ErrorStore — redaction-before-write (R-10 / D-16, T-2-06-02)', () => {
  it('persists the [REDACTED] token, never the raw secret (fixture message)', async () => {
    const fixture = buildRedactionFixture();
    await writeError('TEST_ERR', fixture.messages[0], 'test-module');

    const errors = await getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('[REDACTED]');
    expect(errors[0].message).not.toContain('sk-abc123def456ghi789');
  });
});

describe('ErrorStore — recordMigrationFailure sink (D-12)', () => {
  it('writes a code IDB_MIGRATION_FAILED entry whose cause is redacted', async () => {
    await recordMigrationFailure('notes-db', 'boom during sk-xyz987654321');

    const errors = await getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(ERROR_CODES.IDB_MIGRATION_FAILED);
    expect(errors[0].message).toContain('notes-db');
    expect(errors[0].message).toContain('[REDACTED]');
    expect(errors[0].message).not.toContain('sk-xyz987654321');
  });
});
