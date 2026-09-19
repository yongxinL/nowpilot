# NowPilot Product Specification Review

## Verdict

The existing product specification is a strong architecture reference, but it is not suitable as the direct day-to-day execution input for Superpowers, OpenCode, or a cost-effective coding model.

Use it as a source document after correcting contradictions. Drive implementation from the smaller documents in this package.

## Strengths

- Explicit non-negotiable rules and prohibited behaviours.
- Phase-level file lists, tests, acceptance gates, and verification commands.
- Strong security, privacy, trust-boundary, and evidence requirements.
- Canonical registries for types, strings, prompts, errors, and runtime messages.
- Vendor-neutral model tiers and clear rules for stubbing advanced work.

## Blocking issues

1. **Contradictory side-panel scope**
   - Sections 6.2 and 17.1 define the Side Panel as Chat-only.
   - Sections 6.5, 8.1, 8.3, 9.1, and Phase 17 also place Agent, Write, and TeamGQM in the Side Panel.
   - Locked decision for this package: **Side Panel is Chat-only**. Agent, Notes, Write, Tools, TeamGQM, and Options belong in the Standalone view.

2. **Contradictory Standalone paths**
   - The specification alternates between `src/entrypoints/standalone/**` and `src/entrypoints/app/**`, and between `src/components/standalone/**` and `src/components/app/**`.
   - Locked decision: use `standalone` everywhere.

3. **Conflicting extraction order**
   - One section describes ServiceNow API first; a worked example states Defuddle, Readability, APC-lite, then ServiceNow.
   - Locked decision: ServiceNow API first when its registered strategy applies; otherwise Defuddle with internal Readability fallback for default mode, or APC-lite for actionable mode.

4. **Invalid or inconsistent examples**
   - Several snippets contain malformed separators, missing JSX names, non-TypeScript comment glyphs, or types imported from the wrong canonical home.
   - Worked examples must be treated as illustrative until compilation tests pass.

5. **Error registry drift**
   - Worked examples use errors such as `WRITE_JOURNAL_FAILED`, `EXTRACTION_STRATEGY_FAILED`, and `EXTRACTION_FAILED`, but these are absent from the declared closed error-code registry.
   - Add every used code to one registry before implementation, or replace it with an existing canonical code.

6. **Roadmap is too large for direct plan generation**
   - Nineteen phases plus long appendices encourage context loss and cross-phase edits.
   - Each phase must be converted into a separately approved design and a task plan containing 2–5 minute TDD tasks.

7. **Premature scope for v0.1**
   - Evaluation, continual evolution, multimodal input, and multi-role collaboration substantially increase risk before the core extension is usable.
   - Recommendation: make these post-MVP tracks unless they are independently approved after the knowledge and workspace flows are stable.

8. **Deployment is underspecified**
   - Build, packaging, environment validation, Chrome loading, smoke tests, release artefacts, rollback, and release evidence need a dedicated runbook.

## Recommended document hierarchy

- `PRODUCT_SPEC.md`: product truth, scope, invariants, acceptance outcomes.
- `ARCHITECTURE.md`: context boundaries, data ownership, canonical paths, ADRs.
- `ROADMAP.md`: phase order and phase gates only.
- `AGENTS.md`: deterministic instructions for OpenCode and low-cost agents.
- `EXECUTION_PROTOCOL.md`: Superpowers workflow, TDD, reviews, commits, and evidence.
- `DEPLOYMENT.md`: local build, unpacked deployment, release packaging, rollback.
- `.planning/phases/<NN-name>/DESIGN.md`: approved phase design.
- `.planning/phases/<NN-name>/PLAN.md`: executable task plan generated after design approval.
- `.planning/evidence/phase-<NN>/`: verification output and manual evidence.

## Go or no-go

**No-go for direct implementation from the original file.**

**Go for phased execution after:**

- applying the locked decisions above;
- creating a clean repository baseline;
- installing Superpowers for OpenCode;
- approving Phase 1 design;
- generating a Phase 1 task plan;
- implementing only Phase 1 in an isolated worktree.
