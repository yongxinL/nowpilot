import { useRef, useState, useEffect, useCallback } from 'react';
import { ChunkBuffer } from '../core/ai/streaming/ChunkBuffer';
import type { AgentOrchestrator } from '../core/ai/pipeline/AgentOrchestrator';
import type { OrchestratorEvent } from '../core/ai/pipeline/pipelineTypes';
import type { OptimizedContext } from '../core/context/contextTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrchestrationStage = 'idle' | 'retrieving' | 'planning' | 'thinking' | 'tool' | 'generating' | 'extracting';

export interface StreamingLLMConfig {
  orchestrator: AgentOrchestrator;
  onDelta: (text: string) => void;
  onReasoning?: (text: string) => void;
  onStageChange?: (stage: OrchestrationStage) => void;
  onComplete: (fullText: string, reasoning?: string) => void;
  onError: (message: string) => void;
  onToolCall?: (toolName: string, input: unknown) => void;
  onWaitingPermission?: (toolName: string, toolInput: unknown) => void;
  onDegradation?: (
    event: OrchestratorEvent & { type: 'context-degraded' },
  ) => void;
  onContextError?: (
    event: OrchestratorEvent & { type: 'context-error' },
  ) => void;
}

export interface StreamingLLMReturn {
  startStream: (
    optimizedContext: OptimizedContext,
    preferredProviders: string[],
    modelId?: string,
  ) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStreamingLLM(config: StreamingLLMConfig): StreamingLLMReturn {
  const {
    orchestrator,
    onDelta,
    onReasoning,
    onStageChange,
    onComplete,
    onError,
    onToolCall,
    onWaitingPermission,
    onDegradation,
    onContextError,
  } = config;

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chunkBufferRef = useRef<ChunkBuffer | null>(null);
  const isMountedRef = useRef(true);
  const onDeltaRef = useRef(onDelta);
  const onReasoningRef = useRef(onReasoning);
  const onStageChangeRef = useRef(onStageChange);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onToolCallRef = useRef(onToolCall);
  const onWaitingPermissionRef = useRef(onWaitingPermission);
  const onDegradationRef = useRef(onDegradation);
  const onContextErrorRef = useRef(onContextError);

  // Keep callback refs in sync with latest values
  onDeltaRef.current = onDelta;
  onReasoningRef.current = onReasoning;
  onStageChangeRef.current = onStageChange;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  onToolCallRef.current = onToolCall;
  onWaitingPermissionRef.current = onWaitingPermission;
  onDegradationRef.current = onDegradation;
  onContextErrorRef.current = onContextError;

  // ---------------------------------------------------------------
  // Cleanup on unmount (Pitfall 2 mitigation)
  // ---------------------------------------------------------------

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      orchestrator.cancel();
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      chunkBufferRef.current?.destroy();
      chunkBufferRef.current = null;
    };
  }, [orchestrator]);

  // ---------------------------------------------------------------
  // abort()
  // ---------------------------------------------------------------

  const abort = useCallback(() => {
    orchestrator.cancel();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, [orchestrator]);

  // ---------------------------------------------------------------
  // startStream()
  // ---------------------------------------------------------------

  const startStream = useCallback(
    async (
      optimizedContext: OptimizedContext,
      preferredProviders: string[],
      modelId?: string,
    ): Promise<void> => {
      // Abort existing stream if active (CHAT-08 / one-stream-per-session)
      if (isStreaming) {
        orchestrator.cancel();
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        chunkBufferRef.current?.destroy();
        chunkBufferRef.current = null;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const signal = abortController.signal;

      setIsStreaming(true);
      setError(null);

      // Create ChunkBuffer with onFlush calling onDelta
      const chunkBuffer = new ChunkBuffer((text: string) => {
        if (signal.aborted || !isMountedRef.current) return;
        onDeltaRef.current(text);
      });
      chunkBufferRef.current = chunkBuffer;

      let hasReasoning = false;
      let hasText = false;
      try {
        for await (const event of orchestrator.runWithContext(
          optimizedContext,
          preferredProviders,
          modelId,
        )) {
          if (signal.aborted || !isMountedRef.current) break;

          switch (event.type) {
            case 'text-delta':
              if (!hasText) {
                hasText = true;
                onStageChangeRef.current?.(hasReasoning ? 'thinking' : 'generating');
              }
              chunkBuffer.push(event.text);
              break;

            case 'reasoning-delta':
              if (!hasReasoning) {
                hasReasoning = true;
                onStageChangeRef.current?.('thinking');
              }
              onReasoningRef.current?.(event.text);
              break;

            case 'text-complete':
              chunkBuffer.flush();
              if (isMountedRef.current) {
                onCompleteRef.current(event.fullText, event.reasoning);
              }
              break;

            case 'tool-called':
              onToolCallRef.current?.(event.toolName, event.input);
              break;

            case 'waiting-permission':
              onWaitingPermissionRef.current?.(
                event.toolName,
                event.toolInput,
              );
              break;

            case 'context-degraded':
              onDegradationRef.current?.(event);
              break;

            case 'context-error':
              onContextErrorRef.current?.(event);
              break;

            case 'plan-created':
              onStageChangeRef.current?.('planning');
              break;

            case 'tool-result':
              // Ignored — consumer hooks handle this
              break;

            case 'error':
              chunkBuffer.flush();
              if (isMountedRef.current) {
                setError(event.message);
                onErrorRef.current(event.message);
              }
              break;
          }
        }
      } catch (err) {
        // Swallow AbortError (Pitfall 2 — abort on unmount is intentional)
        if (
          err instanceof DOMException &&
          err.name === 'AbortError'
        ) {
          // Silent swallow — this is expected on abort/unmount
        } else {
          const message =
            err instanceof Error ? err.message : 'Unknown streaming error';
          if (isMountedRef.current) {
            setError(message);
            onErrorRef.current(message);
          }
        }
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
        chunkBuffer.destroy();
        chunkBufferRef.current = null;
        abortControllerRef.current = null;
      }
    },
    [orchestrator, isStreaming],
  );

  return { startStream, abort, isStreaming, error };
}
