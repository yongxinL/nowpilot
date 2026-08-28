---
status: superseded
type: review-artifact
superseded_by: "03-REVIEW-FIX.md (findings resolved during planning review)"
---
# Phase 3 Plan Review Findings

## Review Verdict

**Status: CHANGES REQUIRED before execution.**

The seven plans cover the Phase 3 architecture, but several contracts remain internally inconsistent or unsupported. These are implementation traps for a cost-effective model.

# Blockers

## B-01 — Invented `CONFIG_REQUIRED` error identifier conflicts with the closed error set

- **Severity:** Blocker
- **Evidence:** `03-06-PLAN.md` artifacts export `CONFIG_REQUIRED`; context D-54a requires a “configuration-required state,” while context §21.6 says the error-code set is closed and prohibits invented codes.
- **Impact:** An implementer may add a non-authoritative error code to the runtime, tests, and UI contract.
- **Exact fix:** Do not prescribe `CONFIG_REQUIRED` as an exported error code. Add a repository/spec discovery gate: use an existing authoritative code/state if one exists; otherwise represent the result as a typed non-error orchestrator outcome without adding to §21.6. Record the discovered identifier before implementation.
- **Affected:** `03-06-PLAN.md`; `src/core/ai/AgentOrchestrator.ts`; `tests/core/ai/AgentOrchestrator.test.ts`.

## B-02 — Planner schema and zero-tool production behavior conflict

- **Severity:** Blocker
- **Evidence:** Context D-46 says the production planner produces only `answer` and `ask_clarification` with zero registered tools. `03-01-PLAN.md` requires the canonical three-variant `PlannerDecisionSchema`, including `run_tool`, and says the closed enum is supplied later by ExecutorService.
- **Impact:** A model may create an invalid empty `z.enum`, retain an unrestricted string, or remove the authoritative `run_tool` variant globally.
- **Exact fix:** Separate the canonical decision schema from the runtime schema factory. Preserve the authoritative three-variant base schema. Add an explicit factory that receives registered tool names and, when empty, returns a production schema containing only `answer` and `ask_clarification`. Executor tests may directly inject `run_tool` to prove `TOOL_REJECTED`. Do not construct `z.enum([])`.
- **Affected:** `03-01-PLAN.md`, `03-04-PLAN.md`; `types.ts`, `toolSchemas.ts`, `PlannerService.ts`, `ExecutorService.ts`, associated tests.

## B-03 — `append-chat-turn` is treated as approved although D-45a requires repository verification

- **Severity:** Blocker
- **Evidence:** Context D-45a says Phase 3 consumes existing ChatHistoryDB/WriteJournal infrastructure and must stop if additional storage contracts are required outside inventory. `03-07-PLAN.md` mandates a new union member, journal step, and modifications to `src/types/storage.ts` and `WriteJournal.ts`.
- **Impact:** The plan converts a research recommendation into an authoritative storage contract and expands a closed operation union without verified approval.
- **Exact fix:** Add a mandatory discovery checkpoint before coding. Verify the current ChatHistoryDB append API, WriteJournal operation union, registration API, and §20.3 extension rules. Only apply `append-chat-turn` if repository/spec evidence authorizes that exact identifier. Otherwise stop and report the boundary conflict. Remove `ChatHistoryDB.ts` from `files_modified` because no schema change is allowed.
- **Affected:** `03-07-PLAN.md`; `src/types/storage.ts`, `WriteJournal.ts`, `ChatHistoryDB.ts`, chat integration test.

# High

## H-01 — First-setup tier suggestion remains nondeterministic

- **Severity:** High
- **Evidence:** Context D-54 says “first-discovered model of each class”; no classifier or stable ordering is defined. Plans 03-05 and 03-07 prohibit model-slug guessing.
- **Impact:** An implementer must invent regexes or rely on provider ordering, contradicting D-53/D-54a.
- **Exact fix:** Do not auto-classify in Phase 3. Discovery populates selectors only. Leave fast/balanced unset until explicit user selection and Save. If UI prefill must remain, require an authoritative classifier and deterministic sort before implementation.
- **Affected:** `03-07-PLAN.md`; `OptionsPage.tsx`, tier preference tests.

## H-02 — Renderer tier contradicts research text

- **Severity:** High
- **Evidence:** Context D-55 and plans 03-04/03-06 require Renderer `fast`; `03-RESEARCH.md` contains passages saying Renderer `balanced` and stage constants carry planner fast/renderer balanced.
- **Impact:** A cost-effective model may select different tiers based on whichever source it reads last.
- **Exact fix:** Mark the stale Renderer-balanced research passages `(SUPERSEDED BY D-55)` and state that reviewed context governs planning: Planner `fast`, Renderer `fast`, Executor turn tier only when tools exist.
- **Affected:** `03-RESEARCH.md`, `03-PATTERNS.md`, plans 03-04 and 03-06.

## H-03 — Provider wire formats are still delegated to implementation-time guessing

- **Severity:** High
- **Evidence:** `03-03-PLAN.md` marks Gemini/OpenAI/Anthropic request and wire details as assumed and says to confirm against live APIs during implementation.
- **Impact:** Execution is not deterministic and may require network access or credentials unavailable to the coding model.
- **Exact fix:** Replace each assumption with a repository-discovery instruction and fixture contract. Do not encode uncertain envelope fields. Parse only authoritative minimum fields already documented; make fixtures tolerant of unrelated fields. If Anthropic structured-output mechanics remain unresolved, stop that adapter task and report rather than guessing.
- **Affected:** `03-03-PLAN.md`; all provider adapters, StreamAdapter fixtures/tests.

## H-04 — Validation task IDs and waves do not match the seven plans

- **Severity:** High
- **Evidence:** `03-VALIDATION.md` maps persona work to 03-01 although it belongs to 03-02, maps Planner/Executor work to 03-02, and stops at plan 04 despite plans 05–07.
- **Impact:** Execution evidence cannot be traced to actual tasks; gates may report green while later work is untested.
- **Exact fix:** Rebuild the validation map using actual plan/task IDs 03-01 through 03-07 and include routing, orchestrator, chat persistence, Options, abort, and manual checkpoint coverage.
- **Affected:** `03-VALIDATION.md`; all plans.

# Medium

## M-01 — `files_modified` contains a prohibited no-change file

- **Severity:** Medium
- **Evidence:** `03-07-PLAN.md` lists `src/core/storage/ChatHistoryDB.ts`, while D-45a and the plan truth state its schema fits unchanged.
- **Impact:** A model may edit the database unnecessarily.
- **Exact fix:** Remove `src/core/storage/ChatHistoryDB.ts` from frontmatter and add it to a read-only discovery list.

## M-02 — Phase inventory/count language is stale

- **Severity:** Medium
- **Evidence:** Context says “19 files” while its expanded create list has more entries and plans add several out-of-inventory files.
- **Impact:** Automated completeness checks become unreliable.
- **Exact fix:** Do not restate an arithmetic count unless copied verbatim from §18. Add a generated inventory reconciliation section listing spec-created, approved modifications, tests, and read-only files.

## M-03 — `files_modified` directories are ambiguous

- **Severity:** Medium
- **Evidence:** Plans use `tests/core/ai/fixtures/` as a directory without exact fixture filenames.
- **Impact:** Different executors produce incompatible fixture names and imports.
- **Exact fix:** Require task-time repository discovery followed by an explicit fixture manifest recorded in the plan summary before files are created. Do not guess names in this patch.

# Nits

## N-01 — Stale test-existence prose

Update any statement that `tests/core/ai` is absent so it acknowledges the existing `tests/core/ai/testProviderConnection.test.ts` and distinguishes it from the eight new required tests.

## N-02 — Resolved research questions remain under `Open Questions`

Mark the five resolved questions `(RESOLVED)` and point to D-45/D-54/D-59 or the corresponding plan decision.

# Preservation Report

- **Retained:** all plan frontmatter, purposes, must_haves, artifacts, key_links, prohibitions, assumptions, threat models, task breakdowns, success criteria, and inventory tables.
- **Moved:** none.
- **Removed:** only `ChatHistoryDB.ts` from `03-07-PLAN.md` `files_modified`; it remains a read-only discovery dependency.
- **Superseded text:** only stale Renderer-balanced research wording and unresolved Open Questions markers.
- **No full replacement plans requested:** surgical patching is safer because the attached plan bodies are dense and mostly valid.

# Closure Matrix

| Requirement / Decision | Plan / Task | Files | Tests | Verification |
|---|---|---|---|---|
| RICH-R-01, D-57 | 03-02 persona profile | `PersonaProfile.ts` | `PersonaProfile.test.ts` | `pnpm run verify:phase-3` |
| RICH-R-02, D-58/D-59 | 03-02 + 03-04 injection choke point | `PersonaInjector.ts`, `PromptCacheManager.ts` | `PersonaInjector.test.ts` | persona-first exact string and stable repeat |
| RICH-R-10 | 03-01 stage prompts + 03-04 assembly | `prompts/index.ts`, `PromptCacheManager.ts` | persona/integration tests | all stage prompts include same resolved block |
| D-46 | 03-01 + 03-04 | `types.ts`, `toolSchemas.ts`, `PlannerService.ts`, `ExecutorService.ts` | Planner/Executor tests | zero-tool schema excludes production `run_tool`; direct injection rejects |
| D-47 / REQ-R09 | 03-01 + 03-03 | `StreamAdapter.ts`, providers | `StreamAdapter.test.ts`, fixtures | canonical event sequences and missing terminator |
| D-49–D-52 | 03-05 | Registry/router files | `ProviderRouter.test.ts` plus registry assertions | hydrate before reads; no disk migration |
| D-53–D-56 | 03-05 + 03-07 | TierResolver, Options | router/chat integration | no request before explicit assignments |
| §1.5 / §20.10 | 03-05 | `ProviderRouter.ts` | `ProviderRouter.test.ts` | retry, votes, open interval, no post-token switch |
| Appendix I / D-44 | 03-06 + 03-07 | Orchestrator, chat hook | orchestrator/chat integration | only orchestrator calls Planner; production chat uses pipeline |
| D-45/D-45a | 03-06 + 03-07 | persist seam and verified storage APIs | orchestrator/chat integration | once on completion; never chunks/abort |
| Renderer cap | 03-04 | `RendererService.ts` | `RendererService.test.ts` | default 512 and approved override |
| Appendix L | 03-01 | `StructuredOutput.ts` | `StructuredOutput.test.ts` | one repair only; terminal authoritative code |
