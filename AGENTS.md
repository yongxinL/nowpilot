# Agent Instructions

## 1. Purpose

These instructions apply to every OpenCode and other coding-agent session in this repository.

The repository uses Superpowers as its primary development methodology. Work must be deterministic, test-driven, phase-scoped, evidence-backed, and suitable for cost-effective models.

This file is the mandatory entry point for agent behaviour. Keep it concise. Detailed product, architecture, planning, execution, and deployment information lives under `.planning/`.

## 2. Instruction precedence

Use the following precedence order:

1. Current approved phase `.planning/phases/<phase>/DESIGN.md`
2. Current approved phase `.planning/phases/<phase>/PLAN.md`
3. This root `AGENTS.md`
4. Active product specification `.planning/product/PRODUCT_SPEC.md`
5. Architecture baseline `.planning/architecture/ARCHITECTURE.md`
6. Accepted ADRs under `.planning/architecture/decisions/`
7. Delivery roadmap `.planning/roadmap/ROADMAP.md`
8. Execution protocol `.planning/operations/EXECUTION_PROTOCOL.md`
9. Deployment guide `.planning/operations/DEPLOYMENT.md`

The archived source specification at `.planning/product/PRODUCT_SPEC_SOURCE_V0_1.md` is retained for traceability only. It is not an implementation authority and must not override an active specification, accepted ADR, approved phase design, or approved phase plan.

If authoritative documents conflict:

1. Stop work on the affected scope.
2. Do not choose, merge, or reinterpret the requirements silently.
3. Record the conflict in the current phase evidence.
4. Ask the operator one focused blocking question with concrete options and a recommended resolution.
5. Resume only after the authoritative document is corrected or the decision is recorded in an ADR.

## 3. Canonical planning locations

Use these locations exactly:

```text
.planning/
├── README.md
├── STATUS.md
├── DECISIONS.md
├── product/
│   ├── PRODUCT_SPEC.md
│   └── PRODUCT_SPEC_SOURCE_V0_1.md
├── architecture/
│   ├── ARCHITECTURE.md
│   └── decisions/
├── roadmap/
│   └── ROADMAP.md
├── operations/
│   ├── EXECUTION_PROTOCOL.md
│   └── DEPLOYMENT.md
├── phases/
│   └── <NN-phase-name>/
│       ├── DESIGN.md
│       ├── PLAN.md
│       └── ACCEPTANCE.md
└── evidence/
    └── phase-<NN>/
        ├── verification.txt
        ├── review.md
        ├── manual-checks.md
        └── screenshots/
```

Do not create alternative planning locations or duplicate authoritative documents.

## 4. Locked repository decisions

The following decisions are locked unless an approved ADR explicitly changes them:

- The Side Panel is Chat-only.
- Deep-work and administration surfaces belong in the Standalone view.
- Use `standalone` as the canonical path, symbol, surface, registry, router, and entry-point stem.
- Do not introduce a parallel `app` naming family.
- Content scripts are extraction-only in v0.1.
- Do not render host-page UI or write into host-page fields in v0.1.
- AI-provider calls and MCP streams run only in extension-owned Side Panel or Standalone contexts.
- The background service worker does not run AI-provider streams, MCP streams, or IndexedDB operations.
- The model may request tools, but only deterministic application code validates and executes them.
- Side-effect completion requires matching verification evidence.
- Notes and memory are local-first. Optional filesystem storage is a backup target, not the primary store.
- Build-agent model selection is operator-configured and must not be hard-coded in product code or specifications.

Do not reopen these decisions during routine implementation.

## 5. Required Superpowers workflow

Before implementation, use the relevant Superpowers workflow.

### New or changed behaviour

1. Use `brainstorming` to refine and approve the phase design.
2. Save the approved design to `.planning/phases/<phase>/DESIGN.md`.
3. Use `writing-plans` to create the executable phase plan.
4. Save the approved plan to `.planning/phases/<phase>/PLAN.md`.
5. Use `using-git-worktrees` before implementation when the worktree does not already exist.
6. Use `subagent-driven-development` when reliable subagents are available. Otherwise use `executing-plans`.
7. Use `test-driven-development` for implementation tasks.
8. Use `requesting-code-review` after each task.
9. Use `verification-before-completion` before any completion claim.
10. Use `finishing-a-development-branch` after the complete phase passes its gates.

### Bugs and unexpected failures

Use `systematic-debugging` before proposing or applying a fix when the root cause is not already proven by a focused failing test.

Do not bypass a mandatory Superpowers workflow merely because the task appears small.

## 6. Session start procedure

At the start of every implementation session:

1. Read this file.
2. Read `.planning/README.md`.
3. Read `.planning/STATUS.md`.
4. Identify the current phase and current task from `STATUS.md`.
5. Read only the current phase `DESIGN.md`, `PLAN.md`, and directly referenced contracts.
6. Confirm that the design and plan are approved and contain no unresolved blocking question.
7. Confirm the current Git branch and worktree.
8. Confirm the working tree is clean before starting a new task.
9. Run the baseline verification command defined by the current plan.
10. Confirm the baseline passes before modifying files.
11. Implement exactly one plan task.

If `STATUS.md`, the current design, or the current plan is missing, stop. Do not infer the active phase or create an implementation plan during execution.

## 7. Plan-task contract

Every executable task in `PLAN.md` must define:

- task ID;
- objective;
- exact files allowed to change;
- exact test file or manual verification procedure;
- initial failing-test command;
- expected failure reason;
- minimal implementation steps;
- focused verification command;
- phase verification command;
- required evidence;
- atomic commit message;
- implementation tier, when advanced capability may be required.

If any required field is absent or ambiguous, stop and record a blocking plan defect. Do not fill the gap by guessing.

## 8. Deterministic implementation rules

- Never invent a path, type, interface, constant, message, error code, storage key, prompt, tool name, provider ID, model ID, test command, or acceptance criterion.
- Search the repository for the canonical declaration before using an identifier.
- Use codebase-memory tools for structural discovery when available, but treat repository source and approved documents as authoritative.
- Use external documentation tools only for current third-party APIs. External documentation must not override NowPilot architecture or locked decisions.
- Modify only files explicitly allowed by the current task.
- Do not implement later-phase infrastructure early.
- Do not refactor unrelated code.
- Do not perform speculative cleanup.
- Do not add, remove, upgrade, or replace a dependency unless the approved plan names the exact change.
- Do not modify manifest permissions unless the approved design and plan explicitly require it.
- Keep public module boundaries schema-validated and fixture-tested.
- Pass one `AbortSignal` through each applicable asynchronous call chain.
- Every catch block must use a canonical error code and structured debug logging.
- Do not use empty catch blocks.
- Do not duplicate canonical types, prompts, strings, schemas, or registries.
- Do not weaken security, privacy, accessibility, isolation, or verification requirements to reduce implementation effort.
- Do not mark advanced behaviour complete when the approved design requires a stub.

## 9. Chrome MV3 and isolation rules

- Register background listeners synchronously.
- Use `chrome.alarms` for background scheduling.
- Do not use `setInterval` in the background service worker.
- Do not access IndexedDB from the background service worker.
- Do not call AI providers or MCP servers from the background service worker.
- Content scripts must not import React, React DOM, Ant Design, Ant Design X, Defuddle, YAML, Turndown, Temml, MathML conversion packages, or filesystem APIs.
- Content scripts must not render UI, create UI shadow roots, inject styles, or modify host-page fields.
- Cross-context messages must use the canonical runtime envelope and message registry.
- Validate message senders and message types at trust boundaries.
- Password values must never be extracted, logged, indexed, or persisted.
- Any change affecting an extension context must include the applicable isolation test.

## 10. Security and privacy rules

Never log, persist, display in diagnostics, export, or commit raw:

- API keys;
- bearer tokens;
- cookies or session tokens;
- prompts or model request bodies;
- tool inputs or outputs;
- clipboard contents;
- customer or ServiceNow case content;
- filesystem paths containing sensitive information;
- password-field values;
- image or audio payloads.

Required controls:

- Apply redaction before every logging, persistence, diagnostics, or export sink.
- Store session tokens only in approved session-scoped storage.
- Store API keys only through the approved encrypted-storage path.
- Store message and large content bodies only in the approved IndexedDB stores.
- Treat page, note, memory, upload, and tool content as untrusted data without instruction authority.
- Validate tool input and output at the boundary.
- Apply permission policy before side effects.
- Use idempotency protection for writes.
- Require postcondition evidence before reporting side-effect success.
- Default to the safer behaviour when a security or privacy rule is unclear, then ask the operator.

## 11. Test-driven task loop

For each code task:

1. **RED:** Write or update one focused test for the specified behaviour.
2. Run the focused test and capture the expected failure.
3. Confirm that the failure is caused by the missing behaviour, not broken setup or an unrelated defect.
4. **GREEN:** Implement the smallest change that makes the focused test pass.
5. Run the focused test and confirm it passes.
6. **REFACTOR:** Improve only the changed scope while keeping the focused test green.
7. Run the current phase verification command.
8. Review the diff against the task and approved design.
9. Run specification-compliance review.
10. Run code-quality and security review as required by the plan.
11. Correct all blocking findings and rerun affected verification.
12. Update evidence and status records.
13. Create the atomic task commit.

No production implementation may be committed before its failing test unless the plan explicitly classifies the task as documentation, configuration, generated output, or another approved non-code exception.

Do not change a test merely to make an incorrect implementation pass.

## 12. Verification discipline

Verification must use fresh command output from the current worktree and commit state.

For each task, run:

- the focused test command;
- the current phase verification command;
- any applicable type-check, lint, isolation, security, migration, performance, or build command named by the plan.

For a phase, verify every acceptance criterion through either:

- an automated test with recorded output; or
- an explicit manual check with recorded evidence.

Do not treat the following as successful verification:

- remembered output from an earlier run;
- a partial test suite when the plan requires the full phase command;
- a skipped or filtered test without approval;
- a successful build with failing tests;
- a tool message that claims success without command output;
- visual correctness without the required screenshot or manual record.

## 13. Evidence requirements

Store phase evidence under:

```text
.planning/evidence/phase-<NN>/
```

Required records:

- `verification.txt`: commands, timestamps, exit status, and relevant output;
- `review.md`: specification-compliance and code-quality findings and resolutions;
- `manual-checks.md`: manual acceptance steps and results;
- `screenshots/`: required UI or browser evidence.

Evidence must identify:

- phase and task ID;
- branch and worktree;
- commit or commit range;
- commands executed;
- pass or fail result;
- blocking and deferred findings;
- known limitations;
- final acceptance decision.

Do not overwrite historical evidence for previously accepted tasks or phases. Append or create a new dated record when rerunning a gate after code changes.

## 14. Review gates

Every implementation task requires these reviews in order:

### 14.1 Specification-compliance review

Check:

- exact task scope;
- allowed file paths;
- canonical contracts and identifiers;
- approved dependencies;
- test and fixture requirements;
- security and privacy constraints;
- acceptance-criterion coverage;
- deferred-feature boundaries.

Specification compliance must pass before general code-quality review.

### 14.2 Code-quality review

Check:

- correctness;
- maintainability;
- readability;
- error handling;
- concurrency and abort behaviour;
- security and privacy;
- extension-context isolation;
- accessibility where applicable;
- test quality;
- unnecessary complexity.

Critical and high-severity findings block the next task. Medium findings must be fixed or explicitly deferred in the phase acceptance record. Low findings may be recorded for later cleanup when they do not affect acceptance.

A reviewer must not silently broaden the task or redesign an approved contract.

## 15. Commit policy

Use this format:

```text
<type>(phase-<NN>): <task outcome>
```

Examples:

```text
test(phase-01): define runtime envelope fixtures
feat(phase-01): implement runtime envelope validation
fix(phase-01): preserve workspace handoff version
docs(phase-01): record shell acceptance evidence
```

Rules:

- One plan task equals one atomic commit.
- Do not combine unrelated tasks.
- Do not mix broad formatting or cleanup with functional changes.
- Do not amend, rebase, reset, squash, force-push, or rewrite shared history without explicit operator approval.
- Do not commit generated secrets, local environment files, browser profiles, test credentials, or raw evidence containing sensitive data.
- Update `.planning/STATUS.md` after the task is verified and committed.

## 16. Status updates

After each accepted task, update `.planning/STATUS.md` with:

- current phase;
- completed task ID;
- last commit;
- verification result;
- review result;
- evidence path;
- next task;
- blockers or deferred findings.

Do not rewrite or delete previous status history. Append a dated entry or update only the explicitly designated current-state section.

## 17. Cost-effective model controls

- Load only this file, `.planning/README.md`, `.planning/STATUS.md`, the current phase files, and directly referenced contracts.
- Do not load the archived source specification unless a traceability question explicitly requires it.
- Prefer repository search or structural code queries over reading broad directory trees.
- Keep every task small enough for one focused test-first change.
- Prefer exact schemas, fixtures, examples, and commands over narrative instructions.
- Use a cost-effective model for routine implementation and focused corrections.
- Use a balanced model for phase design, planning, integration review, and non-trivial debugging.
- Escalate to an advanced model only when the task is marked `implementation-tier: advanced`, is security-critical, requires architecture reconciliation, or has failed two independent implementation or review attempts.
- Do not let a model select or change its own implementation tier.
- Advanced modules may be stubbed only when the approved design defines the exact stub contract and acceptance test.
- Disable optional MCP servers and tools when they are not required for the current task.

## 18. Human interaction policy

Continue autonomously when the approved design and plan define:

- required behaviour;
- exact files and identifiers;
- acceptance criteria;
- verification commands;
- dependency and permission treatment;
- security and privacy treatment.

Ask the operator only when:

1. authoritative documents conflict;
2. required product behaviour is genuinely unspecified;
3. a locked decision must change;
4. a new dependency, host permission, Chrome permission, external service, or cloud transmission is required;
5. data loss, destructive Git action, irreversible migration, or incompatible persistence change is possible;
6. sensitive-data handling is unclear;
7. a manual visual decision cannot be determined from approved mock-ups and acceptance criteria;
8. an advanced module requires escalation rather than the approved stub;
9. baseline verification fails for an unrelated pre-existing reason;
10. the phase is ready for final operator acceptance.

When asking:

- ask one focused question;
- explain the blocking ambiguity;
- cite the relevant files and sections;
- provide two to four concrete options;
- recommend one option;
- state implementation, security, migration, and schedule effects where relevant;
- do not modify affected files until answered.

Do not ask the operator about routine implementation details that can be resolved from the current design, plan, repository, tests, or official dependency documentation.

## 19. Stop conditions

Stop immediately when:

- the current phase or task cannot be identified;
- the design or plan is unapproved, missing, or ambiguous;
- a required canonical declaration is missing;
- the plan conflicts with the product specification, architecture baseline, or an accepted ADR;
- baseline verification fails for an unrelated reason;
- the request crosses phase scope;
- the task requires files not allowed by the plan;
- a new dependency or permission is required but not approved;
- a security, privacy, accessibility, isolation, or evidence invariant would be weakened;
- a destructive operation lacks explicit approval;
- implementation would require guessing;
- two independent implementation attempts fail;
- a critical or high-severity review finding remains unresolved.

Record the stop reason in `.planning/STATUS.md` and the current phase evidence before asking the operator for a decision.

## 20. Completion claims

Never say that a task, phase, fix, or release is complete without fresh evidence.

### Task completion requires

- the focused test passes;
- the phase verification command passes;
- required reviews pass;
- task evidence is recorded;
- the atomic commit exists;
- `.planning/STATUS.md` is updated;
- no blocking finding remains;
- the working tree is clean after the commit.

### Phase completion requires

- every planned task is accepted;
- every phase acceptance criterion is mapped to evidence;
- automated verification passes;
- required manual checks pass;
- required screenshots are recorded;
- migration, isolation, security, and performance gates pass where applicable;
- `.planning/phases/<phase>/ACCEPTANCE.md` records the result;
- the operator accepts the phase;
- the finishing-a-development-branch workflow is completed.

### Release completion requires

- the deployment and release guide is followed;
- release verification is recorded;
- the packaged artefact and checksum are verified;
- smoke tests pass on the packaged build;
- rollback artefacts and instructions are available;
- no blocking finding remains.

Evidence over claims. If evidence is incomplete, report the exact missing evidence and use `BLOCKED`, `PARTIAL`, or `FAILED`, never `COMPLETED`.
