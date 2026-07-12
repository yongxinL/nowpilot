import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexedDBMigrator } from '../../../src/core/storage/IndexedDBMigrator';
import { migrationV1 } from '../../../src/core/storage/migrations/v1-initial-schema';
import type { IndexedDBMigration } from '../../../src/core/storage/IndexedDBMigrator';

describe('IndexedDBMigrator', () => {
  let migrator: IndexedDBMigrator;

  beforeEach(() => {
    migrator = new IndexedDBMigrator();
  });

  it('register() adds a migration retrievable by version', () => {
    const migration: IndexedDBMigration = {
      fromVersion: 0,
      toVersion: 1,
      description: 'Test migration',
      migrate: vi.fn(),
    };

    migrator.register(migration);
    const all = migrator.getAllMigrations();

    expect(all).toContain(migration);
    expect(all).toHaveLength(1);
  });

  it('register() with duplicate toVersion throws', () => {
    const migration: IndexedDBMigration = {
      fromVersion: 0,
      toVersion: 1,
      description: 'First v1',
      migrate: vi.fn(),
    };
    const duplicate: IndexedDBMigration = {
      fromVersion: 0,
      toVersion: 1,
      description: 'Duplicate v1',
      migrate: vi.fn(),
    };

    migrator.register(migration);

    expect(() => migrator.register(duplicate)).toThrow('already registered');
  });

  it('getMigrationsBetween() returns correct subset', () => {
    const v1: IndexedDBMigration = {
      fromVersion: 0,
      toVersion: 1,
      description: 'v1',
      migrate: vi.fn(),
    };
    const v2: IndexedDBMigration = {
      fromVersion: 1,
      toVersion: 2,
      description: 'v2',
      migrate: vi.fn(),
    };
    const v3: IndexedDBMigration = {
      fromVersion: 2,
      toVersion: 3,
      description: 'v3',
      migrate: vi.fn(),
    };

    migrator.register(v1);
    migrator.register(v2);
    migrator.register(v3);

    // getMigrationsBetween(0, 2) should return [v1, v2] — v3 excluded (toVersion 3 > 2)
    const result1 = migrator.getMigrationsBetween(0, 2);
    expect(result1).toEqual([v1, v2]);
    expect(result1).not.toContain(v3);

    // getMigrationsBetween(1, 3) should return [v2, v3] — v1 excluded (toVersion 1 not > 1)
    const result2 = migrator.getMigrationsBetween(1, 3);
    expect(result2).toEqual([v2, v3]);
    expect(result2).not.toContain(v1);
  });

  it('getAllMigrations() returns migrations sorted by toVersion', () => {
    const v3: IndexedDBMigration = {
      fromVersion: 2,
      toVersion: 3,
      description: 'v3',
      migrate: vi.fn(),
    };
    const v1: IndexedDBMigration = {
      fromVersion: 0,
      toVersion: 1,
      description: 'v1',
      migrate: vi.fn(),
    };
    const v2: IndexedDBMigration = {
      fromVersion: 1,
      toVersion: 2,
      description: 'v2',
      migrate: vi.fn(),
    };

    migrator.register(v3);
    migrator.register(v1);
    migrator.register(v2);

    const all = migrator.getAllMigrations();

    expect(all).toHaveLength(3);
    expect(all[0]).toBe(v1);
    expect(all[1]).toBe(v2);
    expect(all[2]).toBe(v3);
  });

  it('migrationV1 has fromVersion 0, toVersion 1', () => {
    expect(migrationV1.fromVersion).toBe(0);
    expect(migrationV1.toVersion).toBe(1);
    expect(migrationV1.description).toBeTruthy();
    expect(typeof migrationV1.description).toBe('string');
    expect(migrationV1.description.length).toBeGreaterThan(0);
  });
});
