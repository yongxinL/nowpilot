import { describe, it, expect } from 'vitest';
import {
  WORKSPACE_STATE_SCHEMA_VERSION,
  createInitialWorkspaceState,
  migrateWorkspaceState,
  parseWorkspaceState,
  type WorkspaceState,
} from '../../../src/core/workspace/WorkspaceState';

/**
 * Task 1 (01-07) — the frozen canonical §8.4 `WorkspaceState` contract.
 *
 * Every field is required, the schema is strict, the parser never throws and
 * the migration is total, deterministic and idempotent.
 */

const CANONICAL_FIELDS = [
  'activeAddonContext',
  'activeProvider',
  'activeSkillRun',
  'activeSurface',
  'conversationId',
  'currentPageContext',
  'openedStandaloneTabId',
  'pinnedTabs',
  'schemaVersion',
  'selectedModel',
  'selectedNotes',
  'updatedAt',
  'version',
  'workspaceId',
];

describe('WorkspaceState — canonical shape (D-11 / H-4)', () => {
  it('createInitialWorkspaceState() returns every canonical field and no other field', () => {
    const state = createInitialWorkspaceState();
    expect(Object.keys(state).sort()).toEqual(CANONICAL_FIELDS);
  });

  it('createInitialWorkspaceState() uses safe empty defaults for every inert field', () => {
    const state = createInitialWorkspaceState();

    expect(state.schemaVersion).toBe(WORKSPACE_STATE_SCHEMA_VERSION);
    expect(state.workspaceId).toBeTruthy();
    expect(state.conversationId).toBeNull();
    expect(state.activeProvider).toBeNull();
    expect(state.selectedModel).toBeNull();
    expect(state.pinnedTabs).toEqual([]);
    expect(state.currentPageContext).toBeNull();
    expect(state.selectedNotes).toEqual([]);
    expect(state.activeAddonContext).toBeNull();
    expect(state.activeSkillRun).toBeNull();
    expect(state.activeSurface).toBe('sidepanel');
    expect(state.openedStandaloneTabId).toBeNull();
    expect(typeof state.version).toBe('number');
    expect(typeof state.updatedAt).toBe('number');
  });

  it('parseWorkspaceState(createInitialWorkspaceState()) round-trips with the same values', () => {
    const initial = createInitialWorkspaceState();
    const parsed = parseWorkspaceState(initial);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(initial);
  });

  it('normalises the persisted JSON-string representation before validating', () => {
    const parsed = parseWorkspaceState(JSON.stringify(createInitialWorkspaceState()));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.workspaceId).toBeTruthy();
  });
});

describe('WorkspaceState — strict rejection (T-1-36)', () => {
  it('rejects an unknown field instead of silently accepting it', () => {
    const parsed = parseWorkspaceState({ ...createInitialWorkspaceState(), surprise: 1 });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('unknown_field');
  });

  it('rejects a missing required field', () => {
    const valid = createInitialWorkspaceState();
    const { workspaceId: _omitted, ...withoutWorkspaceId } = valid;

    expect(parseWorkspaceState(withoutWorkspaceId).ok).toBe(false);
    expect(parseWorkspaceState({}).ok).toBe(false);
  });

  it('never throws for null, a string, a number or an array', () => {
    for (const input of [null, 'nope', 42, []]) {
      expect(() => parseWorkspaceState(input)).not.toThrow();
      const parsed = parseWorkspaceState(input);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.code).toBe('not_an_object');
    }
  });

  it('rejects a mismatched schemaVersion through its own code', () => {
    const parsed = parseWorkspaceState({
      ...createInitialWorkspaceState(),
      schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION + 1,
    });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('unsupported_schema_version');
  });

  it('accepts a provider identifier but rejects a provider-key-shaped value in activeProvider', () => {
    const valid = createInitialWorkspaceState();

    // A provider id is a short lowercase slug — a future phase may widen the
    // field deliberately, so a plain identifier must still parse.
    const withProvider = parseWorkspaceState({ ...valid, activeProvider: 'openai' });
    expect(withProvider.ok).toBe(true);
    if (withProvider.ok) expect(withProvider.value.activeProvider).toBe('openai');

    // No field may carry a credential — the field's own constraint rejects it.
    const withKey = parseWorkspaceState({
      ...valid,
      activeProvider: 'sk-proj-1234567890abcdefghijklmnop',
    });
    expect(withKey.ok).toBe(false);

    const withKeyInModel = parseWorkspaceState({
      ...valid,
      selectedModel: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
    });
    expect(withKeyInModel.ok).toBe(false);
  });

  it('rejects a transient UI field (no modal, hover, spinner or palette query in the type)', () => {
    const parsed = parseWorkspaceState({ ...createInitialWorkspaceState(), paletteQuery: 'abc' });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('unknown_field');
  });
});

describe('WorkspaceState — total, deterministic, idempotent migration (H-4)', () => {
  it('is total: null, {}, a legacy partial object and a primitive each migrate without throwing', () => {
    const legacyPartial = { workspaceId: 'legacy-ws', version: 3 };

    for (const input of [null, {}, legacyPartial, 42]) {
      expect(() => migrateWorkspaceState(input, 0)).not.toThrow();
      const state = migrateWorkspaceState(input, 0);
      expect(state.schemaVersion).toBe(WORKSPACE_STATE_SCHEMA_VERSION);
      expect(typeof state.workspaceId).toBe('string');
      expect(parseWorkspaceState(state).ok).toBe(true);
    }

    const migrated = migrateWorkspaceState(legacyPartial, 0);
    expect(migrated.workspaceId).toBe('legacy-ws');
    expect(migrated.version).toBe(3);
  });

  it('is deterministic: the same input migrates to deep-equal output', () => {
    const input = { workspaceId: 'ws-det', conversationId: 'c1' };

    expect(migrateWorkspaceState(input, 1)).toEqual(migrateWorkspaceState(input, 1));
    expect(migrateWorkspaceState(null, 1)).toEqual(migrateWorkspaceState(null, 1));
  });

  it('is idempotent: migrating its own output changes nothing', () => {
    const once = migrateWorkspaceState({ workspaceId: 'ws-idem' }, 1);
    const twice = migrateWorkspaceState(once, WORKSPACE_STATE_SCHEMA_VERSION);

    expect(twice).toEqual(once);
  });

  it('discards unknown keys and invalid field values instead of carrying them through', () => {
    const migrated = migrateWorkspaceState(
      { workspaceId: 'ws-clean', surprise: 1, activeSurface: 'full-app' },
      1,
    );

    expect(migrated.workspaceId).toBe('ws-clean');
    expect((migrated as unknown as Record<string, unknown>).surprise).toBeUndefined();
    expect(migrated.activeSurface).toBe('sidepanel');
  });
});

describe('WorkspaceState — no placeholder production data', () => {
  it('carries no secret, page body, note body or attachment sample', () => {
    const serialised = JSON.stringify(createInitialWorkspaceState());

    for (const sentinel of ['sk-', 'Bearer', 'BEGIN PRIVATE KEY', '<html', 'attachment']) {
      expect(serialised.toLowerCase()).not.toContain(sentinel.toLowerCase());
    }
  });

  it('keeps collections empty until a later phase produces them', () => {
    const state: WorkspaceState = createInitialWorkspaceState();

    expect(state.pinnedTabs).toHaveLength(0);
    expect(state.selectedNotes).toHaveLength(0);
  });
});
