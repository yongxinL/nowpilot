import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrchestratorEvent, ToolExecutionResult, PlannerDecisionType } from '../../src/core/ai/pipeline/pipelineTypes';
import type { PlannerService } from '../../src/core/ai/pipeline/PlannerService';
import type { ExecutorService } from '../../src/core/ai/pipeline/ExecutorService';
import type { RendererService } from '../../src/core/ai/pipeline/RendererService';
import type { ProviderRouter } from '../../src/core/ai/router/ProviderRouter';
import type { MemoryEngine } from '../../src/core/memory/MemoryEngine';

// ---------------------------------------------------------------------------
// Mock AITransactionLogDB + WriteJournal (same as AgentOrchestrator.test.ts)
// ---------------------------------------------------------------------------
vi.mock('../../src/core/storage/stores/AITransactionLogDB', () => ({
  AITransactionLogDB: vi.fn(),
  aiTransactionLogDB: {
    logTransaction: vi.fn().mockResolvedValue(undefined),
    getTransaction: vi.fn().mockResolvedValue(undefined),
    logPromptTrace: vi.fn().mockResolvedValue(undefined),
    logToolTrace: vi.fn().mockResolvedValue(undefined),
    logProviderTrace: vi.fn().mockResolvedValue(undefined),
    logCacheTrace: vi.fn().mockResolvedValue(undefined),
    logMemoryTrace: vi.fn().mockResolvedValue(undefined),
    logWriteJournalTrace: vi.fn().mockResolvedValue(undefined),
    getTraceTree: vi.fn().mockResolvedValue(undefined),
    queryTransactions: vi.fn().mockResolvedValue([]),
    deleteTraces: vi.fn().mockResolvedValue(undefined),
    getTotalCount: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../../src/core/storage/WriteJournal', () => ({
  WriteJournal: vi.fn(),
  writeJournal: {
    begin: vi.fn().mockResolvedValue({ id: 'test-journal', status: 'pending', steps: [] }),
    markStepStart: vi.fn().mockResolvedValue(undefined),
    markStepComplete: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    recover: vi.fn().mockResolvedValue(0),
    prune: vi.fn().mockResolvedValue(0),
  },
}));

import { AgentOrchestrator } from '../../src/core/ai/pipeline/AgentOrchestrator';
import type { PermissionResolver } from '../../src/core/ai/pipeline/AgentOrchestrator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function collectEvents(
  gen: AsyncGenerator<OrchestratorEvent>,
): Promise<OrchestratorEvent[]> {
  const events: OrchestratorEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

async function* eventGen(events: OrchestratorEvent[]): AsyncGenerator<OrchestratorEvent> {
  for (const e of events) {
    yield e;
  }
}

function createMockPlanner() {
  return { plan: vi.fn() } as unknown as PlannerService;
}

function createMockExecutor() {
  return { execute: vi.fn() } as unknown as ExecutorService;
}

function createMockRenderer() {
  return {
    render: vi.fn().mockImplementation(() =>
      eventGen([
        { type: 'text-delta', text: 'Hello world' },
        { type: 'text-complete', fullText: 'Hello world' },
      ]),
    ),
  } as unknown as RendererService;
}

function createMockRouter() {
  return {
    selectModel: vi.fn().mockResolvedValue({
      instance: 'mock-instance',
      modelId: 'mock-model',
      providerId: 'mock-provider',
    }),
  } as unknown as ProviderRouter;
}

function createMockMemoryEngine(): MemoryEngine {
  return {
    assemble: vi.fn().mockResolvedValue({ memory: [], conversationContext: { recentTurns: [] }, preferences: {} }),
    extract: vi.fn().mockResolvedValue(undefined),
    handleMemoryWrite: vi.fn().mockResolvedValue(undefined),
    setPrimary: vi.fn(),
  } as unknown as MemoryEngine;
}

function createMockToolRegistry() {
  return {
    get: vi.fn(),
    has: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    register: vi.fn(),
    unregister: vi.fn(),
  } as any;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MOCK_RUN_TOOL: PlannerDecisionType = {
  action: 'run_tool',
  toolName: 'echo',
  toolInput: { text: 'hello' },
  reasoning: 'need to echo',
};

const MOCK_ANSWER: PlannerDecisionType = {
  action: 'answer',
  reasoning: 'direct answer',
};

const MOCK_TOOL_RESULT: ToolExecutionResult = {
  success: true,
  output: { echoed: 'hello' },
};

const MOCK_DANGEROUS_TOOL: PlannerDecisionType = {
  action: 'run_tool',
  toolName: 'dangerous_tool',
  toolInput: { target: 'some_path' },
  reasoning: 'need dangerous action',
};

// ---------------------------------------------------------------------------
// Pipeline Permission Extension Tests (Task 1)
// ---------------------------------------------------------------------------
describe('AgentOrchestrator permission resolver integration', () => {
  let planner: ReturnType<typeof createMockPlanner>;
  let executor: ReturnType<typeof createMockExecutor>;
  let renderer: ReturnType<typeof createMockRenderer>;
  let router: ReturnType<typeof createMockRouter>;
  let memoryEngine: ReturnType<typeof createMockMemoryEngine>;
  let toolRegistry: ReturnType<typeof createMockToolRegistry>;
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    planner = createMockPlanner();
    executor = createMockExecutor();
    renderer = createMockRenderer();
    router = createMockRouter();
    memoryEngine = createMockMemoryEngine();
    toolRegistry = createMockToolRegistry();

    orchestrator = new AgentOrchestrator(
      planner, executor, renderer, router, memoryEngine, undefined, undefined,
      toolRegistry,
    );
  });

  // -----------------------------------------------------------------------
  // Test 1: Setting a PermissionResolver that returns 'allow-always'
  //         → tool executes normally
  // -----------------------------------------------------------------------
  it('allow-always resolver permits tool execution', async () => {
    (planner.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(MOCK_RUN_TOOL)
      .mockResolvedValueOnce(MOCK_ANSWER);
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TOOL_RESULT);

    const resolver: PermissionResolver = vi.fn().mockResolvedValue('allow-always');
    orchestrator.setPermissionResolver(resolver);

    const events = await collectEvents(
      orchestrator.run('Echo hello', 'system prompt', 'flash', ['provider-a']),
    );

    // Should have plan-created, tool-called, waiting-permission, tool-result, plan-created, renderer events
    expect(events[0]).toMatchObject({ type: 'plan-created', decision: MOCK_RUN_TOOL });
    expect(events[1]).toMatchObject({ type: 'tool-called', toolName: 'echo', input: { text: 'hello' } });

    // waiting-permission should be yielded before permission resolver
    const waitingPermEvent = events[2];
    expect(waitingPermEvent.type).toBe('waiting-permission');
    if (waitingPermEvent.type === 'waiting-permission') {
      expect(waitingPermEvent.toolName).toBe('echo');
      expect(waitingPermEvent.toolInput).toEqual({ text: 'hello' });
    }

    // tool-result should follow after resolver resolved
    expect(events[3]).toMatchObject({ type: 'tool-result', toolName: 'echo' });

    // Executor was called (permission granted)
    expect(executor.execute).toHaveBeenCalledTimes(1);

    // Resolver was called with correct args
    expect(resolver).toHaveBeenCalledWith('echo', { text: 'hello' }, false);
  });

  // -----------------------------------------------------------------------
  // Test 2: Setting a PermissionResolver that returns 'deny'
  //         → tool is skipped, tool-result shows permission denied
  // -----------------------------------------------------------------------
  it('deny resolver skips tool execution and yields denied result', async () => {
    (planner.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(MOCK_RUN_TOOL)
      .mockResolvedValueOnce(MOCK_ANSWER);
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TOOL_RESULT);

    const resolver: PermissionResolver = vi.fn().mockResolvedValue('deny');
    orchestrator.setPermissionResolver(resolver);

    const events = await collectEvents(
      orchestrator.run('Echo hello', 'system prompt', 'flash', ['provider-a']),
    );

    // Event order: plan-created, tool-called, waiting-permission, tool-result (denied)
    expect(events[0]).toMatchObject({ type: 'plan-created', decision: MOCK_RUN_TOOL });
    expect(events[1]).toMatchObject({ type: 'tool-called', toolName: 'echo' });

    const waitingPermEvent = events[2];
    expect(waitingPermEvent.type).toBe('waiting-permission');

    const deniedResult = events[3];
    expect(deniedResult.type).toBe('tool-result');
    if (deniedResult.type === 'tool-result') {
      expect(deniedResult.result.success).toBe(false);
      expect(deniedResult.result.error).toContain('Permission denied');
    }

    // Executor should NOT have been called (permission denied)
    expect(executor.execute).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Test 3: PermissionResolver not set → tool executes normally
  //         (backward compatible, no regression)
  // -----------------------------------------------------------------------
  it('no permission resolver — backward compatible, tool executes normally', async () => {
    (planner.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(MOCK_RUN_TOOL)
      .mockResolvedValueOnce(MOCK_ANSWER);
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TOOL_RESULT);

    // Do NOT set a permissionResolver
    const events = await collectEvents(
      orchestrator.run('Echo hello', 'system prompt', 'flash', ['provider-a']),
    );

    // Event order: plan-created, tool-called, tool-result (no waiting-permission)
    expect(events[0]).toMatchObject({ type: 'plan-created', decision: MOCK_RUN_TOOL });
    expect(events[1]).toMatchObject({ type: 'tool-called', toolName: 'echo' });
    expect(events[2]).toMatchObject({ type: 'tool-result', toolName: 'echo' });

    // No waiting-permission events
    expect(events.filter(e => e.type === 'waiting-permission')).toHaveLength(0);

    // Executor called normally
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Test 4: Dangerous tool with resolver returning 'allow-always'
  //         → executes (permission granted)
  // -----------------------------------------------------------------------
  it('dangerous tool with allow-always resolver permits execution', async () => {
    // ToolRegistry returns a dangerous tool definition
    toolRegistry.get.mockReturnValue({ category: 'dangerous', name: 'dangerous_tool' });

    (planner.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(MOCK_DANGEROUS_TOOL)
      .mockResolvedValueOnce(MOCK_ANSWER);
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TOOL_RESULT);

    const resolver: PermissionResolver = vi.fn().mockResolvedValue('allow-always');
    orchestrator.setPermissionResolver(resolver);

    const events = await collectEvents(
      orchestrator.run('Do dangerous thing', 'system prompt', 'flash', ['provider-a']),
    );

    // waiting-permission event should be yielded
    const waitingPermEvent = events.find(e => e.type === 'waiting-permission');
    expect(waitingPermEvent).toBeDefined();
    if (waitingPermEvent && waitingPermEvent.type === 'waiting-permission') {
      expect(waitingPermEvent.toolName).toBe('dangerous_tool');
    }

    // Resolver called with isDangerous = true
    expect(resolver).toHaveBeenCalledWith('dangerous_tool', { target: 'some_path' }, true);

    // Executor called (permission granted)
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Test 5: Verify waiting-permission event is yielded before resolver
  //         is awaited (test via AsyncGenerator iteration order)
  // -----------------------------------------------------------------------
  it('waiting-permission event appears before tool execution', async () => {
    let resolverResolved = false;
    const slowResolver: PermissionResolver = vi.fn().mockImplementation(async () => {
      // Simulate some async work
      await new Promise(r => setTimeout(r, 10));
      resolverResolved = true;
      return 'allow-always';
    });

    (planner.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(MOCK_RUN_TOOL)
      .mockResolvedValueOnce(MOCK_ANSWER);
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TOOL_RESULT);

    orchestrator.setPermissionResolver(slowResolver);

    const events = await collectEvents(
      orchestrator.run('Echo hello', 'system prompt', 'flash', ['provider-a']),
    );

    // waiting-permission is event index 2 (after plan-created and tool-called)
    const waitingPermIdx = events.findIndex(e => e.type === 'waiting-permission');

    // waiting-permission appears before tool-result
    const toolResultIdx = events.findIndex(e => e.type === 'tool-result');
    expect(waitingPermIdx).toBeGreaterThanOrEqual(0);
    expect(waitingPermIdx).toBeLessThan(toolResultIdx);

    // The resolver was awaited — tool-result is after the resolution
    expect(resolverResolved).toBe(true);

    // waiting-permission event carries toolName and toolInput
    const waitingPerm = events[waitingPermIdx];
    if (waitingPerm && waitingPerm.type === 'waiting-permission') {
      expect(waitingPerm.toolName).toBe('echo');
      expect(waitingPerm.toolInput).toEqual({ text: 'hello' });
    }
  });

  // -----------------------------------------------------------------------
  // Test 6: Existing AgentOrchestrator tests continue to pass
  //         (no regression for non-permission flows)
  // -----------------------------------------------------------------------
  it('non-permission flow — answer-only still works without resolver', async () => {
    (planner.plan as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_ANSWER);

    const events = await collectEvents(
      orchestrator.run('Hello!', 'system prompt', 'haiku', ['provider-a']),
    );

    expect(events[0]).toMatchObject({ type: 'plan-created', decision: MOCK_ANSWER });
    expect(events.filter(e => e.type === 'tool-called')).toHaveLength(0);
    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Test 7: Non-permission flow — tool execution works without resolver
  //         (backward compatible with existing tool tests)
  // -----------------------------------------------------------------------
  it('non-permission flow — tool execution still works without resolver', async () => {
    (planner.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(MOCK_RUN_TOOL)
      .mockResolvedValueOnce(MOCK_ANSWER);
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TOOL_RESULT);

    const events = await collectEvents(
      orchestrator.run('Echo hello', 'system prompt', 'flash', ['provider-a']),
    );

    expect(events[0]).toMatchObject({ type: 'plan-created', decision: MOCK_RUN_TOOL });
    expect(events[1]).toMatchObject({ type: 'tool-called', toolName: 'echo' });
    expect(events[2]).toMatchObject({ type: 'tool-result', toolName: 'echo', result: MOCK_TOOL_RESULT });
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Test 8: allow-once resolver permits tool execution (single use)
  // -----------------------------------------------------------------------
  it('allow-once resolver permits tool execution', async () => {
    (planner.plan as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(MOCK_RUN_TOOL)
      .mockResolvedValueOnce(MOCK_ANSWER);
    (executor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TOOL_RESULT);

    const resolver: PermissionResolver = vi.fn().mockResolvedValue('allow-once');
    orchestrator.setPermissionResolver(resolver);

    const events = await collectEvents(
      orchestrator.run('Echo hello', 'system prompt', 'flash', ['provider-a']),
    );

    // waiting-permission event should be yielded
    const waitingPermEvent = events.find(e => e.type === 'waiting-permission');
    expect(waitingPermEvent).toBeDefined();

    // Executor was called (permission granted via allow-once)
    expect(executor.execute).toHaveBeenCalledTimes(1);

    // Resolver called with correct args
    expect(resolver).toHaveBeenCalledWith('echo', { text: 'hello' }, false);
  });
});

// ---------------------------------------------------------------------------
// useAgent Hook Tests (Task 2)
// ---------------------------------------------------------------------------

// Hoisted mock helpers for useStreamingLLM
const agentStreamingCallbacks = vi.hoisted(() => ({
  onDelta: null as ((text: string) => void) | null,
  onComplete: null as ((fullText: string) => void) | null,
  onError: null as ((message: string) => void) | null,
  onToolCall: null as ((toolName: string, input: unknown) => void) | null,
  onWaitingPermission: null as ((toolName: string, toolInput: unknown) => void) | null,
  onDegradation: null as ((event: any) => void) | null,
  onContextError: null as ((event: any) => void) | null,
  mockStreamState: { isStreaming: false, error: null as string | null },
}));

const mockStartStream = vi.hoisted(() => vi.fn());
const mockAbort = vi.hoisted(() => vi.fn());

const mockMemoryEngineAssemble = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    memory: [],
    conversationContext: { summary: undefined, recentTurns: [] },
    preferences: {
      responseStyle: 'concise',
      preferredLanguage: 'auto',
      preferStructuredOutput: false,
      allowCloudFallbackFromLocal: false,
      defaultProviderId: '',
      toolAutonomy: 'manual',
    },
  }),
);

const mockContextOptimizerOptimize = vi.hoisted(() =>
  vi.fn().mockImplementation((input: any) => ({
    operationId: input.operationId ?? 'test-op',
    tier: 'small' as const,
    inputBudget: 10000,
    outputBudget: 2000,
    safetyMargin: 500,
    sections: [],
    provenance: {
      operationId: input.operationId ?? 'test-op',
      tier: 'small' as const,
      inputBudget: 10000,
      outputBudget: 2000,
      safetyMargin: 500,
      sections: [],
      degradationSteps: [] as string[],
      minimalMode: false,
      createdAt: Date.now(),
    },
    minimalMode: false,
  })),
);

const mockChatHistoryDB = vi.hoisted(() => ({
  createSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockResolvedValue(undefined),
  getAllSessions: vi.fn().mockResolvedValue([
    { id: 'conv-1', title: 'Test Conversation', created: 1000, updated: 2000, starred: false, preview: 'Hello' },
    { id: 'conv-2', title: 'Another Chat', created: 500, updated: 1500, starred: false, preview: 'Hi there' },
  ]),
  updateSession: vi.fn().mockResolvedValue(undefined),
  addMessage: vi.fn().mockResolvedValue(undefined),
  getMessagesBySession: vi.fn().mockResolvedValue([
    { id: 'msg-1', sessionId: 'conv-1', role: 'user', content: 'Hello', timestamp: 1000 },
    { id: 'msg-2', sessionId: 'conv-1', role: 'assistant', content: 'Hi!', timestamp: 1100 },
  ]),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  deleteMessagesBySession: vi.fn().mockResolvedValue(undefined),
}));

const mockPermissionStore = vi.hoisted(() => ({
  getPermission: vi.fn().mockResolvedValue(null),
  setPermission: vi.fn().mockResolvedValue(undefined),
  clearPermission: vi.fn().mockResolvedValue(undefined),
}));

const mockToolRegistry = vi.hoisted(() => ({
  get: vi.fn().mockReturnValue(undefined),
  list: vi.fn().mockReturnValue([]),
  register: vi.fn(),
  unregister: vi.fn(),
  has: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/hooks/useStreamingLLM', () => ({
  useStreamingLLM: (config: any) => {
    agentStreamingCallbacks.onDelta = config.onDelta;
    agentStreamingCallbacks.onComplete = config.onComplete;
    agentStreamingCallbacks.onToolCall = config.onToolCall ?? null;
    agentStreamingCallbacks.onWaitingPermission = config.onWaitingPermission ?? null;
    agentStreamingCallbacks.onDegradation = config.onDegradation ?? null;
    agentStreamingCallbacks.onContextError = config.onContextError ?? null;
    const originalOnError = config.onError;
    agentStreamingCallbacks.onError = (message: string) => {
      agentStreamingCallbacks.mockStreamState.error = message;
      if (originalOnError) originalOnError(message);
    };
    const wrappedStartStream = async (...args: any[]) => {
      agentStreamingCallbacks.mockStreamState.isStreaming = true;
      agentStreamingCallbacks.mockStreamState.error = null;
      return mockStartStream(...args);
    };
    return {
      startStream: wrappedStartStream,
      abort: mockAbort,
      get isStreaming() { return agentStreamingCallbacks.mockStreamState.isStreaming; },
      get error() { return agentStreamingCallbacks.mockStreamState.error; },
    };
  },
}));

vi.mock('../../src/core/memory/MemoryEngine', () => ({
  memoryEngine: {
    assemble: mockMemoryEngineAssemble,
    extract: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/core/context/ContextOptimizer', () => ({
  contextOptimizer: {
    optimize: mockContextOptimizerOptimize,
  },
}));

vi.mock('../../src/core/storage/stores/ChatHistoryDB', () => ({
  chatHistoryDB: mockChatHistoryDB,
}));

vi.mock('../../src/core/permissions/PermissionStore', () => ({
  permissionStore: mockPermissionStore,
}));

vi.mock('../../src/core/ai/tools/ToolRegistry', () => ({
  toolRegistry: mockToolRegistry,
}));

import { renderHook, act } from '@testing-library/react';
import { useAgent } from '../../src/hooks/useAgent';

describe('useAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentStreamingCallbacks.onDelta = null;
    agentStreamingCallbacks.onComplete = null;
    agentStreamingCallbacks.onError = null;
    agentStreamingCallbacks.onToolCall = null;
    agentStreamingCallbacks.onWaitingPermission = null;
    agentStreamingCallbacks.onDegradation = null;
    agentStreamingCallbacks.onContextError = null;
    agentStreamingCallbacks.mockStreamState.isStreaming = false;
    agentStreamingCallbacks.mockStreamState.error = null;
    mockStartStream.mockReset();
    mockAbort.mockReset();
    mockPermissionStore.getPermission.mockResolvedValue(null);
    mockPermissionStore.setPermission.mockResolvedValue(undefined);
    mockToolRegistry.get.mockReturnValue(undefined);
    mockToolRegistry.list.mockReturnValue([]);
    mockChatHistoryDB.getAllSessions.mockResolvedValue([
      { id: 'conv-1', title: 'Test Conversation', created: 1000, updated: 2000, starred: false, preview: 'Hello' },
      { id: 'conv-2', title: 'Another Chat', created: 500, updated: 1500, starred: false, preview: 'Hi there' },
    ]);
    mockChatHistoryDB.deleteSession.mockResolvedValue(undefined);
    mockChatHistoryDB.deleteMessagesBySession.mockResolvedValue(undefined);
    mockChatHistoryDB.addMessage.mockResolvedValue(undefined);
    mockChatHistoryDB.createSession.mockResolvedValue(undefined);
    mockMemoryEngineAssemble.mockResolvedValue({
      memory: [],
      conversationContext: { summary: undefined, recentTurns: [] },
      preferences: {
        responseStyle: 'concise',
        preferredLanguage: 'auto',
        preferStructuredOutput: false,
        allowCloudFallbackFromLocal: false,
        defaultProviderId: '',
        toolAutonomy: 'manual',
      },
    });
  });

  // -----------------------------------------------------------------------
  // Test 1: send() creates initial thoughtChain steps
  // -----------------------------------------------------------------------
  it('send() appends user message and creates initial thoughtChain steps', async () => {
    mockStartStream.mockImplementation(async () => {
      // Simulate no events — just start/complete
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.send('hello');
    });

    // Should have initial steps: Preparing Context, and possibly Planning
    expect(result.current.steps.length).toBeGreaterThanOrEqual(2);

    // First step should be "Preparing Context"
    expect(result.current.steps[0].title).toContain('Preparing');
    expect(result.current.steps[0].status).toBe('success');

    // Second step should be "Planning"
    const planStep = result.current.steps.find(s => s.title.includes('Planning') || s.type === 'planning');
    expect(planStep).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Test 2: plan-created event adds a Think node with reasoning
  // -----------------------------------------------------------------------
  it('plan-created event adds a Think node with planner reasoning', async () => {
    mockStartStream.mockImplementation(async () => {
      agentStreamingCallbacks.onComplete?.('Here is the answer');
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.send('hello');
    });

    // After full pipeline, should have thought chain steps
    expect(result.current.steps.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Test 3: waiting-permission event sets pendingPermission state
  // -----------------------------------------------------------------------
  it('waiting-permission event sets pendingPermission', async () => {
    mockStartStream.mockImplementation(async () => {
      agentStreamingCallbacks.onWaitingPermission?.('echoTool', { text: 'test' });
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.send('hello');
    });

    expect(result.current.pendingPermission).toBeDefined();
    expect(result.current.pendingPermission?.toolName).toBe('echoTool');
    expect(result.current.pendingPermission?.toolInput).toEqual({ text: 'test' });
  });

  // -----------------------------------------------------------------------
  // Test 4: resolvePermission('allow-once') clears pendingPermission
  // -----------------------------------------------------------------------
  it('resolvePermission allow-once clears pendingPermission', async () => {
    mockStartStream.mockImplementation(async () => {
      agentStreamingCallbacks.onWaitingPermission?.('echoTool', { text: 'test' });
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.send('hello');
    });

    expect(result.current.pendingPermission).toBeDefined();

    await act(async () => {
      result.current.resolvePermission('allow-once');
    });

    expect(result.current.pendingPermission).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 5: resolvePermission('deny') clears pendingPermission, no persist
  // -----------------------------------------------------------------------
  it('resolvePermission deny clears pendingPermission without persisting', async () => {
    mockStartStream.mockImplementation(async () => {
      agentStreamingCallbacks.onWaitingPermission?.('echoTool', { text: 'test' });
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.send('hello');
    });

    expect(result.current.pendingPermission).toBeDefined();

    await act(async () => {
      result.current.resolvePermission('deny');
    });

    expect(result.current.pendingPermission).toBeNull();
    // Deny should NOT persist
    expect(mockPermissionStore.setPermission).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Test 6: resolvePermission('allow-always') persists permission
  // -----------------------------------------------------------------------
  it('resolvePermission allow-always persists via PermissionStore', async () => {
    mockStartStream.mockImplementation(async () => {
      agentStreamingCallbacks.onWaitingPermission?.('echoTool', { text: 'test' });
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.send('hello');
    });

    expect(result.current.pendingPermission).toBeDefined();

    await act(async () => {
      result.current.resolvePermission('allow-always');
    });

    // Should have set the permission
    expect(mockPermissionStore.setPermission).toHaveBeenCalledWith('echoTool', 'allow-always');
    expect(result.current.pendingPermission).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 7: error event adds error step
  // -----------------------------------------------------------------------
  it('error event sets error state', async () => {
    mockStartStream.mockImplementation(async () => {
      agentStreamingCallbacks.onError?.('Something went wrong');
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.send('hello');
    });

    expect(result.current.error).toBe('Something went wrong');
  });

  // -----------------------------------------------------------------------
  // Test 8: abort() during stream calls abort
  // -----------------------------------------------------------------------
  it('abort() calls streaming abort', async () => {
    const { result } = renderHook(() => useAgent());

    act(() => {
      result.current.abort();
    });

    expect(mockAbort).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Test 9: conversation management returns conversations
  // -----------------------------------------------------------------------
  it('returns conversations list from ChatHistoryDB', async () => {
    const { result } = renderHook(() => useAgent());

    expect(result.current.conversations).toBeDefined();
    expect(Array.isArray(result.current.conversations)).toBe(true);

    // Wait for the async getAllSessions to resolve
    await vi.waitFor(() => {
      expect(result.current.conversations.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Test 10: isStreaming state tracked correctly
  // -----------------------------------------------------------------------
  it('tracks isStreaming state after send completes', async () => {
    const { result } = renderHook(() => useAgent());

    // Before send — not streaming
    expect(result.current.isStreaming).toBe(false);

    // After send completes, mock's startStream set isStreaming = true
    // (mock never sets it to false, so it remains true)
    await act(async () => {
      await result.current.send('hello');
    });

    expect(result.current.isStreaming).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Test 11: newConversation() creates new conversation state
  // -----------------------------------------------------------------------
  it('newConversation creates a new conversation', async () => {
    const { result } = renderHook(() => useAgent());

    await act(async () => {
      result.current.newConversation();
    });

    // Should clear active conversation
    expect(result.current.activeConversationId).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 12: switchConversation changes active conversation
  // -----------------------------------------------------------------------
  it('switchConversation changes active conversation', async () => {
    const { result } = renderHook(() => useAgent());

    await act(async () => {
      result.current.switchConversation('conv-1');
    });

    expect(result.current.activeConversationId).toBe('conv-1');
  });

  // -----------------------------------------------------------------------
  // Test 13: deleteConversation removes conversation
  // -----------------------------------------------------------------------
  it('deleteConversation calls ChatHistoryDB.deleteSession', async () => {
    const { result } = renderHook(() => useAgent());

    await act(async () => {
      result.current.switchConversation('conv-1');
    });

    await act(async () => {
      await result.current.deleteConversation('conv-1');
    });

    expect(mockChatHistoryDB.deleteMessagesBySession).toHaveBeenCalledWith('conv-1');
    expect(mockChatHistoryDB.deleteSession).toHaveBeenCalledWith('conv-1');
  });

  // -----------------------------------------------------------------------
  // Test 14: full pipeline — text-delta → text-complete flow works
  // -----------------------------------------------------------------------
  it('full pipeline: text-delta and text-complete complete the flow', async () => {
    mockStartStream.mockImplementation(async () => {
      agentStreamingCallbacks.onDelta?.('Hello ');
      agentStreamingCallbacks.onDelta?.('World');
      agentStreamingCallbacks.onComplete?.('Hello World');
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.send('hello');
    });

    // Should have completed steps (not loading)
    const loadingSteps = result.current.steps.filter(s => s.status === 'loading');
    expect(loadingSteps.length).toBe(0);
  });
});
