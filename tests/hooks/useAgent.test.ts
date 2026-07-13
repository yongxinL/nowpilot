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
  };
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
