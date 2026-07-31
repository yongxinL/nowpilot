# NowPilot Additional Requirements

**Document ID:** `NOWPILOT_ADDITIONAL_REQUIREMENTS_AGENT_HARNESS.md`  
**Status:** Proposed implementation amendment for `PRODUCT_SPEC_v0_1.md`  
**Date:** 2026-07-31  
**Scope:** Requirements learned from Agent Fundamentals, Context Engineering, User Memory and Knowledge, Tools, Agent Evaluation, Continual Evolution, and Multimodality/Real-Time Interaction.  
**Implementation target:** Cost-effective coding models such as Claude Haiku, Gemini Flash, DeepSeek Flash, or equivalent.  

## 0. How to use this document

This document is an amendment, not a replacement for the canonical product specification. Implementers must:

1. Read `PRODUCT_SPEC_v0_1.md` §§0–5 before writing code.
2. Read the existing phase and appendix for the target subsystem.
3. Implement only one new sub-phase per response unless explicitly instructed otherwise.
4. Use only existing canonical paths unless this document explicitly defines a new path.
5. Add a Zod schema and at least one fixture for every new public boundary.
6. Add a pre-fix failing test for each behavioural change.
7. Preserve local-first privacy, bounded agent loops, extraction-only content scripts, and the existing Planner → Executor → Renderer pipeline.

## 1. Architectural conclusion

NowPilot already implements the correct high-level formula:

```text
Agent = Reasoning Engine + Working Context + Action Interfaces
```

The upgrade should strengthen the harness rather than increase autonomy:

```text
AgentTurnInput
  → ContextAssembler
  → ContextOptimizer
  → AgentOrchestrator
      → PlannerService
      → ExecutorService
      → OutcomeVerifier
      → RendererService
  → TrajectoryEvaluator
  → Memory / Experience Candidates
```

### 1.1 Decisions that remain unchanged

- `AgentOrchestrator` remains bounded by tier-specific planner/tool caps.
- The LLM never executes tools directly.
- `ExecutorService` remains deterministic and persona-free.
- `RendererService` remains the only user-facing generation gateway.
- `ContextOptimizer` remains the only authority for prompt packing, budgeting, compression, degradation, and provenance.
- Notes remain user-owned; memory remains system-owned.
- Content scripts remain extraction-only in v0.1.
- Browser control and host-page write-back remain deferred.
- Local persistence and local providers remain first-class.

## 2. Requirement conventions

**Priority**

- **P0:** Required to close a reliability, privacy, or verifiability gap in v0.1.
- **P1:** Recommended immediately after the P0 foundation.
- **P2:** Advanced capability; defer until P0/P1 evaluation gates are stable.

**Requirement format**

Each requirement includes a target sub-phase and acceptance criteria so a cost-effective coding model can implement it without inventing architecture.

---

## 3. Agent Runtime and Verification

### AGT-01 — Explicit trajectory state

**Priority:** P0  
**Target:** Phase 3a  
**Create:** `src/core/ai/AgentTrajectoryState.ts`

```ts
export type AgentTrajectoryState =
  | { state: 'assembling-context'; operationId: string }
  | { state: 'planning'; operationId: string; plannerCall: number }
  | { state: 'waiting-for-permission'; operationId: string; toolName: string }
  | { state: 'executing'; operationId: string; toolName: string; toolCall: number }
  | { state: 'verifying'; operationId: string; toolName?: string }
  | { state: 'replanning'; operationId: string; reasonCode: string }
  | { state: 'rendering'; operationId: string }
  | { state: 'completed'; operationId: string; reasonCode: string }
  | { state: 'failed'; operationId: string; errorCode: string }
  | { state: 'aborted'; operationId: string };
```

**Rules**

- Record state transitions, not hidden chain-of-thought.
- Only `AgentOrchestrator` changes trajectory state.
- Every transition is emitted to `AITransactionLog` as metadata.
- Invalid transitions return `AGENT_STATE_INVALID`; they do not silently continue.

**Acceptance**

- Unit tests cover every permitted transition.
- A fixture rejects `completed → executing` and `failed → rendering`.
- Diagnostics can reconstruct the ordered state sequence from metadata only.

### AGT-02 — Evidence-backed completion

**Priority:** P0  
**Target:** Phase 3a  
**Create:** `src/core/ai/OutcomeVerifier.ts`

```ts
export interface CompletionEvidence {
  operationId: string;
  toolName?: string;
  resultRef?: string;
  postcondition?: string;
  verified: boolean;
  verifierType: 'schema' | 'environment' | 'user' | 'none';
  verifiedAt: number;
}
```

**Rules**

- Side-effecting tasks require verified evidence before terminal success.
- Transport success alone is insufficient when an environment postcondition is available.
- `RendererService` must not claim an action was sent, created, updated, deleted, exported, or completed without matching evidence.
- Read-only answer tasks may use `verifierType: 'none'` with a grounded-answer reason code.

**Acceptance**

- Tests fail when rendered text claims a write succeeded but no matching evidence exists.
- `create-note` verifies note ID/version in `NotesDB`.
- `export-data` verifies the generated artefact reference.
- Verification failures produce `TOOL_POSTCONDITION_FAILED` and do not retry irreversibly.

### AGT-03 — Structured turn outcome

**Priority:** P0  
**Target:** Phase 3a  
**Modify:** `AgentTurnOutput`

```ts
export interface AgentTurnOutcome {
  operationId: string;
  terminalState: 'completed' | 'partial' | 'failed' | 'aborted';
  reasonCode: string;
  plannerCalls: number;
  toolCalls: number;
  completionEvidence: CompletionEvidence[];
  startedAt: number;
  endedAt: number;
}
```

**Acceptance**

- Every exit path returns or records an `AgentTurnOutcome`.
- Cap exhaustion is `partial`, not `completed`.
- Abort does not render a success answer.
- The type has a canonical Zod schema and fixtures.

### AGT-04 — Deterministic replanning policy

**Priority:** P0  
**Target:** Phase 3a

**Rules**

- Successful tool result + sufficient information → verify → render.
- Successful tool result + planner indicates more information required → replan within cap.
- Retryable tool failure → at most one replan for an alternative.
- Permission, auth, schema, unknown-tool, and non-retryable validation failures → terminal/user action.
- No retry after an irreversible action unless idempotency proves replay safety.

**Acceptance**

- Fixtures cover success, recoverable failure, permission denial, auth failure, timeout, cap exhaustion, and abort.

---

## 4. Trust-Aware Context Engineering

### CTX-01 — ContextItem contract

**Priority:** P0  
**Target:** Phase 4b  
**Create:** `src/core/context/ContextItem.ts`

```ts
export interface ContextItem {
  sourceId: string;
  kind: PromptSection['kind'];
  text: string;
  estimatedTokens: number;
  relevance: number;   // 0..1
  freshness: number;   // 0..1
  trust: number;       // 0..1
  sensitivity: 'public' | 'private' | 'confidential' | 'secret';
  instructionAuthority: 'system' | 'user' | 'data';
  stable: boolean;
  createdAt?: number;
  expiresAt?: number;
}
```

**Rules**

- User input is `user`; page content, notes, memory text, and tool results are `data`.
- Only canonical system/persona/policy content is `system`.
- Scores are metadata for selection, never instructions to the model.
- Secret items are excluded from cloud prompts and logs.

### CTX-02 — Trust boundary and prompt-injection isolation

**Priority:** P0  
**Target:** Phase 4b

Retrieved data must not:

- redefine system/persona instructions;
- grant tool permission;
- add tools or modify schemas;
- change risk classifications;
- request disclosure of secrets;
- become procedural memory or an active prompt without verification.

**Acceptance**

- Injection fixtures from page HTML, a note, memory text, and tool output cannot alter tool availability or permission outcomes.
- The raw malicious string may remain available as quoted data when relevant, but never as an instruction.

### CTX-03 — Context receipt

**Priority:** P0  
**Target:** Phase 4b  
**Modify:** `ContextProvenanceManifest`

```ts
export interface ContextReceiptEntry {
  sourceId: string;
  kind: PromptSection['kind'];
  originalTokens: number;
  finalTokens: number;
  included: boolean;
  truncated: boolean;
  compressionApplied?: 'summarise' | 'structural' | 'topk';
  omissionReason?: 'budget' | 'irrelevant' | 'stale' | 'sensitive' | 'policy';
  cacheEligible: boolean;
}
```

**Acceptance**

- Prompt Inspector explains inclusion, compression, and omission without displaying raw sensitive text.
- Receipt totals equal packed section totals.
- Source IDs remain source-level, dot-separated hierarchical IDs.

### CTX-04 — Stable-prefix contract

**Priority:** P0  
**Target:** Phase 4b

- Persona, system rules, and sorted tool schemas must be byte-identical for identical configuration.
- Volatile sections always follow stable sections.
- Snapshot tests fail on unexpected whitespace/order changes.

### CTX-05 — Progressive skill disclosure

**Priority:** P1  
**Target:** Phase 4b / 8a

- Load compact summaries for registered skills.
- Load full instructions only for selected/relevant skills.
- Irrelevant skills consume zero prompt tokens.
- The context receipt records which skill instructions were loaded.

### CTX-06 — Context quality telemetry

**Priority:** P1  
**Target:** Phase 6a

Record:

- injected-source count by kind;
- percentage of injected sources cited or used;
- compression ratio;
- omission reasons;
- provenance coverage;
- context-related failure category.

Raw sensitive content remains excluded.

---

## 5. Memory and Knowledge Governance

### MEM-01 — Memory taxonomy

**Priority:** P0  
**Target:** Phase 5b

```ts
export type MemoryType =
  | 'working'
  | 'episodic'
  | 'semantic'
  | 'preference'
  | 'procedural';
```

- Working: current turn and in-flight task state.
- Episodic: a verified past task/event.
- Semantic: durable facts about user/projects/world.
- Preference: user-controlled behaviour/configuration.
- Procedural: verified condition → strategy guidance.
- Notes remain outside MemoryDB as user-owned knowledge.

### MEM-02 — Evidence and lifecycle

**Priority:** P0  
**Target:** Phase 5b

```ts
export interface MemoryRecord {
  id: string;
  type: MemoryType;
  subjectKey: string;
  content: string;
  sourceRef: string;
  sourceType: 'explicit-user' | 'verified-tool' | 'note' | 'inference';
  confidence: number;
  sensitivity: 'private' | 'confidential' | 'secret';
  status: 'active' | 'superseded' | 'disputed' | 'forgotten';
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt?: number;
  expiresAt?: number;
  supersedes?: string;
}
```

**Acceptance**

- Durable memory without source/confidence fails validation.
- Forgotten records are immediately excluded from retrieval.
- Secret records never enter cloud context.

### MEM-03 — Conflict resolution

**Priority:** P0  
**Target:** Phase 5b

Precedence:

```text
explicit user correction
> verified current external state
> previous explicit memory
> inferred memory
```

- Contradictions are preserved as history.
- The losing record becomes `superseded` or `disputed`.
- No silent merge of incompatible values.

### MEM-04 — User memory controls

**Priority:** P0  
**Target:** Phase 7

Memory UI must support view, source, confidence, edit, pin, forget, disable by type, export, and exclude from cloud context.

### MEM-05 — Procedural experience store

**Priority:** P1  
**Target:** Phase 5b / 6b

```ts
export interface ProceduralExperience {
  id: string;
  conditions: string[];
  strategy: string[];
  evidenceRefs: string[];
  outcome: 'success' | 'partial' | 'failure';
  confidence: number;
  version: number;
  status: 'candidate' | 'approved' | 'disabled' | 'superseded';
}
```

Only verified trajectories may create candidates. A candidate is not active until evaluation and approval.

### KNW-01 — Knowledge-edge provenance

**Priority:** P1  
**Target:** Phase 5b

```ts
export type KnowledgeEdgeSource =
  | 'explicit-wikilink'
  | 'imported-frontmatter'
  | 'ai-suggested'
  | 'accepted-suggestion';
```

AI-suggested edges remain proposals until accepted.

---

## 6. Tool Capability and Governance

### TOL-01 — ToolCapabilityManifest

**Priority:** P0  
**Target:** Phase 8a  
**Create:** `src/core/ai/ToolCapabilityManifest.ts`

```ts
export interface ToolCapabilityManifest {
  name: string;
  category: 'perception' | 'execution' | 'collaboration' | 'event' | 'communication';
  risk: 'none' | 'low' | 'medium' | 'high';
  sideEffect: 'none' | 'reversible' | 'irreversible';
  permissions: string[];
  dataScopes: string[];
  timeoutMs: number;
  costClass: 'free' | 'local' | 'metered';
  idempotency: 'not-needed' | 'supported' | 'required';
  verifier?: string;
  inputSchemaHash: string;
  outputSchemaHash: string;
}
```

Registry rejects incomplete manifests.

### TOL-02 — Risk-based execution matrix

**Priority:** P0  
**Target:** Phase 8a

- Perception/read-only + low risk: execute according to user autonomy setting.
- Reversible writes: require confirmation or a prior scoped grant.
- Irreversible/high risk: always preview and explicitly confirm.
- Permission grants are scoped to tool, workspace/add-on, and data scope.

### TOL-03 — Postcondition verification

**Priority:** P0  
**Target:** Phase 3a / 8a

Every side-effecting tool declares a verifier. Unverified transport success is represented as `partial` rather than `completed`.

### TOL-04 — Tool result shaping

**Priority:** P0  
**Target:** Phase 4b / 8a

Before tool output re-enters context:

1. validate output schema;
2. redact secrets;
3. apply maximum size;
4. summarise or retrieve relevant sections;
5. assign source-level provenance and trust metadata.

### TOL-05 — Idempotency

**Priority:** P0  
**Target:** Phase 8a

Write tools must accept or derive an idempotency key. Replay after retry, journal recovery, or surface reload must not repeat external effects.

### TOL-06 — Active tool discovery

**Priority:** P1  
**Target:** Phase 8a

When tool-schema tokens exceed the configured tools allocation:

- expose a small core set;
- expose a read-only `discover-tools` capability;
- return only relevant manifests;
- require normal permission checks before execution.

### TOL-07 — Long-running operation contract

**Priority:** P2  
**Target:** Future Phase 8b

Asynchronous operations use `operationId`, status, progress, cancellation, checkpoint, resume, and idempotency. Do not hide long-running work inside the synchronous turn loop.

---

## 7. Agent Evaluation

### EVAL-01 — Versioned golden task suite

**Priority:** P0  
**Target:** Phase 6a  
**Create:** `tests/evals/**`

Suites:

- planner union and structured repair;
- page grounding and prompt injection;
- tool choice and arguments;
- permission and risk policy;
- provider retry/fallback;
- memory retrieval, conflict, expiry, and forget;
- notes RAG and citations;
- commitment/action consistency;
- multimodal routing and privacy.

### EVAL-02 — Trajectory rubric

**Priority:** P0  
**Target:** Phase 6a

Evaluate independently:

- task outcome;
- plan sufficiency;
- tool choice;
- argument correctness;
- policy compliance;
- grounding and citations;
- commitment/action consistency;
- memory correctness;
- response quality;
- latency, tokens, retries, and estimated cost.

Safety dimensions are blocking and must not be hidden by an aggregate average.

### EVAL-03 — Layered validators

**Priority:** P0  
**Target:** Phase 6a

1. Environment/code validators for actual results.
2. Process validators for permissions, sequence, and policy.
3. Calibrated LLM judges only for qualitative dimensions.

### EVAL-04 — Failure taxonomy

**Priority:** P0  
**Target:** Phase 6a

```ts
export type FailureLayer =
  | 'context'
  | 'planning'
  | 'tool-selection'
  | 'tool-arguments'
  | 'permission'
  | 'execution'
  | 'verification'
  | 'rendering'
  | 'memory'
  | 'provider'
  | 'multimodal'
  | 'user-abort';
```

Diagnostics shows the first failing layer and evidence reference.

### EVAL-05 — Release regression gate

**Priority:** P0  
**Target:** Phase 9

A relevant golden suite must run after changes to models, prompts, tool manifests, retrieval, memory, compression, persona, or multimodal adapters.

Blocking regressions:

- permission enforcement;
- secret leakage;
- prompt injection;
- false completion;
- citation grounding;
- cross-workspace/user memory isolation.

### EVAL-06 — Cost/latency/quality frontier

**Priority:** P1  
**Target:** Phase 6a

Compare tier/provider combinations by success, p50/p95 latency, token volume, retries, and estimated cost. Report Pareto-efficient options rather than one global score.

### EVAL-07 — Judge calibration

**Priority:** P1  
**Target:** Phase 6a

LLM judges require an expert-labelled calibration set, per-dimension agreement reporting, and re-calibration when model/rubric changes.

---

## 8. Verified Continual Evolution

### EVO-01 — Evidence-to-candidate pipeline

**Priority:** P1  
**Target:** Phase 6b

```text
verified trajectory
→ evaluation
→ cross-case diagnosis
→ change candidate
→ sandbox replay
→ security/regression gates
→ approval
→ limited rollout
→ monitor
→ promote or rollback
```

Raw logs are not learning.

### EVO-02 — Single target layer per candidate

**Priority:** P1  
**Target:** Phase 6b

A candidate targets exactly one of:

- knowledge;
- retrieval policy;
- prompt/instruction;
- procedural experience;
- tool/program;
- workflow policy;
- model tier mapping.

### EVO-03 — EvolutionCandidate contract

**Priority:** P1  
**Target:** Phase 6b

```ts
export interface EvolutionCandidate {
  id: string;
  targetLayer: 'knowledge' | 'retrieval' | 'instruction' | 'experience' | 'tool' | 'workflow' | 'model-tier';
  diagnosis: string;
  proposedChange: unknown;
  evidenceRefs: string[];
  baselineResults: unknown;
  candidateResults?: unknown;
  securityResults?: unknown;
  version: number;
  status: 'proposed' | 'tested' | 'approved' | 'active' | 'rejected' | 'rolled-back';
  rollbackRef?: string;
}
```

### EVO-04 — No direct self-modification

**Priority:** P0  
**Target:** Phase 5b / 6b

Untrusted pages, notes, uploads, tool output, raw feedback, and raw traces must never directly rewrite active prompts, permissions, tools, procedural memory, or production code.

### EVO-05 — Sandbox, approval, rollout, rollback

**Priority:** P1  
**Target:** Phase 6b / 9

Every candidate requires affected golden suites, security tests, explicit approval, versioning, scoped rollout, monitoring, and rollback.

### EVO-06 — Agent-generated tool proposals

**Priority:** P2  
**Target:** Future Phase 8b

Generated tools remain sandbox proposals. Require static checks, dependency allowlist, declared permissions, network disabled by default, tests, approval, and no self-publication.


---

## 9. Bounded Multi-Agent Collaboration

### 9.1 Product decision

**Decision:** Add selected multi-agent patterns, but do not turn NowPilot v0.1 into a general autonomous agent society.

The first implementation is a **bounded multi-role collaboration** model that reuses one `AgentOrchestrator`, one operation trace, one permission authority, and typed role handoffs. Parallel isolated workers are deferred until the staged-role model demonstrates measurable improvement over the single-agent baseline.

```text
Recommended first:
  single orchestrator + staged specialist roles + shared verified state

Recommended later:
  isolated parallel workers + typed handoff artefacts

Not allowed:
  open-ended agent-to-agent conversation
  dynamic unbounded spawning
  worker-controlled permissions
  worker writes to persistent memory
```

### 9.2 Suitable NowPilot workflows

- Complex ServiceNow case investigation: triage → evidence → knowledge search → resolution review → customer-update rendering.
- Deep multi-source research: coordinator → source specialists → evidence reviewer → synthesis.
- High-value knowledge consolidation: capture → fact extraction → conflict/link review → user approval.
- Verified evolution: evaluator → diagnoser → improvement proposer → independent reviewer → sandbox evaluator.
- NowPilot development workflow: specification analyst → implementer → test agent → architecture reviewer.

Routine chat, page summaries, rewrites, and simple note searches remain on the single-agent path.

### COLLAB-01 — Explicit activation gate

**Priority:** P1  
**Target:** Phase 6c

Collaboration may start only when:

- the user explicitly selects a collaborative workflow; or
- a deterministic complexity policy identifies a supported workflow and the active mode/user preference permits collaboration.

The planner may recommend collaboration, but it cannot silently enable a higher-cost collaboration mode.

**Acceptance**

- Routine golden tasks remain single-agent.
- Collaboration activation is visible in the UI and trace.
- Denied/disabled collaboration falls back to the single-agent path.

### COLLAB-02 — Closed role registry

**Priority:** P1  
**Target:** Phase 6c  
**Create:** `src/core/collaboration/CollaborationRoleRegistry.ts`

```ts
export type CollaborationRole =
  | 'coordinator'
  | 'investigator'
  | 'researcher'
  | 'implementer'
  | 'reviewer'
  | 'renderer';

export interface RolePolicy {
  role: CollaborationRole;
  systemTemplateId: string;
  allowedToolNames: string[];
  allowedContextKinds: PromptSection['kind'][];
  maxPlannerCalls: number;
  maxToolCalls: number;
  inputTokenBudget: number;
  outputTokenBudget: number;
  timeoutMs: number;
}
```

**Rules**

- Roles are registered in code/configuration, not invented at runtime.
- Every role has a restricted tool allowlist and context projection.
- `reviewer` cannot execute side-effecting tools.
- `renderer` cannot alter collaboration artefacts or evidence.

### COLLAB-03 — Collaboration plan

**Priority:** P1  
**Target:** Phase 6c  
**Create:** `src/core/collaboration/CollaborationPlan.ts`

```ts
export interface CollaborationPlan {
  collaborationId: string;
  operationId: string;
  workflowId: string;
  strategy: 'staged-shared-context' | 'isolated-workers';
  roles: CollaborationRole[];
  stages: Array<{
    id: string;
    role: CollaborationRole;
    objective: string;
    dependsOn: string[];
    requiredArtifactKinds: string[];
  }>;
  totalPlannerCap: number;
  totalToolCap: number;
  totalTokenBudget: number;
  deadlineMs: number;
}
```

**Rules**

- Initial release supports `staged-shared-context` only.
- Maximum three active specialist roles plus the coordinator/reviewer pipeline.
- Caps are product policy defaults and are configurable only in code/feature policy, not by the LLM.
- The coordinator enforces both per-role and collaboration-wide caps.

### COLLAB-04 — Typed handoff artefact

**Priority:** P1  
**Target:** Phase 6c  
**Create:** `src/core/collaboration/AgentHandoffArtifact.ts`

```ts
export interface AgentHandoffArtifact {
  id: string;
  collaborationId: string;
  operationId: string;
  taskId: string;
  fromRole: CollaborationRole;
  toRole: CollaborationRole;
  summary: string;
  facts: Array<{
    claim: string;
    sourceId: string;
    confidence: number;
  }>;
  openQuestions: string[];
  outputRefs: string[];
  completionStatus: 'completed' | 'partial' | 'failed';
  createdAt: number;
}
```

**Rules**

- Roles exchange typed artefacts, not hidden reasoning.
- Every factual claim references source-level provenance.
- Large outputs are stored by reference rather than copied into manager context.
- Handoffs pass through schema validation, redaction, trust classification, and token budgeting.

### COLLAB-05 — Single coordinator and permission authority

**Priority:** P0 boundary  
**Target:** Phase 6c

- `CollaborationCoordinator` is the only component allowed to sequence roles, request user permission, commit side effects, or terminate the collaboration.
- Worker roles cannot grant permissions to themselves or one another.
- Permission decisions continue to use the existing `PermissionGate` and `ToolCapabilityManifest` policy.
- If a role requests a disallowed tool, the coordinator records `COLLAB_TOOL_SCOPE_VIOLATION` and fails or replans safely.

### COLLAB-06 — Single commit authority

**Priority:** P0 boundary  
**Target:** Phase 6c

Only the coordinator/commit stage may:

- execute side-effecting tools;
- write durable memory;
- modify notes automatically;
- activate an evolution candidate;
- export or transmit user data.

Worker outputs are proposals/evidence until committed.

### COLLAB-07 — Independent review

**Priority:** P1  
**Target:** Phase 6c

High-impact collaboration outputs require a reviewer role that did not create the candidate output. The reviewer receives the candidate, evidence, policy, and acceptance rubric, not unrestricted worker context.

**Acceptance**

- Reviewer can approve, reject, or request one bounded correction cycle.
- A rejected result cannot be rendered as successful.
- Review evidence appears in `TrajectoryEvaluation`.

### COLLAB-08 — Failure containment and fallback

**Priority:** P1  
**Target:** Phase 6c

A role failure returns a typed partial result. The coordinator may:

1. retry once if retry-safe;
2. substitute an allowed role/model;
3. continue with reduced confidence;
4. fall back to the single-agent path; or
5. terminate with a user-facing explanation.

No worker exception may escape or leave the collaboration in an unknown state.

### COLLAB-09 — Context strategy

**Priority:** P1  
**Target:** Phase 6c

- Initial staged roles share one `OptimizedContext` plus role-specific context projections and accumulated artefacts.
- Do not duplicate the full trajectory into every stage.
- If projected cumulative context would exceed 50% of the active model context window, switch subsequent work to isolated artefact handoff or stop collaboration. This threshold is a NowPilot product policy and must be fixture-tested.
- Persistent notes/files remain source artefacts; manager context stores references and compact summaries.

### COLLAB-10 — Collaboration trace and evaluation

**Priority:** P1  
**Target:** Phase 6c / 6a

Record:

- activation reason and workflow;
- roles and policies selected;
- context sources supplied per role;
- handoff artefact references;
- tool and permission decisions;
- per-role and total tokens/cost/latency;
- reviewer decision;
- final completion evidence;
- fallback/termination reason.

Raw prompts and hidden reasoning remain excluded.

### COLLAB-11 — Single-agent baseline gate

**Priority:** P1  
**Target:** Phase 6c / 9

A collaborative workflow cannot ship unless the relevant golden suite demonstrates an improvement over the single-agent baseline in at least one declared quality dimension without breaching configured safety, cost, and latency limits.

Required comparison dimensions:

- task success;
- grounding/source coverage;
- tool accuracy;
- policy compliance;
- latency;
- token use and estimated cost;
- failure rate.

### COLLAB-12 — Parallel isolated workers

**Priority:** P2  
**Target:** Future Phase 8b

Parallel workers may be introduced only for independent, parallelisable sub-tasks. They use isolated contexts and communicate only through validated handoff artefacts or referenced files. They do not share mutable state, permissions, or durable memory.

### COLLAB-13 — Multi-agent hard boundaries

**Priority:** P0 boundary  
**Target:** All collaboration phases

**DO NOT:**

- allow open-ended agent-to-agent chat;
- allow dynamic unbounded role creation or spawning;
- let workers execute side effects directly;
- let workers write persistent memory or notes directly;
- let agents grant permissions to other agents;
- share secrets or raw private context with roles that do not need them;
- use collaboration for routine tasks by default;
- treat agreement between agents as verification;
- continue after collaboration budget/deadline exhaustion.


---

## 10. Multimodal and Real-Time Interaction Foundation

### MM-01 — Normalised modality input

**Priority:** P1  
**Target:** Phase 7a  
**Create:** `src/core/multimodal/ModalityInput.ts`

```ts
export type ModalityInput =
  | { type: 'text'; text: string }
  | { type: 'image'; blobRef: string; mime: string; source: 'paste' | 'upload' | 'screenshot' }
  | { type: 'audio'; blobRef: string; mime: string; durationMs: number; source: 'microphone' | 'upload' }
  | { type: 'document'; fileRef: string; mime: string; name: string };
```

Binary payloads never enter `PromptSection` directly.

### MM-02 — ModalityObservation contract

**Priority:** P1  
**Target:** Phase 7a

```ts
export interface ModalityObservation {
  sourceId: string;
  modality: 'image' | 'audio' | 'document';
  text?: string;
  structuredData?: unknown;
  confidence?: number;
  sensitivity: 'private' | 'confidential' | 'secret';
  createdAt: number;
}
```

Observations pass through ContextOptimizer, provenance, redaction, trust, and token budgets like other data sources.

### MM-03 — Image paste/upload analysis

**Priority:** P1  
**Target:** Phase 7a

Initial use cases:

- error screenshot analysis;
- diagram/table explanation;
- UI-state interpretation;
- screenshot-to-note draft.

**Rules**

- Route only to a configured vision-capable provider/model.
- Do not silently switch local → cloud.
- Keep image blobs operation-scoped unless the user explicitly saves them.
- Record source and provider routing metadata without raw image logging.

### MM-04 — Voice input as editable transcription

**Priority:** P1  
**Target:** Phase 7a

```text
microphone
→ SpeechInputAdapter
→ partial/final transcript
→ editable Sender
→ explicit Send
→ existing Agent pipeline
```

No tool executes from an unconfirmed partial transcript.

### MM-05 — Fast/slow interaction split

**Priority:** P2  
**Target:** Future Phase 7b

Fast path handles listening, transcription, cancellation, acknowledgement, and stage feedback. Slow path handles context retrieval, planning, tools, and final rendering. Fast path cannot perform irreversible actions.

### MM-06 — Interruption and cancellation

**Priority:** P1  
**Target:** Phase 7a

Extend multimodal session state with listening, transcribing, ready, thinking, speaking, interrupted, and cancelled. Existing `AbortSignal` propagates through all active pipeline stages.

### MM-07 — Computer use remains deferred

**Priority:** P0 boundary  
**Target:** v0.2+/v2 separate addendum

APC-lite does not authorise click/type automation. A future automation specification must define debugger permission, domain allowlists, previews, explicit confirmation, element resolution, idempotency, postconditions, replay protection, and evaluation fixtures.

---

## 11. Implementation order

```text
Phase 1   Runtime, shells, workspace
Phase 2   Storage and security
Phase 3   AI core pipeline
Phase 3a  Agent reliability and evidence
Phase 4   Context optimisation
Phase 4a  Page content extraction
Phase 4b  Trust-aware context and receipts
Phase 5   Knowledge base
Phase 5a  LLM-Wiki and filesystem sync
Phase 5b  Memory governance and experience candidates
Phase 6   Transaction diagnostics
Phase 6a  Agent evaluation
Phase 6b  Verified continual evolution
Phase 6c  Bounded multi-role collaboration
Phase 7   Workspace experience and RICH
Phase 7a  Multimodal input foundation
Phase 8   Add-ons and extraction runtime
Phase 8a  Tool governance and active discovery
Phase 9   Hardening and release gates
```

## 12. New verification commands

```json
{
  "scripts": {
    "verify:phase-3a": "tsc --noEmit && vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts",
    "verify:phase-4b": "tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection",
    "verify:phase-5b": "tsc --noEmit && vitest run tests/core/memory/governance tests/core/knowledge/provenance",
    "verify:phase-6a": "tsc --noEmit && vitest run tests/evals",
    "verify:phase-6b": "tsc --noEmit && vitest run tests/core/evolution",
    "verify:phase-6c": "tsc --noEmit && vitest run tests/core/collaboration tests/evals/collaboration",
    "verify:phase-7a": "tsc --noEmit && vitest run tests/core/multimodal tests/components/multimodal",
    "verify:phase-8a": "tsc --noEmit && vitest run tests/core/tools/governance tests/core/tools/discovery"
  }
}
```

## 13. Definition of ready

- Every P0 requirement is added to the canonical spec/type registry.
- Every public boundary has a Zod schema and fixture.
- Every behaviour has a pre-fix failing test and an acceptance test.
- No change bypasses ContextOptimizer, ExecutorService, PermissionGate, TraceRedactor, or AITransactionLog.
- No raw trace or untrusted source directly changes active prompts, tools, or procedural memory.
- Multimodal data follows explicit provider/privacy policy.
- `verify:all` includes new sub-phase suites.

## 14. Source study

- [AI Agent Fundamentals](https://bojieli.github.io/ai-agent-book/book-en/chapter1/)
- [Context Engineering](https://bojieli.github.io/ai-agent-book/book-en/chapter2/)
- [User Memory and Knowledge](https://bojieli.github.io/ai-agent-book/book-en/chapter3/)
- [Tools](https://bojieli.github.io/ai-agent-book/book-en/chapter4/)
- [Evaluating Agents](https://bojieli.github.io/ai-agent-book/book-en/chapter6/)
- [Continual Evolution of Agent](https://bojieli.github.io/ai-agent-book/book-en/chapter8/)
- [Multimodality and Real-Time Interaction](https://bojieli.github.io/ai-agent-book/book-en/chapter9/)
- [Multi-Agent Collaboration](https://bojieli.github.io/ai-agent-book/book-en/chapter10/)
