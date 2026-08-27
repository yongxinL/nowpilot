import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import type { ILLMProvider, LLMStreamRequest } from '../../../src/core/ai/ILLMProvider';
import type { StreamEvent } from '../../../src/core/ai/types';
import * as AgentOrchestrator from '../../../src/core/ai/AgentOrchestrator';
import * as aiProvider from '../../../src/services/aiProvider';
import * as WriteJournal from '../../../src/core/storage/WriteJournal';
import { ProviderRegistry, __test__ as registryTest } from '../../../src/core/ai/ProviderRegistry';
import { __test__ as routerTest } from '../../../src/core/ai/ProviderRouter';
import { __test__ as adapterTest } from '../../../src/core/theme/chromeStorageAdapter';
import { useUserPreferencesStore } from '../../../src/core/ai/UserPreferences';
import { useExtensionStore } from '../../../src/store/useExtensionStore';
import { useChatStreaming } from '../../../src/components/chat/useChatStreaming';
import { openChatHistoryDB } from '../../../src/core/storage/ChatHistoryDB';
import { openWriteJournalDB } from '../../../src/core/storage/WriteJournalDB';
import { flushPendingWrites } from '../../../src/core/theme/chromeStorageAdapter';
import { FixtureProvider } from './fixtures/FixtureProvider';
import { OPENAI_ANSWER_STREAM } from './fixtures/openai-stream';
import type { WriteJournalEntry } from '../../../src/types/storage';

/**
 * chat-integration test (plan 03-07, Task 2) — production chat runs the
 * Planner → Executor → Renderer pipeline through AgentOrchestrator (D-44),
 * persists the completed turn once at turn end via the journaled
 * 'append-chat-turn' op (D-45), drops the partial on abort, and performs
 * ZERO per-chunk storage writes (P2 write-rate, T-3-22).
 *
 * The hook is rendered REAL (renderHook + AntdApp wrapper for the antd
 * message API); the pipeline stages are REAL; the provider is a D-48
 * fixture registered into ProviderRegistry with UserPreferences persisted
 * (D-54). The legacy streamChatResponse path is spied to prove it is not
 * invoked (grep-assertable call-site removal).
 *
 * Case groups: (a) pipeline path used · (b) persist once at turn end ·
 * (c) abort drops the partial · (d) zero per-chunk storage writes.
 */

const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;
const sessionMap = (globalThis as any).__chromeSessionMap as Map<string, string>;
const chromeStorageLocal = (globalThis as any).__chromeStorageLocal;

const ANSWER_TEXT = 'Hello world — relayed verbatim by the renderer.';

/** Disk shape for the chat tests — a single enabled openai provider. */
const seedDisk = {
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: true,
      enabled: true,
      models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true }],
    },
  },
};

/** Seed the module-level environment the hook + pipeline consume. */
async function seedEnv(provider: ILLMProvider): Promise<void> {
  storageMap.clear();
  sessionMap.clear();
  adapterTest.resetPendingState();
  registryTest.reset();
  routerTest.resetBreaker();
  useUserPreferencesStore.setState({
    fastModel: 'gpt-4o-mini',
    balancedModel: 'gpt-4o-mini',
    personaOverrides: undefined,
  });
  storageMap.set('np_providers', JSON.stringify(seedDisk));
  await ProviderRegistry.hydrate();
  ProviderRegistry.registerProvider(provider);
  registryTest.seedCachedModels('openai', ['gpt-4o-mini']);
  useExtensionStore.setState({
    sessions: [],
    activeSessionId: '',
    activeSession: null,
    activeAttachments: [],
  });
}

/** D-48 fixture whose planner answers and whose renderer streams the answer. */
function answerFixture(): FixtureProvider {
  return new FixtureProvider([OPENAI_ANSWER_STREAM], {
    streamScript: [
      { kind: 'delta', delta: ANSWER_TEXT },
      { kind: 'complete', fullText: ANSWER_TEXT },
    ],
  });
}

/** D-48 fixture provider whose stream stalls mid-answer until the caller aborts. */
class StallStreamProvider implements ILLMProvider {
  readonly providerId = 'openai' as const;
  constructor(private readonly inner: FixtureProvider) {}
  stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const { operationId } = request;
    return (async function* () {
      yield { type: 'STREAM_START', operationId };
      yield { type: 'STREAM_DELTA', operationId, delta: 'partial answer ' };
      await new Promise((r) => setTimeout(r, 80));
      if (signal?.aborted) return;
      yield { type: 'STREAM_COMPLETE', operationId, fullText: 'partial answer unreachable' };
    })();
  }
  async requestJson(prompt: string, jsonSchema: unknown, signal?: AbortSignal): Promise<string> {
    return this.inner.requestJson(prompt, jsonSchema, signal);
  }
}

/** antd App provider — useChatStreaming uses App.useApp() for toasts. */
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AntdApp, null, children);

describe('chat-integration — useChatStreaming → AgentOrchestrator (D-44/D-45)', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    storageMap.clear();
    sessionMap.clear();
    adapterTest.resetPendingState();
    registryTest.reset();
    routerTest.resetBreaker();
    useUserPreferencesStore.setState({
      fastModel: undefined,
      balancedModel: undefined,
      personaOverrides: undefined,
    });
    await flushPendingWrites();
    chromeStorageLocal.set.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('(a) handleSend routes through runAgentTurn — the legacy streaming path is NOT invoked, the answer renders from the pipeline', async () => {
    const fixture = answerFixture();
    await seedEnv(fixture);
    const runSpy = vi.spyOn(AgentOrchestrator, 'runAgentTurn');
    const legacySpy = vi.spyOn(aiProvider, 'streamChatResponse');

    const { result } = renderHook(() => useChatStreaming(), { wrapper });

    await act(async () => {
      await result.current.handleSend('Help me fix this incident.');
    });

    // The legacy proxy-coupled path is retired for production chat (D-44/D-12).
    expect(legacySpy).not.toHaveBeenCalled();

    // runAgentTurn was the path, with the D-44 contract.
    expect(runSpy).toHaveBeenCalledTimes(1);
    const args = runSpy.mock.calls[0][0];
    expect(args.userInput).toBe('Help me fix this incident.');
    expect(args.sessionId).toBeTruthy();
    expect(args.operationId).toBeTruthy();
    expect(args.tier).toEqual({ plannerCap: 3, toolCap: 2, modelTier: 'balanced' });
    expect(typeof args.persistTurn).toBe('function');
    expect(args.abortSignal).toBeTruthy();

    // The pipeline's answer rendered into the assistant message (Planner →
    // Renderer both fired on an ordinary chat turn).
    const session = useExtensionStore.getState().activeSession;
    const assistant = session?.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toContain(ANSWER_TEXT);
    expect(assistant?.isThinking).toBe(false);

    // Appendix J.2 np_active_stream lifecycle: written at start, cleared in finally.
    expect(sessionMap.get('np_active_stream')).toBeUndefined();
  });

  it('(b) persistTurn runs the journaled append-chat-turn ONCE at turn end — the pair lands in ChatHistoryDB and the entry completes', async () => {
    const fixture = answerFixture();
    await seedEnv(fixture);
    const journalSpy = vi.spyOn(WriteJournal, 'runJournaled');

    const { result } = renderHook(() => useChatStreaming(), { wrapper });

    await act(async () => {
      await result.current.handleSend('Help me fix this incident.');
    });

    // The D-45 persist seam fired exactly once (never per delta).
    expect(journalSpy).toHaveBeenCalledTimes(1);
    const entry = journalSpy.mock.calls[0][0] as WriteJournalEntry;
    expect(entry.operation).toBe('append-chat-turn');

    // The completed pair persisted into the ChatHistoryDB messages store.
    const db = await openChatHistoryDB();
    const all = await db.getAll('messages');
    db.close();
    expect(all).toHaveLength(2);
    const user = all.find((m) => m.role === 'user');
    const assistant = all.find((m) => m.role === 'assistant');
    expect(user?.content).toBe('Help me fix this incident.');
    expect(assistant?.content).toBe(ANSWER_TEXT);
    expect(user?.sessionId).toBeTruthy();
    expect(assistant?.sessionId).toBe(user?.sessionId);

    // The journal entry reached 'completed' with the registered step applied.
    const jdb = await openWriteJournalDB();
    const persisted = await jdb.get('entries', entry.id);
    jdb.close();
    expect(persisted?.status).toBe('completed');
    expect(persisted?.steps.map((s) => s.name)).toEqual(['append-chat-turn']);
  });

  it('(c) abort mid-stream drops the partial — nothing persisted', async () => {
    const fixture = answerFixture();
    await seedEnv(new StallStreamProvider(fixture));
    const journalSpy = vi.spyOn(WriteJournal, 'runJournaled');

    const { result } = renderHook(() => useChatStreaming(), { wrapper });

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.handleSend('Help me fix this incident.');
    });
    // Land mid-render: the stall is 80 ms after the first delta; abort at ~30 ms.
    await new Promise((r) => setTimeout(r, 30));
    act(() => {
      result.current.handleStopGenerating();
    });
    await act(async () => {
      await sendPromise;
    });

    // D-45: abort drops the partial — the persist seam never fired.
    expect(journalSpy).not.toHaveBeenCalled();
    const db = await openChatHistoryDB();
    const all = await db.getAll('messages');
    db.close();
    expect(all).toHaveLength(0);
    const jdb = await openWriteJournalDB();
    const entries = await jdb.getAll('entries');
    jdb.close();
    expect(entries).toHaveLength(0);

    // The in-memory placeholder carries the stopped note, not partial text.
    const session = useExtensionStore.getState().activeSession;
    const assistant = session?.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).not.toContain('partial answer');
    expect(assistant?.content).toContain('Generation stopped');
    expect(useExtensionStore.getState().config).toBeDefined();
  });

  it('(d) zero per-chunk storage writes — the stream performs no chrome.storage.local writes (P2/D-45)', async () => {
    const fixture = answerFixture();
    await seedEnv(fixture);

    const { result } = renderHook(() => useChatStreaming(), { wrapper });

    // Reset the mock counter right before the turn.
    chromeStorageLocal.set.mockClear();

    await act(async () => {
      await result.current.handleSend('Help me fix this incident.');
    });

    // The happy-path pipeline resolves on microtasks (fixture streams carry no
    // timers), so the debounced adapter never flushed — no chrome.storage.local
    // write occurred during the entire turn. Mid-stream chunks live in memory +
    // ChunkBuffer only (D-45, T-3-22); the ONLY persistence is the turn-end
    // journaled append into IndexedDB (case b).
    expect(chromeStorageLocal.set).not.toHaveBeenCalled();
  });
});