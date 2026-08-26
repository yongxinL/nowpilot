# Phase 3 Patch Application Prompt

Apply `Phase-3-PLAN-PATCH.md` to the Phase 3 planning artifacts.

## Inputs

- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/Phase-3-PLAN-REVIEW-FINDINGS.md`
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/Phase-3-PLAN-PATCH.md`
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-01-PLAN.md` through `03-07-PLAN.md`
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-CONTEXT.md`
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-PATTERNS.md`
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-RESEARCH.md`
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-VALIDATION.md`
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/COVERAGE.md`
- authoritative `.planning/PRODUCT_SPEC_v0_1.md`

## Rules

1. Apply only the surgical edits in the patch.
2. Preserve all unchanged content verbatim, including frontmatter, task breakdowns, must_haves, artifacts, key_links, threat models, tests, success criteria, and human checkpoints.
3. Do not invent identifiers, error codes, file paths, task IDs, schema fields, fixture names, provider fields, or storage operations.
4. For every repository-discovery instruction, inspect the repository and record the sourced value. If evidence is absent, retain the discovery instruction and report it as unresolved. Do not guess.
5. Do not modify `ChatHistoryDB.ts`; it is read-only for contract verification.
6. Do not implement application code. This operation patches planning documents only.
7. Do not commit until all validation checks pass.

## Procedure

1. Create a clean working branch or confirm the worktree contains only intended planning changes.
2. Apply each patch section in filename order.
3. Inspect the diff file by file.
4. Verify that no unchanged task section was shortened or removed.
5. Rebuild `03-VALIDATION.md` using exact task IDs read from the seven plan files.
6. Run the post-application searches from the patch.
7. Run Markdown/link checks used by the repository, if present.
8. Run `pnpm run verify:phase-3` only if dependencies are installed; otherwise record the exact prerequisite without changing application code.
9. If any check fails, fix only the planning-document cause and rerun once.
10. Commit with:

```text
planning(phase-3): harden plans for deterministic execution
```

## Required final response

```md
# Patch Application Result

## Files changed
- `<file>`: `<exact surgical edits applied>`

## Repository-sourced discoveries
- `<contract>`: `<source path and exact discovered identifier/signature>`

## Validation
- `<command>`: PASS / FAIL / NOT RUN
- Expected-result checks: `<summary>`

## Preservation
- Retained sections: `<list>`
- Moved content: `<list or none>`
- Removed content: `<only justified removals>`

## Unresolved items
- `<item or none>`

## Commit
- `<hash and subject, or reason not committed>`
```
