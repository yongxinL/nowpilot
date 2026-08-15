# NowPilot — GSD ⇄ Reviewer Workflow

This folder holds the **review-gate workflow** for building NowPilot with a cost-effective model (e.g. DeepSeek V4 Flash) in **OpenCode + GSD**. GSD generates each phase's artifacts; a stronger reviewer checks them at two gates before the cheap model executes.

> **Why this exists:** cost-effective models are strong at *execution* but weakest at *discussion/planning* (the reasoning-heavy stages). Inserting a review gate exactly there catches drift in the planning artifacts, then hands a corrected, unambiguous plan back to the cheap model for the mechanical work it's genuinely good at.

---

## Contents

| File | Purpose |
|------|---------|
| `README.md` | This file — how the workflow fits together. |
| `REVIEW-PROMPTS.md` | The copy-paste prompts for each review gate (A discussion · B plan · C fast-fix · D cross-artifact). |
| `PRODUCT_SPEC_v0_1.md` | **Authoritative source of truth.** Always attach it with any review request. |
| `DESIGN_SYSTEM.md` | Visual language + `§8.0` mockup reference (visual acceptance at Phase 15). |
| `mockup/` | Annotated UI mockups (pinned visual ground-truth, indexed in DESIGN_SYSTEM §8.0). |
| `Phase-<N>-REVIEW-FINDINGS.md` | Output of each gate (created per phase; keep for traceability). |

---

## The loop

```
GSD discuss (cheap) ──▶ [GATE 1: review context/decisions] ──▶ GSD plan (cheap)
        └──────────────▶ [GATE 2: review plan, pre-execution] ──▶ GSD execute (cheap) ──▶ GSD verify (deterministic)
```

- **Gate 1 — after discuss-phase:** catch decisions that contradict the spec, unresolved ambiguities, and scope creep. → Prompt **A**.
- **Gate 2 — after plan-phase:** catch invented paths/types (R-1), undefined constants, missing tests, dependency-order errors, cheap-model implementability gaps. → Prompt **B**.
- **Execute / verify:** usually no review — mechanical + deterministic (`verify:phase-N`).

Gate 1 + Gate 2 deliver ~90% of the value. Review execution only for unusually complex phases.

---

## How to run a gate (quick)

1. Let GSD finish the stage and commit its artifact (e.g. `01-CONTEXT.md`, `02-PLAN.md`).
2. Open a review turn and **attach BOTH**: the GSD artifact **and** the current `PRODUCT_SPEC_v0_1.md`.
3. Paste the matching prompt from `REVIEW-PROMPTS.md` (replace `<N>` with the phase number).
4. Save the returned findings as `Phase-<N>-REVIEW-FINDINGS.md` in this folder.
5. Apply the fixes (or take the handed-back corrected doc) and feed it to the next GSD stage.
6. Advance the phase only when the artifact is clean **and** (Gate 2) it matches the §18 DONE-when + required tests.

---

## Which prompt to use

| Situation | Prompt |
|-----------|--------|
| Reviewing a discussion / context / decision-log doc | **A** |
| Reviewing a plan (files, tasks, tests, verify script) before execution | **B** |
| You just want the doc fixed inline, fast | **C** |
| Confirm a plan honors the reviewed decisions | **D** |

Full text of each is in `REVIEW-PROMPTS.md`.

---

## Non-negotiables

- **Always attach `PRODUCT_SPEC_v0_1.md`** with the GSD doc — it is the reviewer's ground truth, and the review sandbox resets between turns.
- **The spec mandates no build-agent model (§0.3a).** Any `claude-sonnet-*` appearing at plan/subagent time comes from your OpenCode/GSD config, *not* the spec. Point GSD subagents at your chosen model (e.g. `deepseek-v4-flash`) per stage; restart the session after changing agent configs (they're cached at startup).
- **Phases are flat linear 1–19 (§18).** Reference phases by their linear number.
- **Keep every findings file in `.planning/`** so each gate is auditable and feeds the next stage.

---

## Higher-scrutiny phases

These warrant the closest plan review (reasoning-heavy or safety-critical); give Gate 2 extra attention here:

**3** AI runtime · **4** reliability/evidence · **6** PageContentService (extraction) · **7** trust-aware context · **10** memory governance · **13** verified evolution · **14** collaboration · **18** tool governance.

The rest (1, 2, 5, 8, 9, 11, 12, 15, 16, 17, 19) are typically safe for the standard gate.

---

## Example (Phase 1)

```
1. GSD discuss → commits 01-CONTEXT.md (+ D-01…D-13)
2. Review turn: attach 01-CONTEXT.md + PRODUCT_SPEC_v0_1.md → paste Prompt A (<N>=1)
   → save Phase-1-REVIEW-FINDINGS.md, apply fixes
3. GSD plan → commits 02-PLAN.md
4. Review turn: attach 02-PLAN.md + PRODUCT_SPEC_v0_1.md → paste Prompt B (<N>=1)
   → save Phase-1-PLAN-REVIEW-FINDINGS.md, hand corrected plan back to GSD
5. GSD execute → GSD verify (verify:phase-1) → phase done when green
```
