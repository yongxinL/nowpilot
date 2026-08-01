export type PipelineProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export type ModelTier = 'FAST' | 'BALANCED' | 'ADVANCED';

export type PipelineErrorCode =
  | 'PROVIDER_AUTH'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_5XX'
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'MODEL_UNKNOWN'
  | 'SCHEMA_INVALID'
  | 'NO_SUCH_TOOL'
  | 'INVALID_TOOL_INPUT'
  | 'TIER_CAP_REACHED'
  | 'CIRCUIT_OPEN'
  | 'ABORTED'
  | 'CONTEXT_TOO_LARGE'
  | 'AGENT_STATE_INVALID'
  | 'TOOL_POSTCONDITION_FAILED'
  | 'COMPLETION_EVIDENCE_MISSING'
  | 'TOOL_IDEMPOTENCY_CONFLICT'
  | 'UNKNOWN';

export type PipelineErrorCategory = 'retryable' | 'terminal';

export type PlannerDecision =
  | { action: 'answer'; reasonCode: string }
  | { action: 'run_tool'; toolName: string; input: unknown }
  | { action: 'ask_clarification'; question: string };

export interface PlannerContext {
  version: 1;
  userMessage: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  toolCallHistory: Array<{ toolName: string; input: unknown; output: unknown; timestamp: number }>;
  availableTools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  personaBehavior: { brevity: string; clarificationStrategy: string; reasoningStyle: string } | null;
  abortSignal?: AbortSignal;
}

/**
 * Context window tier classification per spec §2.1.
 * tiny ≤4K, small ≤16K, medium ≤128K, large >128K.
 */
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

/**
 * A single assembled prompt section (spec §2.3). `stable` is read-only
 * metadata set during assembly (D-14) — never mutated by degradation or
 * cache preparation.
 */
export interface PromptSection {
  kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
}

export interface ContextProvenanceEntry {
  kind: PromptSection['kind'];
  sourceId: string;
  tokens: number;
  truncated: boolean;
  compressionApplied?: 'summarise' | 'structural' | 'topk';
}

/**
 * Source-level provenance manifest (spec §2.6, D-17): one entry per distinct
 * data source, keyed by hierarchical dot-separated sourceId (D-18).
 *
 * Phase 4b (D-03, CTX-T03): sections carry ContextReceiptEntry fields —
 * receipt entries ARE provenance entries, extended with inclusion, omission,
 * and cache-eligibility bookkeeping.
 */
export interface ContextProvenanceManifest {
  sections: ContextReceiptEntry[];
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'full-app';
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4b — Trust-aware context contracts (D-01, D-03, D-06, D-07, D-09)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Data-sensitivity classification (D-09). Severity order:
 * public < private < confidential < secret. `secret` items must never
 * become ContextItem instances — ContextItemSchema rejects them (D-09).
 */
export type Sensitivity = 'public' | 'private' | 'confidential' | 'secret';

/**
 * Who authored a context source (D-06/D-07): system instructions, explicit
 * user interaction, or machine-produced data. Trust validation and section
 * ordering (system → user → data) derive from this — never self-assigned.
 */
export type InstructionAuthority = 'system' | 'user' | 'data';

/**
 * Compact skill capability summary for progressive disclosure (CTX-T05, P1).
 * Just enough for the planner to decide relevance — the full skill
 * instructions are only materialized when the skill is loaded. Summaries are
 * authored by developers in a static registry (T-04b-20 accept: never
 * user-generated content).
 */
export interface SkillSummary {
  name: string;
  description: string;
  capabilityKeywords: string[];
}

/** Why a context source was omitted from the final prompt (CTX-T03). */
export type OmissionReason = 'budget' | 'irrelevant' | 'stale' | 'sensitive' | 'policy';

/**
 * Trust-aware context item (D-01): a PromptSection-shaped payload plus trust
 * metadata assigned by source adapters. The wrapper is SEPARATE from
 * PromptSection — metadata is stripped by unwrapToPromptSections() before
 * any provider sees prompt text (D-01).
 */
export interface ContextItem extends PromptSection {
  relevance: number;
  freshness: number;
  trust: number;
  sensitivity: Sensitivity;
  instructionAuthority: InstructionAuthority;
  createdAt?: number;
  expiresAt?: number;
}

/**
 * Context receipt entry (D-03, CTX-T03): extends ContextProvenanceEntry with
 * original/final token counts, inclusion status, omission reason, and cache
 * eligibility. Receipt entries never carry raw text (T-04b-03).
 */
export interface ContextReceiptEntry extends ContextProvenanceEntry {
  originalTokens: number;
  finalTokens: number;
  included: boolean;
  omissionReason?: OmissionReason;
  cacheEligible: boolean;
}

/**
 * The context produced by ContextOptimizer.optimize() — the single contract
 * consumed by PlannerService and RendererService (D-01, D-04).
 */
export interface OptimizedContext {
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
  /**
   * Prompt cache metadata computed at the final stage of optimize() (D-13).
   * cacheKeyHash is the FNV-1a hash of stable sections (D-16); the actual
   * per-provider cache hint transformation happens after provider selection
   * via PromptCacheManager.prepareCacheHints().
   */
  cacheMetadata?: {
    cacheKeyHash: string;
    stableSectionCount: number;
    /**
     * Per-section FNV-1a hashes (CTX-T04, D-04): one hash per stable
     * section, keyed by sourceId. When the combined hash changes across
     * turns, the differing per-section hashes identify exactly which
     * section drifted — diagnostic drift detection for the stable-prefix
     * contract. Volatile sections never appear here.
     */
    perSectionHashes?: Array<{ sourceId: string; hash: string }>;
  };
}

export interface ToolSchemaInfo {
  name: string;
  description: string;
  jsonSchema?: unknown;
  dangerous?: boolean;
  source?: string;
  /**
   * Optional tool implementation (WR-04): when present it is forwarded to
   * the registered tool so the orchestrator's run_tool loop can actually
   * execute work. The orchestrator rejects a selected tool without an
   * implementation with SCHEMA_INVALID rather than silently stubbing a
   * null-returning executor.
   */
  execute?: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
  /**
   * Phase 3a selected-tool adapter handoff (D-08/D-16): the same three
   * reliability metadata fields as RegisteredTool, so the orchestrator can
   * forward them from the optimizer path. No Phase 8a manifest fields
   * (category, risk, permissions, dataScopes, timeout, costClass, schema
   * hashes, discovery) are permitted here.
   */
  sideEffect?: ToolSideEffect;
  idempotency?: ToolIdempotency;
  evidence?: ToolEvidencePolicy;
}

/**
 * Raw input to ContextOptimizer.optimize(). Optional sources (pageContext,
 * memoryHints, preferences) are skipped with graceful no-ops when absent
 * (D-05).
 */
export interface ContextOptimizerInput {
  operationId: string;
  model: string;
  modelContextWindow: number;
  userInput: string;
  conversationId: string;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'full-app';
  pageContext?: unknown;
  selectedToolSchemas: ToolSchemaInfo[];
  memoryHints: unknown[];
  preferences: {
    responseStyle?: string;
    preferredLanguage?: string;
    preferStructuredOutput?: boolean;
    allowCloudFallbackFromLocal?: boolean;
    defaultProviderId?: string;
    toolAutonomy?: string;
    defaultSurface?: 'sidepanel' | 'full-app';
    themeMode?: string;
    personaId?: string;
    personaOverrides?: unknown;
  };
  /**
   * Runtime pass-through signal for the optimizer/orchestrator path (Phase
   * 3a). It is never assembled into prompt sections — it is an
   * orchestration control, not prompt data.
   */
  abortSignal?: AbortSignal;
  /**
   * Skills the planner considered but decided NOT to load (CTX-T05, P1).
   * The optimizer never decides skill selection — it only records the
   * planner's policy omission in the receipt: each name gets an
   * `included:false` entry with `omissionReason:'policy'` and zero token
   * cost, so unloaded skills are visible to diagnostics without consuming
   * prompt tokens. Optional — when absent, no unloaded-skill receipt
   * entries are created.
   */
  unloadedSkillNames?: string[];
}

/**
 * Raw conversational input for a turn (D-03) — replaces PlannerContext as
 * the agent entry contract. AgentOrchestrator.runTurn() accepts this type.
 */
export interface AgentTurnInput {
  operationId: string;
  model: string;
  modelContextWindow: number;
  userInput: string;
  conversationId: string;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'full-app';
  providerId: PipelineProviderId;
  tier: ModelTier;
  selectedToolSchemas: ToolSchemaInfo[];
  memoryHints: unknown[];
  preferences: ContextOptimizerInput['preferences'];
  personaBehavior: PlannerContext['personaBehavior'];
  abortSignal?: AbortSignal;
  /**
   * Operation-scoped permission gate (D-03/AGT-01). The orchestrator
   * consults this callback before executing side-effecting tools; it
   * resolves to granted, denied, or cancelled with an attributable
   * user/caller origin when known.
   */
  requestPermission?: (request: PermissionRequest) => Promise<PermissionDecision>;
}

export type StreamEvent =
  | { type: 'text-delta'; content: string }
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; output: unknown }
  | { type: 'error'; error: import('./PipelineError').PipelineError }
  | { type: 'done'; usage?: { promptTokens: number; completionTokens: number } };

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
  /**
   * Phase 3a reliability metadata (D-08/D-16). Exactly these three
   * forward-compatible fields — the full ToolCapabilityManifest (category,
   * risk, permissions, dataScopes, timeout, costClass, schema hashes,
   * active discovery) remains Phase 8a responsibility.
   */
  sideEffect?: ToolSideEffect;
  idempotency?: ToolIdempotency;
  evidence?: ToolEvidencePolicy;
}

export interface ToolExecutionResult {
  toolName: string;
  output: unknown;
  durationMs: number;
  /**
   * Distinct identity of the logical tool call (Phase 3a). ExecutorService
   * supplies it for every execution; evidence references it.
   */
  toolCallId: string;
  /**
   * Attached CompletionEvidence — populated for completed idempotent
   * duplicates and via ExecutorService.attachEvidence (validated cache
   * seam). Never carries raw output or the logical key.
   */
  evidence?: CompletionEvidence;
}

export const TIER_CAPS: Record<ModelTier, { planner: number; tool: number }> = {
  FAST: { planner: 3, tool: 2 },
  BALANCED: { planner: 5, tool: 3 },
  ADVANCED: { planner: 7, tool: 5 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3a — Agent reliability & evidence contracts (D-01..D-09, D-16, D-17)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ten explicit trajectory states (AGT-01, D-03). Terminal states
 * (completed/failed/aborted) have empty transition allowlists.
 */
export type AgentTrajectoryState =
  | 'assembling-context'
  | 'planning'
  | 'waiting-for-permission'
  | 'executing'
  | 'verifying'
  | 'replanning'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'aborted';

export const AGENT_TRAJECTORY_STATES: readonly AgentTrajectoryState[] = [
  'assembling-context',
  'planning',
  'waiting-for-permission',
  'executing',
  'verifying',
  'replanning',
  'rendering',
  'completed',
  'failed',
  'aborted',
];

/**
 * D-04 strict transition allowlist. Every legal edge is explicit and
 * independently reviewable; terminal states permit no further transitions.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<AgentTrajectoryState, readonly AgentTrajectoryState[]>
> = {
  'assembling-context': ['planning', 'failed', 'aborted'],
  planning: ['waiting-for-permission', 'executing', 'rendering', 'failed', 'aborted'],
  'waiting-for-permission': ['executing', 'rendering', 'failed', 'aborted'],
  executing: ['verifying', 'replanning', 'rendering', 'failed', 'aborted'],
  verifying: ['replanning', 'rendering', 'failed', 'aborted'],
  replanning: ['planning', 'rendering', 'failed', 'aborted'],
  rendering: ['completed', 'failed', 'aborted'],
  completed: [],
  failed: [],
  aborted: [],
};

/**
 * One immutable trajectory record (D-07). `exitedAt`/`durationMs` are null
 * while the entry is open; AgentTrajectoryMachine finalizes them on close.
 */
export interface TrajectoryStateEntry {
  state: AgentTrajectoryState;
  enteredAt: number;
  exitedAt: number | null;
  durationMs: number | null;
  reasonCode?: string;
  plannerCall?: number;
  toolCall?: number;
  toolName?: string;
}

/**
 * Side-effect classification (D-08/D-16). `irreversible` blocks replanning.
 */
export type ToolSideEffect = 'none' | 'read' | 'write' | 'irreversible';

/**
 * Idempotency posture (D-08/D-16). Only `required` is enforced by
 * ExecutorService in Phase 3a (D-17); durable cross-turn guarantees are
 * Phase 8a.
 */
export type ToolIdempotency = 'not-required' | 'supported' | 'required';

/**
 * A safe, bounded evidence check (D-09/T-03a-04). Checks carry a name,
 * pass/fail, an expected scalar or reference, an actual reference, and a
 * bounded message — never raw tool output, secrets, or logical keys.
 */
export interface CompletionEvidenceCheck {
  checkId: string;
  name: string;
  passed: boolean;
  expected?: string | number | boolean | null;
  actualRef?: string;
  message?: string;
}

/**
 * Bounded reference to a verified artifact (e.g. a created note), not the
 * artifact payload itself.
 */
export interface CompletionResultRef {
  type: string;
  ref: string;
}

export type EvidenceVerifierType = 'schema' | 'environment' | 'read-after-write' | 'tool-provided';

export interface ToolEvidenceVerifier {
  type: EvidenceVerifierType;
  check: (result: unknown, signal?: AbortSignal) => Promise<CompletionEvidenceCheck[]>;
}

export interface ToolEvidencePolicy {
  required: boolean;
  verifier?: ToolEvidenceVerifier;
}

export type EvidenceFailureReason =
  | 'postcondition_failed'
  | 'evidence_unavailable'
  | 'verification_timeout'
  | 'verification_error'
  | 'aborted';

/**
 * Structured discriminated union of completion evidence (D-09). Verified
 * evidence carries safe checks and an optional result reference; unverified
 * evidence carries a closed failure reason and retryability. Shared fields:
 * id, operationId, toolCallId, toolName, verifiedAt, durationMs.
 */
export type CompletionEvidence =
  | {
      id: string;
      operationId: string;
      toolCallId: string;
      toolName: string;
      verified: true;
      verifierType: EvidenceVerifierType;
      checks: readonly CompletionEvidenceCheck[];
      resultRef?: CompletionResultRef;
      verifiedAt: number;
      durationMs: number;
    }
  | {
      id: string;
      operationId: string;
      toolCallId: string;
      toolName: string;
      verified: false;
      failureReason: EvidenceFailureReason;
      retryable: boolean;
      verifiedAt: number;
      durationMs: number;
    };

export type PermissionOrigin = 'user' | 'caller';

export interface PermissionRequest {
  toolName: string;
  operationId: string;
  toolCallId: string;
  sideEffect: ToolSideEffect;
  reason?: string;
}

export type PermissionDecision =
  | { decision: 'granted'; origin?: PermissionOrigin }
  | { decision: 'denied'; origin?: PermissionOrigin }
  | { decision: 'cancelled'; origin?: PermissionOrigin };

/**
 * Redacted observation handed to the planner on a replan recovery call
 * (D-14/D-15). Carries only safe, code-allowlisted diagnostics — never raw
 * input, exception text, secrets, or logical idempotency keys.
 *
 * Plan 02 additive fields (all optional, so existing consumers are
 * unaffected): the pure ReplanPolicy consumes `sideEffect`,
 * `effectKnownNotStarted`, `aborted`, and `caps` at both evaluation
 * checkpoints. `effectKnownNotStarted` is true ONLY on proven
 * failed-before-effect (diagnostic.effectStarted === false); every other
 * failure state is unresolved and never re-executed.
 */
export interface ReplanContext {
  operationId: string;
  replanCount: number;
  toolName?: string;
  toolCallId?: string;
  cause?: import('./PipelineError').PipelineErrorProjection;
  priorToolResults: readonly ToolExecutionResult[];
  sideEffect?: ToolSideEffect;
  effectKnownNotStarted?: boolean;
  aborted?: boolean;
  caps?: {
    plannerCalls: number;
    plannerCap: number;
    plannerCapReached: boolean;
    toolCalls: number;
    toolCap: number;
    toolCapReached: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4b — ContextItem Zod schemas re-exported from the context layer so
// consumers import types + validation from one place (D-01).
// ─────────────────────────────────────────────────────────────────────────────
export {
  ContextItemSchema,
  SensitivitySchema,
  InstructionAuthoritySchema,
  unwrapToPromptSections,
} from '../context/ContextItem';
