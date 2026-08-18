# NowPilot — Review Prompts for the GSD ⇄ Reviewer Loop

## Purpose

Insert stronger-model review gates around GSD stages executed with cost-effective models. The goal is not to shorten artifacts. The goal is to eliminate implementation guessing while preserving all execution-critical detail.

**Location:** `.planning/prompts/REVIEW-PROMPTS.md`

## Ground rules

1. `PRODUCT_SPEC_v0_1.md` is the authoritative product source.
2. Attach the current product spec with every review request.
3. Attach only the artifacts required by the selected gate. For plan review, attach the approved context, but do not attach the discussion log unless investigating a decision-history conflict.
4. Apply surgical edits only unless restructuring is required to resolve a blocker.
5. Never remove execution-critical detail merely to make a document shorter.
6. Do not invent requirements, paths, identifiers, APIs, packages, contracts, constants, or examples.
7. A reviewer must distinguish sourced requirements from reviewer recommendations.
8. Every finding must include evidence, impact, and an exact fix.
9. Both the review output and every corrected document must be deterministic and suitable for a cost-effective model.
10. Do not convert ambiguity into guessed authority. If an identifier or contract is not established by the repository or authoritative artifacts, require repository discovery or report a blocker instead of inventing it.
11. When existing documents need correction, produce a surgical patch and a separate application prompt that a cost-effective model can follow without interpreting the findings.

## Protected execution content

The following content must be preserved when correcting a context or plan document unless it is demonstrably incorrect, duplicated without additional value, or contradicted by the authoritative source:

- task breakdowns and task order
- `must_haves`, truths, artifacts, key links, prohibitions, assumptions, and success criteria
- file paths and `files_modified`
- required exports, imports, interfaces, signatures, schemas, storage keys, events, routes, and error codes
- per-file source maps and citations
- implementation patterns and short contract examples
- edge cases, lifecycle rules, cleanup requirements, failure behavior, and concurrency expectations
- test fixtures, assertions, verification commands, and human verification steps
- UI states, exact copy, dimensions, component hierarchy, and referenced mockups
- dependency and phase-boundary information
- threat mitigations that create implementation or verification obligations

A corrected document must retain the original tasks and protected sections. If content is moved or consolidated, provide a preservation map showing its new location.

## Review loop

```text
GSD discuss
  → Gate 1: context review only when required
  → GSD plan
  → Gate 2: plan implementability review
  → Gate 2.1: reference-closure review
  → generate surgical patch package
  → apply patch with a cost-effective model, validate diff, and commit
  → GSD execute
  → Gate 2.5: implementation review
  → deterministic verification
  → Gate 3: failure triage when verification is not green
```

Gate 1 is required when context decisions are ambiguous, contradictory, incomplete, high-risk, or not yet approved. It may be skipped when the GSD-generated context has already been reviewed and approved.

The GSD discussion log is an audit trail, not a normal review input. Review it only to resolve a conflict or reconstruct why a decision was made.

Gate 2.5 is required for high-scrutiny phases and recommended whenever a cost-effective model changes architecture, shared state, asynchronous behavior, storage, messaging, security boundaries, or more than one connected file.

## How to run a gate

1. Let GSD finish and save the artifact without replacing the previous version.
2. Attach the authoritative spec and only the artifacts requested by the selected prompt.
3. Run the review prompt.
4. Save findings and patch artifacts under `.planning/`.
5. Apply the patch with Prompt I, inspect the diff, run document validation, and commit only patch-related files.
6. Run the next gate or execute the plan.
7. Advance only when blockers are closed and deterministic verification is green.

---

## Prompt A — Review an unapproved or high-risk context document (Gate 1)

```md
Use this gate only when the context has not already been reviewed and approved, or when it contains ambiguity, contradiction, high-risk decisions, or unresolved phase boundaries. Do not review the discussion log by default.

Attached:
- Phase <N> context document
- PRODUCT_SPEC_v0_1.md
- DESIGN_SYSTEM.md and UI spec/mockups when the phase has UI scope

Treat PRODUCT_SPEC_v0_1.md as authoritative. Review the context for downstream planning and implementation by a cost-effective model. The corrected context must be deterministic enough that a cost-effective planner does not need to infer missing decisions.

Check:
1. Every decision against the precise authoritative section.
2. Contradictions, duplicated sources of truth, silent drift, and stale decisions.
3. Missing decisions, invariants, thresholds, defaults, ownership rules, failure behavior, lifecycle behavior, UI states, and phase-boundary calls that an implementer might otherwise guess.
4. Capabilities that belong to a later phase.
5. Whether every decision has a stable ID and an implementation consequence.
6. Whether deferred items state the owning phase and prohibit premature implementation.
7. Whether terms, identifiers, routes, stores, events, storage areas, and surfaces are used consistently.

For each finding provide:
- Severity: Blocker / Ambiguity / Nit
- Evidence: authoritative section plus exact context passage
- Problem and implementation impact
- Exact replacement, insertion, or deletion

Output `Phase-<N>-REVIEW-FINDINGS.md` with:
# Blockers
# Ambiguities
# Confirmed Decisions
# Deferred
# Exact Surgical Edits

Preservation rule:
Do not shorten or rewrite the document for style. Preserve all original decisions and execution-critical detail unless a cited finding requires a change. If content is consolidated, include an old-location → new-location preservation map.
```

---

## Prompt B — Review a plan before execution (Gate 2)

```md
Attached:
- Phase <N> plan document(s)
- reviewed Phase <N> context
- PRODUCT_SPEC_v0_1.md
- relevant patterns/research, design system, UI spec, and mockups

Review the plan for deterministic execution by a cost-effective model. Correctness and implementation precision are more important than brevity.

1. Verify scope and traceability:
   - every requirement, decision, DONE-when condition, UI state, and required test maps to at least one task
   - every task maps back to an authoritative requirement or reviewed decision
   - no later-phase capability is introduced

2. Verify identifiers and files:
   - file paths, modules, routes, imports, exports, types, interfaces, event names, storage keys, constants, enums, error codes, commands, and package versions are sourced and consistent
   - flag every invented or unsupported identifier
   - reconcile `files_modified` with all task-level file references

3. Verify task implementability:
   Each task must specify, where applicable:
   - objective and authoritative references
   - files to create/modify
   - required imports and exports
   - exact public signatures, contract shapes, or schema fields
   - component/store hierarchy and file-to-file connections
   - ordered implementation steps
   - error, empty, loading, partial, overflow, and disabled behavior
   - async ownership, cancellation, cleanup, retry, idempotency, and race behavior
   - exact tests and observable assertions
   - verification command and expected result
   - prohibitions and explicit non-goals

4. Verify dependency order:
   - no task consumes a contract before it exists
   - each task is executable from the repository state produced by earlier tasks/waves
   - parallel tasks do not modify the same contract incompatibly

5. Detect cost-effective-model traps:
   - implicit assumptions, magic values, unclear naming, hidden invariants, vague verbs, missing acceptance values, broad "implement" instructions, or references that require searching across large documents
   - replace each trap with a precise instruction

6. Review examples:
   - preserve authoritative code examples and exact signatures
   - add only short, targeted contract examples when they remove genuine ambiguity
   - label each added example `ILLUSTRATIVE, NON-AUTHORITATIVE`
   - never provide a full implementation when a signature, object shape, call sequence, or assertion is sufficient
   - ensure examples use only approved APIs, identifiers, and paths

7. Preserve plan density:
   Never remove or collapse task breakdowns, must_haves, truths, artifacts, key_links, prohibitions, assumptions, source maps, code signatures, edge cases, tests, success criteria, or human verification merely to reduce length. Remove content only when it is wrong, unsafe, stale, or exactly redundant, and document the removal.

For each finding provide:
- Severity: Blocker / High / Medium / Nit
- Evidence: plan location plus authoritative source
- Implementation impact
- Exact fix
- Affected task(s) and file(s)

Output:
1. `Phase-<N>-PLAN-REVIEW-FINDINGS.md`
2. `Phase-<N>-PLAN-PATCH.md`, containing surgical, file-targeted edits suitable for application by a cost-effective model
3. `Phase-<N>-PATCH-APPLICATION-PROMPT.md`, containing the exact prompt for a cost-effective model to apply the patch, validate the diff, commit the change, and summarize the result
4. The complete corrected plan when full replacement files are requested or safer than patching
5. A preservation report listing retained sections, moved content, and justified removals
6. A final closure matrix:
   Requirement/Decision → Task → Files → Tests → Verification

Patch requirements:
- target exact filenames and insertion/replacement anchors
- include complete inserted or replacement Markdown
- preserve unchanged content verbatim
- never encode guessed identifiers as authoritative
- distinguish repository-sourced values from repository-discovery instructions
- include post-application checks and expected results
- be usable by a cost-effective model without requiring interpretation of the review findings

Do not return a shortened outline or omit unchanged task sections. Use surgical edits and preserve everything else verbatim.
```

---

## Prompt C — Fast inline correction without content loss

Do not use this prompt to apply an existing patch. Use the patch-application prompt embedded in the generated review-patch document.

```md
Attached:
- GSD Phase <N> <context|plan> document
- PRODUCT_SPEC_v0_1.md
- relevant reviewed context, patterns, UI spec, and mockups

Review and return the COMPLETE UPDATED DOCUMENT with surgical fixes applied inline. The updated document must remain deterministic and suitable for a cost-effective model.

Hard constraints:
- preserve every unchanged section and task verbatim
- do not summarize, shorten, or replace detailed tasks with high-level prose
- do not remove execution-critical sections listed in REVIEW-PROMPTS.md
- if content is wrong, replace it at the same level of implementation detail
- if content moves, state old location → new location
- provide evidence for every substantive change

Finish with:
# Changes Applied
# Preserved Execution Content
# Removed Content and Justification
# Remaining Blockers
```

---

## Prompt D — Cross-artifact consistency review

```md
Attached:
- Phase <N> reviewed context
- all Phase <N> plan documents
- PRODUCT_SPEC_v0_1.md
- relevant design system, UI spec, patterns, and mockups

Confirm that the plans faithfully implement every applicable requirement and every reviewed decision.

Check:
1. Dropped, contradicted, partially implemented, duplicated, or differently named decisions.
2. Cross-plan file conflicts, incompatible contracts, repeated ownership, and wave-order defects.
3. Consistent paths, exports, event payloads, storage keys, UI copy, component hierarchy, state ownership, and error codes.
4. Whether each deferment remains unimplemented and is assigned to the correct later phase.
5. Whether the combined plans cover all DONE-when conditions and required tests without relying on unstated work.

Output:
# Blockers
# Cross-Plan Risks
# Confirmed Coverage
# Deferred
# Exact Fixes
# Decision → Plan → Task → File → Test Matrix

Do not rewrite the plans unless requested. Do not infer coverage from task titles; verify it from task instructions and assertions.
```

---

## Prompt E — Reference-closure review (Gate 2.1)

```md
Attached:
- corrected Phase <N> plan document(s)
- reviewed context
- PRODUCT_SPEC_v0_1.md
- all referenced patterns, research, design, UI, and mockup artifacts

Perform a reference-closure audit before execution.

For every task, identify:
- authoritative requirement sections
- reviewed decision IDs
- prerequisite phase contracts
- files and symbols consumed
- files and symbols produced
- exact patterns/examples to follow
- UI/mockup references
- tests and verification commands

Flag:
1. A referenced source that is absent, stale, ambiguous, or too broad to guide implementation.
2. A task that names a contract without its path, export, signature, schema, or producing task.
3. A file change lacking an authoritative source or reviewed decision.
4. Requirements, decisions, patterns, or mockups with no consuming task.
5. References that conflict across artifacts.

Apply exact reference-closure edits directly to the complete plan. Prefer per-task and per-file references over a single large reading list.

Output:
1. `Phase-<N>-REFERENCE-CLOSURE.md`
2. The complete corrected plan
3. Task → Source → Contract → Output → Test matrix

Do not remove implementation details while adding references.
```

---

## Prompt F — Review implemented code (Gate 2.5)

```md
Attached or available in the repository:
- implemented Phase <N> code and diff
- executed Phase <N> plan and summary
- reviewed context
- PRODUCT_SPEC_v0_1.md
- test, lint, typecheck, and build output

Review the actual implementation, not only the plan.

1. Verify task completion:
   - every plan instruction is implemented completely
   - no placeholder, stub, TODO, FIXME, HACK, skipped test, broad type suppression, or silent fallback substitutes for required behavior
   - no unplanned capability or file is introduced

2. Verify contracts and architecture:
   - public signatures, types, events, storage keys, routes, ownership boundaries, component hierarchy, and file links match the reviewed plan
   - abstractions are used rather than bypassed
   - state and logic are not duplicated across surfaces

3. Verify runtime behavior:
   - error handling preserves actionable failure information
   - async work has correct ownership, ordering, cleanup, cancellation, retry, and stale-result handling where applicable
   - listeners, timers, subscriptions, observers, and ports are disposed correctly
   - state transitions are deterministic under repeated and concurrent actions
   - browser-extension lifecycle and storage-area behavior match the contract

4. Verify UI behavior where applicable:
   - loading, empty, populated, partial, error, overflow, zero/one/many, long-text, disabled, and responsive states required by the artifacts are implemented
   - accessibility names, keyboard behavior, focus behavior, exact copy, tokens, and metrics match their sources

5. Verify tests:
   - tests assert observable contract behavior, edge cases, and failures rather than only snapshots or implementation details
   - required fixtures are present and non-vacuous
   - identify missing regression tests for every blocker found

Every finding must cite:
- plan task or requirement
- source file and line or exact snippet
- observed or likely failure
- exact code-level correction
- exact regression test

Output `Phase-<N>-CODE-REVIEW-FINDINGS.md`:
# Blockers
# High-Risk Defects
# Architecture and Contract Drift
# Missing or Weak Tests
# Verified Implementation
# Exact Fix Order

Do not claim a file or behavior was reviewed if it was unavailable. Do not approve based only on green lint/typecheck/build output.
```

---

## Prompt G — Deterministic verification and failure triage (Gate 3)

```md
Attached:
- Phase <N> verification output
- code diff
- executed plan and summary
- Phase <N> code-review findings

Classify each failure as one of:
- plan defect
- implementation defect
- test defect
- environment/tooling defect
- authoritative-source conflict

For every failure provide:
- failing command and exact output excerpt
- root cause supported by repository evidence
- smallest safe fix
- affected files
- regression test or verification step
- whether plan/context documentation must also change

Then produce an ordered repair sequence that preserves already-green checks.

Do not weaken assertions, delete tests, add broad ignores, or change requirements merely to make verification green. Mark unresolved causes as blockers rather than guessing.
```

---

## Prompt I — Apply a plan patch, commit, and summarize with a cost-effective model

> Prompt H is intentionally unassigned. Patch application is handled directly by Prompt I below, so the letter is skipped to keep gate letters stable (A–G for review, I for application).

```md
Apply the attached `Phase-<N>-PLAN-PATCH.md` to the existing Phase <N> planning documents in the repository.

Inputs:
- `Phase-<N>-PLAN-PATCH.md`
- all existing Phase <N> plan documents targeted by the patch
- reviewed Phase <N> context
- `PRODUCT_SPEC_v0_1.md`
- relevant research/pattern documents referenced by the patch

Execution rules:
1. Read the entire patch before editing.
2. Apply each patch item exactly to its named file and anchor.
3. Preserve every unchanged section verbatim.
4. Do not summarize, collapse, reorder, or stylistically rewrite existing task content.
5. Do not invent identifiers, files, paths, modules, routes, commands, events, keys, types, interfaces, error codes, constants, versions, or APIs.
6. When the patch requires repository discovery:
   - inspect only the named repository files/symbols first
   - reuse the existing repository identifier
   - record the discovered identifier in the updated plan where instructed
   - stop and report a blocker if no authoritative value exists
7. Do not implement product code. Modify planning documents only unless the patch explicitly targets another planning artifact.
8. Do not introduce later-phase capability.
9. After editing, inspect the diff and verify:
   - every patch item is applied once
   - no unrelated content changed
   - protected execution content remains present
   - all Markdown/frontmatter remains valid
   - `files_modified` matches task-level references
   - dependency/wave declarations remain consistent
   - no unsupported identifier was added
10. Run available planning/document validation commands named by the patch. Do not run destructive commands.
11. If validation fails, correct only patch-related defects and rerun it.
12. Commit the completed planning-document changes using:

    `docs(phase-<N>): apply reviewed plan patch`

13. Do not amend, squash, rebase, force-push, or alter unrelated working-tree changes.
14. If unrelated uncommitted changes exist, commit only the files modified by this patch.

Return:
1. `PATCH-APPLICATION-SUMMARY.md` containing:
   - files changed
   - patch items applied
   - repository identifiers discovered and their source files
   - validation commands and results
   - preserved sections
   - unresolved blockers or `None`
   - commit hash and commit message
2. Final list of changed files.
3. Readiness decision: `READY FOR EXECUTION` or `BLOCKED`, with exact reasons.

The result must remain suitable for deterministic execution by a cost-effective model.
```

---

## Minimum execution-quality contract for every plan task

A task is not ready for a cost-effective implementer unless it answers the applicable items below:

```text
WHY     authoritative requirement or decision
WHAT    precise observable outcome
WHERE   exact files
API     imports, exports, signatures, schemas, keys, events
FLOW    ordered connections and state transitions
EDGES   failure, empty, lifecycle, concurrency, cleanup
LIMITS  prohibitions and non-goals
TEST    fixtures and exact assertions
VERIFY  command and expected observable result
```

## Example-code policy

More example code can improve implementation quality only when it removes a specific ambiguity.

Prefer, in order:

1. exact public signature
2. type or object shape
3. short call sequence
4. expected assertion
5. minimal illustrative snippet

Avoid complete solutions duplicated inside the plan. Large duplicated examples can become stale or conflict with the authoritative source. Every reviewer-added example must be labeled `ILLUSTRATIVE, NON-AUTHORITATIVE` and must identify the requirement or decision it clarifies.

## Reviewer completion checklist

Before marking a gate clean, confirm:

- no blocker remains
- no execution-critical section was silently removed
- requirements and decisions close to tasks, files, and tests
- all identifiers are sourced
- every vague instruction has an observable acceptance condition
- architecture and ownership are explicit
- edge cases and cleanup are explicit where applicable
- examples clarify rather than create a second source of truth
- deterministic verification covers the phase's observable contracts
- corrected artifacts are returned in full when requested
- reviewed and updated documents are deterministic for a cost-effective model
- a surgical patch document is produced when existing documents must be updated
- the patch-application prompt requires diff validation, a scoped commit, and an application summary
- the discussion log is excluded unless an explicit decision-history conflict requires it

## NowPilot reminders

- Keep review findings in `.planning/`.
- Preserve flat phase numbering used by the authoritative roadmap.
- Do not treat model configuration as a product requirement unless the authoritative source does so.
- Apply closer implementation review to AI runtime, reliability/evidence, extraction, trust-aware context, memory governance, verified evolution, collaboration, and tool-governance phases.
- Package versions and public APIs must be revalidated when they affect the plan; do not rely on remembered versions.
