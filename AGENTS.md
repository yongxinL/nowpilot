# NowPilot Implementation Instructions

## Purpose

This file is the common repository instruction entry point for Codex, OpenCode, other repository-aware coding agents, and human contributors.

## Canonical Sources

Read in this order before changing code:

1. `.planning/PRODUCT_SPEC_v0_1.md` §0.
2. `.planning/STATUS.md`.
3. The active phase in product-spec §18.
4. `.planning/phases/<active-phase>/PLAN.md`, when it exists.
5. The feature sections and appendices explicitly referenced by that phase.
6. The existing repository implementation and tests.

Precedence:

1. Product-spec hard rules and canonical registries.
2. Ratified ADRs that explicitly amend the product spec.
3. Active phase plan.
4. Existing implementation where it does not conflict with the above.
5. Tool-specific or personal instructions.

If two canonical sources conflict, stop implementation and report the exact conflict. Do not guess a near match.

## Mandatory Behaviour

- Implement exactly one phase or approved sub-phase at a time.
- Do not invent file paths, identifiers, types, provider IDs, storage keys, message types, error codes, schemas, tool names, or public contracts.
- Preserve existing structure and prefer surgical patches over broad rewrites.
- Do not implement later-phase functionality early.
- Do not modify unrelated files.
- Inspect the repository before proposing paths or APIs.
- Reuse canonical reference implementations and imports from the product spec.
- Every public boundary must have the phase-required validation and fixture tests.
- Every catch path must use a canonical error code and `debugLog` as specified.
- Never weaken, delete, skip, or rewrite a test merely to obtain a passing result.
- Never report completion unless verification has passed against the reported commit.
- Never commit secrets, credentials, tokens, raw customer content, or unredacted traces.

## Phase Workflow

For each phase use this sequence:

1. **Discuss**, only if unresolved decisions, repository/spec conflicts, or material ambiguity exist.
2. **Plan** the phase in `.planning/phases/<NN>-<name>/PLAN.md`.
3. **Execute** only the approved plan.
4. **Verify** using focused tests and `pnpm run verify:phase-N`.
5. Record `RESULT.md`, `ACCEPTANCE.md`, and update `.planning/STATUS.md`.
6. Commit the verified state.

Discussion is not required when all contracts, paths, dependencies and acceptance criteria are already deterministic.

## Git Rules

- Branch: `phase/<number>-<short-name>` or `fix/<phase-number>-<short-name>`.
- Keep one phase or approved sub-phase per branch.
- Use small, reviewable commits.
- Recommended commit forms:
  - `phase(03): implement provider registry hydration`
  - `test(03): add provider fallback fixtures`
  - `fix(03): preserve canonical stream event contract`
  - `docs(03): record verification evidence`
- Do not rewrite shared history.
- Do not merge with failing verification.

## Planning Requirements

Every `PLAN.md` must include:

- phase goal and non-goals;
- dependencies and preconditions;
- requirement and decision IDs;
- exact existing and proposed files;
- task order and dependency graph;
- canonical types, schemas, constants and imports;
- tests to add or update;
- exact verification command;
- manual acceptance steps;
- risks, blockers and deferred work;
- traceability from every requirement to at least one task and test or acceptance check.

A plan must not create new repository contracts unless an authoritative source requires them.

## Execution Requirements

Before each change:

- inspect the target file and nearby tests;
- confirm the path and symbol exist or are explicitly created by the phase;
- identify the applicable canonical type and error-code homes;
- make the smallest coherent patch.

After each task:

- run the narrowest relevant test or type check;
- update the phase result notes if implementation differs from the plan;
- stop on a contract conflict rather than solving it by invention.

## Verification Requirements

Verification must include:

- focused tests for changed behaviour;
- the phase verification command;
- lint, type-check, isolation, performance, or security checks required by the phase;
- review of the final Git diff for unrelated changes;
- confirmation that required files and tests exist;
- manual visual evidence where the product spec requires it.

Record in `RESULT.md`:

- command;
- timestamp;
- exit status;
- test summary;
- verified commit SHA;
- deviations;
- known issues;
- deferred items.

Verification becomes stale after any code change.

## UI Stack

For v0.1 extension-owned surfaces:

- use Ant Design v6;
- use Ant Design X 2.x presentation components only;
- use `@ant-design/x-markdown` for streaming Markdown;
- do not use `@ant-design/x-sdk` or `@ant-design/x-card`;
- do not introduce Tailwind CSS into Side Panel or Standalone surfaces;
- Side Panel is Chat only;
- Standalone uses `src/entrypoints/standalone/` and `src/components/standalone/`.

Future injected Shadow DOM UI is outside v0.1 and must not be implemented without a ratified addendum.

## Completion Response

When finishing work, report only:

1. scope completed;
2. files changed;
3. tests and verification run;
4. result;
5. deviations or blockers;
6. verified commit SHA, if committed.

Do not claim success without evidence.

## Planning Artefact Locations

All project planning, specification, decision and verification artefacts live
under `.planning/`.

Canonical locations:

- Product specification:   `.planning/PRODUCT_SPEC_v0_1.md`
- Project status:   `.planning/STATUS.md`
- Roadmap:   `.planning/ROADMAP.md`
- Requirement index:   `.planning/REQUIREMENTS.md`
- Decision register:   `.planning/DECISIONS.md`
- Operator prompts:   `.planning/prompts/`
- Phase plans and results:   `.planning/phases/`
- Architecture decisions:   `.planning/adr/`
- Verification attachments:   `.planning/evidence/`

Do not create parallel copies under `.project/`, `docs/`, `prompts/`, or the repository root.

The only planning-related file permitted at the repository root is `AGENTS.md`, because coding agents use it as the repository instruction entry point.

When moving an artefact, update every inbound reference in the same commit. Never leave compatibility copies that could become competing sources of truth.