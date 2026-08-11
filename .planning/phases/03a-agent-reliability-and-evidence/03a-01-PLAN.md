---
phase: 03a-agent-reliability-and-evidence
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/harness.ts
  - src/core/error/errorCodes.ts
  - src/core/ai/types.ts
  - src/core/ai/ProviderRouter.ts
  - src/core/ai/StructuredOutput.ts
  - tests/fixtures/trajectory.ts
  - tests/core/ai/trajectory/transition.test.ts
autonomous: true
requirements: [AGT-01, AGT-02, AGT-03]
must_haves:
  truths:
    - "src/types/harness.ts declares AgentTrajectoryPhase (10-state enum, C.1 L4810-4813), AgentTrajectoryState (L4815-4821), AgentTurnOutcome (L4830-4837) VERBATIM from Appendix C.1 — exactly one declaration each (R-1). CompletionEvidence stays unchanged (already C.1). The file header's Phase-3a extension note is realized, not relocated."
    - "LEGAL_TRANSITIONS is defined ONCE in harness.ts (C5, R-1): a Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]> with the 10-state table (assembling-context→[planning]; planning→[executing,rendering,waiting-for-permission]; waiting-for-permission→[planning,aborted]; executing→[verifying,replanning]; verifying→[planning,rendering]; replanning→[executing,rendering]; rendering→[completed,failed,partial,aborted]; terminal states have empty arrays). transitionPhase(from,to) throws an Error whose message contains 'AGENT_STATE_INVALID' on an illegal transition and is otherwise a no-op."
    - "The three harness error codes AGENT_STATE_INVALID, TOOL_POSTCONDITION_FAILED, COMPLETION_EVIDENCE_MISSING are added IN PLACE to src/core/error/errorCodes.ts ERROR_CODES (canonical mirror of spec Appendix C.2 L5051-5053, GR-9). No re-export, no duplicates."
    - "PromptSection['kind'] in src/core/ai/types.ts is extended with 'tool_result' (the replan-feedback section kind, D-3a-11). 'tool_result' is added to TASK_KINDS in BOTH src/core/ai/ProviderRouter.ts (L73) and src/core/ai/StructuredOutput.ts (L41) — it is NEVER added to CACHED_KINDS (ProviderRouter L65-72), so it maps to the provider prompt side and stays out of hashStableSections (Pitfall 2/7, cache-stability)."
    - "tests/fixtures/trajectory.ts is a NEW deterministic fixture module (O1) — fixed constants only, never crypto.*/Date.now (fixtures/index.ts determinism rule): a mock dangerous side-effecting tool definition + a buildOutcome-verifier fixture + synthetic CompletionEvidence builders + a transitionAssert helper (asserts a recorded transition sequence against LEGAL_TRANSITIONS)."
    - "Zod boundary schemas (AgentTrajectoryStateSchema, AgentTurnOutcomeSchema, CompletionEvidenceSchema) co-located with the types (GR-4, D-3a-20 — mirrors ProviderConfigSchema in ai/types.ts L89-103, zod 3 API only: z.enum/z.object/z.array/z.discriminatedUnion, .safeParse — never zod-4 APIs)."
    - "tests/core/ai/trajectory/transition.test.ts proves: every legal transition in the table passes without throw; an illegal transition (e.g. planning→completed) throws an Error whose message includes AGENT_STATE_INVALID; the boundary schemas round-trip valid fixtures and reject malformed shapes."
  artifacts:
    - "src/types/harness.ts"
    - "src/core/error/errorCodes.ts"
    - "src/core/ai/types.ts"
    - "src/core/ai/ProviderRouter.ts"
    - "src/core/ai/StructuredOutput.ts"
    - "tests/fixtures/trajectory.ts"
    - "tests/core/ai/trajectory/transition.test.ts"
  key_links:
    - "harness.ts is the R-1 canonical home (@/types/harness) — consumers (src/core/ai/types.ts ToolExecutionResult.evidence, OutcomeVerifier 03a-02, AgentOrchestrator 03a-03) import from here, never re-declare (spec C.1 type-home table L4798)."
    - "errorCodes.ts extends IN PLACE (Phase-1/2/3 block pattern L56-80) — the harness block is the canonical mirror of spec Appendix C.2 L5051-5053 (already canonical in the spec)."
    - "TASK_KINDS exists in TWO files (ProviderRouter L73 + StructuredOutput L41) — Pitfall 2: both MUST gain 'tool_result' or the section is silently dropped by joinSections/filter."
    - "PromptSection canonical home stays src/core/ai/types.ts (P-3, 03-01 decision) — the kind union extension is additive, no home move."
  flagged_assumptions:
    - "AGT-01 [unclassified — manual review]: the trajectory legal-transition table is the single definition of reachable states; the ORCHESTRATOR (03a-03) is the only runtime caller of transitionPhase — tests exercise the table directly in 03a-01."
    - "AGT-02 [unclassified — manual review]: 'side-effecting success requires CompletionEvidence' — the evidence shape and verifier interface land in 03a-02 (OutcomeVerifier); this plan only ships the types + boundary schemas."
    - "AGT-03 [boundary — manual review]: cap exhaustion yields status 'partial', reasonCode 'cap_exhausted' — the boundary contract is encoded in the AgentTurnOutcomeSchema enum ('completed'|'partial'|'failed'|'aborted') here; the behavioral proof lands in 03a-02 buildOutcome tests."
    - "AGT-03 [precision — manual review]: C.1 status union has NO 'verification_failed' member — Open Q1 resolved as: verification_failed → status:'failed' + reasonCode:'verification_failed' (keeps C.1 verbatim); waiting_for_permission is a trajectory PHASE, never a terminal outcome status. This plan's schema keeps the 4-value C.1 union; the orchestrator (03a-03) owns the mapping."
    - "A3 [research]: trajectory cap formula = plannerCap + toolCap + 1 (slack constant 1) — orchestrator-owned (03a-03), not this plan."
  prohibitions:
    - "No second declaration of AgentTrajectoryPhase/AgentTrajectoryState/AgentTurnOutcome anywhere (R-1 single home in harness.ts)."
    - "No 'tool_result' in CACHED_KINDS (ProviderRouter L65-72) — cache-stability break (Pitfall 7)."
    - "No TASK_KINDS update in only ONE of the two files (Pitfall 2 — both ProviderRouter.ts and StructuredOutput.ts must gain 'tool_result')."
    - "No zod-4-only APIs (research A5 — project pins zod 3.25.76; use z.enum/z.object/z.array/.safeParse)."
    - "No free-form error strings — AGENT_STATE_INVALID must appear as the canonical code (GR-9); every catch in this plan's code logs via debugLog."
---

<!-- 03a-01 (2026-08-11): Foundation — harness.ts canonical types + Zod boundary schemas
     + the legal-transition table (C5, R-1 home), the 3-code harness error block
     (IN PLACE, GR-9), and the PromptSection kind += 'tool_result' extension (Pitfall 2 —
     added to TASK_KINDS in BOTH ProviderRouter.ts and StructuredOutput.ts, never CACHED_KINDS). -->

Purpose: Every downstream 3a module (OutcomeVerifier 03a-02, AgentOrchestrator rewire 03a-03, hook mapping 03a-04) imports the C.1 types and the 'tool_result' section kind — nothing compiles until this foundation lands. harness.ts is the R-1 canonical home the spec already points to (its header declares 3a as the extension point). The transition table + Zod schemas make the state machine and boundary shapes testable at the type level before the loop is rewired. The TASK_KINDS 'tool_result' extension (both files) is the pre-requisite for the F-4 sections-in replan feedback (D-3a-11) — the section must survive ProviderRouter.joinSections and StructuredOutput's cached filter.
Output: harness.ts extended (types + LEGAL_TRANSITIONS/transitionPhase + Zod schemas), errorCodes.ts harness block added, PromptSection kind union + both TASK_KINDS extended, deterministic trajectory/evidence fixtures, transition+boundary-schema tests green.
<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

### Tasks (ordered — do not reorder; each maps to a truth/artifact)
1. **Extend src/types/harness.ts with the C.1 types + transition table + Zod schemas.** Read .planning/PRODUCT_SPEC_v0_1.md Appendix C.1 (L4807-4837) and src/types/harness.ts (current 13 lines). Add: `export type AgentTrajectoryPhase = 'assembling-context' | 'planning' | 'waiting-for-permission' | 'executing' | 'verifying' | 'replanning' | 'rendering' | 'completed' | 'failed' | 'aborted'`; `export interface AgentTrajectoryState { operationId: string; phase: AgentTrajectoryPhase; plannerCalls: number; toolCalls: number; updatedAt: number }`; `export interface AgentTurnOutcome { operationId: string; status: 'completed' | 'partial' | 'failed' | 'aborted'; reasonCode: string; evidence: CompletionEvidence[]; plannerCalls: number; toolCalls: number }`. Add `import { z } from 'zod'` and co-located `AgentTrajectoryPhaseSchema` (z.enum of the 10 states), `AgentTrajectoryStateSchema`, `CompletionEvidenceSchema`, `AgentTurnOutcomeSchema` (zod 3 API). Add the `LEGAL_TRANSITIONS` Record + `transitionPhase(from, to)` throwing `new Error(\`AGENT_STATE_INVALID: ${from} -> ${to}\`)` on illegal transitions. Do NOT modify CompletionEvidence.
2. **Extend src/core/error/errorCodes.ts IN PLACE.** Read src/core/error/errorCodes.ts (L56-80 block pattern) and spec Appendix C.2 L5051-5053. Add `AGENT_STATE_INVALID`, `TOOL_POSTCONDITION_FAILED`, `COMPLETION_EVIDENCE_MISSING` to ERROR_CODES (values equal the keys). No duplicates, no re-exports.
3. **Extend the PromptSection kind union in src/core/ai/types.ts.** Read src/core/ai/types.ts L130-136. Change the union to add `| 'tool_result'` (result: `kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input' | 'tool_result'`).
4. **Add 'tool_result' to TASK_KINDS in BOTH src/core/ai/ProviderRouter.ts and src/core/ai/StructuredOutput.ts.** Read ProviderRouter.ts L60-88 (CACHED_KINDS/TASK_KINDS + joinSections) and StructuredOutput.ts L35-50 + L117-133 (TASK_KINDS + repair-section append). Change both `TASK_KINDS` arrays to `['context', 'task', 'user_input', 'tool_result']`. Leave CACHED_KINDS unchanged.
5. **Create tests/fixtures/trajectory.ts (new deterministic fixture module).** Read tests/fixtures/index.ts (determinism header) + tests/fixtures/optimizedContext.ts (builder pattern). Export: a mock dangerous side-effecting tool descriptor (`MOCK_DANGEROUS_TOOL = { name: 'mock-dangerous-write', dangerous: true, ... }` shape compatible with BuiltinTool), a buildOutcome verifier fixture (`postconditionId: 'mock-dangerous.verified'`), synthetic `syntheticEvidence(overrides)` builders for CompletionEvidence, and a `transitionAssert(transitions: AgentTrajectoryPhase[][])` helper that asserts each step against LEGAL_TRANSITIONS. Fixed constants only — never crypto.*/Date.now.
6. **Create tests/core/ai/trajectory/transition.test.ts.** Prove: every legal transition in the table passes; an illegal transition (e.g. `transitionPhase('planning','completed')`) throws with AGENT_STATE_INVALID in the message; AgentTurnOutcomeSchema/AgentTrajectoryStateSchema/CompletionEvidenceSchema round-trip valid fixtures and reject malformed shapes (e.g. status 'verification_failed' fails the enum).
7. **Verify green.** Run `npx vitest run tests/core/ai/trajectory/transition.test.ts` and `npx tsc --noEmit`; grep-assert exactly one `export type AgentTrajectoryPhase` in the repo (in src/types/harness.ts); grep-assert `tool_result` appears in BOTH ProviderRouter.ts TASK_KINDS and StructuredOutput.ts TASK_KINDS; grep-assert the three harness codes in errorCodes.ts; no existing-suite regression (`npx vitest run tests/core/ai`).

**Decision-coverage citations (tasks above implement):** D-3a-20 — the C.1 types (AgentTrajectoryState/AgentTurnOutcome) + the legal-transition table live in `src/types/harness.ts` (R-1 home) with Zod boundary schemas co-located (GR-4).

### Edge Coverage Assumptions (specless probe fallback — 6 edges, ALL unresolved, surfaced not dropped)

Every unresolved edge from $COVERAGE is carried as an explicit flagged assumption in this plan's must_haves.flagged_assumptions where it belongs to this plan's scope (AGT-01 transition table, AGT-02/03 evidence + status boundary shape). The remaining edges are owned by the plans that implement their requirements (AGT-01/02/04/05 behavior → 03a-02/03, AGT-03 hook mapping → 03a-04). None are silently dropped.

### Artifacts This Phase Produces
- src/types/harness.ts: AgentTrajectoryPhase, AgentTrajectoryState, AgentTurnOutcome, AgentTrajectoryPhaseSchema, AgentTrajectoryStateSchema, CompletionEvidenceSchema, AgentTurnOutcomeSchema, LEGAL_TRANSITIONS, transitionPhase(). CompletionEvidence unchanged.
- src/core/error/errorCodes.ts: AGENT_STATE_INVALID, TOOL_POSTCONDITION_FAILED, COMPLETION_EVIDENCE_MISSING.
- src/core/ai/types.ts: PromptSection['kind'] union gains 'tool_result'.
- src/core/ai/ProviderRouter.ts: TASK_KINDS gains 'tool_result'.
- src/core/ai/StructuredOutput.ts: TASK_KINDS gains 'tool_result'.
- tests/fixtures/trajectory.ts (new): MOCK_DANGEROUS_TOOL, mock-dangerous verifier, syntheticEvidence(), transitionAssert().
- tests/core/ai/trajectory/transition.test.ts (new): transition-table + boundary-schema tests.
<threat_model>

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| harness.ts types/schemas → all 3a consumers | The canonical types and legal-transition table are the single source every reliability module imports; a second declaration or an invented status value cascades (R-1, GR-2) |
| PromptSection kind union → prompt assembly | 'tool_result' must reach the model as prompt content (TASK_KINDS) yet never enter the cached system block — a misclassification breaks prompt-cache stability (F-4) |

### STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-01-01 | Tampering | harness.ts types/schemas | high | mitigate | C.1 verbatim copy only; the verify greps assert a single AgentTrajectoryPhase declaration and 4-value status enum (R-1); Zod boundary schemas (GR-4) reject invented statuses/reasonCodes |
| T-03a-01-02 | Tampering | PromptSection kind classification | high | mitigate | 'tool_result' added to TASK_KINDS in BOTH files and never CACHED_KINDS (Pitfall 2/7); verify grep asserts both arrays and CACHED_KINDS absence |
| T-03a-01-03 | Tampering | errorCodes.ts canonical registry | high | mitigate | IN-PLACE extension only; codes mirror spec C.2 L5051-5053 verbatim; verify asserts no duplicate keys |
| T-03a-01-SC | Spoofing | transition table | medium | mitigate | Legal-transition table is a pure data structure; the transition.test.ts proves every legal edge and the AGENT_STATE_INVALID throw on illegal edges (C5) |
</threat_model>
<success_criteria>
- tsc --noEmit green; tests/core/ai/trajectory/transition.test.ts green; no existing-suite regression.
- Exactly one AgentTrajectoryPhase/AgentTrajectoryState/AgentTurnOutcome declaration, in src/types/harness.ts (R-1).
- PromptSection kind union includes 'tool_result'; 'tool_result' present in TASK_KINDS in BOTH ProviderRouter.ts and StructuredOutput.ts and absent from CACHED_KINDS.
- errorCodes.ts contains AGENT_STATE_INVALID / TOOL_POSTCONDITION_FAILED / COMPLETION_EVIDENCE_MISSING (canonical C.2 mirror).
- Zod boundary schemas reject a 'verification_failed' status value (4-value C.1 union preserved); transitionPhase('planning','completed') throws AGENT_STATE_INVALID.
- tests/fixtures/trajectory.ts ships the mock dangerous tool, verifier, synthetic evidence, and transitionAssert helpers (deterministic — no crypto/Date.now).
</success_criteria>
