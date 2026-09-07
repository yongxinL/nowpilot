# Discuss NowPilot Phase

Follow `AGENTS.md`. This is a decision step, not an implementation step.

## Phase

`.planning/phases/<PHASE_NUMBER> - <PHASE_NAME>`

## Objective

Resolve only the decisions that are necessary to produce a deterministic implementation plan for this phase.

## Instructions

1. Read the active phase in product-spec §18 and every section and appendix it references.
2. Inspect the current repository implementation, tests and `.planning/STATUS.md`.
3. Identify only material ambiguities, conflicts, missing contracts, or decisions with multiple viable implementations.
4. Do not reopen decisions already canonical in the product spec, ADRs or repository contracts.
5. Do not invent file paths, names, schemas, constants, error codes or APIs.
6. For each required decision, provide 2 to 4 materially different options.
7. Mark one option as **Recommended** based on determinism, minimal drift, privacy, security, testability and suitability for cost-effective implementation agents.
8. State the exact files or product-spec sections affected by the decision.
9. If no discussion is needed, state `NO DISCUSSION REQUIRED` and list the evidence that makes the phase deterministic.
10. Do not edit code.

## Required Output

For every decision:

### D-<NUMBER>: <TITLE>

**Question:** ...

1. **<Option> (Recommended)**  
   Exact contract and consequences.

2. **<Option>**  
   Exact contract and consequences.

**Decision required from operator:** `<option number or custom answer>`

End with a paste-ready decision summary for `.planning/DECISIONS.md`.
