import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock useChat's module-level imports to verify persona injector is called
const { mockInject } = vi.hoisted(() => ({
  mockInject: vi.fn((prompt: string) => `## PERSONA\n\n${prompt}`),
}));

vi.mock('../../../../src/core/ai/persona/PersonaInjector', () => ({
  personaInjector: {
    inject: mockInject,
  },
}));

// Mock AITransactionLogDB for AgentOrchestrator
vi.mock('../../../../src/core/storage/stores/AITransactionLogDB', () => ({
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

// Mock WriteJournal for AgentOrchestrator
vi.mock('../../../../src/core/storage/WriteJournal', () => ({
  WriteJournal: vi.fn(),
  writeJournal: {
    begin: vi.fn().mockResolvedValue({ id: 'test', status: 'pending', steps: [] }),
    markStepStart: vi.fn().mockResolvedValue(undefined),
    markStepComplete: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    recover: vi.fn().mockResolvedValue(0),
    prune: vi.fn().mockResolvedValue(0),
  },
}));

import { AgentOrchestrator } from '../../../../src/core/ai/pipeline/AgentOrchestrator';
import type { PlannerService } from '../../../../src/core/ai/pipeline/PlannerService';
import type { ExecutorService } from '../../../../src/core/ai/pipeline/ExecutorService';
import type { RendererService } from '../../../../src/core/ai/pipeline/RendererService';
import type { ProviderRouter } from '../../../../src/core/ai/router/ProviderRouter';
import type { MemoryEngine } from '../../../../src/core/memory/MemoryEngine';
import type { OptimizedContext } from '../../../../src/core/context/contextTypes';
import { createManifest } from '../../../../src/core/context/ContextProvenanceManifest';

function createMockPlanner() {
  return { plan: vi.fn() } as unknown as PlannerService;
}
function createMockExecutor() {
  return { execute: vi.fn() } as unknown as ExecutorService;
}
function createMockRenderer() {
  return { render: vi.fn() } as unknown as RendererService;
}
function createMockRouter() {
  return { selectModel: vi.fn().mockResolvedValue(null) } as unknown as ProviderRouter;
}
function createMockMemoryEngine() {
  return { extract: vi.fn().mockResolvedValue(undefined) } as unknown as MemoryEngine;
}

function makeOptimizedContext(overrides?: Partial<OptimizedContext>): OptimizedContext {
  return {
    operationId: 'test-op',
    tier: 'small',
    budget: 8000,
    sections: [
      { kind: 'system_prompt', content: 'You are a helpful AI assistant.', estimatedTokens: 10 },
      { kind: 'task_instructions', content: 'Respond concisely.', estimatedTokens: 5 },
      { kind: 'user_input', content: 'Hello', estimatedTokens: 2 },
    ],
    provenance: createManifest('test-op', 'small', 8000, 7000, []),
    minimalMode: false,
    estimatedTokens: 100,
    totalTokens: 200,
    ...overrides,
  } as OptimizedContext;
}

describe('Persona Integration — AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let mockPlanner: ReturnType<typeof createMockPlanner>;

  beforeEach(() => {
    mockInject.mockClear();
    mockPlanner = createMockPlanner();
    mockPlanner.plan = vi.fn().mockResolvedValue({ action: 'answer', reasoning: 'test' });
    orchestrator = new AgentOrchestrator(
      mockPlanner,
      createMockExecutor(),
      createMockRenderer(),
      createMockRouter(),
      createMockMemoryEngine(),
    );
  });

  it('runWithContext() passes persona-injected plannerSystemPrompt to executePlannerLoop (Test 3)', async () => {
    const context = makeOptimizedContext();
    const gen = orchestrator.runWithContext(context, []);
    // Collect events to drive the generator
    for await (const _ of gen) {
      // consume
    }
    // verify personaInjector.inject was called with the system prompt
    expect(mockInject).toHaveBeenCalled();
    const callArg = mockInject.mock.calls[0][0] as string;
    expect(callArg).toContain('You are a helpful AI assistant.');
  });
});
