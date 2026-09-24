import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NP_STORE_SCHEMA_VERSION,
  PERSISTED_BLOB_FIELDS,
  npStoreMigrate,
  useExtensionStore,
  type ChatHydrationDeps,
} from '../../../src/store/useExtensionStore';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';
import { flushPendingWrites } from '../../../src/core/theme/chromeStorageAdapter';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';
import { closeDb, __test__ as dbTest } from '../../../src/core/storage/NowPilotDB';
import {
  readAllConversations,
  readConversation,
  writeConversationWithMessages,
  type ChatSessionRecord,
  type MessageRecord,
} from '../../../src/core/storage/ChatHistoryDB';

/**
 * `np_store` persist suite — plan `01-11` adds the credential assertions the
 * inventory row requires (D-07 / D-08 / D-15) on top of plan `01-05`'s
 * theme-source assertions. Plan `02-08` adds the v3 body-free projection, the
 * D2-18 hydration contract and the no-legacy-fallback rule.
 *
 * The removed-field names are written here, in the suite, on purpose: the
 * source scan in Task 1's verify reads `src/types`, `src/store` and
 * `src/services`, so the *production* modules must not restate them while the
 * test that proves their absence must.
 */

/** A synthetic body — the sentinel the body-absence assertions look for. */
const BODY = 'synthetic-body-DO-NOT-LEAK-9c41f7';
/** No substring of the body may survive a projection: the full value, its
 *  excerpt-length prefix and its distinctive fragments are all asserted. */
const BODY_FRAGMENTS = [
  BODY,
  BODY.slice(0, 20),
  ...BODY.split('-').filter((fragment) => fragment.length > 3),
];
/** A synthetic fixture body — never allowed to reach the store or the database. */
const FIXTURE_BODY = 'synthetic-fixture-body-DO-NOT-LEAK-2b8e10';

const storageMap = () =>
  (globalThis as unknown as { __chromeStorageMap: Map<string, string> }).__chromeStorageMap;

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

    // v3 (D2-08): the conversation collection and the active-conversation id
    // are dropped — a v2 blob's bodies cannot be carried forward.
    expect('sessions' in result).toBe(false);
    expect('activeSessionId' in result).toBe(false);

    // Authorised non-secret, non-chat metadata survives.
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
    expect('sessions' in r).toBe(false);
    expect('activeSessionId' in r).toBe(false);
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
  // Plan `02-08` keeps the constant-level guard but drops the module-path
  // guard: the store now legitimately imports the storage repositories for the
  // D2-17 read path (`NowPilotDB.getDb`, `ChatHistoryDB`, `WriteJournal`).
  it('source module does not import the IndexedDB DB_VERSION constant (A5)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(
      path.resolve(__dirname, '../../../src/store/useExtensionStore.ts'),
      'utf8',
    );
    // Reject any import statement that brings DB_VERSION into scope.
    expect(src).not.toMatch(/import[^;]*\bDB_VERSION\b/);
    // The store reads the repositories, but never the version constant: the
    // two counters stay separate axes.
    expect(src).not.toMatch(/\bDB_VERSION\b\s*[,}]/);
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

describe('useExtensionStore hydration — a malformed np_store blob (WR-02)', () => {
  it('normalises the shapes instead of silently discarding the whole blob', async () => {
    const storageMap = (globalThis as unknown as { __chromeStorageMap: Map<string, string> })
      .__chromeStorageMap;
    const previous = storageMap.get('np_store');

    // Settle any debounced write left by an earlier case: while a write is
    // pending, the storage adapter returns the pending value instead of the
    // stored one, and the seeded blob below would never be read.
    await flushPendingWrites();

    // `version` matches the configured schema version, so zustand does NOT run
    // `migrate` — this is the path the review's probe took: `sessions` is a
    // number, `prompts` a string, `notes` an object, `activeSessionId` a number
    // and `config.providers` a string.
    storageMap.set(
      'np_store',
      JSON.stringify({
        state: {
          config: { openAiBaseUrl: 'https://probe.example/v1', providers: 'nope' },
          sessions: 5,
          prompts: 'nope',
          writeHistory: null,
          notes: { a: 1 },
          activeSessionId: 7,
        },
        version: NP_STORE_SCHEMA_VERSION,
      }),
    );

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    try {
      await useExtensionStore.persist.rehydrate();

      const state = useExtensionStore.getState();

      // Every collection the merge and the UI trust is a real array again.
      expect(Array.isArray(state.sessions)).toBe(true);
      expect(Array.isArray(state.prompts)).toBe(true);
      expect(Array.isArray(state.writeHistory)).toBe(true);
      expect(Array.isArray(state.notes)).toBe(true);
      expect(state.activeSessionId).toBe('');
      expect(state.activeSession).toBeNull();
      // The provider map keeps the record shape it is typed for: the corrupt
      // string is not adopted as the map, and the default catalogue is not
      // emptied.
      expect(typeof state.config.providers).toBe('object');
      expect(Array.isArray(state.config.providers)).toBe(false);
      expect(Object.keys(state.config.providers).length).toBeGreaterThan(0);

      // The valid part of the blob survives: a whole-blob discard would leave
      // the module default ('http://localhost:12380/v1').
      expect(state.config.openAiBaseUrl).toBe('https://probe.example/v1');

      // And the failure net did not have to fire: the merge is total.
      const logged = debugSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).not.toContain('NP_STORE_REHYDRATE_FAILED');
    } finally {
      debugSpy.mockRestore();
      if (previous === undefined) storageMap.delete('np_store');
      else storageMap.set('np_store', previous);
    }
  });

  // WR-02 / plan `02-08`: the rehydrate failure net still records. A storage
  // read that rejects is the path `onRehydrateStorage` exists for.
  it('a rehydrate failure still records NP_STORE_REHYDRATE_FAILED', async () => {
    clearLogs();
    const getSpy = vi
      .spyOn(chrome.storage.local, 'get')
      .mockRejectedValueOnce(new Error('synthetic-storage-read-failure'));

    try {
      await useExtensionStore.persist.rehydrate();
    } finally {
      getSpy.mockRestore();
    }

    const logged = getRecentLogs().map((entry) => `${entry.code} ${entry.message}`).join('\n');
    expect(logged).toContain('NP_STORE_REHYDRATE_FAILED');
  });
});

describe('useExtensionStore — the np_store v3 projection is body-free (D2-08)', () => {
  // D2-08 / D2-11: v3 is the body-free schema. A v2 blob's conversation
  // collection, active-conversation id and body-derived excerpt are dropped by
  // the allow-list rebuild rather than carried forward.
  it('migrate(v2Blob, 2) keeps the surviving fields only: no conversations, no active id, no excerpt', () => {
    const v2 = {
      config: { language: 'English', themeMode: 'Auto' },
      sessions: [
        {
          id: 's1',
          title: 'Legacy conversation',
          preview: BODY.slice(0, 20),
          createdAt: 1,
          updatedAt: 2,
          isStarred: false,
          group: 'Today',
          messages: [{ id: 'm1', role: 'user', content: BODY, timestamp: 1 }],
        },
      ],
      activeSessionId: 's1',
      prompts: [],
      writeHistory: [],
      notes: [],
    };

    // Non-vacuity: the sentinel body and the excerpt really are in the input.
    expect(JSON.stringify(v2)).toContain(BODY);

    const migrated = npStoreMigrate(v2, 2) as Record<string, unknown>;
    const serialised = JSON.stringify(migrated);

    expect(Object.keys(migrated).sort()).toEqual(['config', 'notes', 'prompts', 'writeHistory']);
    expect(serialised).not.toContain('sessions');
    expect(serialised).not.toContain('activeSessionId');
    expect(serialised).not.toContain('preview');
    for (const fragment of BODY_FRAGMENTS) {
      expect(serialised, `migrated blob must not carry "${fragment}"`).not.toContain(fragment);
    }

    // The declared allow-list itself is body-free — the suite fails if a
    // conversation, the active-conversation id or an excerpt is ever added.
    expect(PERSISTED_BLOB_FIELDS).toEqual(['config', 'prompts', 'writeHistory', 'notes']);
  });

  // T-02-41 / CR-01: the body leaves `chrome.storage.local` at the migration
  // boundary — never earlier. The store's hydration takes the `migrate` branch
  // and computes the body-free v3 projection, but replacing the stored source
  // with it would destroy bodies the migration has not read yet, so the guarded
  // storage holds that write back (`npStoreWriteGuard.ts`).
  it('the v3 projection is never written over an un-migrated legacy source (CR-01)', async () => {
    await flushPendingWrites();
    const previous = storageMap().get('np_store');
    const legacyBlob = JSON.stringify({
      state: {
        config: { language: 'English' },
        sessions: [
          {
            id: 's1',
            title: 'Legacy conversation',
            preview: BODY.slice(0, 20),
            messages: [{ id: 'm1', role: 'user', content: BODY, timestamp: 1 }],
          },
        ],
        activeSessionId: 's1',
        prompts: [],
        writeHistory: [],
        notes: [],
      },
      version: 2,
    });
    storageMap().set('np_store', legacyBlob);

    try {
      await useExtensionStore.persist.rehydrate();
      await flushPendingWrites();

      // The in-memory projection really is body-free (non-vacuity: the migrate
      // branch ran and `partialize` cannot carry the body).
      const partialize = useExtensionStore.persist.getOptions().partialize;
      const projected = JSON.stringify(partialize?.(useExtensionStore.getState()) ?? {});
      for (const fragment of BODY_FRAGMENTS) {
        expect(projected).not.toContain(fragment);
      }

      // The stored source is byte-identical: the write-back was held back, so
      // the migration can still discover the legacy bodies.
      expect(storageMap().get('np_store')).toBe(legacyBlob);
      expect(storageMap().get('np_store')).toContain(BODY);
    } finally {
      if (previous === undefined) storageMap().delete('np_store');
      else storageMap().set('np_store', previous);
    }
  });
});

// ---------------------------------------------------------------------------
// The D2-17 read path and D2-18's states (plan `02-08` Task 2)
// ---------------------------------------------------------------------------

function sessionRecord(id: string, updated: number): ChatSessionRecord {
  return { id, title: `Conversation ${id}`, created: updated - 10, updated, starred: false };
}

function messageRecord(sessionId: string, seq: number, content = 'synthetic message'): MessageRecord {
  return {
    sessionId,
    seq,
    id: `${sessionId}:${seq}`,
    role: 'user',
    content,
    timestamp: 1_700_000_000_000 + seq,
  };
}

/** The explicit test adapter D2-20 sanctions: every seam is injectable. */
function stubPort(overrides: Partial<ChatHydrationDeps> = {}): ChatHydrationDeps {
  return {
    ensureDatabase: async () => undefined,
    recoverJournal: async () => ({ replayed: 0, failed: 0 }),
    runMigration: async () => ({ ok: true, conversations: 0, sanitised: true }),
    listConversations: async () => ({ ok: true, sessions: [], invalidIds: [] }),
    readConversation: async () => ({ ok: false, code: 'CHAT_HISTORY_NOT_FOUND' }),
    ...overrides,
  };
}

/** Put the store back to its pre-hydration runtime state. */
function resetStore(): void {
  useExtensionStore.setState({
    sessions: [],
    activeSessionId: '',
    activeSession: null,
    hydrationStatus: 'idle',
    hydrationError: null,
  });
}

const loggedText = () =>
  getRecentLogs()
    .map((entry) => `${entry.code} ${entry.message} ${JSON.stringify(entry.context ?? {})}`)
    .join('\n');

describe('useExtensionStore — the asynchronous hydration contract (D2-17/D2-18)', () => {
  beforeEach(async () => {
    (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
    closeDb();
    dbTest.reset();
    clearLogs();
    await flushPendingWrites();
    resetStore();
  });

  afterEach(() => {
    closeDb();
    dbTest.reset();
  });

  it('runs the D2-17 order and publishes idle → hydrating → ready', async () => {
    const observed: Array<{ step: string; status: string }> = [];
    const record = (step: string) => {
      observed.push({ step, status: useExtensionStore.getState().hydrationStatus });
    };

    expect(useExtensionStore.getState().hydrationStatus).toBe('idle');

    const port = stubPort({
      ensureDatabase: async () => {
        record('ensureDatabase');
      },
      recoverJournal: async () => {
        record('recoverJournal');
        return { replayed: 0, failed: 0 };
      },
      runMigration: async () => {
        record('runMigration');
        return { ok: true, conversations: 1, sanitised: true };
      },
      listConversations: async () => {
        record('listConversations');
        return { ok: true, sessions: [sessionRecord('s1', 200)], invalidIds: [] };
      },
      readConversation: async (id) => {
        record(`readConversation:${id}`);
        return {
          ok: true,
          session: sessionRecord(id, 200),
          messages: [messageRecord(id, 0, BODY)],
        };
      },
    });

    const status = await useExtensionStore.getState().hydrateChatHistory(port);

    expect(status).toBe('ready');
    // The seams run in the D2-17 order, and every one of them observes
    // `hydrating` — the status is published before the work, not after it.
    expect(observed).toEqual([
      { step: 'ensureDatabase', status: 'hydrating' },
      { step: 'recoverJournal', status: 'hydrating' },
      { step: 'runMigration', status: 'hydrating' },
      { step: 'listConversations', status: 'hydrating' },
      { step: 'readConversation:s1', status: 'hydrating' },
    ]);

    const state = useExtensionStore.getState();
    expect(state.hydrationStatus).toBe('ready');
    expect(state.hydrationError).toBeNull();
    expect(state.sessions.map((session) => session.id)).toEqual(['s1']);
    expect(state.sessions[0].messages.map((message) => message.content)).toEqual([BODY]);
    expect(state.activeSession?.id).toBe('s1');
  });

  it('resolves empty only from a successful read that found nothing', async () => {
    const status = await useExtensionStore.getState().hydrateChatHistory(stubPort());

    expect(status).toBe('empty');
    const state = useExtensionStore.getState();
    expect(state.hydrationStatus).toBe('empty');
    expect(state.hydrationError).toBeNull();
    expect(state.sessions).toEqual([]);
    expect(state.activeSession).toBeNull();
  });

  // T-02-42 / D2-18: a database error is never presented as empty history.
  it('a database failure resolves failed with the typed code and never empty', async () => {
    const status = await useExtensionStore.getState().hydrateChatHistory(
      stubPort({
        ensureDatabase: async () => {
          throw new Error('synthetic-database-unavailable');
        },
      }),
    );

    expect(status).toBe('failed');
    const state = useExtensionStore.getState();
    expect(state.hydrationStatus).toBe('failed');
    expect(state.hydrationStatus).not.toBe('empty');
    expect(state.hydrationError).toEqual({ code: 'IDB_OPEN_FAILED' });
    expect(state.sessions).toEqual([]);
  });

  it('a conversation-list read failure resolves a typed failure and never empty', async () => {
    const status = await useExtensionStore.getState().hydrateChatHistory(
      stubPort({
        listConversations: async () => ({ ok: false, code: 'CHAT_HISTORY_UNAVAILABLE' }),
      }),
    );

    expect(status).toBe('failed');
    expect(useExtensionStore.getState().hydrationStatus).not.toBe('empty');
    expect(useExtensionStore.getState().hydrationError).toEqual({
      code: 'CHAT_HISTORY_UNAVAILABLE',
    });
  });

  // T-02-42 / D2-17 step 7: no legacy fallback. With the database unavailable
  // and a legacy body in `chrome.storage.local`, the body never reaches the
  // in-memory session collection — and the failure is not presented as empty.
  it('no legacy fallback: an unavailable database leaves the legacy body out of the session collection', async () => {
    await flushPendingWrites();
    const previous = storageMap().get('np_store');
    const legacyBlob = JSON.stringify({
      state: {
        config: {},
        sessions: [
          {
            id: 's-legacy',
            title: 'Legacy conversation',
            preview: BODY.slice(0, 20),
            messages: [{ id: 'm1', role: 'user', content: BODY, timestamp: 1 }],
          },
        ],
        activeSessionId: 's-legacy',
      },
      version: 2,
    });
    storageMap().set('np_store', legacyBlob);

    // The database cannot open: the migrator's own failure seam aborts a fresh
    // open (a real path, not a stubbed one).
    dbTest.setMigrationFailure(() => {
      throw new Error('synthetic-injected-migration-failure');
    });

    try {
      // Non-vacuity: the legacy body really is in the storage map.
      expect(storageMap().get('np_store')).toContain(BODY);

      const status = await useExtensionStore.getState().hydrateChatHistory();

      expect(status).toBe('failed');
      const state = useExtensionStore.getState();
      expect(state.hydrationStatus).toBe('failed');
      expect(state.hydrationError?.code).toBe('IDB_MIGRATION_FAILED');
      expect(state.sessions).toEqual([]);

      const partialize = useExtensionStore.persist.getOptions().partialize;
      for (const fragment of BODY_FRAGMENTS) {
        expect(JSON.stringify(partialize?.(state) ?? {})).not.toContain(fragment);
        expect(loggedText(), `logs must not carry "${fragment}"`).not.toContain(fragment);
      }
    } finally {
      dbTest.setMigrationFailure(null);
      closeDb();
      if (previous === undefined) storageMap().delete('np_store');
      else storageMap().set('np_store', previous);
    }
  });

  // D2-20's partial-failure policy: the verified conversations hydrate and the
  // status stays a non-empty error state — never the empty presentation.
  it('a partially migrated installation hydrates the verified conversations and reports the error state', async () => {
    const status = await useExtensionStore.getState().hydrateChatHistory(
      stubPort({
        runMigration: async () => ({
          ok: false,
          code: 'LEGACY_CHAT_MIGRATION_DESTINATION_VERIFY_FAILED',
          stage: 'destination-verified',
        }),
        listConversations: async () => ({
          ok: true,
          sessions: [sessionRecord('s-verified', 300)],
          invalidIds: [],
        }),
        readConversation: async (id) => ({
          ok: true,
          session: sessionRecord(id, 300),
          messages: [messageRecord(id, 0)],
        }),
      }),
    );

    // The migration leaves its journal entry non-terminal and resumable, so
    // the typed error state is `recovery required`.
    expect(status).toBe('recovery required');
    const state = useExtensionStore.getState();
    expect(state.hydrationStatus).toBe('recovery required');
    expect(state.hydrationStatus).not.toBe('empty');
    expect(state.hydrationError).toEqual({
      code: 'LEGACY_CHAT_MIGRATION_DESTINATION_VERIFY_FAILED',
    });
    expect(state.sessions.map((session) => session.id)).toEqual(['s-verified']);
  });

  // T-02-44: one malformed conversation is identified by safe id only, the
  // remaining conversations still hydrate, and nothing logs body text.
  it('one malformed conversation is excluded by safe id and the rest still hydrate', async () => {
    const status = await useExtensionStore.getState().hydrateChatHistory(
      stubPort({
        listConversations: async () => ({
          ok: true,
          sessions: [sessionRecord('s-good', 400), sessionRecord('s-bad', 300)],
          invalidIds: ['s-broken'],
        }),
        readConversation: async (id) => {
          if (id === 's-bad') return { ok: false, code: 'CHAT_HISTORY_INVALID_RECORD' };
          return {
            ok: true,
            session: sessionRecord(id, 400),
            messages: [messageRecord(id, 0, BODY)],
          };
        },
      }),
    );

    expect(status).toBe('failed');
    const state = useExtensionStore.getState();
    expect(state.sessions.map((session) => session.id)).toEqual(['s-good']);
    expect(state.hydrationStatus).not.toBe('empty');
    expect(state.hydrationError).toEqual({ code: 'CHAT_HISTORY_INVALID_RECORD' });

    const logged = loggedText();
    expect(logged).toContain('s-bad');
    expect(logged).toContain('s-broken');
    for (const fragment of BODY_FRAGMENTS) {
      expect(logged, `logs must not carry "${fragment}"`).not.toContain(fragment);
    }
  });

  // CR-01 regression: the *real* startup order. The store hydrates first (its
  // `migrate` branch computes the body-free v3 projection and would write it
  // back), then `hydrateChatHistory()` runs the D2-17 read path. The legacy body
  // must reach ChatHistoryDB and only then leave `np_store`.
  it('the real startup order migrates the legacy body into ChatHistoryDB before np_store is sanitised', async () => {
    await flushPendingWrites();
    const previous = storageMap().get('np_store');
    const legacyBlob = JSON.stringify({
      state: {
        config: { language: 'English' },
        sessions: [
          {
            id: 's1',
            title: 'Legacy conversation',
            preview: BODY.slice(0, 20),
            messages: [{ id: 'm1', role: 'user', content: BODY, timestamp: 1 }],
          },
        ],
        activeSessionId: 's1',
        prompts: [],
        writeHistory: [],
        notes: [],
      },
      version: 2,
    });
    expect(legacyBlob).toContain(BODY);
    storageMap().set('np_store', legacyBlob);

    try {
      // 1. The store's hydration: the migrate branch ran, but the guarded write
      //    was held back, so the migration's source read is still safe.
      await useExtensionStore.persist.rehydrate();
      await flushPendingWrites();
      expect(storageMap().get('np_store')).toContain(BODY);
      expect((JSON.parse(storageMap().get('np_store') as string) as { version: number }).version).toBe(2);

      // 2. The production read path, in order: database, journal, migration,
      //    destination read (the real seams, no stubs).
      const status = await useExtensionStore.getState().hydrateChatHistory();

      expect(status).toBe('ready');
      const state = useExtensionStore.getState();
      expect(state.sessions.map((session) => session.id)).toEqual(['s1']);
      expect(state.sessions[0].messages.map((message) => message.content)).toEqual([BODY]);

      // 3. The body is durably in ChatHistoryDB...
      const readBack = await readConversation('s1');
      expect(readBack.ok).toBe(true);
      if (!readBack.ok) return;
      expect(readBack.messages.map((message) => message.content)).toEqual([BODY]);

      // 4. ...and only then gone from `np_store`, which is the verified v3 blob.
      const stored = storageMap().get('np_store') ?? '';
      for (const fragment of BODY_FRAGMENTS) {
        expect(stored, `sanitised blob must not carry "${fragment}"`).not.toContain(fragment);
      }
      expect(stored).not.toContain('sessions');
      expect(stored).not.toContain('preview');
      expect((JSON.parse(stored) as { version: number }).version).toBe(NP_STORE_SCHEMA_VERSION);
    } finally {
      await flushPendingWrites();
      if (previous === undefined) storageMap().delete('np_store');
      else storageMap().set('np_store', previous);
    }
  });

  // T-02-45: a failed hydration can be re-driven, and the retry runs the real
  // production read path against `np_db`.
  it('retryHydration re-drives a failed hydration to ready', async () => {
    await flushPendingWrites();
    storageMap().delete('np_store');

    expect(
      (await writeConversationWithMessages(sessionRecord('s-real', 500), [
        messageRecord('s-real', 0),
      ])).ok,
    ).toBe(true);

    const first = await useExtensionStore.getState().hydrateChatHistory(
      stubPort({
        ensureDatabase: async () => {
          throw new Error('synthetic-database-unavailable');
        },
      }),
    );
    expect(first).toBe('failed');
    expect(useExtensionStore.getState().sessions).toEqual([]);

    // The retry uses the production defaults: the real database, the real
    // journal recovery and the real migration.
    const second = await useExtensionStore.getState().retryHydration();

    expect(second).toBe('ready');
    const state = useExtensionStore.getState();
    expect(state.hydrationError).toBeNull();
    expect(state.sessions.map((session) => session.id)).toEqual(['s-real']);
  });

  // D2-20 fixtures clause: fixture chat states are separated from production
  // hydration — never written into the database automatically, never marking
  // hydration successful, never overriding a persisted conversation.
  it('fixture chat states stay separated from production hydration', async () => {
    const fixture = {
      id: 's-fixture',
      title: 'Fixture conversation',
      preview: FIXTURE_BODY.slice(0, 20),
      createdAt: 1,
      updatedAt: 1,
      isStarred: false,
      group: 'Today',
      messages: [
        { id: 'm-fixture', role: 'user' as const, content: FIXTURE_BODY, timestamp: 1 },
      ],
    };

    // The explicit test adapter carries the fixture in a field the read path
    // never consults; the seams below are the production repository reads.
    const adapter: ChatHydrationDeps & { fixtures: unknown[] } = {
      ensureDatabase: async () => undefined,
      recoverJournal: async () => ({ replayed: 0, failed: 0 }),
      runMigration: async () => ({ ok: true, conversations: 0, sanitised: true }),
      listConversations: () => readAllConversations(),
      readConversation: (sessionId) => readConversation(sessionId),
      fixtures: [fixture],
    };

    // (1) An empty database with a fixture present resolves `empty`: a fixture
    //     never marks hydration successful and is never written to the database.
    const emptyStatus = await useExtensionStore.getState().hydrateChatHistory(adapter);
    expect(emptyStatus).toBe('empty');
    expect(useExtensionStore.getState().sessions).toEqual([]);

    const stored = await readAllConversations();
    expect(stored.ok && stored.sessions.some((session) => session.id === 's-fixture')).toBe(false);
    const fixtureRead = await readConversation('s-fixture');
    expect(fixtureRead.ok).toBe(false);
    if (!fixtureRead.ok) expect(fixtureRead.code).toBe('CHAT_HISTORY_NOT_FOUND');

    // (2) A persisted conversation is never overridden by a fixture.
    expect(
      (await writeConversationWithMessages(sessionRecord('s-persisted', 600), [])).ok,
    ).toBe(true);

    const readyStatus = await useExtensionStore.getState().hydrateChatHistory(adapter);
    expect(readyStatus).toBe('ready');
    const state = useExtensionStore.getState();
    expect(state.sessions.map((session) => session.id)).toEqual(['s-persisted']);
    expect(JSON.stringify(state.sessions)).not.toContain(FIXTURE_BODY);
  });
});
