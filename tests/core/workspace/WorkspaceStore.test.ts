import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  PHASE1_WRITER_STATE,
  WORKSPACE_WRITER_STATES,
  deleteLegacyWorkspaceBlob,
  isMirrorState,
  isPrimaryWriter,
  useWorkspaceStore,
  type ActiveSurface,
} from '../../../src/core/workspace/WorkspaceStore';
import {
  WORKSPACE_STATE_SCHEMA_VERSION,
  parseWorkspaceState,
} from '../../../src/core/workspace/WorkspaceState';

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
] as const;

/** The store carries actions alongside the state; the schema boundary sees the state only. */
function toWorkspaceState(state: Record<string, unknown>): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const field of CANONICAL_FIELDS) projected[field] = state[field];
  return projected;
}

function sourceFiles(dir: string): { file: string; text: string }[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: { file: string; text: string }[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push({ file: full, text: fs.readFileSync(full, 'utf8') });
    }
  }
  return files;
}

describe('WorkspaceStore — canonical shape, no persistence (D-11, D-14)', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
  });

  it('initializes with the canonical defaults and no synthetic production data', () => {
    const state = useWorkspaceStore.getState();

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
    expect(state.version).toBe(0);
    expect(typeof state.updatedAt).toBe('number');
  });

  it('satisfies the strict schema at the store boundary', () => {
    const parsed = parseWorkspaceState(toWorkspaceState(useWorkspaceStore.getState() as unknown as Record<string, unknown>));

    expect(parsed.ok).toBe(true);
  });

  it('exposes only the authorised Phase-1 mutators', () => {
    const state = useWorkspaceStore.getState() as unknown as Record<string, unknown>;
    const actions = Object.keys(state)
      .filter((key) => typeof state[key] === 'function')
      .sort();

    expect(actions).toEqual([
      'reset',
      'setActiveSurface',
      'setConversationId',
      'setOpenedStandaloneTabId',
      'setWorkspaceId',
    ]);
  });

  it('sets the conversation id and bumps the write counter and the staleness marker', () => {
    const before = useWorkspaceStore.getState();
    before.setConversationId('conv-1');

    const after = useWorkspaceStore.getState();
    expect(after.conversationId).toBe('conv-1');
    expect(after.version).toBe(before.version + 1);
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
  });

  it('accepts null as a conversation id (an empty conversation is valid)', () => {
    const store = useWorkspaceStore.getState();
    store.setConversationId('conv-2');
    store.setConversationId(null);

    expect(useWorkspaceStore.getState().conversationId).toBeNull();
  });

  it('sets the workspace id and the active surface', () => {
    const store = useWorkspaceStore.getState();
    store.setWorkspaceId('ws-canonical');
    store.setActiveSurface('standalone');

    const state = useWorkspaceStore.getState();
    expect(state.workspaceId).toBe('ws-canonical');
    expect(state.activeSurface).toBe('standalone');
    expect(state.version).toBe(2);
  });

  it('records the opened Standalone tab id and can clear it', () => {
    const store = useWorkspaceStore.getState();
    store.setOpenedStandaloneTabId(77);
    expect(useWorkspaceStore.getState().openedStandaloneTabId).toBe(77);

    store.setOpenedStandaloneTabId(null);
    expect(useWorkspaceStore.getState().openedStandaloneTabId).toBeNull();
  });

  it('resets to a fresh canonical state', () => {
    const store = useWorkspaceStore.getState();
    store.setConversationId('conv-test');
    store.setWorkspaceId('ws-test');
    store.reset();

    const state = useWorkspaceStore.getState();
    expect(state.conversationId).toBeNull();
    expect(state.workspaceId).not.toBe('ws-test');
    expect(state.version).toBe(0);
    expect(parseWorkspaceState(toWorkspaceState(state as unknown as Record<string, unknown>)).ok).toBe(true);
  });

  it('writes nothing to chrome.storage when state changes', () => {
    const local = (globalThis as unknown as { __chromeStorageLocal: { set: { mock: { calls: unknown[] } } } })
      .__chromeStorageLocal;
    const writesBefore = local.set.mock.calls.length;

    const store = useWorkspaceStore.getState();
    store.setWorkspaceId('ws-no-write');
    store.setConversationId('conv-no-write');
    store.setActiveSurface('standalone');
    store.setOpenedStandaloneTabId(5);
    store.reset();

    expect(local.set.mock.calls.length).toBe(writesBefore);
  });

  it('has no persist middleware and no storage key of its own', () => {
    const store = useWorkspaceStore as unknown as { persist?: unknown };

    expect(store.persist).toBeUndefined();

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/core/workspace/WorkspaceStore.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/persist\s*\(/);
    for (const line of source.split('\n')) {
      if (line.includes(LEGACY_WORKSPACE_STORAGE_KEY)) {
        expect(line).toMatch(/LEGACY/);
      }
    }
  });

  it('source scan: no Phase-1 module names a workspace storage key for writing', () => {
    const violations: string[] = [];

    for (const { file, text } of sourceFiles(path.resolve(process.cwd(), 'src'))) {
      text.split('\n').forEach((line, index) => {
        if (!line.includes('np_workspace')) return;
        // Phase 2 adds the two canonical §15.1 key constants — the workspace
        // key's channel literal and the session-storage election record key.
        // A canonical literal is always quoted; an unquoted, ad-hoc or
        // misspelled key name is still a violation.
        const isCanonicalKeyConstant = /['"]np_workspace(_primary)?['"]/.test(line);
        const isLegacyRemoval = /legacy/i.test(line);
        if (!isCanonicalKeyConstant && !isLegacyRemoval) {
          violations.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('deletes the stale prototype workspace blob on startup', async () => {
    const map = (globalThis as unknown as { __chromeStorageMap: Map<string, string> }).__chromeStorageMap;
    map.set(LEGACY_WORKSPACE_STORAGE_KEY, '{"state":{"workspaceId":"stale"}}');

    await deleteLegacyWorkspaceBlob();

    expect(map.has(LEGACY_WORKSPACE_STORAGE_KEY)).toBe(false);
  });
});

describe('WorkspaceStore — Phase-1 writer adapter and mirror contract (D-12)', () => {
  it('reports the surface writable without claiming an election', () => {
    expect(PHASE1_WRITER_STATE).toBe('primary');
    expect(isPrimaryWriter()).toBe(true);
    expect(isPrimaryWriter()).toBe(true);
  });

  it('freezes the canonical writer vocabulary and stays out of every mirror state', () => {
    expect(WORKSPACE_WRITER_STATES).toEqual([
      'primary',
      'mirror',
      'election-pending',
      'handoff-pending',
      'handoff-failed',
      'writer-unavailable',
    ]);

    for (const state of WORKSPACE_WRITER_STATES) {
      expect(isMirrorState(state)).toBe(state !== 'primary');
    }
    expect(isMirrorState(PHASE1_WRITER_STATE)).toBe(false);
  });
});

describe('ActiveSurface union (D-07 canonicalization)', () => {
  it("accepts 'standalone' as a valid value", () => {
    const surface: ActiveSurface = 'standalone';
    expect(surface).toBe('standalone');
  });

  it("accepts 'sidepanel' as a valid value", () => {
    const surface: ActiveSurface = 'sidepanel';
    expect(surface).toBe('sidepanel');
  });

  it("rejects 'full-app' at the type level (canonical rename)", () => {
    // @ts-expect-error 'full-app' is no longer a member of ActiveSurface — canonicalized to 'standalone' (D-07).
    const surface: ActiveSurface = 'full-app';
    expect(surface).toBe('full-app');
  });
});
