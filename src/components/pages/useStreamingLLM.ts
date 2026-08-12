// src/components/pages/useStreamingLLM.ts — D-01 co-located streaming hook
// (Phase-7 promotion target: src/hooks/useStreamingLLM.ts, Appendix J.2
// reference). Golden Rule 3: the ONLY prompt assembly on the UI path is the
// context layer (04-04 ContextOptimizer, D-04-08 — it replaced the deleted
// Phase-3 context-helper module) — this hook imports ContextOptimizer, never
// builds prompts.
//
// send() threads the §2.3 OptimizedContext (per-stage ContextOptimizer, 04-06
// rewire) through the 03-05 createStageInvocation StageResolver closure into
// 03-06 runAgentTurn, streaming renderer deltas into the Appendix J.1 ChunkBuffer
// (rAF flush → the growing assistant Bubble text). abort() cancels generation so
// no orphaned request bills tokens (§17.5 one stream per session — a new send
// aborts the previous). Phase-3 stream state is IN-MEMORY per surface (D-03/D-14):
// the session stream key stays writeAllowed:false in Setting.ts (D-11) — nothing
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
import { optimize, isContextTooLargeError } from '@/core/context/ContextOptimizer';
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

/**
 * D-04-04 pre-resolution fallback ONLY — never the primary source: per-stage
 * budgets derive from each StageInvocation's modelContextWindow (04-05 stamp)
 * via ContextOptimizer, so the fallback tier/window are contract documentation.
 * The pair is internally consistent: classifyModelContext(131_072) === 'medium'
 * === DEFAULT_CONTEXT_TIER (a 16_384 fallback would derive 'small' and
 * contradict the retained 'medium' constant — the fallback window and the
 * fallback tier must never disagree). Exported for the consistency assertion
 * (04-06 Task-2 vitest); budgets come from TokenBudget now — the Phase-3
 * DEFAULT_INPUT/OUTPUT_BUDGET constants are removed.
 */
export const DEFAULT_CONTEXT_TIER: ModelContextTier = 'medium';
export const FALLBACK_MODEL_CONTEXT_WINDOW = 131_072;

/**
 * The UI-SPEC surface state machine (D-01): idle / streaming / completed /
 * failed / offline, each carrying the turn's operationId. Phase-3 stream state
 * is in-memory per-surface (D-03/D-14) — no persistence, no session key.
 *
 * WR-04 (04): the failed terminal carries an optional `reason` discriminator —
 * 'too_long' marks the D-04-15 CONTEXT_TOO_LARGE honest terminal so the surface
 * can render STR.chat.messageTooLong and suppress Retry (re-sending the same
 * oversized input lands in the same terminal). Any other failure has no reason.
 */
export type ChatStreamState =
  | { state: 'idle' }
  | { state: 'streaming'; operationId: string }
  | { state: 'completed'; operationId: string }
  | { state: 'failed'; operationId: string; reason?: 'too_long' }
  | { state: 'offline'; operationId: string };

export interface UseStreamingLLMResult {
  state: ChatStreamState;
  /** The current streamed text (grows via ChunkBuffer flush). */
  text: string;
  /**
   * Start a turn: per-stage ContextOptimizer (04-06) → StageResolver over
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
        // DEFAULT_PERSONA fallback) feeds the optimizer's byte-stable block.
        const prefs = await readPersonaPrefs();
        const persona = resolvePersona(DEFAULT_PERSONA, prefs);
        const personaBlock = buildPersonaBlock(persona);
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
        // D-04-04/05: resolve BOTH stages upfront, read each StageInvocation's
        // modelContextWindow (04-05 stamp), and run ContextOptimizer.optimize
        // once per stage — tier + §2.2 budgets derive from the resolved window,
        // never the pre-resolution fallback. Golden Rule 3 (Pitfall 7): the hook
        // imports ContextOptimizer + capsForTier — it NEVER assembles prompts or
        // computes budget math; compact prompt text lives only in
        // src/core/prompts/index.ts (04-04).
        const plannerInv = invocation('planner');
        const rendererInv = invocation('renderer');
        const optimizerBase = {
          operationId,
          userInput: trimmed,
          personaBlock,
          conversationId: 'default', // A11 (04-04): no conversation store until Phase 7
          workspaceId,
          activeSurface,
          selectedToolSchemas: [],
          memoryHints: [],
          preferences: prefs,
          pageContext: undefined,
        };
        const plannerCtx = optimize({
          ...optimizerBase,
          model: plannerInv.model.modelId,
          modelContextWindow: plannerInv.modelContextWindow,
          stage: 'planner',
        });
        const rendererCtx = optimize({
          ...optimizerBase,
          model: rendererInv.model.modelId,
          modelContextWindow: rendererInv.modelContextWindow,
          stage: 'renderer',
        });
        const result = await runAgentTurn({
          operationId,
          userInput: trimmed,
          context: plannerCtx,
          abortSignal: controller.signal,
          // D-04-05 (locked): the PLANNER-stage tier governs the loop caps —
          // planner and renderer may resolve DIFFERENT tiers (T-04-27).
          tier: capsForTier(plannerCtx.tier),
          onStreamDelta: (delta) => bufferRef.current?.enqueue(delta),
          invocation,
          contextForStage: (stage) => (stage === 'planner' ? plannerCtx : rendererCtx),
        });
        if (operationIdRef.current !== operationId) return; // superseded by a new send
        bufferRef.current?.flushNow();
        // D-3a-19 (AGT-03): map the honest AgentTurnOutcome.status to the
        // surface state machine — completed → completed; partial|failed →
        // failed (partial text retained + Retry, NEVER 'completed' — a capped
        // turn is honest non-completion); aborted → idle. ChatStreamState is
        // unchanged (idle/streaming/completed/failed/offline) — only the
        // mapping source changed from reasonCode-as-terminal to status.
        if (result.reasonCode === 'provider_unconfigured') {
          // D-07 gate is the shell's job; a defensively-surfaced
          // provider_unconfigured reasonCode is an honest failed terminal
          // (status 'failed' — unchanged UX, D-3a-19).
          setState({ state: 'failed', operationId });
          return;
        }
        if (result.status === 'completed') {
          setState({ state: 'completed', operationId });
          return;
        }
        if (result.status === 'aborted') {
          setState({ state: 'idle' });
          return;
        }
        // partial | failed (incl. provider_unconfigured) → the failed bubble.
        setState({ state: 'failed', operationId });
      } catch (e) {
        if (operationIdRef.current !== operationId) return; // superseded by a new send
        bufferRef.current?.flushNow(); // retain partial text for the failed bubble
        if (isAbortError(e)) {
          // Surface-initiated cancel (no stop control this phase — a new send
          // or an unmount) — not a provider failure, no error surface.
          setState({ state: 'idle' });
          return;
        }
        if (isContextTooLargeError(e)) {
          // D-04-15 honest terminal (T-04-25): the turn cannot fit the model's
          // window even in minimal mode — surface the messageTooLong failed
          // state, NEVER silently truncate the user's input (P4-10). Returns
          // BEFORE classifyProviderError (T-04-28: no section/user text logged).
          // WR-01 (04): GR-9 mandates the canonical code on this real error
          // path — module + operationId only, no user text (R-10). WR-04 (04):
          // the reason discriminator lets the surface render
          // STR.chat.messageTooLong and suppress Retry (the same oversized
          // input can never succeed via a re-send).
          debugLog(ERROR_CODES.CONTEXT_TOO_LARGE, 'context too large — minimal mode exceeded', {
            module: 'useStreamingLLM',
            extra: { operationId },
          });
          setState({ state: 'failed', operationId, reason: 'too_long' });
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
