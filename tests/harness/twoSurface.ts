import { vi } from 'vitest';
import { clearLogs, getRecentLogs } from '../../src/core/log/debugLog';
import {
  HANDOFF_DRAFT_MAX_CHARS,
  buildHandoffUrl,
  createHandoffTarget,
  parseHandoffUrl,
  type HandoffBootstrap,
  type HandoffEnvelope,
  type HandoffOpenTargetArgs,
  type HandoffSurface,
  type HandoffTarget,
  type HandoffTransport,
  type Phase1HandoffProjection,
} from '../../src/core/workspace/handoff/protocol';
import { useHandoffComposerDraftStore } from '../../src/core/workspace/handoff/composerDraft';
import {
  HEARTBEAT_MS,
  createWriterElection,
  type ElectionOutcome,
  type PrimaryRecordStorageArea,
  type StillPrimaryResult,
  type WriterElection,
} from '../../src/core/workspace/WriterElection';
import {
  createInitialWriterProjection,
  projectWriterSignal,
  type WriterElectionSignal,
  type WriterProjection,
} from '../../src/core/workspace/WorkspaceStore';
import {
  createInitialWorkspaceState,
  type WorkspaceState,
} from '../../src/core/workspace/WorkspaceState';
import { WORKSPACE_STORAGE_KEY, readWorkspaceState } from '../../src/core/workspace/WorkspacePersistence';
import { STORAGE_DEBOUNCE_MS, flushPendingWrites } from '../../src/core/theme/chromeStorageAdapter';
import { __test__ as nowPilotDbTest, closeDb, getDb } from '../../src/core/storage/NowPilotDB';
import {
  readAllConversations,
  readConversation,
  writeConversationWithMessages,
  type ChatSessionRecord,
  type MessageRecord,
} from '../../src/core/storage/ChatHistoryDB';
import { listErrors, recordError, type RecordErrorInput } from '../../src/core/storage/ErrorStore';
import type { WriteJournalEntry } from '../../src/core/storage/WriteJournal';

/**
 * The shared two-surface harness (D2-30, plan 02-11).
 *
 * ## The mock-only-environmental rule (binding)
 *
 * Production behaviour is never mocked here. The harness constructs the real
 * `createHandoffInitiator` / `createHandoffTarget` state machines through their
 * injectable `transport` seam, the real `validateHandoffEnvelope` /
 * `parseHandoffUrl` / `buildHandoffUrl` contracts, the real `WriterElection`,
 * the real `WorkspacePersistence` read path, the real `ChatHistoryDB`,
 * `ErrorStore` and `WriteJournal` repositories, and the real pure writer
 * projection (`projectWriterSignal`). It duplicates no election, persistence,
 * migration or handoff decision.
 *
 * The only boundaries faked — D2-30's exhaustive list — are environmental:
 *
 * | Boundary | The fake |
 * |---|---|
 * | Chrome tabs / focus | the in-memory `HarnessTabs` registry (query → focus/re-point vs create) |
 * | Side Panel APIs + browser lifecycle | `reload()` / `restartSurface()` and `crashDuring()` |
 * | `BroadcastChannel` transport | `createLoopbackTransport()` — the shipped bus cannot deliver an in-process cross-surface message (module-level `INSTANCE_ID` + own-echo suppression, RESEARCH Pitfall 6) |
 * | `chrome.storage` | the Map-backed local/session areas installed by `tests/setup.ts` |
 * | IndexedDB reset / failure injection | `__resetIndexedDB()` + `NowPilotDB.__test__` |
 * | Time | the installed fake timers plus this clock seam (`now`, `advanceMs`, `advanceHeartbeat`, `advanceDebounce`) |
 * | Credential store | `createSyntheticCredentialStore()` — synthetic sentinels only, never the vault |
 *
 * The harness is **not** a test file: it matches no Vitest glob
 * (`twoSurface.ts`) and is imported by both integration suites.
 */

/** The synthetic credential the suites plant and then assert absent everywhere. */
export const SYNTHETIC_CREDENTIAL_SENTINEL = 'sk-synthetic-DO-NOT-LEAK-XYZ123';

const SYNTHETIC_CREDENTIAL_PREFIX = 'sk-synthetic-';

/** The handoff stages a crash can be injected between (D2-31 clause 18). */
export type HandoffCrashStage = 'ready' | 'transfer' | 'ack';

const CRASH_STAGE_TYPES: Record<HandoffCrashStage, HandoffEnvelope['type']> = {
  ready: 'HANDOFF_READY',
  transfer: 'WORKSPACE_HANDOFF',
  ack: 'HANDOFF_ACK',
};

/** The canonical workspace-state-only field names — a broadcast must never carry them. */
export const WORKSPACE_STATE_ONLY_FIELDS = [
  'pinnedTabs',
  'currentPageContext',
  'selectedNotes',
  'activeAddonContext',
  'activeSkillRun',
  'openedStandaloneTabId',
] as const;

/* -------------------------------------------------------------------------- */
/* Deterministic primitives                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A bounded microtask flush — the D2-35 replacement for an arbitrary sleep.
 * Promise resolution is not faked by the fake timers, so this is deterministic.
 */
export async function flush(turns = 8): Promise<void> {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

interface PublishedSpy {
  mock: { calls: unknown[][] };
}

/**
 * Collect every published envelope of `type` from a `vi.spyOn` on a transport
 * `publish` (or on `BroadcastBus.publish` — the payload is then the second call
 * argument). The harness transport records its own outbox too, so a case can
 * assert either way.
 */
export function publishedOf(spy: PublishedSpy, type: HandoffEnvelope['type']): HandoffEnvelope[] {
  const found: HandoffEnvelope[] = [];
  for (const call of spy.mock.calls) {
    for (const argument of call) {
      if (
        typeof argument === 'object' &&
        argument !== null &&
        (argument as { type?: unknown }).type === type
      ) {
        found.push(argument as HandoffEnvelope);
      }
    }
  }
  return found;
}

export interface LoopbackTransport extends HandoffTransport {
  /** Every envelope that actually left the channel, in order. */
  published(): readonly HandoffEnvelope[];
  /** Forget the outbox and any armed crash. */
  reset(): void;
  /** Drop the next envelope of `type` — a crash between handoff stages. */
  dropNext(type: HandoffEnvelope['type']): void;
  /** Disarm every pending drop. */
  clearDrops(): void;
  subscriberCount(): number;
}

/**
 * The deterministic transport (D2-30). `publish` records the envelope and
 * delivers a clone to every current subscriber on a **queued microtask** — the
 * real `BroadcastChannel` delivery is a queued task, and a synchronous
 * delivery would close the acknowledgement window before the sender opened it
 * (the shipped bus has module-level `INSTANCE_ID` + own-echo suppression, so it
 * cannot deliver an in-process cross-surface message at all: RESEARCH Pitfall 6).
 */
export function createLoopbackTransport(): LoopbackTransport {
  const listeners = new Set<(value: unknown) => void>();
  const outbox: HandoffEnvelope[] = [];
  const dropped = new Set<HandoffEnvelope['type']>();

  return {
    publish(envelope) {
      if (dropped.has(envelope.type)) {
        dropped.delete(envelope.type);
        return; // the publishing document died before the message left it
      }
      outbox.push(structuredClone(envelope));
      const delivered = structuredClone(envelope);
      queueMicrotask(() => {
        for (const listener of [...listeners]) listener(structuredClone(delivered));
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    published: () => outbox,
    reset: () => {
      outbox.length = 0;
      dropped.clear();
    },
    dropNext: (type) => {
      dropped.add(type);
    },
    clearDrops: () => {
      dropped.clear();
    },
    subscriberCount: () => listeners.size,
  };
}

export interface SyntheticCredentialStore {
  readonly kind: 'synthetic';
  readonly sentinel: string;
  /** Store the synthetic sentinel. A non-synthetic value is refused. */
  store(value: string): void;
  read(): string | null;
  clear(): void;
  isInitialised(): boolean;
}

/**
 * The synthetic-only credential stand-in (D2-30). It is not the vault: it holds
 * one synthetic sentinel so a suite can prove the handoff payload cannot carry
 * a credential, and it refuses any value that is not synthetic. Suite A never
 * initialises the real KeyVault (D2-33).
 */
export function createSyntheticCredentialStore(
  sentinel: string = SYNTHETIC_CREDENTIAL_SENTINEL,
): SyntheticCredentialStore {
  let stored: string | null = null;
  return {
    kind: 'synthetic',
    sentinel,
    store(value) {
      if (!value.startsWith(SYNTHETIC_CREDENTIAL_PREFIX)) {
        throw new Error('The synthetic credential stand-in accepts synthetic values only');
      }
      stored = value;
    },
    read: () => stored,
    clear: () => {
      stored = null;
    },
    isInitialised: () => stored !== null,
  };
}

/* -------------------------------------------------------------------------- */
/* Chrome tabs / focus — the mocked environmental boundary                    */
/* -------------------------------------------------------------------------- */

export interface HarnessTab {
  id: number;
  windowId: number;
  url: string;
  active: boolean;
}

export interface HarnessTabs {
  list(): readonly HarnessTab[];
  query(urlPrefix: string): HarnessTab[];
  update(tabId: number, props: { url?: string; active?: boolean }): void;
  create(props: { url: string; windowId?: number }): HarnessTab;
  focused(): HarnessTab | null;
  blur(): void;
}

function createHarnessTabs(firstTabId: number): HarnessTabs {
  const tabs: HarnessTab[] = [];
  let nextId = firstTabId - 1;

  return {
    list: () => tabs,
    query: (urlPrefix) => tabs.filter((tab) => tab.url.startsWith(urlPrefix)),
    update(tabId, props) {
      const tab = tabs.find((candidate) => candidate.id === tabId);
      if (!tab) return;
      if (props.url !== undefined) tab.url = props.url;
      if (props.active !== undefined) {
        for (const other of tabs) other.active = false;
        tab.active = props.active;
      }
    },
    create({ url, windowId = 1 }) {
      const tab: HarnessTab = { id: (nextId += 1), windowId, url, active: true };
      for (const other of tabs) other.active = false;
      tabs.push(tab);
      return tab;
    },
    focused: () => tabs.find((tab) => tab.active) ?? null,
    blur: () => {
      for (const tab of tabs) tab.active = false;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Phase 2 database adapters                                                  */
/* -------------------------------------------------------------------------- */

export interface HarnessDatabase {
  /** A fresh IndexedDB factory plus a reset database module (per-test contract). */
  reset(): void;
  /** Close every handle this harness opened. */
  close(): void;
  journalEntries(): Promise<WriteJournalEntry[]>;
  writeConversation(
    session: ChatSessionRecord,
    messages: readonly MessageRecord[],
  ): ReturnType<typeof writeConversationWithMessages>;
  readConversation(sessionId: string): ReturnType<typeof readConversation>;
  readAllConversations(): ReturnType<typeof readAllConversations>;
  recordError(input: RecordErrorInput): ReturnType<typeof recordError>;
  listErrors(): ReturnType<typeof listErrors>;
}

export interface HarnessStorage {
  local(): Map<string, unknown>;
  session(): Map<string, unknown>;
  clear(): void;
  /** Land every debounced write now (the adapter's own flush hook). */
  flush(): Promise<void>;
  serialised(): string;
}

/* -------------------------------------------------------------------------- */
/* The surface runtime                                                        */
/* -------------------------------------------------------------------------- */

export interface HarnessSurface {
  readonly name: HandoffSurface;
  readonly tabId: number;
  /** The document's current URL, when it was loaded with a handoff bootstrap. */
  readonly url: string | null;
  /** The parsed bootstrap the document is running (real parser). */
  readonly bootstrap: HandoffBootstrap | null;
  /** This surface's own in-memory workspace projection (D-11 shape). */
  workspace(): WorkspaceState;
  /** This surface's own writer projection, built by the real pure projection. */
  writer(): WriterProjection;
  /** Apply one authoritative election signal (the 02-10 composition step). */
  applyElectionSignal(signal: WriterElectionSignal): WriterProjection;
  /** Elect and apply the outcome to this surface's projection. */
  elect(): Promise<ElectionOutcome>;
  startHeartbeat(): void;
  /** The pre-write authority gate; a rejection demotes this surface's projection. */
  assertStillPrimary(): Promise<StillPrimaryResult>;
  isAuthoritativeWriter(): boolean;
  /** The target controller, when the document is running a handoff bootstrap. */
  target(): HandoffTarget | null;
  appliedRequestIds(): readonly string[];
  appliedCount(): number;
  /** Re-read the durable workspace state (throw-free, real repository). */
  hydrateFromDurable(): Promise<void>;
  /** A document reload: rebuild in-memory state, same identity, same tab id. */
  reload(): Promise<HarnessSurface>;
  dispose(): void;
}

interface SurfaceContext {
  now(): number;
  transport: HandoffTransport;
  sessionArea: PrimaryRecordStorageArea;
}

export interface TwoSurfaceHarnessOptions {
  workspaceId?: string;
  conversationId?: string | null;
  route?: string | null;
  tabIds?: { sidepanel?: number; standalone?: number };
}

export interface TwoSurfaceHarness {
  readonly workspaceId: string;
  readonly conversationId: string | null;
  readonly route: string | null;
  readonly sidepanel: HarnessSurface;
  readonly standalone: HarnessSurface;
  readonly transport: LoopbackTransport;
  readonly tabs: HarnessTabs;
  readonly storage: HarnessStorage;
  readonly credentials: SyntheticCredentialStore;
  readonly db: HarnessDatabase;
  surface(name: HandoffSurface): HarnessSurface;
  now(): number;
  /** Advance the mocked clock and settle every timer/microtask it triggered. */
  advanceMs(ms: number): Promise<void>;
  /** Advance `beats` heartbeat intervals (never a hard-coded duration). */
  advanceHeartbeat(beats?: number): Promise<void>;
  /** Advance one debounce window so a pending chrome.storage write lands. */
  advanceDebounce(): Promise<void>;
  flush(): Promise<void>;
  /** The navigation adapter `createHandoffInitiator` takes (mocked Chrome tabs). */
  openTarget(args: HandoffOpenTargetArgs): Promise<void>;
  /** Load the Standalone document under a handoff request id (cold or warm). */
  bringUpStandalone(requestId: string): void;
  /** A document reload for one surface: in-memory state is rebuilt from durable storage. */
  restartSurface(name: HandoffSurface): Promise<HarnessSurface>;
  /** Crash the publishing document between two named handoff stages. */
  crashDuring(stage: HandoffCrashStage, run: () => Promise<void>): Promise<void>;
  /** The real consume-once composer draft slot. */
  draft(): string;
  logs(): ReturnType<typeof getRecentLogs>;
  dispose(): Promise<void>;
}

function chromeStorageLocalMap(): Map<string, unknown> {
  return (globalThis as unknown as { __chromeStorageMap: Map<string, unknown> }).__chromeStorageMap;
}

function chromeStorageSessionMap(): Map<string, unknown> {
  return (globalThis as unknown as { __chromeStorageSessionMap: Map<string, unknown> })
    .__chromeStorageSessionMap;
}

function resolveSessionArea(): PrimaryRecordStorageArea {
  const session = (globalThis as unknown as { chrome: typeof chrome }).chrome?.storage?.session;
  return session as unknown as PrimaryRecordStorageArea;
}

function initialWorkspaceState(
  name: HandoffSurface,
  workspaceId: string,
  conversationId: string | null,
  now: number,
): WorkspaceState {
  return {
    ...createInitialWorkspaceState(),
    workspaceId,
    conversationId,
    activeSurface: name,
    version: 0,
    updatedAt: now,
  };
}

/**
 * Build the shared two-surface harness. It installs the fake timers (the clock
 * seam is built on them), clears the shared storage maps, resets the IndexedDB
 * double, and returns two simulated surface runtimes plus the environmental
 * adapters. `dispose()` reverses all of it.
 */
export function createTwoSurfaceHarness(
  options: TwoSurfaceHarnessOptions = {},
): TwoSurfaceHarness {
  const workspaceId = options.workspaceId ?? 'ws-harness';
  const conversationId =
    options.conversationId === undefined ? 'conv-harness' : options.conversationId;
  const route = options.route === undefined ? 'chat' : options.route;
  const sidepanelTabId = options.tabIds?.sidepanel ?? 101;
  const standaloneTabId = options.tabIds?.standalone ?? 202;

  // Explicit `toFake`: microtasks and `queueMicrotask` stay real, so `flush()`
  // is deterministic and cannot hang behind a faked scheduler.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });

  chromeStorageLocalMap().clear();
  chromeStorageSessionMap().clear();
  clearLogs();
  nowPilotDbTest.reset();
  (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
  useHandoffComposerDraftStore.getState().setDraft('');

  const transport = createLoopbackTransport();
  // The registry's first tab carries the Standalone surface's stable identity,
  // so the document's tab id and the election's `tabId` are the same number.
  const tabs = createHarnessTabs(standaloneTabId);
  const credentials = createSyntheticCredentialStore();

  const now = (): number => Date.now();
  const context: SurfaceContext = { now, transport, sessionArea: resolveSessionArea() };

  /** Internal activation seam: a document loading a handoff bootstrap. */
  const activators: Partial<Record<HandoffSurface, (bootstrap: HandoffBootstrap, url: string) => void>> =
    {};

  const buildSurface = (name: HandoffSurface, tabId: number): HarnessSurface => {
    let workspace = initialWorkspaceState(name, workspaceId, conversationId, now());
    let writer = createInitialWriterProjection();
    let url: string | null = null;
    let bootstrap: HandoffBootstrap | null = null;
    let target: HandoffTarget | null = null;
    const applied = new Set<string>();
    let election: WriterElection = createWriterElection({
      surface: name,
      tabId,
      sessionStorage: context.sessionArea,
      now: context.now,
    });

    const applyProjection = (projection: Phase1HandoffProjection): void => {
      applied.add(projection.requestId);
      workspace = {
        ...workspace,
        workspaceId: projection.workspaceId,
        conversationId: projection.conversationId,
        activeSurface: name,
        version: workspace.version + 1,
        updatedAt: now(),
      };
      // The production consume-once slot (WR-07/WR-09), re-bounded at the
      // consumption boundary exactly as `hydrateFromURL` does.
      useHandoffComposerDraftStore
        .getState()
        .setDraft(projection.composerDraft.slice(0, HANDOFF_DRAFT_MAX_CHARS));
    };

    const activateTarget = (nextBootstrap: HandoffBootstrap, nextUrl: string): void => {
      target?.dispose();
      bootstrap = nextBootstrap;
      url = nextUrl;
      target = createHandoffTarget({
        bootstrap: nextBootstrap,
        apply: applyProjection,
        transport,
      });
      target.start();
    };
    activators[name] = activateTarget;

    const applyElectionSignal = (signal: WriterElectionSignal): WriterProjection => {
      writer = projectWriterSignal(signal, writer);
      return writer;
    };

    const surface: HarnessSurface = {
      name,
      tabId,
      get url() {
        return url;
      },
      get bootstrap() {
        return bootstrap;
      },
      workspace: () => workspace,
      writer: () => writer,
      applyElectionSignal,
      async elect() {
        const outcome = await election.elect();
        applyElectionSignal(outcome);
        return outcome;
      },
      startHeartbeat: () => election.startHeartbeat(),
      async assertStillPrimary() {
        const result = await election.assertStillPrimary();
        // The surface projects the election's authoritative state: a rejection
        // demotes it, exactly as 02-10 applies `coordinationState()`.
        if (!result.ok) applyElectionSignal(election.coordinationState());
        return result;
      },
      isAuthoritativeWriter: () => writer.writerState === 'primary',
      target: () => target,
      appliedRequestIds: () => [...applied],
      appliedCount: () => applied.size,
      async hydrateFromDurable() {
        const result = await readWorkspaceState();
        if (!result.ok) return;
        // Nothing durable yet: keep this surface's stable harness identity.
        if (!chromeStorageLocalMap().has(WORKSPACE_STORAGE_KEY) && result.value.version === 0) {
          return;
        }
        workspace = { ...result.value, activeSurface: name };
      },
      async reload() {
        // A document reload: the in-memory projections are rebuilt, the durable
        // stores are untouched, and the identity (surface + tab id) is
        // unchanged. The previous election instance is stopped gracefully.
        target?.dispose();
        target = null;
        election.stop();
        writer = createInitialWriterProjection();
        workspace = initialWorkspaceState(name, workspaceId, conversationId, now());
        await surface.hydrateFromDurable();
        election = createWriterElection({
          surface: name,
          tabId,
          sessionStorage: context.sessionArea,
          now: context.now,
        });
        if (name === 'standalone' && url !== null && bootstrap !== null) {
          activateTarget(bootstrap, url);
        }
        return surface;
      },
      dispose() {
        target?.dispose();
        target = null;
        election.stop();
      },
    };

    return surface;
  };

  const sidepanel = buildSurface('sidepanel', sidepanelTabId);
  const standalone = buildSurface('standalone', standaloneTabId);
  const surfaces: Record<HandoffSurface, HarnessSurface> = { sidepanel, standalone };

  const storage: HarnessStorage = {
    local: () => chromeStorageLocalMap(),
    session: () => chromeStorageSessionMap(),
    clear() {
      chromeStorageLocalMap().clear();
      chromeStorageSessionMap().clear();
    },
    flush: () => flushPendingWrites(),
    serialised: () =>
      JSON.stringify({
        local: [...chromeStorageLocalMap().entries()],
        session: [...chromeStorageSessionMap().entries()],
      }),
  };

  const db: HarnessDatabase = {
    reset() {
      nowPilotDbTest.reset();
      (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
    },
    close: () => closeDb(),
    journalEntries: async () => {
      const database = await getDb();
      return database.getAll('entries');
    },
    writeConversation: (session, messages) => writeConversationWithMessages(session, messages),
    readConversation: (sessionId) => readConversation(sessionId),
    readAllConversations: () => readAllConversations(),
    recordError: (input) => recordError(input),
    listErrors: () => listErrors(),
  };

  /** Load the Standalone document from a built bootstrap URL (real parser). */
  const loadStandaloneUrl = (nextUrl: string): void => {
    const parsed = parseHandoffUrl(nextUrl);
    if (!parsed.ok || parsed.value === null) return;
    activators.standalone?.(parsed.value, nextUrl);
  };

  const bringUpStandalone = (requestId: string): void => {
    loadStandaloneUrl(
      buildHandoffUrl({
        workspaceId,
        requestId,
        conversationId,
        route,
        sourceSurface: 'sidepanel',
        targetSurface: 'standalone',
      }),
    );
  };

  const openTarget = async (args: HandoffOpenTargetArgs): Promise<void> => {
    const url = buildHandoffUrl({
      workspaceId: args.workspaceId,
      requestId: args.requestId,
      conversationId,
      route: args.page,
      sourceSurface: 'sidepanel',
      targetSurface: 'standalone',
    });

    const existing = tabs.query('standalone.html')[0];
    if (existing) {
      // Warm path: the same tab is focused and re-pointed at this attempt's
      // bootstrap (BroadcastBus has no replay, so a stale tab can never answer
      // a new request id).
      tabs.update(existing.id, { url, active: true });
    } else {
      tabs.create({ url });
    }
    loadStandaloneUrl(url);
  };

  const restartSurface = async (name: HandoffSurface): Promise<HarnessSurface> =>
    surfaces[name].reload();

  const crashDuring = async (stage: HandoffCrashStage, run: () => Promise<void>): Promise<void> => {
    transport.dropNext(CRASH_STAGE_TYPES[stage]);
    try {
      await run();
    } finally {
      transport.clearDrops();
    }
  };

  const dispose = async (): Promise<void> => {
    sidepanel.dispose();
    standalone.dispose();
    transport.reset();
    db.close();
    storage.clear();
    useHandoffComposerDraftStore.getState().setDraft('');
    clearLogs();
    credentials.clear();
    vi.useRealTimers();
  };

  return {
    workspaceId,
    conversationId,
    route,
    sidepanel,
    standalone,
    transport,
    tabs,
    storage,
    credentials,
    db,
    surface: (name) => surfaces[name],
    now,
    async advanceMs(ms) {
      await vi.advanceTimersByTimeAsync(ms);
      await flush();
    },
    async advanceHeartbeat(beats = 1) {
      await vi.advanceTimersByTimeAsync(beats * HEARTBEAT_MS);
      await flush();
    },
    async advanceDebounce() {
      await vi.advanceTimersByTimeAsync(STORAGE_DEBOUNCE_MS);
      await flush();
    },
    flush: () => flush(),
    openTarget,
    bringUpStandalone,
    restartSurface,
    crashDuring,
    draft: () => useHandoffComposerDraftStore.getState().draft,
    logs: () => getRecentLogs(200),
    dispose,
  };
}
