# Plan NowPilot Phase

Follow `AGENTS.md`. Plan only. Do not change application code.

## Phase

`.planning/phases/<PHASE_NUMBER> - <PHASE_NAME>`

## Objective

Create a deterministic, execution-ready phase plan suitable for Codex or another repository-aware coding agent.

## Instructions

1. Read the active phase in product-spec §18, all referenced requirements, appendices, worked examples, ADRs and accepted decisions.
2. Inspect every existing file and test relevant to the phase.
3. Confirm all proposed paths and symbols against the repository or explicit product-spec create list.
4. Map every phase requirement and accepted decision to at least one task.
5. Map every task to exact files, canonical contracts, tests and acceptance evidence.
6. Use small tasks with explicit prerequisites and completion criteria.
7. Include precise imports, type homes, schema homes, error codes and verification commands when they are canonical.
8. Do not add future-phase scope or opportunistic refactors.
9. Do not invent new identifiers or near-match existing ones.
10. If a blocker prevents deterministic planning, stop and return the blocker rather than filling the gap.

## Write

Create or update:

`.planning/phases/<NN>-<phase-name>/PLAN.md`

The plan must contain:

- goal;
- non-goals;
- dependencies and preconditions;
- requirement and decision traceability;
- repository findings;
- ordered task list;
- exact files touched by each task;
- canonical contracts used by each task;
- tests for each task;
- manual acceptance checks;
- verification command;
- risks and rollback notes;
- deferred items;
- final completeness checklist.

## Final Response

Return:

- plan file created or updated;
- blocker count;
- warning count;
- requirement-to-task coverage;
- exact next prompt: `EXECUTE_PHASE.md`.
