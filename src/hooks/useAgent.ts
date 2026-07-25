import { useState, useRef, useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../core/stores/workspaceStore';
import { useStreamingLLM } from './useStreamingLLM';
import { AgentOrchestrator, type PermissionResolver } from '../core/ai/pipeline/AgentOrchestrator';
import { PlannerService } from '../core/ai/pipeline/PlannerService';
import { ExecutorService } from '../core/ai/pipeline/ExecutorService';
import { RendererService } from '../core/ai/pipeline/RendererService';
import { contextOptimizer } from '../core/context/ContextOptimizer';
import { memoryEngine } from '../core/memory/MemoryEngine';
import { chatHistoryDB } from '../core/storage/stores/ChatHistoryDB';
import { permissionStore } from '../core/permissions/PermissionStore';
import { toolRegistry } from '../core/ai/tools/ToolRegistry';
import { providerRouter } from '../core/ai/router/ProviderRouter';
import { permissionService } from '../core/ai/tools/PermissionService';
import type { OrchestratorEvent } from '../core/ai/pipeline/pipelineTypes';
import type { OptimizedContext, ContextOptimizerInput } from '../core/context/contextTypes';
import { debugLog } from '../core/utils/debugLog';
import { pageContentService } from '../core/extraction/PageContentService';

// ---------------------------------------------------------------------------
// Singleton orchestrator instance (same pattern as useChat.ts)
// ---------------------------------------------------------------------------

const plannerService = new PlannerService(providerRouter);
const executorService = new ExecutorService(toolRegistry, permissionService);
const rendererService = new RendererService(providerRouter);
const agentOrchestrator = new AgentOrchestrator(
  plannerService,
  executorService,
  rendererService,
  providerRouter,
  memoryEngine,
  undefined,
  undefined,
  toolRegistry,
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionDecision = 'allow-once' | 'allow-always' | 'deny';

export interface ThoughtChainStep {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: 'loading' | 'success' | 'error' | 'abort';
  content?: unknown;
  collapsible?: boolean;
  blink?: boolean;
  duration?: number;
}

export interface AgentConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
  preview: string;
}

export interface UseAgentReturn {
  steps: ThoughtChainStep[];
  send: (message: string) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
  error: string | null;
  pendingPermission: { toolName: string; toolInput: unknown } | null;
  resolvePermission: (decision: PermissionDecision) => void;
  conversations: AgentConversationMeta[];
  activeConversationId: string | null;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  newConversation: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are NowPilot, an AI assistant that helps users accomplish tasks.
You have access to tools that can interact with the user's environment.
When you need to use a tool, you plan the action and execute it step by step.
Always explain your reasoning before and after using tools.`;

let stepCounter = 0;
function nextStepId(): string {
  stepCounter++;
  return `step-${stepCounter}-${Date.now()}`;
}

function addStep(
  steps: ThoughtChainStep[],
  type: string,
  title: string,
  overrides?: Partial<ThoughtChainStep>,
): ThoughtChainStep[] {
  const step: ThoughtChainStep = {
    id: nextStepId(),
    type,
    title,
    status: 'loading',
    collapsible: false,
    ...overrides,
  };
  return [...steps, step];
}

function updateStep(
  steps: ThoughtChainStep[],
  id: string,
  updates: Partial<ThoughtChainStep>,
): ThoughtChainStep[] {
  return steps.map((s) => (s.id === id ? { ...s, ...updates } : s));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgent(): UseAgentReturn {
  const [steps, setSteps] = useState<ThoughtChainStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<{
    toolName: string;
    toolInput: unknown;
  } | null>(null);
  const [conversations, setConversations] = useState<AgentConversationMeta[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Refs for permission resolution (Pitfall 3 mitigation)
  const permissionResolveRef = useRef<
    ((decision: PermissionDecision) => void) | null
  >(null);
  const pendingPermissionRef = useRef<{
    toolName: string;
    toolInput: unknown;
  } | null>(null);
  const stepsRef = useRef<ThoughtChainStep[]>([]);

  // Keep ref in sync with steps state
  stepsRef.current = steps;

  // Get workspace state
  const activeProvider = useWorkspaceStore((s) => s.activeProvider);
  const activeModel = useWorkspaceStore((s) => s.activeModel);
  const currentPageContext = useWorkspaceStore((s) => s.currentPageContext);

  // -----------------------------------------------------------------------
  // Permission Resolver — bridges Pipeline → useAgent state
  // -----------------------------------------------------------------------

  const handlePermissionRequest = useCallback(
    async (
      toolName: string,
      toolInput: unknown,
      isDangerous: boolean,
    ): Promise<PermissionDecision> => {
      // D-08: Dangerous tools ALWAYS prompt regardless of stored permission
      if (isDangerous) {
        return new Promise<PermissionDecision>((resolve) => {
          pendingPermissionRef.current = { toolName, toolInput };
          setPendingPermission({ toolName, toolInput });
          permissionResolveRef.current = resolve;
        });
      }

      // Check stored permission (D-06)
      const stored = await permissionStore.getPermission(toolName);
      if (stored === 'allow-always') {
        return 'allow-always';
      }
      if (stored === 'deny') {
        return 'deny';
      }

      // No stored permission — prompt user
      return new Promise<PermissionDecision>((resolve) => {
        pendingPermissionRef.current = { toolName, toolInput };
        setPendingPermission({ toolName, toolInput });
        permissionResolveRef.current = resolve;
      });
    },
    [],
  );

  // Set PermissionResolver on orchestrator once
  useEffect(() => {
    agentOrchestrator.setPermissionResolver(
      handlePermissionRequest as PermissionResolver,
    );
  }, [handlePermissionRequest]);

  // -----------------------------------------------------------------------
  // Stream callbacks
  // -----------------------------------------------------------------------

  const handleDelta = useCallback((_text: string) => {
    // Text delta is handled via thought chain — we just ensure the
    // generating response step is present
    setSteps((prev) => {
      const hasGenerating = prev.some(
        (s) => s.type === 'generating-response',
      );
      if (!hasGenerating) {
        return addStep(prev, 'generating-response', 'Generating Response', {
          status: 'loading',
          blink: true,
        });
      }
      return prev;
    });
  }, []);

  const handleComplete = useCallback((_fullText: string) => {
    // Mark all loading steps as success
    setSteps((prev) => {
      const updated = prev.map((s) =>
        s.status === 'loading' ? { ...s, status: 'success' as const, blink: false } : s,
      );
      // Remove blink from any step
      return updated.map((s) => ({ ...s, blink: false }));
    });
    setError(null);
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    setSteps((prev) => {
      const updated = prev.map((s) =>
        s.status === 'loading'
          ? { ...s, status: 'error' as const, description: message }
          : s,
      );
      return addStep(updated, 'error', 'Error', {
        status: 'error',
        description: message,
        collapsible: true,
      });
    });
  }, []);

  const handleToolCall = useCallback((toolName: string, _input: unknown) => {
    setSteps((prev) =>
      addStep(prev, 'tool-call', `Executing ${toolName}`, {
        status: 'loading',
        blink: true,
        collapsible: true,
      }),
    );
  }, []);

  const handleWaitingPermission = useCallback(
    (toolName: string, toolInput: unknown) => {
      const pending = { toolName, toolInput };
      pendingPermissionRef.current = pending;
      setPendingPermission(pending);
      // Update tool step description
      setSteps((prev) =>
        updateStep(prev, prev[prev.length - 1]?.id ?? '', {
          description: 'Waiting for permission...',
        }),
      );
    },
    [],
  );

  const handleDegradation = useCallback(
    (_event: OrchestratorEvent & { type: 'context-degraded' }) => {
      setSteps((prev) =>
        addStep(prev, 'degradation', 'Context Optimized', {
          description: _event.message,
          status: 'success',
          collapsible: true,
        }),
      );
    },
    [],
  );

  const handleContextError = useCallback(
    (_event: OrchestratorEvent & { type: 'context-error' }) => {
      setError(_event.message);
      setSteps((prev) =>
        addStep(prev, 'context-error', 'Context Error', {
          status: 'error',
          description: _event.message,
          collapsible: true,
        }),
      );
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Stream management via useStreamingLLM
  // -----------------------------------------------------------------------

  const {
    startStream,
    abort: abortStream,
    isStreaming,
    error: streamingError,
  } = useStreamingLLM({
    orchestrator: agentOrchestrator,
    onDelta: handleDelta,
    onComplete: handleComplete,
    onError: handleError,
    onToolCall: handleToolCall,
    onWaitingPermission: handleWaitingPermission,
    onDegradation: handleDegradation,
    onContextError: handleContextError,
  });

  // Sync streamingError to hook-level error
  useEffect(() => {
    if (streamingError) {
      setError(streamingError);
    }
  }, [streamingError]);

  // -----------------------------------------------------------------------
  // Conversation management
  // -----------------------------------------------------------------------

  // Load conversations on mount
  useEffect(() => {
    chatHistoryDB
      .getAllSessions()
      .then((sessions) => {
        const metas: AgentConversationMeta[] = sessions.map((s) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updated,
          preview: s.preview,
        }));
        setConversations(metas);
      })
      .catch((err) => {
        debugLog('error', '[useAgent] Failed to load conversations', {
          error: err,
        });
      });
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const sessions = await chatHistoryDB.getAllSessions();
      const metas: AgentConversationMeta[] = sessions.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updated,
        preview: s.preview,
      }));
      setConversations(metas);
    } catch (err) {
      debugLog('error', '[useAgent] Failed to refresh conversations', {
        error: err,
      });
    }
  }, []);

  // -----------------------------------------------------------------------
  // send()
  // -----------------------------------------------------------------------

  const send = useCallback(
    async (message: string): Promise<void> => {
      setError(null);

      // Start with initial steps
      const initialSteps = addStep(
        addStep([], 'preparing-context', 'Preparing Context'),
        'planning',
        'Planning Actions',
      );
      setSteps(initialSteps);

      const conversationId =
        activeConversationId ?? `agent-${crypto.randomUUID()}`;
      if (!activeConversationId) {
        setActiveConversationId(conversationId);
      }

      try {
        // Assemble context
        const memoryResult = await memoryEngine.assemble(
          conversationId,
          message,
          'small',
        );

        const toolSchemas = toolRegistry.list().map((t) => ({
          name: t.name,
          schema: t.inputSchema,
        }));

        const input: ContextOptimizerInput = {
          operationId: conversationId,
          providerId: activeProvider ?? 'default',
          modelId: 'default',
          modelContextWindow: 128000,
          userInput: message,
          systemPrompt: SYSTEM_PROMPT,
          taskInstructions:
            'Use the available tools to accomplish the user\'s request. Plan step by step.',
          toolSchemas,
          memory: memoryResult.memory,
          preferences: memoryResult.preferences as Record<string, unknown>,
          pageContext: currentPageContext ?? await (async () => {
            try {
              const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tabs[0]?.id) {
                return await pageContentService.getForTabAsPageContext(tabs[0].id);
              }
            } catch {
              debugLog('debug', '[useAgent] On-demand page context fetch failed', {});
            }
            return null;
          })(),
        };

        const optimizedContext: OptimizedContext =
          await contextOptimizer.optimize(input);

        // Mark preparing context as success
        setSteps((prev) => {
          const updated = prev.map((s) =>
            s.type === 'preparing-context' && s.status === 'loading'
              ? { ...s, status: 'success' as const }
              : s,
          );
          return updated;
        });

        // Create session if new
        if (!activeConversationId) {
          await chatHistoryDB.createSession({
            id: conversationId,
            title: message.slice(0, 50),
            created: Date.now(),
            updated: Date.now(),
            starred: false,
            preview: message.slice(0, 100),
          });
        }

        // Add user message to DB
        await chatHistoryDB.addMessage({
          id: crypto.randomUUID(),
          sessionId: conversationId,
          role: 'user',
          content: message,
          timestamp: Date.now(),
        });

        await startStream(optimizedContext, [activeProvider ?? 'default'], activeModel ?? undefined);

        // Stream completed — persist assistant message
        await chatHistoryDB.addMessage({
          id: crypto.randomUUID(),
          sessionId: conversationId,
          role: 'assistant',
          content: '(Agent response completed)',
          timestamp: Date.now(),
        });

        // Refresh conversation list
        await refreshConversations();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Unknown error in useAgent';
        setError(msg);
        debugLog('error', '[useAgent] send failed', { error: err });
      }
    },
    [
      activeConversationId,
      activeProvider,
      activeModel,
      currentPageContext,
      startStream,
      refreshConversations,
    ],
  );

  // -----------------------------------------------------------------------
  // abort()
  // -----------------------------------------------------------------------

  const abort = useCallback(() => {
    abortStream();
    setSteps((prev) =>
      prev.map((s) =>
        s.status === 'loading'
          ? { ...s, status: 'abort' as const, blink: false }
          : s,
      ),
    );
  }, [abortStream]);

  // -----------------------------------------------------------------------
  // resolvePermission()
  // -----------------------------------------------------------------------

  const resolvePermission = useCallback(
    (decision: PermissionDecision) => {
      if (decision === 'allow-always' && pendingPermissionRef.current) {
        // Persist the allow-always decision (D-06)
        permissionStore.setPermission(
          pendingPermissionRef.current.toolName,
          'allow-always',
        );
      }

      setPendingPermission(null);
      pendingPermissionRef.current = null;

      // Resolve the promise to unblock the orchestrator (D-07)
      if (permissionResolveRef.current) {
        permissionResolveRef.current(decision);
        permissionResolveRef.current = null;
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Conversation management callbacks
  // -----------------------------------------------------------------------

  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setSteps([]);
    setError(null);
    // Update workspace store
    useWorkspaceStore.getState().setConversationId(id);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await chatHistoryDB.deleteMessagesBySession(id);
        await chatHistoryDB.deleteSession(id);
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setSteps([]);
        }
        await refreshConversations();
      } catch (err) {
        debugLog('error', '[useAgent] deleteConversation failed', {
          error: err,
        });
      }
    },
    [activeConversationId, refreshConversations],
  );

  const newConversation = useCallback(() => {
    setActiveConversationId(null);
    setSteps([]);
    setError(null);
    setPendingPermission(null);
    pendingPermissionRef.current = null;
    if (permissionResolveRef.current) {
      permissionResolveRef.current('deny');
      permissionResolveRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Cleanup on unmount (Pitfall 3 mitigation)
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      // Resolve any pending permission with 'deny' to prevent zombie promises
      if (permissionResolveRef.current) {
        permissionResolveRef.current('deny');
        permissionResolveRef.current = null;
      }
    };
  }, []);

  return {
    steps,
    send,
    abort,
    isStreaming,
    error,
    pendingPermission,
    resolvePermission,
    conversations,
    activeConversationId,
    switchConversation,
    deleteConversation,
    newConversation,
  };
}
