import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AgentOrchestrator } from '../core/ai/pipeline/AgentOrchestrator';
import { PlannerService } from '../core/ai/pipeline/PlannerService';
import { ExecutorService } from '../core/ai/pipeline/ExecutorService';
import { RendererService } from '../core/ai/pipeline/RendererService';
import { useStreamingLLM, type OrchestrationStage } from './useStreamingLLM';
import { memoryEngine } from '../core/memory/MemoryEngine';
import { contextOptimizer } from '../core/context/ContextOptimizer';
import { chatHistoryDB } from '../core/storage/stores/ChatHistoryDB';
import { providerRouter } from '../core/ai/router/ProviderRouter';
import { toolRegistry } from '../core/ai/tools/ToolRegistry';
import { permissionService } from '../core/ai/tools/PermissionService';
import { slashCommandRegistry } from '../core/slash/SlashCommandRegistry';
import { useWorkspaceStore } from '../core/stores/workspaceStore';
import { personaInjector } from '../core/ai/persona/PersonaInjector';
import { followUpService } from '../core/ai/followUp/FollowUpService';
import type { FollowUpSuggestion } from '../core/ai/followUp/FollowUpService';
import { debugLog } from '../core/utils/debugLog';
import { pageContentService } from '../core/extraction/PageContentService';
import type { OptimizedContext } from '../core/context/contextTypes';

// ---------------------------------------------------------------------------
// Singleton orchestrator instance
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
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  streaming: boolean;
  timestamp: number;
  metadata?: any;
  clarification?: ClarificationPayload;
}

export interface ConversationMeta {
  id: string;
  title: string;
  updated: number;
  created: number;
  starred: boolean;
  preview: string;
}

export interface ClarificationPayload {
  question: string;
  options: Array<{ label: string; value: string }>;
}

export interface BubbleListItem {
  key: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  stage?: OrchestrationStage;
  currentTool?: string;
  loading: boolean;
  streaming: boolean;
  metadata?: any;
  clarification?: ClarificationPayload;
  followUpSuggestions?: FollowUpSuggestion[];
}

export interface UseChatReturn {
  messages: ChatMessage[];
  bubbleItems: BubbleListItem[];
  send: (message: string, metadata?: any) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
  error: string | null;
  conversations: ConversationMeta[];
  activeConversationId: string | null;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  newConversation: () => void;
  draft: string;
  setDraft: (text: string) => void;
  clearDraft: () => void;
  activeProvider: string | null;
  setActiveProvider: (id: string) => void;
  editMessage: (id: string, newContent: string) => Promise<void>;
  regenerateResponse: (assistantMessageId: string) => Promise<void>;
  followUpSuggestions: Map<string, FollowUpSuggestion[]>;
}

// ---------------------------------------------------------------------------
// Title generation helper
// ---------------------------------------------------------------------------

async function generateTitle(userMessage: string): Promise<string | null> {
  try {
    // Non-blocking Haiku-tier call with timeout (D-15)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    // Use ProviderRouter to get a Haiku-tier model and make a simple completion
    const model = await providerRouter.selectModel('haiku', []);
    clearTimeout(timeout);

    if (!model) return null;

    // Import the AI SDK generateText for lightweight title generation
    const { generateText } = await import('ai');
    const result = await generateText({
      model: model.instance as Parameters<typeof generateText>[0]['model'],
      prompt: `Generate a brief title (max 7 words) for this conversation: ${userMessage}`,
      maxTokens: 16,
      temperature: 0,
      abortSignal: controller.signal,
    });

    return result.text?.trim() || null;
  } catch {
    return null; // Silently fall back
  }
}

function formatPageContext(
  currentPageContext: any | null,
  pinnedTabs: any[]
): string | null {
  let contextString = '';

  if (currentPageContext) {
    contextString += `## Active Page Context\n`;
    contextString += `Title: ${currentPageContext.title || 'Untitled Page'}\n`;
    contextString += `URL: ${currentPageContext.url || 'No URL'}\n`;
    if (currentPageContext.markdown) {
      contextString += `Content:\n${currentPageContext.markdown}\n`;
    }
    contextString += `\n---\n\n`;
  }

  // Active pins
  const activePins = pinnedTabs.filter((t) => t.active !== false);
  if (activePins.length > 0) {
    contextString += `## Pinned Pages Context\n`;
    activePins.forEach((tab, index) => {
      contextString += `### Pinned Page #${index + 1}\n`;
      contextString += `Title: ${tab.title || tab.page?.title || 'Untitled Page'}\n`;
      contextString += `URL: ${tab.url || tab.page?.url || ''}\n`;
      contextString += `Tab ID: ${tab.tabId}\n`;
      if (tab.page?.markdown) {
        contextString += `Content:\n${tab.page.markdown}\n`;
      }
      contextString += `\n`;
    });
  }

  return contextString.trim() || null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<string>('');
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [followUpSuggestions, setFollowUpSuggestions] = useState<Map<string, FollowUpSuggestion[]>>(new Map());
  const conversationIdRef = useRef<string | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMessageRef = useRef<string>('');
  const clarificationRoundsRef = useRef<Map<string, number>>(new Map());

  // ---------------------------------------------------------------
  // useStreamingLLM — receives callbacks that update messages
  // ---------------------------------------------------------------

  const [stage, setStage] = useState<OrchestrationStage>('idle');
  const [currentTool, setCurrentTool] = useState<string | undefined>();

  const streamingLLM = useStreamingLLM({
    orchestrator: agentOrchestrator,
    onDelta: (text: string) => {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + text,
          };
        }
        return updated;
      });
    },
    onReasoning: (text: string) => {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            reasoning: (last.reasoning || '') + text,
          };
        }
        return updated;
      });
    },
    onStageChange: (newStage: OrchestrationStage) => {
      setStage(newStage);
      if (newStage !== 'tool') setCurrentTool(undefined);
    },
    onToolCall: (toolName: string) => {
      setStage('tool');
      setCurrentTool(toolName);
    },
    onComplete: (fullText: string, reasoning?: string) => {
      setStage('idle');
      // Mark last message as complete with final content and reasoning
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: fullText,
            streaming: false,
            reasoning: reasoning || last.reasoning,
          };
        }
        return updated;
      });

      // Persist the assistant message
      const convId = conversationIdRef.current;
      if (convId) {
        chatHistoryDB.addMessage({
          id: crypto.randomUUID(),
          sessionId: convId,
          role: 'assistant',
          content: fullText,
          timestamp: Date.now(),
        });

        // Trigger title generation for the first message (D-15)
        if (isFirstMessage && lastUserMessageRef.current) {
          setIsFirstMessage(false);
          generateTitle(lastUserMessageRef.current).then((title) => {
            if (title) {
              chatHistoryDB.updateSession(convId, { title }).catch(() => {});
              // Update local conversations state
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === convId ? { ...c, title } : c,
                ),
              );
            } else {
              // Fallback to truncated first user message
              const fallback = lastUserMessageRef.current.slice(0, 50);
              chatHistoryDB.updateSession(convId, { title: fallback }).catch(() => {});
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === convId ? { ...c, title: fallback } : c,
                ),
              );
            }
          });
        }

        // D-02: Memory extraction triggered after stream completes (post-execution)
        // D-04: Fire-and-forget — NOT awaited, extraction failures don't block the user
        const userMsg = lastUserMessageRef.current;
        if (userMsg) {
          const messages = [
            { role: 'user' as const, content: userMsg },
            { role: 'assistant' as const, content: fullText },
          ];
          memoryEngine.extract(convId, messages, [])
            .catch(err => debugLog('error', '[useChat] Memory extraction failed', { error: err }));
        }

        // D-30: Fire-and-forget follow-up suggestion generation after stream completion
        const hostname = workspaceCurrentPageContext?.hostname ?? '';
        followUpService.generateSuggestions(fullText, { hostname })
          .then(suggestions => {
            if (suggestions.length > 0) {
              // Attach to the last assistant message by its ID
              setMessages(prev => {
                const lastIndex = prev.length - 1;
                if (lastIndex >= 0 && prev[lastIndex].role === 'assistant') {
                  const lastId = prev[lastIndex].id;
                  setFollowUpSuggestions(fs => {
                    const next = new Map(fs);
                    next.set(lastId, suggestions);
                    return next;
                  });
                }
                return prev;
              });
            }
          })
          .catch(err => debugLog('warn', '[useChat] Follow-up suggestion generation failed', { error: err }));
      }
    },
    onError: (_message: string) => {
      // Error is surfaced via streamingLLM.error
    },
  });

  // Workspace store selectors (individual to prevent unnecessary re-renders)
  const workspaceActiveProvider = useWorkspaceStore((s) => s.activeProvider);
  const workspaceActiveModel = useWorkspaceStore((s) => s.activeModel);
  const workspaceSetActiveProvider = useWorkspaceStore((s) => s.setActiveProvider);
  const workspaceSetConversationId = useWorkspaceStore((s) => s.setConversationId);
  const workspaceCurrentPageContext = useWorkspaceStore((s) => s.currentPageContext);
  const workspacePinnedTabs = useWorkspaceStore((s) => s.pinnedTabs);

  // ---------------------------------------------------------------
  // Load conversations on mount
  // ---------------------------------------------------------------

  useEffect(() => {
    chatHistoryDB.getAllSessions().then((sessions) => {
      const meta: ConversationMeta[] = (sessions ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        updated: s.updated,
        created: s.created,
        starred: s.starred,
        preview: s.preview,
      }));
      // Sort by updatedAt descending
      meta.sort((a, b) => b.updated - a.updated);
      setConversations(meta);
    });
    setMounted(true);
  }, []);

  // Store streamingLLM in a ref so send() can always access the latest version
  const streamingLLMRef = useRef(streamingLLM);
  streamingLLMRef.current = streamingLLM;
  const isStreamingRef = useRef(false);
  isStreamingRef.current = streamingLLM.isStreaming;
  const sendingRef = useRef(false);

  // ---------------------------------------------------------------
  // send()
  // ---------------------------------------------------------------

  const send = useCallback(
    async (message: string, metadata?: any): Promise<void> => {
      if (!message.trim()) return;

      // 1. Parse slash commands via SlashCommandRegistry (D-04)
      const parsed = slashCommandRegistry.parseCommand(message);
      if (parsed) {
        parsed.command.handler?.(parsed.rest);
        return; // Don't invoke pipeline for pure-command messages
      }

      // 2. Abort existing stream if active (CHAT-08) — use ref for current value
      if (streamingLLMRef.current.isStreaming) {
        streamingLLMRef.current.abort();
      }
      // Prevent double-submit: if still streaming after abort, another send is in flight
      if (sendingRef.current) return;
      sendingRef.current = true;

      // 3. Get or create conversationId (D-14)
      let convId = conversationIdRef.current;
      if (!convId) {
        convId = crypto.randomUUID();
        conversationIdRef.current = convId;
        setActiveConversationId(convId);
        workspaceSetConversationId(convId);

        // Create session in ChatHistoryDB on first send
        await chatHistoryDB.createSession({
          id: convId,
          title: 'New Conversation',
          created: Date.now(),
          updated: Date.now(),
          starred: false,
          preview: message.slice(0, 80),
        });

        // Add to local conversations list
        setConversations((prev) => [
          {
            id: convId!,
            title: 'New Conversation',
            updated: Date.now(),
            created: Date.now(),
            starred: false,
            preview: message.slice(0, 80),
          },
          ...prev,
        ]);
      }

      lastUserMessageRef.current = message;

      // 4. Append user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        streaming: false,
        timestamp: Date.now(),
        metadata,
      };

      // 5. Append placeholder assistant message (D-03)
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        streaming: true,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      // 6. Persist user message
      await chatHistoryDB.addMessage({
        id: userMsg.id,
        sessionId: convId,
        role: 'user',
        content: message,
        timestamp: userMsg.timestamp,
        metadata,
      });

      // 7. Clear draft (D-36)
      clearDraft();

      // 8. Assemble context (D-04)
      setStage('retrieving');
      // Get conversation history
      const historyMessages = await chatHistoryDB.getMessagesBySession(convId);

      // Get memory context (triggers MiniSearch retrieval of user facts)
      const memoryResult = await memoryEngine.assemble(convId, message, 'small');

      // Build conversation history for ContextOptimizerInput
      const conversationHistory = historyMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Build ContextOptimizerInput
      const contextInput = {
        operationId: convId,
        providerId: workspaceActiveProvider ?? 'default',
        modelId: 'default',
        modelContextWindow: 128000,
        userInput: message,
        systemPrompt: personaInjector.inject('You are a helpful AI assistant.'),
        taskInstructions: (() => {
          const rounds = clarificationRoundsRef.current.get(convId ?? '') ?? 0;
          let instructions = 'Respond to the user message concisely and accurately.';
          instructions += ' The current page context and any pinned tabs are included in this message under "Active Page Context" and "Pinned Pages Context". If the page content (markdown) is missing or incomplete, you should call the get-page-content tool via JSON output (not native function calling). Pass the Tab ID shown in the pinned context, or pass the url parameter with the page URL. For the active page, omit both parameters.';
          instructions += ` Available tools (use exact name): get-page-content, pin-tab. Do NOT use <|tool_call|> or any native function call syntax. Output plain JSON only.`;
          if (rounds >= 2) {
            instructions += ' You have already asked 2 clarifying questions. Proceed with your best judgment and state your assumptions clearly.';
          }
          return instructions;
        })(),
        memory: memoryResult.memory,
        preferences: memoryResult.preferences as Record<string, unknown>,
        conversationHistory,
        conversationSummary: memoryResult.conversationContext.summary,
        pageContext: await (async () => {
          const cached = formatPageContext(workspaceCurrentPageContext, workspacePinnedTabs);
          if (cached) {
            debugLog('debug', '[useChat] Using cached page context', { url: workspaceCurrentPageContext?.url, length: cached.length });
            return cached;
          }
          debugLog('debug', '[useChat] No cached page context, fetching on-demand', {});
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) {
              debugLog('debug', '[useChat] Fetching page context for tab', { tabId: tabs[0].id });
              const ctx = await pageContentService.getForTabAsPageContext(tabs[0].id);
              debugLog('info', '[useChat] On-demand page context fetched', { url: ctx.url, markdownLength: ctx.markdown?.length ?? 0 });
              return formatPageContext(ctx, []);
            }
            debugLog('debug', '[useChat] No active tab found for on-demand fetch', {});
          } catch (err) {
            debugLog('error', '[useChat] On-demand page context fetch failed', { error: err instanceof Error ? err.message : String(err) });
          }
          return null;
        })(),
        toolSchemas: toolRegistry.list().map((t) => ({
          name: t.name,
          schema: t.inputSchema,
        })),
      };

      const optimizedContext: OptimizedContext =
        await contextOptimizer.optimize(contextInput);

      // 9. Call startStream
      const preferredProviders = workspaceActiveProvider
        ? [workspaceActiveProvider]
        : [];

      const activeModelId = workspaceActiveModel ?? undefined;

      try {
        await streamingLLMRef.current.startStream(optimizedContext, preferredProviders, activeModelId);
      } finally {
        sendingRef.current = false;
      }
    },
    [workspaceActiveProvider, workspaceActiveModel, workspaceSetConversationId, workspaceCurrentPageContext, workspacePinnedTabs],
  );

  // ---------------------------------------------------------------
  // abort()
  // ---------------------------------------------------------------

  const abort = useCallback(() => {
    streamingLLMRef.current.abort();
  }, []);

  // ---------------------------------------------------------------
  // Conversation management (D-16)
  // ---------------------------------------------------------------

  const switchConversation = useCallback(
    async (id: string) => {
      conversationIdRef.current = id;
      setActiveConversationId(id);
      workspaceSetConversationId(id);
      setFollowUpSuggestions(new Map());

      // Load messages for this conversation
      const historyMessages = await chatHistoryDB.getMessagesBySession(id);
      const loadedMessages: ChatMessage[] = (historyMessages ?? []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        streaming: false,
        timestamp: m.timestamp,
        metadata: m.metadata as any,
      }));
      setMessages(loadedMessages);
    },
    [workspaceSetConversationId],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      // Delete messages first, then session
      await chatHistoryDB.deleteMessagesBySession(id);
      await chatHistoryDB.deleteSession(id);

      // Remove from local state
      setConversations((prev) => prev.filter((c) => c.id !== id));

      // If active conversation was deleted, clear state
      if (conversationIdRef.current === id) {
        conversationIdRef.current = null;
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [],
  );

  const newConversation = useCallback(() => {
    conversationIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setDraftState('');
    setIsFirstMessage(true);
    setFollowUpSuggestions(new Map());
  }, []);

  // ---------------------------------------------------------------
  // Drafts (D-33 through D-36)
  // ---------------------------------------------------------------

  const setDraft = useCallback(
    (text: string) => {
      setDraftState(text);

      // Debounced write to workspaceStore (300ms)
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }

      const convId = conversationIdRef.current;
      if (convId) {
        draftTimerRef.current = setTimeout(() => {
          const wsDraft = useWorkspaceStore.getState().setDraft;
          wsDraft(convId, text);
        }, 300);
      }
    },
    [],
  );

  const clearDraft = useCallback(() => {
    setDraftState('');
    const convId = conversationIdRef.current;
    if (convId) {
      const wsClearDraft = useWorkspaceStore.getState().clearDraft;
      wsClearDraft(convId);
    }
  }, []);

  // ---------------------------------------------------------------
  // bubbleItems — computed from messages (stable keys, Pitfall 1 mitigation)
  // ---------------------------------------------------------------

  const bubbleItems = useMemo<BubbleListItem[]>(
    () =>
      messages.map((msg) => ({
        key: msg.id,
        role: msg.role,
        content: msg.content,
        reasoning: msg.reasoning,
        stage: msg.streaming ? stage : undefined,
        currentTool: msg.streaming && stage === 'tool' ? currentTool : undefined,
        loading: msg.streaming && !msg.content,
        streaming: msg.streaming,
        metadata: msg.metadata,
        clarification: msg.clarification,
        followUpSuggestions: followUpSuggestions.get(msg.id),
      })),
    [messages, stage, currentTool, followUpSuggestions],
  );

  // ---------------------------------------------------------------
  // Additional Conversation management helpers
  // ---------------------------------------------------------------

  const toggleStarConversation = useCallback(
    async (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return;
      const nextStarred = !conv.starred;
      await chatHistoryDB.updateSession(id, { starred: nextStarred });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, starred: nextStarred } : c)),
      );
    },
    [conversations],
  );

  const updateConversationTitle = useCallback(async (id: string, title: string) => {
    await chatHistoryDB.updateSession(id, { title });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const deleteAllConversations = useCallback(
    async (includeStarred: boolean) => {
      const toDelete = conversations.filter((c) => includeStarred || !c.starred);
      for (const c of toDelete) {
        await chatHistoryDB.deleteMessagesBySession(c.id);
        await chatHistoryDB.deleteSession(c.id);
      }
      setConversations((prev) => prev.filter((c) => !includeStarred && c.starred));
      if (toDelete.some((c) => c.id === conversationIdRef.current)) {
        conversationIdRef.current = null;
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [conversations],
  );

  const editMessage = useCallback(async (id: string, newContent: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: newContent } : m))
    );
    const activeId = conversationIdRef.current;
    if (activeId) {
      const dbMessages = await chatHistoryDB.getMessagesBySession(activeId);
      const found = dbMessages.find((m) => m.id === id);
      if (found) {
        await chatHistoryDB.addMessage({
          id,
          sessionId: activeId,
          role: found.role,
          content: newContent,
          timestamp: found.timestamp,
        });
      }
    }
  }, []);

  const regenerateResponse = useCallback(async (assistantMessageId: string) => {
    const activeId = conversationIdRef.current;
    if (!activeId) return;

    const index = messages.findIndex((m) => m.id === assistantMessageId);
    if (index === -1) return;

    const userMessage = messages.slice(0, index).reverse().find((m) => m.role === 'user');
    if (!userMessage) return;

    const userMessageIndex = messages.findIndex((m) => m.id === userMessage.id);
    const slicedMessages = messages.slice(0, userMessageIndex + 1);

    await chatHistoryDB.deleteMessagesBySession(activeId);
    for (const msg of slicedMessages) {
      await chatHistoryDB.addMessage({
        id: msg.id,
        sessionId: activeId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: msg.metadata,
      });
    }

    setMessages(slicedMessages);

    const newAssistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      streaming: true,
      timestamp: Date.now(),
    };
    setMessages([...slicedMessages, newAssistantMsg]);

    const historyMessages = await chatHistoryDB.getMessagesBySession(activeId);
    const memoryResult = await memoryEngine.assemble(activeId, userMessage.content, 'small');
    const conversationHistory = historyMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const contextInput = {
      operationId: activeId,
      providerId: workspaceActiveProvider ?? 'default',
      modelId: 'default',
      modelContextWindow: 128000,
      userInput: userMessage.content,
      systemPrompt: personaInjector.inject('You are a helpful AI assistant.'),
      taskInstructions: (() => {
        const rounds = clarificationRoundsRef.current.get(activeId) ?? 0;
        let instructions = 'Respond to the user message concisely and accurately.';
        instructions += ' The current page context and any pinned tabs are included in this message under "Active Page Context" and "Pinned Pages Context". If the page content (markdown) is missing or incomplete, you should call the get-page-content tool via JSON output (not native function calling). Pass the Tab ID shown in the pinned context, or pass the url parameter with the page URL. For the active page, omit both parameters.';
        instructions += ' Available tools (use exact name): get-page-content, pin-tab. Do NOT use <|tool_call|> or any native function call syntax. Output plain JSON only.';
        if (rounds >= 2) {
          instructions += ' You have already asked 2 clarifying questions. Proceed with your best judgment and state your assumptions clearly.';
        }
        return instructions;
      })(),
      memory: memoryResult.memory,
      preferences: memoryResult.preferences as Record<string, unknown>,
      conversationHistory,
      pageContext: formatPageContext(workspaceCurrentPageContext, workspacePinnedTabs), // PageContext | null (D-19)
    };

    const optimizedContext = await contextOptimizer.optimize(contextInput);
    const preferredProviders = workspaceActiveProvider ? [workspaceActiveProvider] : [];
    const activeModelId = workspaceActiveModel ?? undefined;

    await streamingLLMRef.current.startStream(optimizedContext, preferredProviders, activeModelId);
  }, [messages, workspaceActiveProvider, workspaceActiveModel, workspaceCurrentPageContext, workspacePinnedTabs]);

  // ---------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------

  return {
    messages,
    bubbleItems,
    followUpSuggestions,
    send,
    abort,
    get isStreaming() { return streamingLLM.isStreaming; },
    get error() { return streamingLLM.error; },
    conversations,
    setConversations,
    activeConversationId,
    switchConversation,
    deleteConversation,
    toggleStarConversation,
    updateConversationTitle,
    deleteAllConversations,
    newConversation,
    draft,
    setDraft,
    clearDraft,
    activeProvider: workspaceActiveProvider,
    setActiveProvider: workspaceSetActiveProvider,
    editMessage,
    regenerateResponse,
  };
}
