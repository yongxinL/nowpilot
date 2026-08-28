---
status: superseded
type: review-artifact
superseded_by: "03-01-PLAN.md … 03-07-PLAN.md (patch edits applied during planning review)"
---
# Phase 3 Plan Patch

Apply only the edits below. Preserve all other content verbatim.

# 03-01-PLAN.md

## P01-1 — Clarify zero-tool Planner schema

**Insert after the `PlannerDecisionSchema` artifact description:**

```md
**Zero-tool runtime specialization:** Preserve the authoritative three-variant base `PlannerDecisionSchema`. Add a runtime schema-construction contract that receives the registered tool-name list. When the list is empty, the production planner schema contains only `answer` and `ask_clarification`; never construct `z.enum([])` and never leave `toolName` as an unrestricted production string. The base `run_tool` variant remains available for direct Executor contract tests and later tool-owning phases.
```

## P01-2 — Correct stale test-existence wording

Where acceptance prose says no Phase-3 AI test exists, replace it with:

```md
`tests/core/ai/testProviderConnection.test.ts` already exists and MUST remain green. The eight §18 Phase-3 test files listed by the authoritative spec are additional files delivered by these plans.
```

# 03-03-PLAN.md

## P03-1 — Replace implementation-time guessing rule

**Insert after `flagged_assumptions`:**

```md
### Provider-contract discovery gate

Before editing a provider adapter, inspect the authoritative in-repository specification, `COVERAGE.md`, existing `src/services/aiProvider.ts`, and available provider fixtures. Treat only explicitly sourced request fields, auth placement, stream terminators, and minimum parsed field paths as authoritative. Ignore unrelated envelope fields. If a required JSON-mode or streaming contract remains marked ASSUMED after this inspection, STOP that provider subtask and report the unresolved contract; do not guess from model knowledge and do not require live credentials for automated completion.
```

# 03-04-PLAN.md

## P04-1 — Replace empty-enum wording

**Find:**

```md
ExecutorService rejects any run_tool whose toolName is absent from the closed z.enum with code TOOL_REJECTED (D-46, §21.6) — with zero registered tools, every run_tool is rejected
```

**Replace with:**

```md
ExecutorService rejects every direct or test-injected run_tool decision because Phase 3 registers zero tools, returning TOOL_REJECTED (D-46, §21.6). The production Planner schema excludes run_tool while the registry is empty. Do not construct z.enum([]); use the zero-tool specialization defined by 03-01.
```

# 03-06-PLAN.md

## P06-1 — Remove invented error-code authority

**Find in artifacts exports:**

```md
["runAgentTurn", "AgentTurnInput", "AgentTurnOutput", "AgentTier", "CONFIG_REQUIRED"]
```

**Replace with:**

```md
["runAgentTurn", "AgentTurnInput", "AgentTurnOutput", "AgentTier"]
```

**Insert after the unresolved-tier truth:**

```md
**Identifier discovery rule:** “configuration-required” describes an orchestrator outcome, not an approved §21.6 error code. Before defining the result shape, search the authoritative spec and repository for an existing configuration-required identifier. Reuse it if found. If none exists, represent the condition as a typed non-error `AgentTurnOutput` outcome using only already-approved fields; do not invent or export `CONFIG_REQUIRED`. Record the selected repository-sourced shape in the plan summary and test the exact result plus zero provider calls.
```

# 03-07-PLAN.md

## P07-1 — Reconcile `files_modified`

**Delete this frontmatter entry:**

```md
- src/core/storage/ChatHistoryDB.ts
```

**Insert after `files_modified`:**

```md
read_only_discovery:
- src/core/storage/ChatHistoryDB.ts
```

## P07-2 — Add mandatory persistence discovery checkpoint

**Insert before the first automated implementation task:**

```md
### Mandatory pre-implementation storage contract check

1. Read `src/core/storage/ChatHistoryDB.ts`, `src/core/storage/WriteJournal.ts`, and `src/types/storage.ts`.
2. Confirm the existing append API can atomically persist one completed user/assistant pair without changing the ChatHistoryDB schema.
3. Verify whether the authoritative §20.3 contract permits extending `WriteJournalOperation` and whether an exact repository-approved chat append identifier already exists.
4. Only if the exact identifier `append-chat-turn` is already authorized by the reviewed context/spec may the task add that literal and its journal-step registration.
5. If authorization or schema fit is absent, STOP this task and report the D-45a boundary conflict. Do not edit ChatHistoryDB, invent a second store, or substitute an unjournaled write.
6. Record inspected signatures and the go/stop result in the execution summary before coding.
```

## P07-3 — Remove model-class guessing

**Find all instructions requiring:**

```md
first-setup pre-fill suggestions using the first-discovered model of each class
```

**Replace with:**

```md
Model discovery populates the FAST and BALANCED selectors but does not classify, preselect, or persist either value. Both remain unset until the operator explicitly selects values and confirms Save. If an authoritative deterministic classifier is later supplied, it may add UI-only suggestions without changing the runtime null contract.
```

# 03-RESEARCH.md

## PR-1 — Mark resolved questions

Under `### Open Questions`, append `(RESOLVED)` to each of the five question headings and add the applicable decision reference. Rename the heading to:

```md
### Resolved Questions
```

## PR-2 — Resolve Renderer tier drift

For every passage that says Renderer uses `balanced`, append:

```md
(SUPERSEDED BY REVIEWED CONTEXT D-55: Phase 3 Renderer uses `fast`.)
```

Do not alter quoted authoritative Appendix text. Where a quoted source conflicts, retain the quote and add the supersession note immediately after it.

# 03-VALIDATION.md

## PV-1 — Replace the per-task verification map

Replace the current map with a map generated from the actual task IDs in `03-01-PLAN.md` through `03-07-PLAN.md`. The replacement MUST:

```md
- preserve every existing behavior and command;
- map persona work to plan 03-02;
- map provider parsing to 03-03;
- map prompt cache/executor/renderer to 03-04;
- map registry/tier/router to 03-05;
- map orchestration to 03-06;
- map chat persistence and Options behavior to 03-07;
- include the human live-provider checkpoint from 03-07;
- use the exact task IDs present in each plan, discovered from the files rather than guessed;
- contain no task ID that does not exist in a plan.
```

# Post-application checks

Run:

```bash
rg -n "CONFIG_REQUIRED|z\.enum\(\[\]\)|first-discovered model of each class|Renderer.*balanced|ChatHistoryDB.ts" .planning/phases/03-* .planning/phases/03-*/03-*.md
pnpm run verify:phase-3
```

Expected:

```md
- No plan authorizes `CONFIG_REQUIRED` as a new error code.
- No plan requires an empty Zod enum.
- No plan requires model-class guessing.
- Renderer-balanced text is either absent or explicitly marked superseded.
- `ChatHistoryDB.ts` appears only as read-only discovery, not `files_modified`.
- Validation task IDs all exist in their referenced plans.
- Existing provider-connection test and all implemented Phase-3 tests pass.
```
