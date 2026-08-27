import { useState, useRef, useEffect } from 'react';
import { App } from 'antd';
import { useExtensionStore } from '../../store/useExtensionStore';
import {
  runAgentTurn,
  type AgentTier,
  type PersistTurnInput,
} from '../../core/ai/AgentOrchestrator';
import { useUserPreferencesStore } from '../../core/ai/UserPreferences';
import { generateOperationId } from '../../core/runtime/OperationId';
import { createChunkBuffer } from '../../core/ai/ChunkBuffer';
import { openWriteJournalDB } from '../../core/storage/WriteJournalDB';
import {
  createChatTurnSteps,
  chatTurnStepsDepsFromChatHistoryDB,
  runJournaled,
} from '../../core/storage/WriteJournal';
import type { WriteJournalEntry } from '../../types/storage';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { debugLog } from '../../core/log/debugLog';
import type { Message, Attachment } from '../../types';

/**
 * useChatStreaming — D-44 (Phase 3 03-07): production chat runs the
 * Planner → Executor → Renderer pipeline through
 * AgentOrchestrator.runAgentTurn. The legacy `streamChatResponse` path in
 * src/services/aiProvider.ts is RETIRED for production chat — it remains
 * only behind the DEMO_MODE+DEV gate (D-12) and this hook never calls it
 * (grep-assertable).
 *
 * D-45 write-rate contract:
 *   - Mid-stream chunks live in memory + ChunkBuffer only — NO per-chunk
 *     store-persist calls (the old per-chunk updateLastAssistantMessage
 *     path is REMOVED; P2 write-rate, T-3-22).
 *   - The completed user/assistant pair persists ONCE at turn end via the
 *     journaled 'append-chart-turn' WriteJournal op → ChatHistoryDB
 *     (persistTurn, D-45).
 *   - An abort drops the partial assistant message — nothing persisted
 *     (the AgentOrchestrator never invokes persistTurn on the aborted
 *     path, proven by the 03-06 test contract).
 *
 * Appendix J.2 np_active_stream lifecycle: the key is written to
 * chrome.storage.session on stream start and cleared in `finally`; a
 * boot-recovery check surfaces an interrupted state when a stale key for
 * the SAME conversation is found (Pitfall 7).
 */

/** §1.4 medium caps (planner 3 / tool 2) — the chat default turn tier.
 * Zero tools are registered in Phase 3 (D-46), so the tool cap is inert
 * until owning phases register real tools. */
const CHAT_TIER: AgentTier = { plannerCap: 3, toolCap: 2, modelTier: 'balanced' };

/**
 * Appendix J.2 effect batching — split the completed answer into
 * effect-sized chunks so the ChunkBuffer delivers rAF-batched UI updates
 * (progressive reveal) instead of one giant flush.
 */
function chunkStringForEffect(text: string, size = 32): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [''];
}

/**
 * D-45 turn-end persist — journaled 'append-chat-turn' op. Creates a
 * metadata-only WriteJournalEntry (D-33), persists it to WriteJournalDB,
 * then runs the registered step list built by createChatTurnSteps bound to
 * the REAL ChatHistoryDB (idb put, 'messages' store — v1 schema fits the
 * pair write, D-45a). Replay-safe: deterministic message ids make a
 * crash-replay re-put idempotent (T-3-23).
 */
async function persistChatTurn(
  sessionId: string,
  operationId: string,
  turn: PersistTurnInput,
): Promise<void> {
  const entry: WriteJournalEntry = {
    id: `op-${operationId}`,
    operation: 'append-chat-turn',
    status: 'pending',
    attempts: 0,
    steps: [],
    createdAt: Date.now(),
  };
  const journalDb = await openWriteJournalDB();
  try {
    await journalDb.put('entries', entry);
  } finally {
    journalDb.close();
  }

  const steps = createChatTurnSteps(chatTurnStepsDepsFromChatHistoryDB())({
    sessionId,
    userMessage: turn.userMessage,
    assistantMessage: turn.assistantMessage,
    timestamp: Date.now(),
  });
  await runJournaled(entry, steps, async (e) => {
    const db = await openWriteJournalDB();
    try {
      await db.put('entries', e);
    } finally {
      db.close();
    }
  });
}

export function useChatStreaming() {
  const { message: antMessage } = App.useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    config,
    activeSession,
    createNewSession,
    addMessageToActiveSession,
    updateLastAssistantMessage,
  } = useExtensionStore();

  const handleSend = async (
    textToSend: string,
    attachments: Attachment[] = [],
    onAfterSend?: () => void
  ) => {
    if (!textToSend.trim() && attachments.length === 0) return;

    let currentSession = activeSession;
    if (!currentSession) {
      createNewSession();
      currentSession = useExtensionStore.getState().activeSession;
    }
    if (!currentSession) return;

    const currentAttachments = [...attachments];

    const userMessage: Message = {
      id: 'm_' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      attachments: currentAttachments,
    };

    const assistantMsgId = 'm_ast_' + Date.now();
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      thoughtProcess: 'Analyzing prompt and scanning context tabs...',
      timestamp: Date.now(),
      model: config.selectedModel,
      isThinking: true,
      versions: [''],
      currentVersionIndex: 0,
      followups: [
        'What are the core components of critical thinking?',
        'Can you provide a practical workplace example?',
      ],
    };

    addMessageToActiveSession(userMessage);
    addMessageToActiveSession(assistantMessage);
    onAfterSend?.();
    setIsGenerating(true);

    abortControllerRef.current = new AbortController();
    const operationId = generateOperationId();
    const sessionId = currentSession.id;
    const surface = useWorkspaceStore.getState().activeSurface ?? 'sidepanel';

    // Appendix J.2: record the active stream in chrome.storage.session so a
    // surface reload within the 5-min window can surface the interrupted
    // state (Pitfall 7). Best-effort — session storage may be unavailable in
    // non-extension contexts.
    try {
      await chrome.storage.session.set({
        np_active_stream: {
          conversationId: sessionId,
          operationId,
          startedAt: Date.now(),
          surface,
        },
      });
    } catch {
      // np_active_stream is advisory — a failed write must not block chat.
    }

    try {
      // D-44: the pipeline is the production chat path. runAgentTurn owns
      // the Appendix I loop (planner → executor → renderer), the §1.4 caps,
      // the D-54a configuration-required outcome, and the persist seam.
      const output = await runAgentTurn({
        userInput: textToSend,
        sessionId,
        operationId,
        tier: CHAT_TIER,
        prefs: useUserPreferencesStore.getState(),
        abortSignal: abortControllerRef.current.signal,
        // D-45: invoked exactly once at turn end by the orchestrator's
        // finish path with the completed pair (never per delta, not on
        // abort — 03-06 test contract).
        persistTurn: (turn) => persistChatTurn(sessionId, operationId, turn),
      });

      if (output.reasonCode === 'configuration_required') {
        // D-54a: no fast/balanced tier persisted → no provider request
        // started. Surface the configuration prompt.
        antMessage.warning(
          'AI tiers are not configured — set the fast and balanced models in Options → General before chatting.',
        );
      }

      // D-45 / Appendix J.2: mid-stream chunks live in memory + ChunkBuffer
      // only. The completed answer is enqueued into the buffer and flushed —
      // the ONE store update (from the buffer) happens here, at turn end.
      // No per-chunk store-persist calls exist in this hook (grep-gated).
      const buffer = createChunkBuffer();
      let lastFlushedLen = 0;
      buffer.onFlush((text) => {
        // The buffer delivers the FULL accumulated text — append only the
        // delta since the last flush (the store action is append-based).
        const delta = text.slice(lastFlushedLen);
        lastFlushedLen = text.length;
        if (delta.length > 0) updateLastAssistantMessage(delta, '', true);
      });
      if (output.streamedText.length > 0) {
        for (const chunk of chunkStringForEffect(output.streamedText)) {
          buffer.enqueue(chunk);
        }
        buffer.flushNow();
      }
      // Mark the placeholder done even for an empty answer (clarification
      // question / configuration-required surfaces as its own state above).
      updateLastAssistantMessage('', '', true);
    } catch (err) {
      // Abort (Stop button): the partial assistant message is DROPPED —
      // nothing persisted (the orchestrator never invoked persistTurn on the
      // aborted path). The stopped note is appended by handleStopGenerating
      // synchronously; here we only make sure the generating state clears.
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsGenerating(false);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      debugLog('CHAT_TURN_FAILED', message);
      updateLastAssistantMessage(`\n\n*Error generating response: ${message}*`, '', true);
    } finally {
      setIsGenerating(false);
      // Appendix J.2: clear the active-stream key.
      try {
        await chrome.storage.session.remove('np_active_stream');
      } catch {
        // best-effort
      }
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      // D-45: the partial assistant message is dropped (nothing persisted) —
      // the in-memory placeholder carries the stopped note.
      updateLastAssistantMessage('\n\n*(Generation stopped by user)*', '', true);
      antMessage.info('Generation stopped');
    }
  };

  // Appendix J.2 boot-recovery: a stale np_active_stream for THIS
  // conversation (from a surface reload inside the 5-min session window)
  // surfaces the interrupted state and removes the key (Pitfall 7).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = (await chrome.storage.session.get('np_active_stream')) as {
          np_active_stream?: { conversationId: string; operationId: string };
        };
        if (cancelled) return;
        const active = v.np_active_stream;
        if (active && active.conversationId === useExtensionStore.getState().activeSessionId) {
          antMessage.warning('Previous stream was interrupted — the partial response was discarded.');
          await chrome.storage.session.remove('np_active_stream');
        }
      } catch {
        // session storage unavailable — no recovery signal possible
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [antMessage]);

  return {
    isGenerating,
    handleSend,
    handleStopGenerating,
  };
}