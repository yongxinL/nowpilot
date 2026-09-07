# Start NowPilot Project

Use the repository as the source of truth. Follow `AGENTS.md` and `.planning/PRODUCT_SPEC_v0_1.md`.

## Objective

Initialise or assess the NowPilot repository for phase-based implementation without using GSD as a required dependency.

## Instructions

1. Read `AGENTS.md`.
2. Read `.planning/PRODUCT_SPEC_v0_1.md` §§0, 18, 24 and the appendices referenced by Phase 1.
3. Inspect the repository, Git status, branches, package scripts, existing `.planning/` artefacts, source files and tests.
4. Do not create or modify application code yet.
5. Determine whether this is a new repository, partially implemented repository, or migration from an earlier plan.
6. Identify the earliest incomplete phase based on repository evidence, not assumptions.
7. Create or update only these tracking artefacts:
   - `.planning/STATUS.md`
   - `.planning/ROADMAP.md`
   - `.planning/REQUIREMENTS.md`
   - `.planning/DECISIONS.md`
   - `.planning/phases/<active-phase>/`
8. Create the active phase directory under: `.planning/phases/<NN>-<phase-name>/`
9. Preserve existing useful planning history. Do not delete or rewrite it without necessity.
10. Report spec/repository conflicts exactly. Do not invent resolutions.
11. Recommend whether the active phase needs a discussion before planning.

## Required Output

- repository assessment;
- current active phase and evidence;
- missing prerequisites;
- canonical files and verification commands for the active phase;
- conflicts requiring a decision;
- recommended next prompt: `DISCUSS_PHASE.md` or `PLAN_PHASE.md`.
