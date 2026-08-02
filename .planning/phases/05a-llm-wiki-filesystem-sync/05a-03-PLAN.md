---
phase: 05a-llm-wiki-filesystem-sync
plan: 03
type: execute
wave: 3
depends_on: [05a-01, 05a-02]
files_modified:
  - .planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md
autonomous: true
gap_closure: true
requirements: [NOTE-02, NOTE-03]

must_haves:
  truths:
    - "All 79 pre-existing phase tests across the 5 suites (NoteTagger 18, NoteQA 11, NoteChatConverter 5, NoteMaintenance, NoteFileSync 35) plus the new gap-closure tests pass — no regressions (regression-run task)"
    - "The full phase verification command `npm run verify:phase-5a` (tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations) exits 0"
    - "SC4 holds at the service layer after the replan: the one-way .md backup is durable across simulated sessions (CR-01) and cannot corrupt another note's file (CR-02) — the two blocker gaps are closed and verified by their suites"
    - "WR-02 cleanup is wired (note:deleted/note:renamed events exist and are subscribed) — no dead cleanup code remains"
    - "WR-03 decision recorded: staleness timestamps written at the service layer in NotesDB.save(); Phase 7 needs no additional writer for getStaleNotes() viability"
    - "Phase 7 deferrals recorded in deferred-items.md: SC1/SC2/SC3 UI rendering, real-browser FSA structured-clone verification, UI-SPEC 2 backstop rows + 1 unresolved row — nothing silently dropped"
    - "NoteTagger keeps making a single haiku-tier, temperature-0 structured-output call via LlmService with the enrichment + memoryFacts partitions (D-01 preserved — 05a touches no LLM path; regression gate keeps the 18-test NoteTagger suite green)"
    - "Enrichment and memoryFacts stay on two independent review surfaces — inline accept/reject suggestions on the note editor vs the separate 'New Memory Facts' surface (D-02 preserved; SC1 rendering is the Phase 7 deferral, the service-layer event delivery is unchanged)"
    - "LLM-reported confidence remains display-only metadata; accepted memoryFacts are stored with confidence=0.5 (inferred), never the LLM self-score (D-03 preserved — regression gate keeps the NoteTagger suite green)"
    - "MemoryFacts with LLM confidence < 0.3 stay filtered out, max 3 displayed per save, both thresholds still local NoteTagger constants (D-04 preserved — 05a changes no NoteTagger constant)"
    - "NoteTagger toggle logic preserved (D-06): all toggles off → no LLM call at all; some on + MEM-02 memory extraction off → call runs but generated memoryFacts are discarded — regression gate keeps the NoteTagger suite green"
    - "The shared src/core/ai/LlmService.ts structured-call path for NoteTagger/NoteQA/NoteChatConverter (TierResolver haiku/flash, temperature-0, Zod validation) is unchanged (D-08 preserved — 05a adds no LLM-call changes)"
    - "MEM-02 primary-surface check stays at MemoryEngine.write() time, not at NoteTagger call time (D-19 preserved — 05a touches neither the NoteTagger call path nor MemoryEngine.write)"
    - "NoteChatConverter still drafts pre-filled notes via LlmService (haiku + MemoryEngine.assemble()) then routes them through the full save pipeline with provenance chat-conversion (D-20 preserved — regression gate keeps the 5-test NoteChatConverter suite green)"
  artifacts:
    - .planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md
  key_links:
    - "verify:phase-5a script → tsc + all notes/storage/migration suites (single regression gate)"
    - "deferred-items.md → Phase 7 handoff (real-browser FSA, UI rendering, backstop/unresolved UI rows)"
  prohibitions:
    - statement: "MUST NOT drop or silently defer any Phase 7 human-verification item — each is recorded in deferred-items.md with a Phase 7 owner"
      status: flagged-unverified
      verification: "asserted by 05a-03 task 2 (deferred-items.md rows for SC1/SC2/SC3, real-browser FSA, UI-SPEC backstop/unresolved)"
  assumptions:
    - "Pre-existing Phase 3 AI test failures (StreamAdapter.test.ts ×2, ProviderAdapter.test.ts ×4) are unrelated to 05a — already logged in deferred-items.md entry 1; they are excluded from the 05a regression gate (out of phase scope)"
    - "NOTE-02/NOTE-03 edge coverage unclassified (no SPEC.md) — assumed covered by existing + new gap-closure suites; all human-visual items deferred to Phase 7 per VERIFICATION.md"
---

<objective>
Final gap-closure plan: run the complete regression gate for Phase 05a after the CR-01/CR-02/WR-01/WR-02/WR-03/WR-04/WR-05 fixes land, confirm SC4 holds at the service layer, and record every Phase 7 human-verification deferral in deferred-items.md so nothing is silently dropped.

Purpose: Prove the replan did not regress the 79 pre-existing green tests (5 suites) and that the blocker gaps (CR-01, CR-02) are closed with their new tests green. Record the explicit deferral decisions the verifier asked for (real-browser FSA behavior, Phase 7 UI rendering, UI-SPEC backstop/unresolved rows) so the executor and Phase 7 verifier can see them.
Output: Green regression gate + deferred-items.md updated with the Phase 7 handoff rows.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Gap-closure input contract + deferral sources
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-VERIFICATION.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-REVIEW.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-UI-SPEC.md
@.planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md

# Prior execution summaries (baseline test counts)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-01-SUMMARY.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-02-SUMMARY.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-03-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full regression gate — all phase suites + verify:phase-5a (79 baseline + gap-closure tests green)</name>
  <files>tests/core/notes/NoteTagger.test.ts, tests/core/notes/NoteQA.test.ts, tests/core/notes/NoteChatConverter.test.ts, tests/core/notes/NoteMaintenance.test.ts, tests/core/notes/NoteFileSync.test.ts, tests/core/notes/NotesDB.test.ts</files>
  <read_first>
    - package.json — verify:phase-5a script definition (line 20): `tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations`
    - .planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md — pre-existing entry 1 (Phase 3 AI test failures — out of scope, do not conflate)
  </read_first>
  <action>
    Run the complete regression gate for Phase 05a after all gap-closure edits from 05a-01 and 05a-02 are committed:

    1. `npm run verify:phase-5a` — must exit 0 (tsc --noEmit + all tests/core/notes suites + tests/core/storage/migrations).
    2. Explicitly confirm the 5 baseline suites are green AND count tests: NoteTagger.test.ts (18), NoteQA.test.ts (11), NoteChatConverter.test.ts (5), NoteMaintenance.test.ts, NoteFileSync.test.ts (35) — 79 baseline tests total (VERIFICATION.md spot-check) plus the new gap-closure tests from 05a-01/05a-02.
    3. Run the NoteFileSync + NotesDB suites a second time in isolation (the two most-modified files) to rule out cross-suite ordering flakiness: `npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts --no-coverage`.
    4. If ANY pre-existing test fails: fix the regression immediately (it is caused by the 05a-01/05a-02 edits) — do not commit a red baseline. Do NOT touch the pre-existing Phase 3 AI failures (deferred-items.md entry 1 — unrelated, out of scope).
    5. Record the final test counts in the SUMMARY.
  </action>
  <verify>
    <automated>npm run verify:phase-5a</automated>
  </verify>
  <done>
    - `npm run verify:phase-5a` exits 0.
    - All 79 baseline tests plus every new gap-closure test pass; final counts recorded in 05a-03-SUMMARY.md.
    - No pre-existing 05a test regressed; tsc clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Record Phase 7 deferrals in deferred-items.md (nothing silently dropped)</name>
  <files>.planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md</files>
  <read_first>
    - .planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md — existing table format (entry 1 = Phase 3 AI failures)
    - .planning/phases/05a-llm-wiki-filesystem-sync/05a-VERIFICATION.md — human_verification section (5 items: SC1, SC2, SC3, real-browser FSA, WR-03 staleness)
    - .planning/phases/05a-llm-wiki-filesystem-sync/05a-UI-SPEC.md — ## UI Considerations (53 covered / 2 backstop / 1 unresolved)
  </read_first>
  <action>
    Append rows to the deferred-items.md table (same format as entry 1: | # | Item | Where | Status | Deferred At |), one row per deferral — do NOT delete or edit entry 1:

    1. Phase 7 UI rendering of enrichment suggestions (SC1: accept/reject render for tags/category/summary; note:enriched → component state) — service layer delivers the event; rendering is Phase 7.
    2. Phase 7 clickable citations (SC2: [N] citation links navigate to source notes) — Citation[] delivered; clickable rendering is Phase 7.
    3. Phase 7 pre-filled editor (SC3: chat/page → NoteDraft in editor with user gatekeeper) — NoteDraft delivered; editor UI is Phase 7.
    4. Real-browser File System Access verification (D-09 restart-resume, CR-01 fix validation): showDirectoryPicker + extension restart must be exercised in Chrome Full App — vitest/jsdom cannot run real platform handles; service-layer proxy = duck-typed native-branch tests (05a-01 task 1).
    5. UI-SPEC backstop rows (2): RAG in-flight indicator bubble; Ask-bar in-flight indicator — held-out Phase 7 visual tests (verification: backstop).
    6. UI-SPEC unresolved row (1): Re-analyze progress widget shape — Phase 7 planner assumption (sequential per-note updates via antd message/Progress in Options → Notes).
    7. Staleness hint rendering (LLM-WIKI-08 'Content has changed — [Regenerate tags/summary]') — Phase 7 renders from getStaleNotes(); the service-layer writer (WR-03, 05a-02 task 2) already makes the query viable, so no Phase 7 writer is needed.
    Each row: status `open`, deferred-at `2026-08-02`, and a `where` pointing at the Phase 7 surface.
  </action>
  <verify>
    <automated>[ "$(grep -c 'Phase 7' .planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md)" -ge 6 ]</automated>
  </verify>
  <done>
    - deferred-items.md contains ≥6 new rows referencing Phase 7 (SC1/SC2/SC3, real-browser FSA, backstop ×2, unresolved widget, staleness hint).
    - Entry 1 (Phase 3 AI failures) untouched.
    - The 2 backstop rows carry `verification: backstop` semantics so the Phase 7 verifier treats them as held-out visual tests, never silent passes.
  </done>
</task>

</tasks>

## Artifacts this phase produces

- Regression gate evidence recorded in 05a-03-SUMMARY.md (baseline 79 + gap-closure test counts, verify:phase-5a exit 0).
- `deferred-items.md` — 7 new Phase 7 deferral rows (SC1/SC2/SC3 UI rendering, real-browser FSA, 2 backstop rows, 1 unresolved row, staleness hint).

## Deferred to Phase 7 (recorded — the full list)

- SC1 enrichment suggestion render surface, SC2 clickable citations, SC3 pre-filled editor — Phase 7 UI scope.
- Real-browser FSA structured-clone + restart-resume verification — Chrome Full App human test.
- UI-SPEC 2 backstop rows (RAG in-flight bubble, Ask-bar in-flight indicator) — held-out visual tests.
- UI-SPEC 1 unresolved row (Re-analyze progress widget shape) — Phase 7 planner assumption.
- Staleness hint rendering — Phase 7, powered by the now-viable getStaleNotes().

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| regression gate | a red baseline must never be committed — fixes that break the 79 pre-existing tests fail the gate |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05a-10 | Tampering | regression gate (verify:phase-5a) | medium | mitigate | run the full gate after all fixes; any pre-existing test failure is fixed before commit (task 1); isolation re-run rules out ordering flakiness |
| T-05a-11 | Spoofing | deferred-items.md handoff | low | mitigate | every Phase 7 item recorded with a concrete owner surface; backstop rows keep `verification: backstop` so Phase 7 verifier abstains → human_needed rather than silent pass (task 2) |
| T-05a-SC | Tampering | npm/pip/cargo installs | low | accept | no new package installs in this plan — verification-only + docs |

</threat_model>

<verification>
- `npm run verify:phase-5a` exits 0 (tsc + all notes/storage/migrations suites)
- Isolated re-run of the two most-modified suites (NoteFileSync, NotesDB) green
- deferred-items.md row count check (≥6 new Phase 7 rows)
</verification>

<success_criteria>
- Regression gate green: 79 baseline + all new gap-closure tests pass; tsc clean
- SC4 holds at the service layer (CR-01 + CR-02 suites green)
- All Phase 7 human-verification items recorded in deferred-items.md — nothing silently dropped
- WR-03 decision (implement at service layer) recorded in plan + SUMMARY for the verifier
</success_criteria>

<output>
Create `.planning/phases/05a-llm-wiki-filesystem-sync/05a-03-SUMMARY.md` when done
</output>
