import { describe, it, expect, vi } from 'vitest';
import {
  NP_STORE_SCHEMA_VERSION,
  npStoreMigrate,
  useExtensionStore,
} from '../../../src/store/useExtensionStore';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';

/**
 * `np_store` persist suite — plan `01-11` adds the credential assertions the
 * inventory row requires (D-07 / D-08 / D-15) on top of plan `01-05`'s
 * theme-source assertions.
 *
 * The removed-field names are written here, in the suite, on purpose: the
 * source scan in Task 1's verify reads `src/types`, `src/store` and
 * `src/services`, so the *production* modules must not restate them while the
 * test that proves their absence must.
 */

/** Every field plan `01-11` removed from the persisted schema. */
const REMOVED_FIELDS = [
  'themeMode',
  'selectedModel',
  'selectedWorkflow',
  'workflowModelMapping',
  'openAiKey',
  'geminiKey',
  'apiKey',
] as const;

describe('useExtensionStore persist — D-22 version/migrate scaffold', () => {
  // D-22 / plan 01-11: v2 is the credential-free schema. An older blob is
  // rebuilt from the canonical field set, so a removed field is dropped
  // rather than carried forward.
  it('migrate(v1Blob, 1) drops every removed field from an existing blob', () => {
    const v1 = {
      config: {
        serviceProvider: 'Custom API Key',
        themeMode: 'Auto',
        selectedModel: 'gpt-4o',
        openAiKey: 'legacy-plaintext',
        geminiKey: 'legacy-plaintext',
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKey: 'legacy-plaintext',
            enabled: true,
            proxyUrl: 'http://localhost:12380/v1',
          },
        },
        language: 'English',
      },
      sessions: [{ id: 's1', messages: [] }],
      activeSessionId: 's1',
      prompts: [],
      writeHistory: [],
      notes: [],
    };

    const result = npStoreMigrate(v1, 1) as Record<string, unknown>;

    // Authorised non-secret metadata survives.
    expect(result.sessions).toEqual([{ id: 's1', messages: [] }]);
    expect(result.notes).toEqual([]);
    expect(result.writeHistory).toEqual([]);
    expect((result.config as Record<string, unknown>).language).toBe('English');
    expect(
      ((result.config as Record<string, unknown>).providers as Record<string, unknown>).openai,
    ).toMatchObject({ id: 'openai', name: 'OpenAI', enabled: true });

    // No removed field survives anywhere in the serialised result.
    const serialised = JSON.stringify(result);
    for (const field of REMOVED_FIELDS) {
      expect(serialised, `migrated blob must not carry ${field}`).not.toContain(field);
    }
  });

  // D-22 / T-01-2 backstop: pre-Phase-1 unversioned blob hydrates without
  // throwing and without dropping existing data shapes.
  it('migrate(unversionedBlob, 0) does not throw and keeps the canonical shapes', () => {
    const legacy = {
      config: { language: 'English' },
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
    const r = result as Record<string, unknown>;
    expect(r.sessions).toEqual([{ id: 's1', messages: [] }]);
    expect(r.notes).toEqual([]);
    expect(r.writeHistory).toEqual([]);
    expect(r.config).toEqual({ language: 'English' });
  });

  it('migrate is total: a malformed blob returns {} and never throws', () => {
    for (const malformed of [null, undefined, [], 'blob', 42, true]) {
      let result: unknown;
      expect(() => {
        result = npStoreMigrate(malformed, 0);
      }).not.toThrow();
      expect(result).toEqual({});
    }
  });

  it('migrate is idempotent: re-running it over its own output is a no-op', () => {
    const once = npStoreMigrate({ config: { language: 'English' }, sessions: [] }, 1);
    expect(npStoreMigrate(once, NP_STORE_SCHEMA_VERSION)).toEqual(once);
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

describe('useExtensionStore persisted projection — credential-free, no theme source', () => {
  const persisted = () =>
    useExtensionStore.persist.getOptions().partialize?.(useExtensionStore.getState()) as
      | Record<string, unknown>
      | undefined;

  // D-07 / D-08: no persisted credential field, masked fragment or derived
  // value — the projection has nowhere to put one.
  it('the persisted np_store projection carries no credential field anywhere', () => {
    const blob = persisted();

    expect(blob).toBeDefined();
    const serialised = JSON.stringify(blob);
    for (const field of ['apiKey', 'openAiKey', 'geminiKey', 'accessToken', 'secret']) {
      expect(serialised, `persisted blob must not carry ${field}`).not.toContain(field);
    }
  });

  // DEC-HTML-01: the raw model catalogue and every selector that consumed it
  // are gone (plan `01-11`), and the store persists no selected-model field.
  // The per-provider `models` list is authorised non-secret metadata (D-07's
  // decision record names it explicitly), so only the *selection* field is
  // asserted absent.
  it('the persisted np_store projection carries no selected-model field', () => {
    const blob = persisted();

    expect(JSON.stringify(blob)).not.toContain('selectedModel');
    expect('selectedModel' in (useExtensionStore.getState().config as unknown as object)).toBe(
      false,
    );
  });

  // APPR-03 / D-15: `np_theme` is the single theme source. The persisted
  // preference blob (`np_store`) must therefore carry no theme-mode field —
  // persisted next to the theme store it would be a second source.
  it('the persisted np_store projection carries no theme-mode field anywhere', () => {
    const blob = persisted();

    expect(JSON.stringify(blob)).not.toContain('themeMode');
  });

  it('the in-memory config carries no credential, model-identifier or theme field', () => {
    const config = useExtensionStore.getState().config as unknown as Record<string, unknown>;

    for (const field of REMOVED_FIELDS) {
      expect(field in config, `config must not carry ${field}`).toBe(false);
    }
  });

  it('updateConfig never reaches ThemeStore.setMode (no duplicate theme bridge)', () => {
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');
    const setModeSpy = vi.spyOn(useThemeStore.getState(), 'setMode');
    const before = useThemeStore.getState().mode;

    useExtensionStore.getState().updateConfig({ fontSize: 'Small' });

    expect(setModeSpy).not.toHaveBeenCalled();
    expect(useThemeStore.getState().mode).toBe(before);
    expect(syncSetSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ np_theme: expect.anything() }),
    );

    setModeSpy.mockRestore();
    syncSetSpy.mockRestore();
  });
});
