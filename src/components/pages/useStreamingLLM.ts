// src/components/pages/useStreamingLLM.ts — D-01 co-located streaming hook
// (Phase-7 promotion target: src/hooks/useStreamingLLM.ts, Appendix J.2
// reference). Golden Rule 3: the ONLY prompt assembly on the UI path is
// contextHelper (D-02) — this hook imports contextHelper, never builds prompts.
//
// send() threads the §2.3 OptimizedContext (contextHelper, 03-07) through the
// 03-05 createStageInvocation StageResolver closure into 03-06 runAgentTurn,
// streaming renderer deltas into the Appendix J.1 ChunkBuffer (rAF flush → the
// growing assistant Bubble text). abort() cancels generation so no orphaned
// request bills tokens (§17.5 one stream per session — a new send aborts the
// previous). Phase-3 stream state is IN-MEMORY per surface (D-03/D-14): the
// session stream key stays writeAllowed:false in Setting.ts (D-11) — nothing
// is written to chrome.storage.session here; J.2's np_* persistence is the
// Phase-7 full-hook behavior.
//
// Offline vs failed: a NETWORK-class failure after the Router retry layer
// (D-17) becomes the 'offline' state (STR.chat.offline muted notice); every
// other failure is 'failed' (partial text retained + Retry). The canonical
// §C.2 code goes to debugLog (R-10) — never raw into the UI.
import { useCallback, useEffect, useRef, useState } from 'react';

import { createChunkBuffer } from '@/core/ai/ChunkBuffer';
import type { ChunkBuffer } from '@/core/ai/ChunkBuffer';
import { capsForTier, runAgentTurn } from '@/core/ai/AgentOrchestrator';
import type { StageResolver } from '@/core/ai/AgentOrchestrator';
import { getProviderRouter } from '@/core/ai/ProviderRouter';
import { RENDERER_MAX_TOKENS } from '@/core/ai/RendererService';
import { buildOptimizedContext } from '@/core/ai/contextHelper';
import { privacyModeFromPrefs } from '@/core/ai/TierResolver';
import type { ModelTier } from '@/core/ai/TierResolver';
import { buildPersonaBlock, resolvePersona } from '@/core/ai/persona/PersonaInjector';
import { DEFAULT_PERSONA } from '@/core/ai/persona/PersonaProfile';
import { readPersonaPrefs } from '@/core/ai/persona/personaConfig';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { debugLog } from '@/core/error/debugLog';
import type { ModelContextTier } from '@/core/context/ModelContextTier';
import { createOperationId } from '@/core/runtime/OperationId';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

/** §1.2 — planner/repair output cap (256); renderer rides RENDERER_MAX_TOKENS. */
const PLANNER_MAX_TOKENS = 256;

/** §2.1 chat default: balanced context tier (medium caps 3/2 per §1.4). */
const DEFAULT_CONTEXT_TIER: ModelContextTier = 'medium';
/** §2.2 medium-tier budgets (fixture TIER_BUDGETS.medium). */
const DEFAULT_INPUT_BUDGET = 16_384;
const DEFAULT_OUTPUT_BUDGET = 1_024;

/**
 * The UI-SPEC surface state machine (D-01): idle / streaming / completed /
 * failed / offline, each carrying the turn's operationId. Phase-3 stream state
 * is in-memory per-surface (D-03/D-14) — no persistence, no session key.
 */
export type ChatStreamState =
  | { state: 'idle' }
  | { state: 'streaming'; operationId: string }
  | { state: 'completed'; operationId: string }
  | { state: 'failed'; operationId: string }
  | { state: 'offline'; operationId: string };

export interface UseStreamingLLMResult {
  state: ChatStreamState;
  /** The current streamed text (grows via ChunkBuffer flush). */
  text: string;
  /**
   * Start a turn: contextHelper (03-07) → StageResolver over
   * createStageInvocation (03-05) → runAgentTurn (03-06) with onStreamDelta →
   * ChunkBuffer. Golden Rule 3: the hook assembles NO prompts itself.
   */
  send: (userInput: string) => Promise<void>;
  /** Re-send the last user input through the same path with a NEW operationId. */
  retry: () => void;
  /** Cancel generation — no orphaned request bills tokens. */
  abort: () => void;
}

function isAbortError(err: unknown): boolean {
  // DOMException does not extend Error in every environment — match the
  // canonical AbortError name regardless of prototype chain (03-06 precedent).
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

/** Map the registry snapshot to the TierResolveInput.configuredProviders shape. */
function configuredFromRegistry() {
  return getProviderRegistry()
    .getProviderInfos()
    .map((p) => ({ id: p.id, models: p.models, enabled: p.enabled, priority: p.priority }));
}

export function useStreamingLLM(): UseStreamingLLMResult {
  const bufferRef = useRef<ChunkBuffer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const operationIdRef = useRef<string | null>(null);
  const lastUserInputRef = useRef('');
  const [text, setText] = useState('');
  const [state, setState] = useState<ChatStreamState>({ state: 'idle' });
  const workspaceId = useWorkspaceStore((s) => s.workspace.workspaceId);
  const activeSurface = useWorkspaceStore((s) => s.workspace.activeSurface);

  // Appendix J.1: deltas accumulate in the buffer and flush to the text state
  // on the next animation frame (≤16 ms; 8 kB/s → 33 ms rule).
  useEffect(() => {
    if (!bufferRef.current) bufferRef.current = createChunkBuffer();
    return bufferRef.current.onFlush(setText);
  }, []);

  const send = useCallback(
    async (userInput: string) => {
      const trimmed = userInput.trim();
      if (!trimmed) return;
      // §17.5: one stream per session — abort any previous generation first.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      bufferRef.current?.reset();
      setText('');
      const operationId = createOperationId();
      operationIdRef.current = operationId;
      lastUserInputRef.current = trimmed;
      setState({ state: 'streaming', operationId });
      try {
        // D-02 / D-09: the persona pipeline (np_persona → schema gate →
        // DEFAULT_PERSONA fallback) feeds contextHelper's byte-stable block.
        const prefs = await readPersonaPrefs();
        const persona = resolvePersona(DEFAULT_PERSONA, prefs);
        const personaBlock = buildPersonaBlock(persona);
        // Golden Rule 3: contextHelper is the ONLY prompt builder on this path.
        const context = buildOptimizedContext({
          operationId,
          tier: DEFAULT_CONTEXT_TIER,
          inputBudget: DEFAULT_INPUT_BUDGET,
          outputBudget: DEFAULT_OUTPUT_BUDGET,
          userInput: trimmed,
          personaBlock,
          toolSchemaRefs: [],
          workspaceId,
          activeSurface,
        });
        // 03-05 seam: per-stage invocations (planner haiku 256 / renderer flash
        // 512 — §1.2) from the Router's createStageInvocation.
        const invocation: StageResolver = (stage) =>
          getProviderRouter().createStageInvocation({
            operationId,
            tier: (stage === 'planner' ? 'haiku' : 'flash') as ModelTier,
            privacyMode: privacyModeFromPrefs(prefs),
            maxTokens: stage === 'planner' ? PLANNER_MAX_TOKENS : RENDERER_MAX_TOKENS,
            configuredProviders: configuredFromRegistry(),
          });
        const result = await runAgentTurn({
          operationId,
          userInput: trimmed,
          context,
          abortSignal: controller.signal,
          tier: capsForTier(context.tier),
          onStreamDelta: (delta) => bufferRef.current?.enqueue(delta),
          invocation,
        });
        if (operationIdRef.current !== operationId) return; // superseded by a new send
        bufferRef.current?.flushNow();
        // D-07 gate is the shell's job; a defensively-surfaced
        // provider_unconfigured reasonCode is an honest failed terminal here.
        if (result.reasonCode === 'provider_unconfigured') {
          setState({ state: 'failed', operationId });
          return;
        }
        setState({ state: 'completed', operationId });
      } catch (e) {
        if (operationIdRef.current !== operationId) return; // superseded by a new send
        bufferRef.current?.flushNow(); // retain partial text for the failed bubble
        if (isAbortError(e)) {
          // Surface-initiated cancel (no stop control this phase — a new send
          // or an unmount) — not a provider failure, no error surface.
          setState({ state: 'idle' });
          return;
        }
        const cls = getProviderRouter().classifyProviderError(e);
        debugLog(cls.code, 'chat turn failed', {
          module: 'useStreamingLLM',
          error: e instanceof Error ? e : undefined,
          extra: { operationId },
        });
        // D-17: NETWORK-class after the Router retry layer → offline notice;
        // everything else → the failed bubble (partial text + Retry).
        setState(
          cls.code === ERROR_CODES.NETWORK
            ? { state: 'offline', operationId }
            : { state: 'failed', operationId },
        );
      }
    },
    [activeSurface, workspaceId],
  );

  const retry = useCallback(() => {
    const last = lastUserInputRef.current;
    if (last) void send(last); // NEW operationId inside send()
  }, [send]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { state, text, send, retry, abort };
}
