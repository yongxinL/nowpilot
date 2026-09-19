# Superpowers and OpenCode Execution Protocol

## 1. Bootstrap

Install Superpowers for the OpenCode harness using the current upstream OpenCode installation instructions. Restart OpenCode after installation, then verify that Superpowers skills are discoverable before project work.

Repository prerequisites:

```text
AGENTS.md
PRODUCT_SPEC.md
ARCHITECTURE.md
ROADMAP.md
DEPLOYMENT.md
.planning/STATUS.md
.planning/DECISIONS.md
.planning/phases/
.planning/evidence/
```

## 2. Phase workflow

### Gate A: brainstorm and approve design

Use the Superpowers brainstorming workflow for one phase only.

The approved design must define:

- outcome and non-goals;
- exact files allowed to change;
- canonical interfaces and data ownership;
- failure behaviour and security constraints;
- automated and manual acceptance criteria;
- unresolved questions, all closed before planning.

Save it to:

```text
.planning/phases/<NN-name>/DESIGN.md
```

### Gate B: create executable plan

Use the writing-plans workflow after design approval.

Every task must include:

- task ID and objective;
- exact file paths;
- exact test file;
- failing-test command;
- minimal implementation steps;
- focused verification command;
- phase verification command;
- expected evidence;
- atomic commit message.

Save it to:

```text
.planning/phases/<NN-name>/PLAN.md
```

A task must not depend on model inference. Split any task that cannot be completed and verified in one small test-first cycle.

### Gate C: isolated execution

Use an isolated Git worktree and a dedicated phase branch.

```bash
git status --short
git worktree add ../nowpilot-phase-<NN> -b phase/<NN>-<name>
cd ../nowpilot-phase-<NN>
pnpm install --frozen-lockfile
pnpm run verify:phase-<previous>
```

If the repository has no previous phase, run the baseline command defined in the Phase 1 plan.

### Gate D: task implementation

Prefer subagent-driven development when reliable subagents are available. Otherwise use executing-plans with explicit checkpoints.

For each task:

1. RED: add the test and prove it fails for the intended reason.
2. GREEN: add the minimal implementation.
3. REFACTOR: improve only while tests remain green.
4. Run focused and phase verification.
5. Perform specification-compliance review.
6. Perform code-quality review.
7. Save evidence.
8. Create the atomic commit.

### Gate E: phase acceptance

Create:

```text
.planning/evidence/phase-<NN>/verification.txt
.planning/evidence/phase-<NN>/review.md
.planning/evidence/phase-<NN>/manual-checks.md
.planning/evidence/phase-<NN>/screenshots/
```

The phase acceptance record must contain:

- commit range;
- commands executed;
- exit status and relevant output;
- manual checks and screenshots;
- known limitations;
- deferred findings;
- explicit pass or fail decision.

### Gate F: finish branch

Use the finishing-a-development-branch workflow. Verify the complete phase gate again before merge or pull request. Never merge on the basis of earlier output.

## 3. Model routing

- **Fast/economy:** repository search, test scaffolding, simple adapters, documentation, local refactors.
- **Balanced:** phase planning, cross-module implementation, integration tests, code review.
- **Advanced:** only explicitly marked complex modules, architecture reconciliation, security-critical review, or persistent failures.

The selected build model is an operator setting. Never hard-code build-agent model names in product documents.

## 4. Status updates

After every accepted task, update `.planning/STATUS.md` with:

- phase and task ID;
- last commit;
- verification result;
- next task;
- blockers;
- evidence path.

Do not rewrite prior history. Append a dated entry.
