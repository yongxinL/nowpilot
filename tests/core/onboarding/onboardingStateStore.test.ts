import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LEGACY_ONBOARDING_FLAG_KEY,
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STORAGE_KEY,
  deleteLegacyOnboardingFlag,
  migrateOnboardingState,
  readOnboardingState,
  shouldPresentOnboarding,
  shouldPresentOnboardingForWriter,
  subscribeToOnboardingState,
  writeOnboardingState,
  type OnboardingReadResult,
  type OnboardingState,
} from '../../../src/core/onboarding/onboardingStateStore';
import { WORKSPACE_WRITER_STATES } from '../../../src/core/workspace/WorkspaceStore';

/**
 * Onboarding completion-record suite (plan `01-09`, Task 3 — D-06 / D-07).
 *
 * Six properties are pinned:
 *   1. one typed non-secret record under one key (`np_onboarding`), carrying the
 *      UI-complete flag, the persona, the provider identifier, the schema
 *      version and the separate validation-backing marker;
 *   2. the legacy prototype boolean is absorbed into the record and its key
 *      removed, so no second source of truth survives;
 *   3. the read is total and throw-free — a fresh install, garbage, an
 *      incompatible schema version and a failed read each yield an unknown
 *      state that presents the flow rather than throwing or silently accepting;
 *   4. the record carries no credential, masked fragment, fingerprint or
 *      derived value, and writing it twice is idempotent;
 *   5. completion in one surface reaches the other through the storage change
 *      event without a reload;
 *   6. no extension-context file reads or writes the legacy per-origin storage
 *      fallback flag.
 */

const REPO_ROOT = process.cwd();

/**
 * Strip `//` and block comments before scanning, so a provenance note naming a
 * removed path or a quoted literal cannot trip a source gate (the same
 * instrument correction plans `01-04`/`01-06` recorded).
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** The chrome.storage.local mock's backing map (see `tests/setup.ts`). */
const storageMap = () => (globalThis as any).__chromeStorageMap as Map<string, unknown>;

type OnChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

let onChangedListeners: OnChangedListener[] = [];

function emitStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  area = 'local',
): void {
  for (const listener of onChangedListeners) listener(changes, area);
}

/** The record as it is actually stored (the raw storage value). */
const storedRecord = () => storageMap().get(ONBOARDING_STORAGE_KEY) as Record<string, unknown>;

beforeEach(() => {
  storageMap().clear();
  onChangedListeners = [];
  // This suite drives synthetic change events directly, so it installs its own
  // dispatcher over the shared one from `tests/setup.ts` (plan 02-01) and keeps
  // `emitStorageChange` below as the single emit path.
  (chrome.storage as unknown as Record<string, unknown>).onChanged = {
    addListener: (callback: OnChangedListener) => {
      onChangedListeners.push(callback);
    },
    removeListener: (callback: OnChangedListener) => {
      onChangedListeners = onChangedListeners.filter((listener) => listener !== callback);
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('onboarding completion record — one key, one typed shape', () => {
  it('returns an unknown state on a fresh install rather than an error', async () => {
    const result = await readOnboardingState();

    expect(result).toEqual({ status: 'unknown', reason: 'missing' });
    // Unknown means "present the flow" — never "the user already finished".
    expect(shouldPresentOnboarding(result)).toBe(true);
  });

  it('persists the UI-complete flag, the persona and the provider under one key', async () => {
    const written = await writeOnboardingState({
      uiComplete: true,
      persona: 'fixture-persona',
      providerId: 'anthropic',
    });

    expect(written.uiComplete).toBe(true);
    expect(written.persona).toBe('fixture-persona');
    expect(written.providerId).toBe('anthropic');

    // One key only: no second onboarding key, and no temporary key.
    expect(Array.from(storageMap().keys())).toEqual([ONBOARDING_STORAGE_KEY]);

    const result = await readOnboardingState();
    expect(result).toEqual({ status: 'ok', state: written });
    expect(shouldPresentOnboarding(result)).toBe(false);
  });

  it('carries the schema version and the separate validation-backing marker', async () => {
    await writeOnboardingState({ uiComplete: true, providerId: 'openai' });

    expect(storedRecord().schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION);
    // Phase 1's validation is fixture-backed, and the record says so: a later
    // phase must not read Phase-1 completion as production readiness (T-1-44).
    expect(storedRecord().validationBacking).toBe('fixture');
  });

  it('stores no credential, masked fragment, fingerprint or derived value', async () => {
    await writeOnboardingState({ uiComplete: true, providerId: 'openai' });

    const serialised = JSON.stringify(storedRecord());
    for (const forbidden of ['apiKey', 'token', 'secret', 'credential', 'fingerprint']) {
      expect(serialised, `the record must not carry ${forbidden}`).not.toContain(forbidden);
    }
    expect(Object.keys(storedRecord()).sort()).toEqual(
      [
        'legacyCleanupNoticeShown',
        'persona',
        'providerId',
        'schemaVersion',
        'uiComplete',
        'validationBacking',
      ].sort(),
    );
  });

  it('defaults the legacy-cleanup notice field to false so the notice presents once', async () => {
    await writeOnboardingState({ uiComplete: true, providerId: 'openai' });

    // Plan `01-10`: the D-07 notice's shown-state is a field on THIS record —
    // one key, one writer, no second flag.
    expect(storedRecord().legacyCleanupNoticeShown).toBe(false);
    expect(Array.from(storageMap().keys())).toEqual([ONBOARDING_STORAGE_KEY]);

    const result = await readOnboardingState();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.state.legacyCleanupNoticeShown).toBe(false);
  });

  it('records the notice dismissal on the same record without a second key', async () => {
    await writeOnboardingState({ legacyCleanupNoticeShown: true });

    expect(storedRecord().legacyCleanupNoticeShown).toBe(true);
    expect(Array.from(storageMap().keys())).toEqual([ONBOARDING_STORAGE_KEY]);

    const result = await readOnboardingState();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.state.legacyCleanupNoticeShown).toBe(true);
  });

  it('upgrades a schema-v1 record by defaulting the notice field rather than rejecting it', async () => {
    storageMap().set(ONBOARDING_STORAGE_KEY, {
      uiComplete: true,
      persona: 'fixture-persona',
      providerId: 'openai',
      schemaVersion: ONBOARDING_SCHEMA_VERSION - 1,
      validationBacking: 'fixture',
    });

    const result = await readOnboardingState();

    // An added, safely defaulted field must not push a user who has already
    // finished onboarding back through the flow.
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.state.uiComplete).toBe(true);
      expect(result.state.providerId).toBe('openai');
      expect(result.state.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION);
      expect(result.state.legacyCleanupNoticeShown).toBe(false);
    }
    expect(shouldPresentOnboarding(result)).toBe(false);
  });

  it('produces the same stored record when the completion write happens twice', async () => {
    await writeOnboardingState({ uiComplete: true, persona: null, providerId: 'ollama' });
    const first = JSON.stringify(storedRecord());

    await writeOnboardingState({ uiComplete: true, persona: null, providerId: 'ollama' });

    expect(JSON.stringify(storedRecord())).toBe(first);
  });
});

describe('onboarding completion record — legacy boolean migration', () => {
  it('absorbs a legacy boolean into the record and removes the legacy key', async () => {
    storageMap().set(LEGACY_ONBOARDING_FLAG_KEY, true);

    const result = await readOnboardingState();

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.state.uiComplete).toBe(true);
      expect(result.state.schemaVersion).toBe(ONBOARDING_SCHEMA_VERSION);
    }
    // The legacy key is gone; the record is the only source of truth.
    expect(storageMap().has(LEGACY_ONBOARDING_FLAG_KEY)).toBe(false);
    expect(storageMap().has(ONBOARDING_STORAGE_KEY)).toBe(true);
  });

  it('maps a legacy false to an incomplete record', async () => {
    storageMap().set(LEGACY_ONBOARDING_FLAG_KEY, false);

    const result = await readOnboardingState();

    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.state.uiComplete).toBe(false);
    expect(shouldPresentOnboarding(result)).toBe(true);
    expect(storageMap().has(LEGACY_ONBOARDING_FLAG_KEY)).toBe(false);
  });

  it('deletes the legacy key without touching an existing record', async () => {
    await writeOnboardingState({ uiComplete: true, providerId: 'gemini' });
    const before = JSON.stringify(storedRecord());
    storageMap().set(LEGACY_ONBOARDING_FLAG_KEY, false);

    await deleteLegacyOnboardingFlag();

    expect(storageMap().has(LEGACY_ONBOARDING_FLAG_KEY)).toBe(false);
    expect(JSON.stringify(storedRecord())).toBe(before);
  });
});

describe('onboarding completion record — total, throw-free reads', () => {
  it('rejects an incompatible schema version as unknown instead of accepting it', async () => {
    storageMap().set(ONBOARDING_STORAGE_KEY, {
      uiComplete: true,
      persona: null,
      providerId: 'openai',
      schemaVersion: ONBOARDING_SCHEMA_VERSION + 1,
      validationBacking: 'fixture',
    });

    const result = await readOnboardingState();

    expect(result).toEqual({ status: 'unknown', reason: 'incompatible' });
    // A schema-incompatible record presents the flow rather than silently
    // suppressing it.
    expect(shouldPresentOnboarding(result)).toBe(true);
  });

  it('is total for null, a string, a number, an array and an object with unknown fields', async () => {
    const raws: unknown[] = [null, 'nonsense', 42, ['a'], { unexpected: 'field' }];

    for (const raw of raws) {
      storageMap().set(ONBOARDING_STORAGE_KEY, raw);
      const result = await readOnboardingState();
      expect(result.status, `raw ${JSON.stringify(raw)}`).toBe('unknown');
      expect(shouldPresentOnboarding(result)).toBe(true);
    }

    // ...and the migration helper itself never throws on the same inputs.
    for (const raw of raws) {
      expect(() => migrateOnboardingState(raw, undefined)).not.toThrow();
      expect(migrateOnboardingState(raw, undefined)).toBeNull();
    }
    expect(() => migrateOnboardingState(undefined, undefined)).not.toThrow();
  });

  it('returns an unknown state when the storage read fails entirely', async () => {
    const getSpy = vi
      .spyOn(chrome.storage.local, 'get')
      .mockRejectedValueOnce(new Error('storage unavailable'));

    const result = await readOnboardingState();

    expect(result).toEqual({ status: 'unknown', reason: 'unreadable' });
    expect(shouldPresentOnboarding(result)).toBe(true);
    getSpy.mockRestore();
  });
});

describe('onboarding completion record — cross-surface propagation', () => {
  it('observes a completion written by the other surface without a reload', async () => {
    const observed: unknown[] = [];
    const unsubscribe = subscribeToOnboardingState((result) => observed.push(result));

    // Surface A writes the record; Chrome emits the storage change event that
    // surface B's subscription receives.
    await writeOnboardingState({ uiComplete: true, providerId: 'openai' });
    emitStorageChange({
      [ONBOARDING_STORAGE_KEY]: { oldValue: undefined, newValue: storedRecord() },
    });

    await vi.waitFor(() => {
      expect(observed).toHaveLength(1);
    });
    expect(observed[0]).toEqual({
      status: 'ok',
      state: expect.objectContaining({ uiComplete: true, providerId: 'openai' }),
    });

    unsubscribe();
    emitStorageChange({
      [ONBOARDING_STORAGE_KEY]: { oldValue: storedRecord(), newValue: storedRecord() },
    });
    expect(observed).toHaveLength(1);
  });

  it('ignores a change to an unrelated key', async () => {
    const observed: unknown[] = [];
    const unsubscribe = subscribeToOnboardingState((result) => observed.push(result));

    emitStorageChange({ np_theme: { oldValue: 'auto', newValue: 'dark' } });

    expect(observed).toEqual([]);
    unsubscribe();
  });
});

describe('onboarding completion record — no second source of truth', () => {
  const sourceFiles = (): { file: string; code: string }[] => {
    const files: { file: string; code: string }[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          files.push({
            file: path.relative(REPO_ROOT, full),
            code: stripComments(fs.readFileSync(full, 'utf8')),
          });
        }
      }
    };
    walk(path.join(REPO_ROOT, 'src'));
    return files;
  };

  it('never reads or writes the legacy per-origin storage fallback flag', () => {
    // The prototype fell back to `localStorage` when Chrome storage was absent;
    // a per-origin copy of the completion flag is a second source of truth.
    const fallbackRe =
      /localStorage[\s\S]{0,120}(?:onboardingComplete|LEGACY_ONBOARDING_FLAG_KEY)|(?:onboardingComplete|LEGACY_ONBOARDING_FLAG_KEY)[\s\S]{0,120}localStorage/;

    const offenders = sourceFiles()
      .filter(({ code }) => fallbackRe.test(code))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it('mounts the shared flow on both surfaces and never surface-to-surface', () => {
    const roots = [
      path.join('src', 'entrypoints', 'sidepanel', 'main.tsx'),
      path.join('src', 'entrypoints', 'standalone', 'main.tsx'),
    ];

    for (const root of roots) {
      const code = stripComments(fs.readFileSync(path.join(REPO_ROOT, root), 'utf8'));
      expect(code, `${root} must render the shared flow`).toContain('OnboardingFlow');
      // The gate is the completion record — never a surface-specific copy.
      expect(code, `${root} must gate on the completion record`).toContain('useOnboardingGate');
      expect(code, `${root} must read the record through the store`).toContain(
        'readOnboardingState',
      );
      // Neither surface reaches the other: each supplies its own adapters.
      expect(code, `${root} must not import the other surface`).not.toMatch(
        /from\s+'\.\.\/\.\.\/entrypoints\//,
      );
    }

    // The shared module is one presentation: no second onboarding flow exists.
    const flowModules = sourceFiles().filter(({ code }) =>
      code.includes('OnboardingFlowProps'),
    );
    expect(flowModules.map(({ file }) => file)).toEqual([
      path.join('src', 'components', 'onboarding', 'OnboardingFlow.tsx'),
    ]);
  });

  it('names the new storage key in exactly one module', () => {
    // One key, one owner: the record is read and written only by the store
    // module, so no second writer can invent a parallel representation.
    const offenders = sourceFiles()
      .filter(
        ({ file, code }) =>
          file !== path.join('src', 'core', 'onboarding', 'onboardingStateStore.ts') &&
          code.includes(ONBOARDING_STORAGE_KEY),
      )
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });
});

describe('onboarding single controller — presentation gated on authoritative writer state', () => {
  const COMPLETE_STATE: OnboardingState = {
    uiComplete: true,
    persona: null,
    providerId: 'openai',
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    validationBacking: 'fixture',
    legacyCleanupNoticeShown: false,
  };
  const INCOMPLETE_STATE: OnboardingState = { ...COMPLETE_STATE, uiComplete: false };

  /** Every read outcome the record reader can produce. */
  const READ_RESULTS: Array<[string, OnboardingReadResult]> = [
    ['ok + complete', { status: 'ok', state: COMPLETE_STATE }],
    ['ok + incomplete', { status: 'ok', state: INCOMPLETE_STATE }],
    ['unknown + missing', { status: 'unknown', reason: 'missing' }],
    ['unknown + incompatible', { status: 'unknown', reason: 'incompatible' }],
    ['unknown + unreadable', { status: 'unknown', reason: 'unreadable' }],
  ];

  it('presents the flow only for the authoritative writer with an incomplete record', () => {
    expect(
      shouldPresentOnboardingForWriter({ status: 'ok', state: INCOMPLETE_STATE }, 'primary'),
    ).toBe(true);
    // ...and the record still decides: a completed flow never re-presents.
    expect(
      shouldPresentOnboardingForWriter({ status: 'ok', state: COMPLETE_STATE }, 'primary'),
    ).toBe(false);
  });

  it('is total: every read outcome crossed with every writer state returns a boolean', () => {
    for (const [name, result] of READ_RESULTS) {
      for (const writerState of WORKSPACE_WRITER_STATES) {
        const decision = shouldPresentOnboardingForWriter(result, writerState);
        expect(typeof decision, `${name} on ${writerState}`).toBe('boolean');
        expect(decision, `${name} on ${writerState}`).toBe(
          writerState === 'primary' && shouldPresentOnboarding(result),
        );
      }
    }
  });

  it('hides every non-authoritative writer state, whatever the record says', () => {
    const nonWriters = WORKSPACE_WRITER_STATES.filter((state) => state !== 'primary');

    // The mirror-side vocabulary, named, so a new state cannot slip past.
    expect(nonWriters).toEqual([
      'mirror',
      'election-pending',
      'handoff-pending',
      'handoff-failed',
      'writer-unavailable',
    ]);

    for (const [name, result] of READ_RESULTS) {
      for (const writerState of nonWriters) {
        expect(
          shouldPresentOnboardingForWriter(result, writerState),
          `${name} on ${writerState}`,
        ).toBe(false);
      }
    }
  });

  it('imports the writer state as a type only — no runtime cycle with the store', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'src', 'core', 'onboarding', 'onboardingStateStore.ts'),
      'utf8',
    );

    expect(source).toMatch(
      /import\s+type\s*\{[^}]*\}\s*from\s*'\.\.\/workspace\/WorkspaceStore'/,
    );

    // Remove that one declaration: no other reference to the workspace store
    // may remain, so the module cannot pull zustand/immer into its graph (the
    // background worker imports this module).
    const withoutTypeImport = source.replace(
      /import\s+type\s*\{[^}]*\}\s*from\s*'\.\.\/workspace\/WorkspaceStore';?/g,
      '',
    );
    expect(withoutTypeImport).not.toContain("'../workspace/WorkspaceStore'");
    expect(stripComments(withoutTypeImport)).not.toContain('useWorkspaceStore');
  });

  it('gates the shared surface hook on the same predicate and the writer state', () => {
    const hook = stripComments(
      fs.readFileSync(path.join(REPO_ROOT, 'src', 'core', 'onboarding', 'useOnboardingGate.ts'), 'utf8'),
    );

    expect(hook).toContain('useWorkspaceStore');
    expect(hook).toContain('state.writerState');
    expect(hook).toContain('shouldPresentOnboardingForWriter');
    // A non-writer resolves `hidden` immediately — never `reading` — so a
    // mirror never waits on a competing flow (T-02-40).
    expect(hook).toMatch(/writerState !== 'primary'\)\s*return 'hidden'/);
  });
});
