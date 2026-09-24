import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  HEARTBEAT_MS,
  PRIMARY_RECORD_KEY,
  STALE_AFTER_MS,
  createWriterElection,
  isStale,
  type PrimaryRecord,
  type PrimaryRecordStorageArea,
  type WriterElection,
} from '../../../src/core/workspace/WriterElection';
import { __test__ as adapterTest } from '../../../src/core/theme/chromeStorageAdapter';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * WriterElection suite — plan 02-06 Task 2, the D2-34 case list.
 *
 * Every case drives the real module over the Map-backed `chrome.storage.session`
 * mock (or an injected Map), with fake time so the 3 s heartbeat and the 2-miss
 * staleness window are deterministic and no real sleep occurs. The record is
 * asserted to be visible **immediately** after `elect()` with no timer advanced
 * — the case that fails if the debounced adapter is ever used here.
 *
 * The two handoff clauses in the D2-34 list ("a failed handoff retains the
 * existing writer", "a successful handoff changes authority only after
 * persistence and acknowledgement") are asserted at the election level here:
 * authority moves only after the source releases the record, and the mirroring
 * surface cannot write authoritatively before that. The full handoff + election
 * integration over the two-surface harness is plan 02-11's suite.
 */

const T0 = 1_700_000_000_000;

const sessionMap = (): Map<string, unknown> =>
  (globalThis as unknown as { __chromeStorageSessionMap: Map<string, unknown> })
    .__chromeStorageSessionMap;

const record = (): PrimaryRecord | undefined =>
  sessionMap().get(PRIMARY_RECORD_KEY) as PrimaryRecord | undefined;

const flushMicrotasks = async (): Promise<void> => {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
};

const elections: WriterElection[] = [];

function track(election: WriterElection): WriterElection {
  elections.push(election);
  return election;
}

/** An injected session area with a visible Map, a read counter and failure seams. */
function injectedArea(options: { seed?: PrimaryRecord; lostWrites?: boolean } = {}): {
  area: PrimaryRecordStorageArea;
  map: Map<string, unknown>;
  reads: () => number;
} {
  const map = new Map<string, unknown>();
  if (options.seed) map.set(PRIMARY_RECORD_KEY, options.seed);
  let reads = 0;

  const area: PrimaryRecordStorageArea = {
    get: async (key: string) => {
      reads += 1;
      return { [key]: map.get(key) ?? null };
    },
    set: async (items: Record<string, unknown>) => {
      // A "lost" write is the race the read-back verification must detect.
      if (options.lostWrites) return;
      for (const [key, value] of Object.entries(items)) map.set(key, value);
    },
    remove: async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) map.delete(key);
    },
  };

  return { area, map, reads: () => reads };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(T0));
  sessionMap().clear();
  clearLogs();
  elections.length = 0;
});

afterEach(() => {
  elections.forEach((election) => election.stop());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WriterElection — pinned constants and staleness (§13, §20.11)', () => {
  it('exports the pinned record key, heartbeat interval and staleness window', () => {
    expect(PRIMARY_RECORD_KEY).toBe('np_workspace_primary');
    expect(HEARTBEAT_MS).toBe(3000);
    expect(STALE_AFTER_MS).toBe(2 * HEARTBEAT_MS);
  });

  it('isStale is strictly greater than two heartbeat intervals', () => {
    const fresh = { tabId: 1, surface: 'sidepanel' as const, electedAt: T0 };

    expect(isStale(fresh, T0)).toBe(false);
    expect(isStale(fresh, T0 + STALE_AFTER_MS)).toBe(false);
    expect(isStale(fresh, T0 + STALE_AFTER_MS + 1)).toBe(true);
  });
});

describe('WriterElection — election and the read-back-verified CAS (T-02-30)', () => {
  it('initial assignment when no record exists', async () => {
    const election = track(createWriterElection({ surface: 'sidepanel', tabId: 11 }));

    const outcome = await election.elect();

    expect(outcome).toEqual({ kind: 'primary', epoch: T0 });
    expect(record()).toEqual({ tabId: 11, surface: 'sidepanel', electedAt: T0 });
    expect(election.coordinationState()).toEqual({ state: 'solo', primarySurface: 'sidepanel' });
  });

  it('the CAS reads back what it wrote: a successful election performs the read-back', async () => {
    const { area, reads } = injectedArea();
    const election = track(
      createWriterElection({ surface: 'standalone', tabId: 2, sessionStorage: area }),
    );

    const outcome = await election.elect();

    expect(outcome).toEqual({ kind: 'primary', epoch: T0 });
    // read → write → read-back-verify: authority is never claimed from the
    // write alone.
    expect(reads()).toBe(2);
  });

  it('CAS conflict: another surface’s fresher record returns secondary and is not overwritten', async () => {
    const incumbent: PrimaryRecord = { tabId: 42, surface: 'standalone', electedAt: T0 - 1 };
    sessionMap().set(PRIMARY_RECORD_KEY, incumbent);
    const election = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));

    const outcome = await election.elect();

    expect(outcome).toEqual({ kind: 'secondary', current: incumbent });
    expect(record()).toEqual(incumbent);
    expect(election.coordinationState()).toEqual({
      state: 'secondary',
      primarySurface: 'standalone',
      isMirroring: true,
    });
  });

  it('an unverifiable read-back never reports primary and never fabricates an owner', async () => {
    const { area, map } = injectedArea({ lostWrites: true });
    const election = track(
      createWriterElection({ surface: 'sidepanel', tabId: 1, sessionStorage: area }),
    );

    const outcome = await election.elect();

    expect(outcome).toEqual({
      kind: 'error',
      code: 'ELECTION_TIMEOUT',
      message: expect.any(String),
    });
    expect(map.has(PRIMARY_RECORD_KEY)).toBe(false);
    expect(election.coordinationState()).toMatchObject({
      state: 'error',
      code: 'ELECTION_TIMEOUT',
    });
    // The §C.2 identifier is the log code on this path, not a payload code.
    expect(getRecentLogs().some((entry) => entry.code === 'WORKSPACE_ELECTION_TIMEOUT')).toBe(true);
  });

  it('no debounce: the record is visible immediately with no timer advanced', async () => {
    const election = track(createWriterElection({ surface: 'standalone', tabId: 2 }));

    await election.elect();

    expect(Date.now()).toBe(T0);
    expect(sessionMap().has(PRIMARY_RECORD_KEY)).toBe(true);
    expect(record()).toEqual({ tabId: 2, surface: 'standalone', electedAt: T0 });
    // Nothing went through the debounced adapter's pending map.
    expect(adapterTest.getPendingSize()).toBe(0);
  });

  it('an unavailable storage area resolves the typed STORAGE_UNAVAILABLE error state', async () => {
    const noArea = track(
      createWriterElection({ surface: 'sidepanel', tabId: 1, sessionStorage: null }),
    );
    const failing = track(
      createWriterElection({
        surface: 'sidepanel',
        tabId: 1,
        sessionStorage: {
          get: async () => {
            throw new Error('session area unavailable');
          },
          set: async () => {},
        },
      }),
    );

    expect(await noArea.elect()).toEqual({
      kind: 'error',
      code: 'STORAGE_UNAVAILABLE',
      message: expect.any(String),
    });
    expect(await failing.elect()).toMatchObject({ kind: 'error', code: 'STORAGE_UNAVAILABLE' });
    expect(noArea.coordinationState()).toMatchObject({
      state: 'error',
      code: 'STORAGE_UNAVAILABLE',
    });
    expect(getRecentLogs().some((entry) => entry.code === 'WORKSPACE_STORAGE_UNAVAILABLE')).toBe(
      true,
    );
  });

  it('the staleness boundary is exact: two intervals is fresh, one millisecond more is stale', async () => {
    sessionMap().set(PRIMARY_RECORD_KEY, {
      tabId: 42,
      surface: 'standalone',
      electedAt: T0 - STALE_AFTER_MS,
    });
    const stillFresher = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));
    expect(await stillFresher.elect()).toMatchObject({ kind: 'secondary' });

    sessionMap().set(PRIMARY_RECORD_KEY, {
      tabId: 42,
      surface: 'standalone',
      electedAt: T0 - STALE_AFTER_MS - 1,
    });
    const takesOver = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));

    expect(await takesOver.elect()).toEqual({ kind: 'primary', epoch: T0 });
    expect(record()).toEqual({ tabId: 1, surface: 'sidepanel', electedAt: T0 });
  });
});

describe('WriterElection — heartbeat liveness (§13)', () => {
  it('epoch generation: each heartbeat produces a strictly larger electedAt', async () => {
    const election = track(createWriterElection({ surface: 'standalone', tabId: 7 }));
    expect(await election.elect()).toEqual({ kind: 'primary', epoch: T0 });
    election.startHeartbeat();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    const second = record()?.electedAt;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    const third = record()?.electedAt;

    expect(second).toBe(T0 + HEARTBEAT_MS);
    expect(third).toBe(T0 + 2 * HEARTBEAT_MS);
    expect(second as number).toBeGreaterThan(T0);
    expect(third as number).toBeGreaterThan(second as number);
  });

  it('heartbeat renewal keeps authority: the epoch advances and the write gate stays open', async () => {
    const election = track(createWriterElection({ surface: 'standalone', tabId: 7 }));
    await election.elect();
    election.startHeartbeat();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(record()?.electedAt).toBe(T0 + HEARTBEAT_MS);
    expect(await election.assertStillPrimary()).toEqual({ ok: true });
    expect(election.coordinationState()).toEqual({ state: 'solo', primarySurface: 'standalone' });
  });

  it('heartbeat expiry: a record older than two intervals is stale and any surface may elect', async () => {
    const expired: PrimaryRecord = {
      tabId: 42,
      surface: 'standalone',
      electedAt: T0 - STALE_AFTER_MS - 1,
    };
    sessionMap().set(PRIMARY_RECORD_KEY, expired);
    const challenger = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));

    expect(await challenger.elect()).toEqual({ kind: 'primary', epoch: T0 });
    expect(record()?.tabId).toBe(1);
  });
});

describe('WriterElection — stale-writer rejection and the mirror state (T-02-31)', () => {
  it('a strictly newer electedAt after the last refresh rejects the writer', async () => {
    const { area, map } = injectedArea();
    const election = track(
      createWriterElection({ surface: 'sidepanel', tabId: 1, sessionStorage: area }),
    );
    expect(await election.elect()).toEqual({ kind: 'primary', epoch: T0 });

    // The same identity, a strictly newer epoch: the heartbeat lapsed and
    // another surface re-elected under this identity's shape.
    map.set(PRIMARY_RECORD_KEY, { tabId: 1, surface: 'sidepanel', electedAt: T0 + 1 });

    const rejected = await election.assertStillPrimary();

    expect(rejected).toEqual({ ok: false, code: 'WORKSPACE_WRITER_REJECTED' });
    expect(election.coordinationState()).toMatchObject({
      state: 'secondary',
      isMirroring: true,
    });
    // The rejection never rewrites the record.
    expect(map.get(PRIMARY_RECORD_KEY)).toEqual({
      tabId: 1,
      surface: 'sidepanel',
      electedAt: T0 + 1,
    });
  });

  it('a changed identity rejects the writer too, and never overwrites the record', async () => {
    const { area, map } = injectedArea();
    const election = track(
      createWriterElection({ surface: 'sidepanel', tabId: 1, sessionStorage: area }),
    );
    await election.elect();

    const other: PrimaryRecord = { tabId: 9, surface: 'standalone', electedAt: T0 + 1 };
    map.set(PRIMARY_RECORD_KEY, other);

    expect(await election.assertStillPrimary()).toEqual({
      ok: false,
      code: 'WORKSPACE_WRITER_REJECTED',
    });
    expect(map.get(PRIMARY_RECORD_KEY)).toEqual(other);
    expect(election.coordinationState()).toEqual({
      state: 'secondary',
      primarySurface: 'standalone',
      isMirroring: true,
    });
  });

  it('an absent record rejects the writer rather than granting authority', async () => {
    const { area, map } = injectedArea();
    const election = track(
      createWriterElection({ surface: 'sidepanel', tabId: 1, sessionStorage: area }),
    );
    await election.elect();
    map.delete(PRIMARY_RECORD_KEY);

    expect(await election.assertStillPrimary()).toEqual({
      ok: false,
      code: 'WORKSPACE_WRITER_REJECTED',
    });
    expect(election.coordinationState()).toMatchObject({ state: 'error', code: 'ELECTION_TIMEOUT' });
  });

  it('mirror-state activation comes only from authoritative election state', async () => {
    const election = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));

    // Before any election resolves, no mirror is claimed and no primary named.
    expect(election.coordinationState()).toEqual({ state: 'election-in-progress', startedAt: T0 });

    sessionMap().set(PRIMARY_RECORD_KEY, {
      tabId: 42,
      surface: 'standalone',
      electedAt: T0 - 1,
    });
    await election.elect();

    expect(election.coordinationState()).toEqual({
      state: 'secondary',
      primarySurface: 'standalone',
      isMirroring: true,
    });
  });
});

describe('WriterElection — deterministic conflict resolution (D2-34)', () => {
  it('two surfaces electing at the same electedAt resolve in the Standalone’s favour', async () => {
    const panel = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));
    const standalone = track(createWriterElection({ surface: 'standalone', tabId: 2 }));

    expect(await panel.elect()).toEqual({ kind: 'primary', epoch: T0 });

    // The Standalone elects at the SAME epoch: the pinned tie-break.
    expect(await standalone.elect()).toEqual({ kind: 'primary', epoch: T0 });
    expect(record()).toEqual({ tabId: 2, surface: 'standalone', electedAt: T0 });

    // Exactly one primary and one secondary — never two primaries.
    expect(await panel.elect()).toMatchObject({ kind: 'secondary' });
    expect(panel.coordinationState()).toEqual({
      state: 'secondary',
      primarySurface: 'standalone',
      isMirroring: true,
    });
    expect(standalone.coordinationState()).toEqual({
      state: 'primary',
      surface: 'standalone',
      secondaries: ['sidepanel'],
    });
    expect(record()).toEqual({ tabId: 2, surface: 'standalone', electedAt: T0 });
  });
});

describe('WriterElection — surface lifecycle and handoff (D2-34)', () => {
  it('one-surface closure promotes the survivor', async () => {
    const source = track(createWriterElection({ surface: 'standalone', tabId: 1 }));
    const survivor = track(createWriterElection({ surface: 'sidepanel', tabId: 2 }));
    expect(await source.elect()).toMatchObject({ kind: 'primary' });
    expect(await survivor.elect()).toMatchObject({ kind: 'secondary' });

    source.stop();
    await flushMicrotasks();

    // The closed surface released the record; the survivor promotes itself.
    expect(record()).toBeUndefined();
    expect(await survivor.elect()).toEqual({ kind: 'primary', epoch: T0 });
    expect(record()).toEqual({ tabId: 2, surface: 'sidepanel', electedAt: T0 });
    expect(survivor.coordinationState()).toEqual({ state: 'solo', primarySurface: 'sidepanel' });
  });

  it('a failed handoff retains the existing writer', async () => {
    const writer = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));
    const target = track(createWriterElection({ surface: 'standalone', tabId: 2 }));
    expect(await writer.elect()).toMatchObject({ kind: 'primary' });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(await target.elect()).toMatchObject({ kind: 'secondary' });

    // The handoff never acknowledges: nothing releases authority, so the
    // original writer still passes the pre-write gate and the target does not.
    expect(await writer.assertStillPrimary()).toEqual({ ok: true });
    expect(await target.assertStillPrimary()).toEqual({
      ok: false,
      code: 'WORKSPACE_WRITER_REJECTED',
    });
    expect(record()?.surface).toBe('sidepanel');
  });

  it('a successful handoff changes authority only after persistence and acknowledgement', async () => {
    const writer = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));
    const target = track(createWriterElection({ surface: 'standalone', tabId: 2 }));
    expect(await writer.elect()).toMatchObject({ kind: 'primary' });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(await target.elect()).toMatchObject({ kind: 'secondary' });

    // (1) Persistence: the writer may write authoritatively; the mirroring
    // surface may not — its pre-write gate rejects before anything lands.
    expect(await writer.assertStillPrimary()).toEqual({ ok: true });
    expect(await target.assertStillPrimary()).toEqual({
      ok: false,
      code: 'WORKSPACE_WRITER_REJECTED',
    });

    // (2) Acknowledgement: the source releases authority.
    writer.stop();
    await flushMicrotasks();

    // (3) Only now does authority move — and only to the acknowledged target.
    expect(await target.elect()).toEqual({ kind: 'primary', epoch: T0 + HEARTBEAT_MS });
    expect(record()?.surface).toBe('standalone');
  });
});

describe('WriterElection — the canonical projection and module hygiene', () => {
  it('projects exactly the five §20.11 states and invents no sixth', async () => {
    const expectedKeys: Record<string, string[]> = {
      'election-in-progress': ['startedAt', 'state'],
      solo: ['primarySurface', 'state'],
      primary: ['secondaries', 'state', 'surface'],
      secondary: ['isMirroring', 'primarySurface', 'state'],
      error: ['code', 'message', 'state'],
    };
    const seen = new Set<string>();

    const record1 = (state: { state: string }): void => {
      seen.add(state.state);
      expect(Object.keys(state).sort()).toEqual(expectedKeys[state.state]);
    };

    const fresh = track(createWriterElection({ surface: 'sidepanel', tabId: 1 }));
    record1(fresh.coordinationState() as { state: string });

    const solo = track(createWriterElection({ surface: 'sidepanel', tabId: 2 }));
    await solo.elect();
    record1(solo.coordinationState() as { state: string });

    sessionMap().set(PRIMARY_RECORD_KEY, { tabId: 42, surface: 'standalone', electedAt: T0 - 1 });
    const secondary = track(createWriterElection({ surface: 'sidepanel', tabId: 3 }));
    await secondary.elect();
    record1(secondary.coordinationState() as { state: string });

    const errored = track(
      createWriterElection({ surface: 'sidepanel', tabId: 4, sessionStorage: null }),
    );
    await errored.elect();
    record1(errored.coordinationState() as { state: string });

    sessionMap().clear();
    const winner = track(createWriterElection({ surface: 'sidepanel', tabId: 5 }));
    const standalone = track(createWriterElection({ surface: 'standalone', tabId: 6 }));
    await winner.elect();
    await standalone.elect();
    record1(standalone.coordinationState() as { state: string });

    expect([...seen].sort()).toEqual([
      'election-in-progress',
      'error',
      'primary',
      'secondary',
      'solo',
    ]);
  });

  it('the module writes the session area directly and imports no storage adapter', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/core/workspace/WriterElection.ts'),
      'utf8',
    );

    // No import of, and no call into, the debounced adapter (the module comment
    // names it only to record the divergence).
    expect(source).not.toMatch(/from\s+['"][^'"]*chromeStorageAdapter['"]/);
    expect(source).not.toMatch(/from\s+['"]\.\.\/theme\//);
    expect(source).not.toMatch(/chromeStorageAdapter\s*[.(]/);
    expect(source).toMatch(/chrome\??\.storage\??\.session/);
  });
});
