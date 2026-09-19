import { StandaloneRouteIdSchema, type StandaloneRouteId } from '../registry/standaloneRoutes';
import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import type { StorageKey } from '../storage/storageKeys';
import { StandaloneTabRecordSchema, type StandaloneTabRecord } from '../workspace/workspaceTypes';
import type { BroadcastBus } from './BroadcastBus';
import { createOperationId } from './OperationId';
import type { RuntimeEnvelope } from './RuntimeEnvelope';
import type { WorkspaceWriterSurface } from './RuntimeSurface';

export interface StandaloneNavigationOpenRequest {
  kind: 'open';
  destination: StandaloneRouteId;
}

export interface StandaloneNavigationFocusRequest {
  kind: 'focus';
  destination: StandaloneRouteId;
}

export type StandaloneNavigationRequest =
  StandaloneNavigationOpenRequest | StandaloneNavigationFocusRequest;

function createNavigationEnvelope(
  type: 'standalone.open' | 'standalone.focus',
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface | 'background',
): RuntimeEnvelope {
  const parsedDestination = StandaloneRouteIdSchema.parse(destination);
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type,
    source,
    target: type === 'standalone.open' ? 'background' : 'standalone',
    timestamp: Date.now(),
    payload: { destination: parsedDestination },
  };
}

export function createStandaloneOpenEnvelope(
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return createNavigationEnvelope('standalone.open', destination, source);
}

export function createStandaloneFocusEnvelope(
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface | 'background',
): RuntimeEnvelope {
  return createNavigationEnvelope('standalone.focus', destination, source);
}

export function readStandaloneNavigationRequest(
  envelope: RuntimeEnvelope,
): StandaloneNavigationRequest | undefined {
  if (envelope.type === 'standalone.open') {
    return { kind: 'open', destination: envelope.payload.destination };
  }
  if (envelope.type === 'standalone.focus') {
    return { kind: 'focus', destination: envelope.payload.destination };
  }
  return undefined;
}

export async function openStandalone(
  destination: StandaloneRouteId,
  surface: WorkspaceWriterSurface,
  bus: Pick<BroadcastBus, 'send'>,
): Promise<void> {
  await bus.send(createStandaloneOpenEnvelope(destination, surface));
}

export async function focusStandalone(
  destination: StandaloneRouteId,
  surface: WorkspaceWriterSurface | 'background',
  bus: Pick<BroadcastBus, 'send'>,
): Promise<void> {
  await bus.send(createStandaloneFocusEnvelope(destination, surface));
}

export interface StandaloneTabApi {
  get(tabId: number): Promise<{ id?: number }>;
  create(url: string): Promise<{ id?: number }>;
  update(tabId: number, props: { active: boolean }): Promise<unknown>;
  focusWindow(tabId: number): Promise<void>;
}

export interface StandaloneTabControllerDependencies {
  tabs: StandaloneTabApi;
  storage: ValidatedStorage;
  buildStandaloneUrl(destination: StandaloneRouteId): string;
  sendFocus(envelope: RuntimeEnvelope): Promise<void>;
  now(): number;
}

export type StandaloneOpenResult =
  | { status: 'created' | 'focused'; tabId: number }
  | { status: 'failed'; code: 'STANDALONE_OPEN_FAILED' | 'STANDALONE_TAB_INVALID' };

export interface StandaloneTabController {
  open(destination: StandaloneRouteId): Promise<StandaloneOpenResult>;
  handleTabRemoved(tabId: number): Promise<boolean>;
  readRecord(): Promise<StandaloneTabRecord | undefined>;
}

const STANDALONE_TAB_KEY: StorageKey = 'np_standalone_tab';

export function createStandaloneTabController(
  deps: StandaloneTabControllerDependencies,
): StandaloneTabController {
  async function readRecord(): Promise<StandaloneTabRecord | undefined> {
    const result = await deps.storage.read(STANDALONE_TAB_KEY, StandaloneTabRecordSchema);
    if (result.status === 'valid') return result.value;
    if (result.status === 'invalid') {
      debugLog(createErrorRecord('STANDALONE_TAB_INVALID', { reason: 'record' }));
    }
    return undefined;
  }

  return {
    readRecord,
    async open(destination) {
      const record = await readRecord();
      if (record) {
        let live = false;
        try {
          const tab = await deps.tabs.get(record.tabId);
          live = tab.id !== undefined;
        } catch {
          live = false;
        }
        if (live) {
          await deps.tabs.update(record.tabId, { active: true });
          await deps.tabs.focusWindow(record.tabId);
          await deps.sendFocus(createStandaloneFocusEnvelope(destination, 'background'));
          return { status: 'focused', tabId: record.tabId };
        }
        debugLog(createErrorRecord('STANDALONE_TAB_INVALID', { reason: 'stale' }));
        await deps.storage.remove(STANDALONE_TAB_KEY);
      }

      let created: { id?: number };
      try {
        created = await deps.tabs.create(deps.buildStandaloneUrl(destination));
      } catch {
        debugLog(createErrorRecord('STANDALONE_OPEN_FAILED', { reason: 'create' }));
        return { status: 'failed', code: 'STANDALONE_OPEN_FAILED' };
      }
      if (created.id === undefined) {
        debugLog(createErrorRecord('STANDALONE_OPEN_FAILED', { reason: 'missing-id' }));
        return { status: 'failed', code: 'STANDALONE_OPEN_FAILED' };
      }
      await deps.storage.write(STANDALONE_TAB_KEY, StandaloneTabRecordSchema, {
        tabId: created.id,
        openedAt: deps.now(),
      });
      return { status: 'created', tabId: created.id };
    },
    async handleTabRemoved(tabId) {
      const record = await readRecord();
      if (!record || record.tabId !== tabId) return false;
      await deps.storage.remove(STANDALONE_TAB_KEY);
      return true;
    },
  };
}
