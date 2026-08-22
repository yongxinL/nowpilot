import { describe, it, expect } from 'vitest';
import { npStoreMigrate } from '../../../src/store/useExtensionStore';

describe('useExtensionStore persist — D-22 version/migrate scaffold', () => {
  // D-22: persist config exposes version: 1. A v1 blob migrates as a no-op
  // (v1 IS the schema per D-22).
  it('migrate(v1Blob, 1) is a no-op — v1 IS the current schema', () => {
    const v1 = {
      config: { themeMode: 'Auto' },
      sessions: [{ id: 's1', messages: [] }],
      activeSessionId: 's1',
      prompts: [],
      writeHistory: [],
      notes: [],
    };
    const result = npStoreMigrate(v1, 1) as Record<string, unknown>;
    expect(result).toMatchObject({
      config: { themeMode: 'Auto' },
      sessions: [{ id: 's1', messages: [] }],
      notes: [],
      writeHistory: [],
    });
  });

  // D-22 / T-01-2 backstop: pre-Phase-1 unversioned blob hydrates without
  // throwing and without dropping existing data shapes.
  it('migrate(unversionedBlob, 0) does not throw and is structurally compatible', () => {
    const legacy = {
      config: { themeMode: 'Auto' },
      sessions: [{ id: 's1', messages: [] }],
      activeSessionId: 's1',
      prompts: [],
      writeHistory: [],
      notes: [],
    };
    let result: ReturnType<typeof npStoreMigrate> | undefined;
    expect(() => {
      result = npStoreMigrate(legacy, 0);
    }).not.toThrow();
    expect(result).toBeDefined();
    const r = result as Record<string, unknown>;
    expect(r.sessions).toEqual([{ id: 's1', messages: [] }]);
    expect(r.notes).toEqual([]);
    expect(r.writeHistory).toEqual([]);
    expect(r.config).toEqual({ themeMode: 'Auto' });
  });

  // A5 separation: this zustand-persist version counter is SEPARATE from the
  // IndexedDB DB_VERSION (§20.4). The migrate function signature accepts
  // exactly (persisted, version) — no third DB_VERSION argument is consumed.
  it('migrate signature accepts exactly (persisted, version) — no DB_VERSION arg (A5)', () => {
    expect(npStoreMigrate.length).toBe(2);
  });

  // A5 separation (source-level): the source file must not IMPORT any
  // IndexedDB DB_VERSION constant — guards against a future contributor
  // conflating the two counters when Phase 9 reaches IndexedDB v4.
  // (A `DB_VERSION` literal is allowed in a documentation/comment context to
  // name the axis; we only forbid the import/use of the constant as a value.)
  it('source module does not import IndexedDB DB_VERSION (A5)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(
      path.resolve(__dirname, '../../../src/store/useExtensionStore.ts'),
      'utf8',
    );
    // Reject any import statement that brings DB_VERSION into scope.
    expect(src).not.toMatch(/import[^;]*\bDB_VERSION\b/);
    expect(src).not.toMatch(/from\s+['"][^'"]*db[^'"]*['"]/i);
    // And reject any reference to a runtime constant `DB_VERSION` outside
    // of string-literal/comment contexts.
    const codeOnly = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    expect(codeOnly).not.toMatch(/\bDB_VERSION\b/);
  });
});