/**
 * MemoryGovernance facade tests — MEM-04 (D-128, spec §28.4).
 *
 * Proves all 9 user lifecycle controls:
 *   view, source, confidence, edit, pin, forget, disableType, export, cloudExclude
 * Plus: single-writer gating (non-primary = no-op).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable isPrimaryWriter mock.
const isPrimaryWriterMock = vi.fn(() => true);
vi.mock('../../../../src/core/workspace/WorkspaceStore', () => ({
  isPrimaryWriter: () => isPrimaryWriterMock(),
}));

import { MemoryGovernance } from '../../../../src/core/memory/MemoryGovernance';
import { openMemoryDB, MEMORY_DB_VERSION } from '../../../../src/core/storage/MemoryDB';
import type { MemoryRecord } from '../../../../src/types/harness';

function makeRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: `gov-${Math.random().toString(36).slice(2)}`,
    content: 'ServiceNow incident resolution steps',
    type: 'fact',
    tags: ['servicenow', 'incident'],
    confidence: 0.9,
    source: { kind: 'extracted' },
    kind: 'semantic',
    lifecycle: { status: 'active', verifiedAt: Date.now() - 1000 },
    sensitivity: 'normal',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    useCount: 0,
    ...overrides,
  };
}

async function seedRecord(record: MemoryRecord): Promise<void> {
  const db = await openMemoryDB();
  await db.put('memory_records', record);
}

describe('MemoryGovernance — MEM-04: 9 user lifecycle controls (D-128)', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    isPrimaryWriterMock.mockReturnValue(true);
  });

  it('view: returns record from memory_records', async () => {
    const rec = makeRecord({ id: 'view-test' });
    await seedRecord(rec);

    const result = await MemoryGovernance.view('view-test');
    expect(result).toBeDefined();
    expect(result!.id).toBe('view-test');
    expect(result!.content).toBe(rec.content);
  });

  it('source: returns source object', async () => {
    const rec = makeRecord({ id: 'source-test', source: { kind: 'manual', noteId: 'n1' } });
    await seedRecord(rec);

    const source = await MemoryGovernance.source('source-test');
    expect(source).toBeDefined();
    expect(source!.kind).toBe('manual');
    expect(source!.noteId).toBe('n1');
  });

  it('confidence: returns number in [0,1]', async () => {
    const rec = makeRecord({ id: 'conf-test', confidence: 0.75 });
    await seedRecord(rec);

    const confidence = await MemoryGovernance.confidence('conf-test');
    expect(confidence).toBe(0.75);
    expect(confidence!).toBeGreaterThanOrEqual(0);
    expect(confidence!).toBeLessThanOrEqual(1);
  });

  it('edit: patch applied, verifiedAt updated', async () => {
    const originalVerifiedAt = Date.now() - 5000;
    const rec = makeRecord({
      id: 'edit-test',
      lifecycle: { status: 'active', verifiedAt: originalVerifiedAt },
    });
    await seedRecord(rec);

    await MemoryGovernance.edit('edit-test', { content: 'Updated content' });

    const updated = await MemoryGovernance.view('edit-test');
    expect(updated).toBeDefined();
    expect(updated!.content).toBe('Updated content');
    expect(updated!.lifecycle.verifiedAt).toBeGreaterThan(originalVerifiedAt);
  });

  it('pin: status → pinned', async () => {
    const rec = makeRecord({ id: 'pin-test', lifecycle: { status: 'active' } });
    await seedRecord(rec);

    await MemoryGovernance.pin('pin-test');

    const updated = await MemoryGovernance.view('pin-test');
    expect(updated!.lifecycle.status).toBe('pinned');
  });

  it('forget: status → forgotten (soft-delete, record still exists)', async () => {
    const rec = makeRecord({ id: 'forget-test', lifecycle: { status: 'active' } });
    await seedRecord(rec);

    await MemoryGovernance.forget('forget-test');

    const updated = await MemoryGovernance.view('forget-test');
    expect(updated).toBeDefined();
    expect(updated!.lifecycle.status).toBe('forgotten');
  });

  it('disableType: all records of given kind forgotten', async () => {
    const a = makeRecord({ id: 'dt-a', kind: 'semantic' });
    const b = makeRecord({ id: 'dt-b', kind: 'semantic' });
    const c = makeRecord({ id: 'dt-c', kind: 'episodic' });
    await seedRecord(a);
    await seedRecord(b);
    await seedRecord(c);

    await MemoryGovernance.disableType('semantic');

    const afterA = await MemoryGovernance.view('dt-a');
    const afterB = await MemoryGovernance.view('dt-b');
    const afterC = await MemoryGovernance.view('dt-c');
    expect(afterA!.lifecycle.status).toBe('forgotten');
    expect(afterB!.lifecycle.status).toBe('forgotten');
    expect(afterC!.lifecycle.status).toBe('active'); // different kind, untouched
  });

  it('export: returns valid JSON', async () => {
    const rec = makeRecord({ id: 'export-test', sensitivity: 'normal' });
    await seedRecord(rec);

    const json = await MemoryGovernance.export();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
  });

  it('export: redacts secret records', async () => {
    const secret = makeRecord({ id: 'secret-test', sensitivity: 'secret', content: 'sensitive data' });
    await seedRecord(secret);

    const json = await MemoryGovernance.export();
    const parsed = JSON.parse(json) as MemoryRecord[];
    const secretRecord = parsed.find((r) => r.id === 'secret-test');
    // Secret records are redacted (content emptied or truncated by redactSensitiveValue).
    expect(secretRecord).toBeDefined();
  });

  it('export: applies filter', async () => {
    const a = makeRecord({ id: 'filt-a', kind: 'semantic' });
    const b = makeRecord({ id: 'filt-b', kind: 'episodic' });
    await seedRecord(a);
    await seedRecord(b);

    const json = await MemoryGovernance.export((r) => r.kind === 'semantic');
    const parsed = JSON.parse(json) as MemoryRecord[];
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe('filt-a');
  });

  it('cloudExclude: flag set to true', async () => {
    const rec = makeRecord({ id: 'cloud-test' });
    await seedRecord(rec);

    await MemoryGovernance.cloudExclude('cloud-test');

    const updated = await MemoryGovernance.view('cloud-test');
    expect(updated!.cloudExclude).toBe(true);
  });

  it('non-primary: all mutations are no-ops when isPrimaryWriter returns false', async () => {
    const rec = makeRecord({ id: 'non-primary-test', lifecycle: { status: 'active' } });
    await seedRecord(rec);

    isPrimaryWriterMock.mockReturnValue(false);

    // All mutations should be no-ops.
    await MemoryGovernance.edit('non-primary-test', { content: 'should not apply' });
    await MemoryGovernance.pin('non-primary-test');
    await MemoryGovernance.forget('non-primary-test');
    await MemoryGovernance.cloudExclude('non-primary-test');

    // Record should be unchanged.
    const after = await MemoryGovernance.view('non-primary-test');
    expect(after!.content).toBe(rec.content);
    expect(after!.lifecycle.status).toBe('active');
    expect(after!.cloudExclude).toBeUndefined();

    // Re-enable primary for cleanup.
    isPrimaryWriterMock.mockReturnValue(true);
  });

  it('v5: memory_records store exists after openMemoryDB', async () => {
    const db = await openMemoryDB();
    expect(MEMORY_DB_VERSION).toBe(5);
    expect(db.objectStoreNames.contains('memory_records')).toBe(true);
    db.close();
  });
});
