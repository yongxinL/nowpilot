# Phase 7: Trust-Aware Context and Receipts - Research

**Researched:** 2026-08-30
**Domain:** Trust-aware context pipeline, prompt-injection containment (ADR-SEC-01 layer 5), context receipts, stable-prefix snapshots
**Confidence:** HIGH (all findings verified against the spec, the shipped Phase-5/6 code, and the approved 07-UI-SPEC; no external-library research needed — this phase installs zero new packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Trust architecture — item-level pipeline + O.3 policy
- **D-93 (Trust operates on a `ContextItem[]` intermediate inside `assemble`, not on packed sections):** `ContextItem` (spec 4878-4891) is the item-level trust model; `TrustLevel = 'system'|'user'|'tool'|'retrieved'|'untrusted'` and `instructionAuthority` are attached per item BEFORE sections are packed. `ContextOptimizer.assemble` (Phase 5) builds its sourced sections through this item pipeline: sources → `ContextItem[]` (each tagged with trust/authority/relevance/freshness/sensitivity/sourceId) → `applyTrustPolicy` (Appendix O.3 verbatim: wrap untrusted + force `instructionAuthority:false`) → pack into the A8 `PromptSection[]`. The wrapped text is what lands in the prompt; the manifest/context-item metadata is what the receipt records. `AUTHORITY_BY_TRUST` map comes verbatim from O.3 (spec 6371). — **Reversibility:** `reversible` — rationale: internal pipeline ordering inside assemble; re-splitting later is a local change.
- **D-94 (Trust-level mapping per source, locked):** `[SYSTEM]`/`[TOOL SCHEMAS]` → `trust:'system'`, `instructionAuthority:true`; `[USER PREFERENCES]`/`[USER INPUT]` → `trust:'user'`, `instructionAuthority:true`; `[MEMORY]` → `trust:'retrieved'` (memory is stored page/note-derived content), `instructionAuthority:false`; `[CONTEXT]` (pageContext, Phase-6 output) → `trust:'untrusted'` when it arrives raw from extraction, `instructionAuthority:false`. This is the CTX-01 metadata contract and the CTX-02 enforcement precondition. — **Reversibility:** `reversible` — rationale: constant table; per-source tuning later is a data change.

#### Receipt derivation + original tokens
- **D-95 (Receipt is an additive derived view over the manifest — do NOT edit the Phase-5 manifest schema):** CTX-03's receipt fields (`originalTokens`, `cacheEligible`, `omitReason`) are NOT in the §2.6 manifest (spec 530-544). Decision: keep `ContextProvenanceManifest` verbatim (D-77 lock) and derive a **`ContextReceiptEntry[]`** (spec 4892-4900) from the manifest + retained original per-section token counts. `cacheEligible` = `section.stable` (the §1.3/A8 stable flag that drives PromptCacheAdapter hashing, spec 5747+); `included` = !record.truncated-with-omission (by-design system/task omission records → `included:false` + `omitReason`); `compression` maps from manifest `compressionApplied`; `originalTokens` = pre-degradation count, `finalTokens` = record.tokens. Do NOT add fields to the manifest schema or A8 PromptSection (D-72). — **Reversibility:** `reversible` — rationale: additive derived module; the manifest contract stays untouched.
- **D-96 (assemble retains original per-section token counts for the receipt):** Phase-5 `assemble`/`applyDegradationLadder` must retain the pre-degradation token count per section so the receipt can report original→final. This is an additive bookkeeping change inside assemble (capture counts at `buildSourcedSections`, keep alongside the manifest record); no public-signature change to `assemble(ContextOptimizerInput) → AssembleResult`. — **Reversibility:** `reversible` — rationale: internal accounting; caller contract unchanged.
- **D-97 (Rungs 1-2 of the §2.4 ladder activate for debug/notes when the caller supplies them):** Phase-5's degradation ladder rungs 1 (`drop debug-only context`) and 2 (`drop secondary notes and optional metadata`) are documented RESERVED no-ops awaiting Phase-7 callers. Phase 7 wires them: the context item pipeline exposes an optional debug-sections input and optional secondary-notes input; when present they're dropped by rungs 1-2 with a manifest `truncated` record. When absent the rungs stay no-ops (spec 495-496 preserved). — **Reversibility:** `reversible` — rationale: additive optional inputs; absent inputs keep verbatim behavior.

#### Injection defense scope + policy guard
- **D-98 (Phase 7 ships layers 5 + 6-signal + policy-redefinition guard; layers 1/2/4 owned elsewhere, layer 3 deferred):** ADR-SEC-01 maps v0.1 to six layers: L1 input sanitization = Phase 6 extraction hygiene (DONE), L2 action screening = Phase 4 Executor allowlist (DONE), L3 dual-LLM quarantine = **deferred to v0.2** (never implement), L4 output screening = Phase 18/12, L5 containment/degraded privileges = **this phase** (trust metadata + authority stripping + `<untrusted_data>` wrapping + the policy guard), L6 user disclosure = **signal only here**, UI in Phase 15. Phase 7 must NOT re-implement L1/L2/L4 mechanisms — only the L5 containment seam they feed. — **Reversibility:** `reversible` — rationale: layer assignment is an ADR mapping; shifts later are annotation edits.
- **D-99 (CTX-02 enforced structurally — authority map + wrapping + typed guard; NO content heuristics):** `applyTrustPolicy` (O.3) is the universal enforcement: any item whose `trust` maps to `false` authority is wrapped and force-stripped of `instructionAuthority`. The `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` code (spec 5093, already in the §21.6 closed set) is raised **structurally** when a retrieved/untrusted item is observed attempting to carry instruction authority past the policy boundary (e.g., a fixture that fabricates `instructionAuthority:true` on retrieved data, or a policy-redefinition marker on the item). The `tests/security/prompt-injection/**` fixtures simulate these attempts (malicious page HTML, poisoned note, hostile tool output) and assert the guard raises the typed code / the wrapped output never carries authority. No regex/pattern matching against content — content heuristics are fragile (research P7: "labels and quarantined chains were subverted"; the defense is structural layering, not spotting). — **Reversibility:** `reversible` — rationale: enforcement seam + fixture suite; hardening later is additive.

#### Stable-prefix snapshots (CTX-04)
- **D-100 (Golden snapshot fixtures of the assembled stable prefix + verify:phase-7 as the release block):** CTX-04 "stable-prefix snapshot tests are mandatory; a system-prompt diff blocks release". This repo has no CI (no `.github/`) — the release-block gate is `verify:phase-7` (spec 3611). Decision: commit golden snapshot files of the **packed stable prefix** (the §1.3 stable sections: SYSTEM + TOOL SCHEMAS + USER PREFERENCES byte-identical output) for canonical fixture inputs; `tests/core/context/trust/*.snapshot.*` asserts the assembled output is byte-identical to the golden; any system-prompt change fails the test → blocks the gate. Cross-check with `PromptCacheAdapter.hashStableSections` (stable sections hash-stable, spec 5747+). — **Reversibility:** `reversible` — rationale: golden fixtures; regenerating on intentional prompt change is a fixture update.

#### Progressive skill disclosure (CTX-05, P1)
- **D-101 (Declare-now disclosure mechanism; real skill manifests Phase 15/17):** Skills (`ISkill`, spec 1826-1856) don't exist until Phase 15/17. Phase 7 ships the **disclosure contract + mechanism**: a registry/selector that, given candidate skills with trigger/description metadata, injects only the **trigger + one-line description** for skills not yet activated, and the **full instructions** only for the activated skill — so irrelevant full instructions consume zero prompt tokens (SC#4). Proven by fixtures (N skills present, M active → prompt carries M full bodies + N-M one-liners; token count assertion). The concrete `ISkill` implementations, slash commands, and RICH catalog land Phase 15. — **Reversibility:** `reversible` — rationale: additive declaration + fixture proof; Phase 15 consumes the seam.

#### Context-quality diagnostics (CTX-06, P1)
- **D-102 (Derived aggregate metrics surface — no raw text persisted):** CTX-06 requires diagnostics of context quality without persisting raw sensitive text. Phase 7 exposes a derived metrics surface over the receipt/manifest (aggregates only: section count, trust mix counts, truncation/compression counts, token utilization ratio original→final, minimalMode flag) — no section bodies, no sourceId content beyond the existing manifest sourceIds. This mirrors Phase-5's D-77 derived trace surface; Phase 11 lifts it into `PromptTrace`/DiagnosticsSection. — **Reversibility:** `reversible` — rationale: derived read-only metrics; Phase 11 persistence is additive.

#### Verification gate
- **D-103 (Re-point `verify:phase-7` to `tests/core/context/trust tests/security/prompt-injection` — D-92 analog):** package.json `verify:phase-7` currently targets `tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes` (Phase 15/16). Re-point to the §18 required dirs: `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection` (spec 3611 verbatim). — **Reversibility:** `reversible` — rationale: package.json script edit (D-68/D-78/D-92 precedent).

### the agent's Discretion
- Exact file layout under `src/core/context/trust/` (one file per concern vs a barrel `index.ts` — mirror the `src/core/ai/` convention) and where `TrustPolicy.ts` lands (O.3 names `src/core/context/TrustPolicy.ts`; a `trust/` subdir may mirror `tests/core/context/trust/`).
- Whether `ContextItem`/`ContextReceiptEntry`/`TrustLevel` go in `src/types/harness.ts` (the existing Phase-4 canonical home per spec 4838-4839 "Trust context" row) or `src/core/context/trust/types.ts` — spec's canonical-home rule points to `@/types/harness`; the researcher should confirm the exact import path used by O.3 (spec 6369 imports `@/types/harness`).
- Exact shape of the structural "policy-redefinition attempt" signal the guard keys on (an explicit marker on the item vs fabricating `instructionAuthority:true` on retrieved data — both fixture-testable; must not become a content regex).
- Whether the disclosure mechanism is a standalone module or a `ContextOptimizer` input seam (assembled as part of `[TOOL SCHEMAS]`/a dedicated section) — either satisfies CTX-05's zero-token proof.
- Whether the L6 disclosure signal is a boolean flag on the receipt (`untrustedDataPresent: true`) vs a richer per-item marker — the Phase-15 UI consumes whichever ships.

### Deferred Ideas (OUT OF SCOPE)
- **Live `OptimizedContext` adoption in AgentOrchestrator/useChatStreaming** — Phase 7 keeps assemble proven-by-tests (D-69 discipline); adoption waits until `memoryHints` exists (Phase 8) and the pipeline is wired (D-93 note).
- **`PromptTrace`/AITransactionLog persistence + DiagnosticsSection/TransactionTraceView UI** — Phase 11; Phase 7 ships only the derived metrics/receipt surface (D-95/D-102).
- **Dual-LLM quarantine (injection layer 3)** — v0.2 (ADR-SEC-01); never implement in v0.1 (D-98).
- **Output screening before destructive actions (layer 4)** — Phase 18 tool governance / Phase 12; Phase 7 ships the containment seam they feed (D-98).
- **User-disclosure UI (layer 6)** — Phase 15 (RICH); Phase 7 ships only the disclosure signal (D-98).
- **Real skill manifests + slash commands + RICH catalog (CTX-05 consumers)** — Phase 15; Phase 7 ships the disclosure mechanism + zero-token proof (D-101).
- **Actual memory/note sources for MEMORY items** — Phase 8/9; Phase 7's MEMORY trust mapping applies to whatever retrieval ships then (D-94).
- **Red-team adversarial corpus (HashJack fragments, encoded instructions, Unicode confusables)** — Phase 19; the Phase-7 fixtures are the structural guarantee, not the full red-team suite (D-99).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim §28.3) | Research Support |
|----|------------------------------|------------------|
| CTX-01 | Context sources carry relevance, freshness, trust, sensitivity, and instruction-authority metadata. | D-93 item pipeline: `ContextItem` (C.1 verbatim, all five metadata fields) built per source in `buildSourcedSections`; D-94 per-source trust map; metadata proven by tests, not packed into A8 (D-72). |
| CTX-02 | Page, note, memory, upload, and tool output are untrusted data and cannot redefine system/tool/permission policy. | D-99 structural enforcement: O.3 `applyTrustPolicy` (verbatim, wrap + force `instructionAuthority:false`) + `AUTHORITY_BY_TRUST` closed map + `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` guard (spec 5093); adversarial fixtures in `tests/security/prompt-injection/`. |
| CTX-03 | `ContextProvenanceManifest` becomes a context receipt with inclusion, omission, original/final tokens, compression, and cache eligibility. | D-95/D-96: derived `ContextReceiptEntry[]` (C.1 verbatim) from manifest + retained original token counts + A8 `stable` flag; derivation rules locked in 07-UI-SPEC Contract C. |
| CTX-04 | Stable prefix snapshot tests are mandatory. | D-100: committed golden files under `tests/core/context/trust/*.snapshot.*`; byte-identical assertion on packed stable prefix; `hashStableSections` FNV-1a cross-check; gate = `verify:phase-7` (spec 3611). |
| CTX-05 | Skills use progressive disclosure; irrelevant full instructions consume zero prompt tokens. | D-101: disclosure mechanism shaped against `ISkill` (spec 1829-1856) — trigger+one-liner for inactive, full instructions only for active; fixture token-count proof. |
| CTX-06 | Diagnostics track context quality without persisting raw sensitive text. | D-102: derived aggregate metrics only (no section bodies); 07-UI-SPEC Contract B locks the surface; mirrors D-77 trace surface. |

**DONE-when (spec 2646-2654 + ROADMAP SC):** malicious fixtures cannot alter policy; stable-prefix snapshot diff blocks release; Prompt Inspector reconstructs packing decisions from a transaction id (receipt derivable from what a transaction resolves to); irrelevant skill instructions consume zero prompt tokens. Gate: `pnpm run verify:phase-7`.
</phase_requirements>

## Summary

Phase 7 is a **pure-codebase phase: it adds a trust layer over the shipped Phase-5 context spine and Phase-6 extraction output, and it installs zero new packages.** Every required mechanism has an existing substrate to hook into: `ContextOptimizer.assemble` (the pure item→section pipeline), the verbatim `ContextProvenanceManifest`, `ContextPack`'s §1.3 canonical order, `PromptCacheAdapter.hashStableSections` (FNV-1a), and `@/types/harness` (the C.1 canonical type home). The phase's spine is D-93's **item pipeline inside `assemble`**: sources → trust-tagged `ContextItem[]` → O.3 `applyTrustPolicy` (verbatim, spec 6367-6389) → A8 `PromptSection[]`. The receipt (CTX-03), the L6 disclosure signal, and the CTX-06 metrics are **derived views**, never parallel copies — the manifest schema, A8 `PromptSection`, and §1.3 canonical order stay untouched (D-72/D-77/D-95).

All discretion points in CONTEXT.md were resolved during research against authoritative sources: the C.1 canonical-home table (spec 4833-4844) **mandates** the trust types (`ContextItem`, `ContextReceiptEntry`, `TrustLevel`) live in `@/types/harness` (row "Trust context", spec 4838), and O.3 (spec 6369) imports from `@/types/harness` — so the "harness.ts vs trust/types.ts" question is settled. The approved 07-UI-SPEC additionally locks the L6 signal as the boolean `untrustedDataPresent` on the derived receipt surface (Contract A), the metrics aggregates (Contract B), the receipt derivation rules (Contract C), the disclosure mechanism contract (Contract D), and names the scope `src/core/context/trust/**`. The `verify:phase-7` mis-pointing (D-103) was confirmed in package.json and must be re-pointed exactly as spec 3611 states.

**Primary recommendation:** Build the trust layer as `src/core/context/trust/` modules (TrustPolicy with the O.3-verbatim policy + a structural guard, ContextReceipt derivation, SkillDisclosure, ContextQualityMetrics, and the item-pipeline builder), add the trust types verbatim to `src/types/harness.ts`, modify `assemble` only additively (item pipeline + original-token retention + rungs 1-2 + derived receipt on the output), and re-point `verify:phase-7` per D-103. The `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` guard must key on the **existing** `ContextItem` fields (`trust` + `instructionAuthority` combination) — no new marker field (ContextItem is spec-verbatim), no content regexes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trust/authority metadata attachment (CTX-01) | Core (`src/core/context/`) | `@/types/harness` (type home) | Item pipeline runs inside the pure `assemble()`; types are C.1 canonical-home mandates. Never the UI. |
| Instruction-authority containment (CTX-02) | Core (`src/core/context/trust/TrustPolicy.ts`) | — | O.3 policy + guard are pure functions; L5 seam feeds Phase-4/18 consumers. Content heuristics forbidden. |
| Receipt derivation (CTX-03) | Core (`src/core/context/trust/ContextReceipt.ts`) | Phase 11 `PromptTrace` | Derived from manifest + original tokens; Phase 11 lifts it additively; never persisted in Phase 7. |
| Stable-prefix snapshots (CTX-04) | Tests (`tests/core/context/trust/`) | Core (`ContextPack`/`PromptCacheAdapter`) | Golden fixtures assert byte-identical packed output; gate blocks release (no CI — gate is `verify:phase-7`). |
| Progressive skill disclosure (CTX-05) | Core (`src/core/context/trust/SkillDisclosure.ts`) | Phase 15 RICH catalog | Standalone pure renderer + fixture proof; not wired into the live prompt (D-69 discipline; would disturb stable sections). |
| Context-quality metrics (CTX-06) | Core (`src/core/context/trust/ContextQualityMetrics.ts`) | Phase 11 DiagnosticsSection | Derived aggregates only — no raw text (D-102). |
| L6 disclosure signal | Core (derived `untrustedDataPresent`) | Phase 15 disclosure UI | Signal computed at receipt derivation; UI in Phase 15 (07-UI-SPEC Contract A). |
| Injection defense layers 1/2/4 | NOT Phase 7 | Phase 6 (L1), Phase 4 (L2), Phase 18/12 (L4) | ADR-SEC-01 assignment; Phase 7 only ships L5 + L6-signal. Do NOT re-implement. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.8.2 (installed 5.8.3) `[VERIFIED: package.json + pnpm list]` | Strict-mode implementation language | Zero NP-STRICT ceiling (STATE.md decision 17); `tsc --noEmit` is the type gate. |
| zod | ^4.4.3 (installed 4.4.3) `[VERIFIED: package.json + pnpm list]` | Schema validation for cross-boundary shapes | CLAUDE.md convention: every cross-boundary shape is zod-validated; existing manifest schema is the pattern to follow. |
| vitest | ^3.0.0 (installed 3.2.7) `[VERIFIED: package.json + pnpm list]` | Test framework (jsdom, globals, setup.ts) | Existing Phase-5/6 suites; snapshot support via `toMatchFileSnapshot`/`toMatchSnapshot` for CTX-04. |

**Installation:** NONE — this phase adds zero new dependencies. All Phase-7 code is pure TypeScript over the existing stack. (If the planner is tempted to add a snapshot library or a testing library: don't — vitest's built-in snapshot + `toMatchFileSnapshot` covers CTX-04.)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Structural authority map + wrap (O.3) | Content-heuristic injection detection (regex/LLM judge) | Heuristics are fragile and were subverted in real incidents (PITFALLS P7); structural layering is the locked decision (D-99). |
| Derived receipt module | Adding receipt fields to the manifest schema / A8 `PromptSection` | Forbidden (D-72/D-77/D-95); would break the verbatim contracts and the Phase-11 additive lift. |
| Vitest file snapshots (`toMatchFileSnapshot`) | A dedicated snapshot library (e.g., jest-image-snapshot style) | Unnecessary dependency; vitest snapshots are committed, diffable, and gate on byte equality. |

## Package Legitimacy Audit

> **Required whenever this phase installs external packages.** This phase installs **zero external packages** — all work is new TypeScript modules over the existing dependency set. The audit is therefore vacuous; the only package.json edit is the `verify:phase-7` **script string** (D-103), not a dependency.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none — no packages added this phase)* | — | — | — | — | — | Approved (no install) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none — no installs occur; the executor must not add any (a snapshot or test-util package would be scope creep and would need a checkpoint).

## Architecture Patterns

### System Architecture Diagram

```
 ContextOptimizerInput (Phase-5 §2.3 verbatim + D-97 optional debugSections/secondaryNotes)
   │
   ▼
┌─ assemble()  (src/core/context/ContextOptimizer.ts — MODIFIED additively, D-93/D-96/D-97) ─────┐
│                                                                                              │
│  1. buildSourcedSections → WorkingSection[]  (section + §2.6 record, kept in lockstep)        │
│     └─ NEW item pipeline (D-93): per source → ContextItem[] tagged per D-94                    │
│        (trust/instructionAuthority/relevance/freshness/sensitivity/sourceId)                   │
│     └─ NEW: originalTokens captured per section (D-96)                                         │
│  2. applyTrustPolicy (O.3 VERBATIM, src/core/context/trust/TrustPolicy.ts)                    │
│     └─ any item claiming authority it must not have → wrapped in <untrusted_data source=…>     │
│        + instructionAuthority forced false                                                     │
│     └─ guard: trust in (retrieved|untrusted) ∧ instructionAuthority === true                   │
│        → CONTEXT_INSTRUCTION_INJECTION_BLOCKED (structural, D-99)                              │
│  3. tally → if over budget: applyDegradationLadder                                            │
│     └─ Rungs 1-2 ACTIVATED (D-97): drop debug/notes items, record manifest truncated           │
│     └─ Rungs 3-7 unchanged (Phase-5 behaviour preserved)                                       │
│  4. buildManifest (UNTOUCHED, verbatim) + by-design system/task omission records               │
│  5. NEW: deriveContextReceipt(manifest, originalTokens, sections) → ContextReceiptEntry[]      │
│     + untrustedDataPresent (CTX-03, D-95; 07-UI-SPEC Contract A/C)                             │
│  6. NEW: deriveContextQualityMetrics(...) → aggregates only (CTX-06, D-102)                    │
│                                                                                              │
│  OUTPUT: OptimizedContext { …Phase-5 fields, + additive receipt/metrics surface (D-77 pattern)}│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
   │
   ├──► ContextPack.pack(sections) — §1.3 canonical order (UNTOUCHED, throws on non-canonical kinds)
   ├──► PromptCacheAdapter.hashStableSections — FNV-1a cross-check for CTX-04 snapshots
   └──► tests/core/context/trust/*.snapshot.* — golden stable-prefix files (D-100)

  tests/security/prompt-injection/** — adversarial fixtures (malicious page / poisoned note /
  hostile tool output) → assert CONTEXT_INSTRUCTION_INJECTION_BLOCKED raised and wrapped output
  never carries authority (D-99)
```

### Recommended Project Structure

```
src/
├── core/context/
│   ├── ContextOptimizer.ts            # MODIFIED additively (item pipeline, original tokens, rungs 1-2, receipt attach)
│   ├── ContextProvenanceManifest.ts   # UNTOUCHED (verbatim, D-77/D-95)
│   ├── ContextPack.ts                 # UNTOUCHED (§1.3, D-76)
│   └── trust/                         # NEW — mirrors tests/core/context/trust/ (07-UI-SPEC scope; src/core/ai flat convention)
│       ├── TrustPolicy.ts             # O.3 verbatim: AUTHORITY_BY_TRUST, applyTrustPolicy + structural guard (D-99)
│       ├── contextItems.ts            # item pipeline: sources → ContextItem[] with D-94 trust map (CTX-01)
│       ├── ContextReceipt.ts          # deriveContextReceipt → ContextReceiptEntry[] + untrustedDataPresent (D-95, CTX-03)
│       ├── ContextQualityMetrics.ts   # deriveContextQualityMetrics — aggregates only (D-102, CTX-06)
│       └── SkillDisclosure.ts         # renderSkillDisclosure — trigger+one-liner vs full body (D-101, CTX-05)
├── types/harness.ts                   # MODIFIED additively: + TrustLevel, ContextItem, ContextReceiptEntry (spec 4838 — MANDATORY home)
tests/
├── core/context/trust/                # NEW (§18 required): TrustPolicy, ContextReceipt, SkillDisclosure, metrics, *.snapshot.*
└── security/prompt-injection/         # NEW (§18 required): adversarial fixtures (note: tests/security/, NOT tests/core/security/)
```

File-layout note: the 07-UI-SPEC (approved) names the scope as `src/core/context/trust/**` — the `trust/` subdir is confirmed. One file per concern (flat, `src/core/ai/` convention); a barrel `index.ts` is optional but not required.

### Pattern 1: The item pipeline inside `assemble` (D-93/D-96)

**What:** `buildSourcedSections` gains a parallel item-construction step: for each emitted section, build a `ContextItem` with the D-94 trust mapping; apply the O.3 policy; the (possibly wrapped) item text becomes the section text. Original token counts captured at construction, kept on `WorkingSection` alongside the record.

**When to use:** The exact insertion point — do not restructure `assemble`'s five-phase walk; extend `WorkingSection` additively:

```typescript
// src/core/context/ContextOptimizer.ts — additive change (D-96)
interface WorkingSection {           // EXISTING: lines 115-118 [VERIFIED]
  section: PromptSection;
  record: ManifestSectionRecord;
  // NEW (D-96): pre-degradation token count, captured in buildSourcedSections
  originalTokens: number;
}
```

**Key rules:**
- `sourceIdFor(kind, input)` (ContextOptimizer.ts:349-360) is the existing source-identity function — the item pipeline reuses it for `ContextItem.sourceId` (CONTEXT → `pageContext.url`, MEMORY → hint ids joined `,`, TOOL SCHEMAS → tool names joined `,`).
- A8 `PromptSection` (ai/types.ts:95-100: `kind`/`text`/`stable`/`tokens` as a zod object) is NOT extended — trust metadata lives on items, not sections.
- Token counts must reflect **post-wrap text** when `applyTrustPolicy` wraps an item (the wrap adds `<untrusted_data …>` overhead) — recount after wrapping so `finalTokens` stays accurate.

### Pattern 2: Derived receipt — no schema edits (D-95)

**What:** A pure function `deriveContextReceipt(manifest, originalTokensBySourceId, sections)` maps the verbatim manifest + internal bookkeeping into the C.1-verbatim `ContextReceiptEntry[]`, plus the L6 `untrustedDataPresent` flag. Rules (locked by 07-UI-SPEC Contract C):

| Receipt field | Derivation source |
|---|---|
| `sourceId` | manifest record `sourceId` |
| `included` | `false` for the by-design `system`/`task` omission records (sourceId `'system'`/`'task'`, built by `buildManifest`, ContextProvenanceManifest.ts:83-86) and for dropped debug/notes (D-97); `true` for shipped sections (even degraded ones — truncation ≠ omission) |
| `originalTokens` | retained pre-degradation count (D-96) |
| `finalTokens` | manifest record `tokens` |
| `compression` | manifest record `compressionApplied` (the union `'summarise' | 'structural' | 'topk'` matches C.1 exactly) |
| `cacheEligible` | `sections.find(s => …).stable` (the A8 stable flag; manifest does NOT carry it — pass sections in) |
| `omitReason` | omitted entries only: `'no-input-source'` (system/task) / `'debug-only'` / `'secondary-notes'` (D-97) |

**When to use:** Attach the receipt to the `OptimizedContext` output as an additive field (the exact D-77 precedent — `contextTier`/`truncated`/`truncatedSources` were added additively at ContextOptimizer.ts:67-71). Phase-11 Prompt Inspector reconstructs packing decisions from a transaction id; the receipt must be reachable from what a transaction resolves to, so materializing it on the output is the pragmatic seam. Existing callers keep compiling (additive fields).

### Pattern 3: Structural policy guard — no content heuristics (D-99)

**What:** The guard keys on the **existing C.1 fields** — there is no room for a marker field (ContextItem is spec-verbatim, spec 4880-4891, and a marker would deviate). The structural signal is the field combination `trust: 'retrieved' | 'untrusted'` ∧ `instructionAuthority: true`. Two functions share the same detection:

- `applyTrustPolicy(items)` — O.3 **verbatim** (non-throwing): wrap + force `instructionAuthority:false`. Runs inside `assemble`.
- `raiseIfPolicyRedefinitionAttempt(items)` — throwing variant raising `Object.assign(new Error('blocked'), { code: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED' })` (O.3 comment, spec 6388). Exported for the `tests/security/prompt-injection/**` fixtures and future consumers (Phase 12/18). **`assemble` never throws** (AssembleResult union contract, ContextOptimizer.ts:100-112) — so assemble calls the non-throwing policy only; the throwing guard is the test/consumer seam.

**When to use:** The fixtures simulate the attempts (malicious page HTML, poisoned note, hostile tool output) by **fabricating** `instructionAuthority:true` on retrieved/untrusted items; assert (1) the guard raises the typed code and (2) the wrapped output never carries authority.

### Pattern 4: Stable-prefix golden snapshots (D-100/CTX-04)

**What:** Commit golden files of the byte-identical packed output for canonical fixture inputs; `tests/core/context/trust/*.snapshot.*` asserts `pack(context.sections).prompt` (or the stable-flagged subset) equals the golden. Cross-check `hashStableSections(sections)` against a golden hash. Any system-prompt change (tool-schema rendering, `prefsCompact`, separators, ordering) diffs the golden → `verify:phase-7` fails → release blocked.

**Important reconciliation with the shipped code:** the current `buildSourcedSections` emits NO `SYSTEM` section (by-design omission, ContextProvenanceManifest.ts:83-86) and marks `USER PREFERENCES` `stable:false` (ContextOptimizer.ts:287-292). D-100 names "SYSTEM + TOOL SCHEMAS + USER PREFERENCES" as the stable prefix, but in the shipped Phase-5 code only TOOL SCHEMAS is `stable:true`. **Recommendation:** snapshot the *deterministic packed output for canonical fixtures* — `pack(context.sections).prompt` includes USER PREFERENCES text byte-identically (prefsCompact is deterministic for a fixed input) — and separately assert `hashStableSections` equals a golden FNV-1a hash. Do NOT flip `USER PREFERENCES` to `stable:true` this phase (that changes cache semantics and PromptCacheManager behavior). When SYSTEM arrives (Phase 15 persona), the golden extends. Flag for the discuss/planner: the D-100 list vs the shipped stable flag.

### Anti-Patterns to Avoid
- **Adding receipt fields to the manifest schema or A8 `PromptSection`:** forbidden (D-72/D-77/D-95) — the receipt is derived; an executor who "just adds a field" breaks the verbatim contracts and Phase 11's additive lift.
- **Content regexes / "looks like an instruction" heuristics:** D-99/P7 — the defense is the authority map + wrapping + typed guard; spotting is fragile and was subverted in real incidents.
- **Making `assemble` throw:** the AssembleResult never-throw contract (ContextOptimizer.ts:100-112) is a Phase-5 lock; the guard's throwing variant stays outside assemble.
- **New §1.3 section kinds or edited `CANONICAL_SECTION_ORDER`:** `pack()` throws on non-canonical kinds (ContextPack.ts:39-42) — debug/notes must ride existing kinds (see Open Questions (RESOLVED)).
- **New error codes:** `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` is the ONLY code Phase 7 raises and it already exists in the closed set (spec 5093); the `CONTEXT_TOO_LARGE` literal precedent (ContextOptimizer.ts:465) is how closed-set literals are used — no registry edit.
- **Re-implementing layers 1/2/4:** extraction hygiene (Phase 6), Executor screening (Phase 4), output screening (Phase 18/12) — Phase 7 ships only the L5 containment seam + L6 signal (D-98).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Injection detection | Content regexes / "looks like a directive" scanners | O.3 structural authority map + `<untrusted_data>` wrap + typed guard (D-99) | Labels/heuristics were subverted in production incidents (PITFALLS P7); structural layering is the only defense that survives. |
| Stable-prefix byte-stability check | A custom hashing/compare utility | `PromptCacheAdapter.hashStableSections` (FNV-1a, PromptCacheAdapter.ts:83-95) + committed vitest snapshot files | The FNV-1a function is already shipped and is the cache contract; vitest snapshots are committed and diffable. |
| Receipt persistence | A new storage key / IndexedDB table for receipts | Derived view computed on demand (D-95; Phase 11 persists into AITransactionLog) | "Never persisted (derived view)" is locked; a parallel store duplicates state (D-102 mirrors D-77). |
| Skill-manifest catalog | Building real `ISkill` implementations / slash commands / RICH registry | Disclosure mechanism only (`renderSkillDisclosure` + fixtures) | Phase 15 owns the real catalog; Phase 7 ships the contract + zero-token proof (D-101). |
| Tokenizer | A new token-counting library | Existing `heuristicTokenCounter` (D-71) + recount-on-wrap | No tokenizer dependency exists by design (STACK.md); heuristic counting is the shipped accounting unit. |

**Key insight:** every "hard" part of this phase already has a shipped seam — the phase is *wiring* trust through existing contracts, not inventing new infrastructure. The genuine design decisions (receipt placement, rungs 1-2 mechanics) are both additive and reversible, and are flagged in Open Questions (RESOLVED).

## Common Pitfalls

### Pitfall 1: Editing the verbatim contracts (manifest / A8 / §1.3)
**What goes wrong:** An executor adds `originalTokens` or `cacheEligible` to the manifest schema, or `sourceId` to `PromptSection`, because "it's easier."
**Why it happens:** The derivation path (manifest + originalTokens + sections → receipt) is less obvious than just adding a field.
**How to avoid:** The manifest (`ContextProvenanceManifestSchema`, ContextProvenanceManifest.ts:28-42), A8 (`PromptSectionSchema`, ai/types.ts:95-100), and `CANONICAL_SECTION_ORDER` (ContextPack.ts:15-23) are read-only this phase. The receipt is a separate module.
**Warning signs:** A diff touching `ContextProvenanceManifest.ts` or `src/core/ai/types.ts` beyond imports.

### Pitfall 2: `assemble` throwing the injection code
**What goes wrong:** The guard's `throw … CONTEXT_INSTRUCTION_INJECTION_BLOCKED` lands inside `assemble`, breaking the never-throw AssembleResult contract and every existing caller/test.
**Why it happens:** O.3's comment (spec 6388) shows a throw, and it's the first thing an executor reaches for.
**How to avoid:** `assemble` calls only the non-throwing `applyTrustPolicy`; the throwing guard is an exported seam tested by the prompt-injection fixtures and consumed by future phases.
**Warning signs:** `assemble` gaining a `try/catch` or a new `ok:false` union variant.

### Pitfall 3: `verify:phase-7` still mis-pointed
**What goes wrong:** The gate runs Phase-15/16 dirs (`tests/hooks tests/components …`) and the trust + prompt-injection suites never execute — CTX-04's release block is silently absent.
**Why it happens:** The mis-pointing has persisted since Phase 6 (STATE.md records "verify:phase-7 mis-pointing left for Phase-7").
**How to avoid:** Re-point to `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection` (spec 3611 verbatim) — the D-68/D-78/D-92 precedent. Note: `tests/security/` (not `tests/core/security/`) and `tests/core/context/trust/` do NOT exist yet — both must be created with ≥1 test file or vitest reports "no tests found".
**Warning signs:** The gate passes while `tests/core/context/trust/` and `tests/security/prompt-injection/` are empty or absent.

### Pitfall 4: New section kinds for debug/notes (D-97)
**What goes wrong:** An executor adds a `DEBUG`/`NOTES` section kind — `pack()` throws (`ContextPack.ts:39-42`) and the §1.3 stable order (and the snapshot) breaks.
**Why it happens:** Rungs 1-2 need something to drop; a "new section" seems natural.
**How to avoid:** Debug/notes ride existing kinds with distinct sourceIds (see Open Question 2); rungs 1-2 drop them with manifest `truncated` records. Canonical order stays closed.
**Warning signs:** Any diff to `CANONICAL_SECTION_ORDER` or `MANIFEST_KIND_MAP`.

### Pitfall 5: Snapshot churn from USER PREFERENCES
**What goes wrong:** The golden snapshot includes USER PREFERENCES text; a later phase changes `prefsCompact` and the gate blocks release with an unexplained diff.
**Why it happens:** D-100 names USER PREFERENCES in the stable prefix but the code marks it `stable:false`.
**How to avoid:** Snapshot the deterministic packed output (document that USER PREFERENCES is included because rendering is deterministic for a fixed input, not because it is cache-stable); keep the golden regeneration path documented (intentional prompt change → regenerate fixture).
**Warning signs:** A snapshot test failing with a diff that is actually an intentional copy change.

### Pitfall 6: Trust types in the wrong home
**What goes wrong:** `ContextItem`/`ContextReceiptEntry`/`TrustLevel` end up in `src/core/context/trust/types.ts`, breaking the C.1 canonical-home mandate and Phase 11/15 imports.
**Why it happens:** The trust/ subdir invites a local types file; the discretion wording invites the choice.
**How to avoid:** Spec 4833-4844 is MANDATORY: the "Trust context" row (spec 4838) pins these three types to `@/types/harness`, and O.3 (spec 6369) imports from there. Append to `src/types/harness.ts` (currently only Phase-4 reliability types, harness.ts:20-60).
**Warning signs:** A `types.ts` under `src/core/context/trust/` containing C.1 types.

### Pitfall 7: Zero NP-STRICT ceiling
**What goes wrong:** New Phase-7 code ships `@ts-expect-error NP-STRICT` markers to paper over strict-mode issues.
**Why it happens:** Quick fix under deadline.
**How to avoid:** All new modules must be strict-clean (STATE.md decision 17); `verify:phase-7` runs `tsc --noEmit` which fails on type errors.
**Warning signs:** `grep NP-STRICT src/core/context/trust` returns matches.

## Code Examples

### 1. O.3 TrustPolicy — VERBATIM (spec 6367-6389), the module the executor must reproduce exactly

```typescript
// src/core/context/TrustPolicy.ts   [spec O.3 verbatim]
import type { ContextItem, TrustLevel } from '@/types/harness';

const AUTHORITY_BY_TRUST: Record<TrustLevel, boolean> = {
  system: true, user: true, tool: false, retrieved: false, untrusted: false,
};

/** Enforce CTX-02: only system/user may carry instruction authority. */
export function applyTrustPolicy(items: ContextItem[]): ContextItem[] {
  return items.map(it => {
    const allowed = AUTHORITY_BY_TRUST[it.trust];
    if (it.instructionAuthority && !allowed) {
      // Wrap so the model treats it as quoted DATA, not a directive.
      return { ...it, instructionAuthority: false,
        text: `<untrusted_data source="${it.sourceId}">\n${it.text}\n</untrusted_data>` };
    }
    return it;
  });
}
// Blocked-injection error to raise when a retrieved item tries to redefine policy:
//   throw Object.assign(new Error('blocked'), { code: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED' });
```

### 2. C.1 trust types — VERBATIM additions to `src/types/harness.ts` (spec 4879-4900)

```typescript
// ---- Trust-aware context (Phase 7, §28.3) ----
export type TrustLevel = 'system' | 'user' | 'tool' | 'retrieved' | 'untrusted';
export interface ContextItem {
  id: string;
  kind: PromptSection['kind'];
  text: string;
  tokens: number;
  trust: TrustLevel;
  instructionAuthority: boolean;   // MUST be false for retrieved/untrusted data
  relevance: number;               // 0..1
  freshness: number;               // 0..1
  sensitivity: 'none' | 'low' | 'high';
  sourceId: string;
}
export interface ContextReceiptEntry {
  sourceId: string;
  included: boolean;
  originalTokens: number;
  finalTokens: number;
  compression?: 'summarise' | 'structural' | 'topk';
  cacheEligible: boolean;
  omitReason?: string;
}
```

### 3. Receipt derivation skeleton (D-95; new module `ContextReceipt.ts`)

```typescript
import type { ContextProvenanceManifest } from '../ContextProvenanceManifest';
import type { ContextReceiptEntry } from '@/types/harness';
import type { PromptSection } from '../../ai/types';

export interface ContextReceiptSurface {
  entries: ContextReceiptEntry[];
  untrustedDataPresent: boolean;   // L6 disclosure signal (07-UI-SPEC Contract A)
}

export function deriveContextReceipt(
  manifest: ContextProvenanceManifest,
  originalTokens: Record<string, number>,   // D-96 bookkeeping: sourceId → pre-degradation count
  sections: PromptSection[],                // needed for the A8 `stable` flag (cacheEligible)
): ContextReceiptSurface {
  // per manifest record: included = !(by-design omission || dropped debug/notes);
  // compression = record.compressionApplied; finalTokens = record.tokens;
  // cacheEligible = stable flag of the section whose sourceId matches; omitReason
  // from sourceId ('system'/'task' → 'no-input-source', 'debug' → 'debug-only', …)
  // untrustedDataPresent = any entry whose source derives from a trust:'untrusted'|'retrieved' item
}
```

### 4. Structural guard (D-99; in `TrustPolicy.ts` or sibling)

```typescript
import type { ContextItem, TrustLevel } from '@/types/harness';

const BLOCKED = 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED';  // spec 5093, closed set — no new codes (D-38)

/** Structural detection: the C.1 field combination, never content. */
export function isPolicyRedefinitionAttempt(item: ContextItem): boolean {
  const trust = item.trust as TrustLevel;
  return (trust === 'retrieved' || trust === 'untrusted') && item.instructionAuthority === true;
}

/** Throwing guard — test/consumer seam. assemble() must NOT call this (never-throw contract). */
export function raiseIfPolicyRedefinitionAttempt(items: ContextItem[]): void {
  const offender = items.find(isPolicyRedefinitionAttempt);
  if (offender) {
    throw Object.assign(new Error(`policy redefinition attempted by source ${offender.sourceId}`), {
      code: BLOCKED,
    });
  }
}
```

### 5. Progressive skill disclosure (D-101; new module `SkillDisclosure.ts`)

```typescript
import type { ISkill } from '../../ai/types';  // shape-aligned to spec 1829-1856 (Phase 15 owns real impls)

export interface SkillDisclosureCandidate {
  id: string;
  name: string;
  description: string;      // one-line description (ISkill.description)
  trigger: string;          // trigger metadata (slash command / activation keyword)
  fullInstructions: string; // the full skill body — injected ONLY when active
  active: boolean;
}

/** CTX-05: N skills, M active → M full bodies + (N-M) trigger+one-liners. */
export function renderSkillDisclosure(candidates: SkillDisclosureCandidate[]): { text: string; tokens: number } {
  // active → `${name}:\n${fullInstructions}`; inactive → `${trigger} — ${description}`
  // fixture proof: token count of output == tokens(active bodies) + tokens(one-liners);
  // irrelevant full instructions are absent from the output entirely (zero tokens).
}
```

### 6. Snapshot test skeleton (D-100/CTX-04)

```typescript
import { describe, it, expect } from 'vitest';
import { assemble, type ContextOptimizerInput } from '@/core/context/ContextOptimizer';
import { pack } from '@/core/context/ContextPack';
import { hashStableSections } from '@/core/ai/PromptCacheAdapter';

// tests/core/context/trust/stable-prefix.snapshot.test.ts
it('packed stable prefix is byte-identical to the committed golden (CTX-04)', () => {
  const result = assemble(canonicalFixtureInput);  // fixed, documented fixture
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const prompt = pack(result.context.sections).prompt;
  await expect(prompt).toMatchFileSnapshot('./fixtures/stable-prefix.golden.txt');
});

it('stable-section FNV-1a hash matches the golden (cross-check, spec 5747+)', () => {
  const result = assemble(canonicalFixtureInput);
  if (!result.ok) return;
  expect(hashStableSections(result.context.sections)).toBe('01234567'); // golden hash
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "From web" label on extracted content | Structural authority map + `<untrusted_data>` wrap + typed guard (O.3, D-99) | 2025-2026 incidents (Perplexity Comet, Gemini Deep Research — PITFALLS P7) | Single labels were bypassed; structural layering is the shipped defense. |
| Manifest as internal provenance record | Manifest → derived user-inspectable **context receipt** (CTX-03, D-95) | Phase 7 | Prompt Inspector (Phase 11) reconstructs packing decisions without raw bodies. |
| Skills injected wholesale | Progressive disclosure — trigger+one-liner until activated (CTX-05, D-101) | Phase 7 (mechanism) / Phase 15 (catalog) | Irrelevant full instructions consume zero prompt tokens (SC#4). |
| Monolithic prompt-cache assumptions | Stable-prefix byte-identity gated by committed snapshots (CTX-04, D-100) | Phase 7 | A system-prompt diff blocks release; cache stability is testable. |

**Deprecated/outdated:**
- Content-heuristic injection "spotting": fragile, subverted in production (PITFALLS P7, ADR-SEC-01) — replaced by the six-layer structural stack (L5 = this phase).
- Dual-LLM quarantine as a v0.1 control: **deferred to v0.2** (ADR-SEC-01); v0.1 relies on layers 1/2/4/5/6 + human approval.

## Assumptions Log

> All claims in this research were verified against the spec, the shipped code (read this session), or the approved 07-UI-SPEC. There are **no `[ASSUMED]`-tagged claims** that lock behavior. The genuine design tensions are recorded as Open Questions (RESOLVED, below) rather than assumptions.

## Open Questions (RESOLVED)

1. **Receipt placement on `OptimizedContext` (additive field) vs standalone derivation function**
   - What we know: D-96 forbids a public-signature change to `assemble(ContextOptimizerInput) → AssembleResult`; D-77 already added additive fields (`contextTier`/`truncated`/`truncatedSources`) to `OptimizedContext` as the accepted pattern; Phase-11 Prompt Inspector must reconstruct packing decisions from a transaction id, and the manifest alone lacks `originalTokens`/`stable`.
   - What's unclear: whether "no public-signature change" permits an additive `receipt` field on the output (D-77 precedent) or demands the receipt stay a standalone function Phase 11 calls with separately-retained bookkeeping.
   - Recommendation: **additive `receipt` (+ `untrustedDataPresent`) on `OptimizedContext`**, computed by the trust layer's `deriveContextReceipt` — the D-77 precedent 1:1; existing tests keep passing; Phase 11 lifts it additively. Planner should confirm before locking.
   - **RESOLVED:** additive `receipt` (+ `untrustedDataPresent`) on `OptimizedContext` confirmed — 07-01 Task 2 wires `deriveContextReceipt` into `assemble` per the D-77 precedent; Phase 11 lifts it additively.

2. **Rungs 1-2 mechanics for debug/notes (D-97): how do the optional inputs enter the working set without new section kinds?**
   - What we know: `ContextPack.pack` throws on non-canonical kinds (ContextPack.ts:39-42); `MANIFEST_KIND_MAP`/§1.3 are closed; `buildSourcedSections` uses a `byKind` Map (one section per kind); the decision requires "a manifest `truncated` record" when dropped.
   - What's unclear: the A8 kind + manifest kind the optional debug/notes sections ride (extra `CONTEXT`-kind sections with distinct sourceIds vs a `task`-kind carrier), and whether rungs 1-2 fire only over budget (ladder scope) or always when inputs are present.
   - Recommendation: model them as **additional `CONTEXT`-kind sections with `sourceId` prefixes `debug:`/`notes:`** — `findSection(working,'CONTEXT')` returns the first (main page context), rungs 1-2 drop them over budget with `truncated` records, and the receipt maps their sourceId to `omitReason: 'debug-only' | 'secondary-notes'`. Rungs stay inside the existing over-budget ladder scope. Planner must verify the `byKind` Map → ordered-array refactor is acceptable (it is local to `buildSourcedSections`).
   - **RESOLVED:** debug/notes ride additional `CONTEXT`-kind sections with sourceId `'debug'`/`'notes'` (the `byKind` Map → ordered-array refactor is accepted — local to `buildSourcedSections`); rungs 1-2 drop them over budget with truncated manifest records and the receipt maps `omitReason: 'debug-only' | 'secondary-notes'` — 07-01 Task 2 (D-97).

3. **USER PREFERENCES in the CTX-04 snapshot vs its `stable:false` flag**
   - What we know: D-100 names "SYSTEM + TOOL SCHEMAS + USER PREFERENCES"; the shipped code emits no SYSTEM and marks USER PREFERENCES `stable:false` (ContextOptimizer.ts:287-292).
   - What's unclear: whether Phase 7 should flip `USER PREFERENCES` to `stable:true` (a cache-semantics change to Phase-5/PromptCacheManager behavior) to match D-100's naming.
   - Recommendation: **do NOT flip the flag**; snapshot the deterministic packed output (USER PREFERENCES text is byte-identical for a fixed input regardless of the flag) + the `hashStableSections` FNV-1a golden. A future phase (persona/Phase 15) reconciles the flag.
   - **RESOLVED:** USER PREFERENCES stays `stable:false` (no cache-semantics change); the CTX-04 snapshot pins the deterministic packed output + `hashStableSections` FNV-1a golden — 07-02 Task 2.

4. **`tests/security/` vs `tests/core/security/`**
   - What we know: §18 required tests are `tests/security/prompt-injection/**` (spec 2650) and the gate string (spec 3611) names `tests/security/prompt-injection`; only `tests/core/security/` exists today.
   - What's unclear: whether to create the new top-level `tests/security/` dir (spec-verbatim path) or place fixtures under the existing `tests/core/security/`.
   - Recommendation: **create `tests/security/prompt-injection/` exactly as spec-named** — the gate string is verbatim and must match; renaming would mis-point the gate.
   - **RESOLVED:** create `tests/security/prompt-injection/` exactly as spec-named — 07-01 Task 3 ships `policy-redefinition.test.ts` there (the spec-3611 gate string matches verbatim).

## Environment Availability

> Phase 7 is a pure code/config phase — no external services, CLIs beyond the existing toolchain, or network dependencies. Audit was run this session.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test toolchain | ✓ | v24.19.0 | — |
| pnpm | package scripts (`verify:phase-7`) | ✓ | 11.22.0 | — |
| TypeScript | `tsc --noEmit` gate | ✓ | 5.8.3 (declared ~5.8.2) | — |
| vitest | test runner (jsdom, globals, setup.ts) | ✓ | 3.2.7 (declared ^3.0.0) | — |
| zod | schema validation | ✓ | 4.4.3 | — |

**Missing dependencies with no fallback:** none — the stack is fully installed (verified via `pnpm list` this session). No `.github/` CI exists (D-100: the release-block gate is `verify:phase-7`, not CI).

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: true` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.7 (jsdom, globals:true, setupFiles `tests/setup.ts`, `@`→`src` alias) `[VERIFIED: vitest.config.ts]` |
| Config file | `vitest.config.ts` (no changes needed this phase) |
| Quick run command | `pnpm lint` (type gate) / `pnpm test -- tests/core/context/trust tests/security/prompt-injection` |
| Full suite command | `pnpm run verify:phase-7` (after D-103 re-point) / `pnpm run verify:all` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | Item pipeline tags trust/authority/relevance/freshness/sensitivity/sourceId per D-94 | unit | `vitest run tests/core/context/trust` | ❌ Wave 0 — `tests/core/context/trust/` new |
| CTX-02 | Fabricated authority on retrieved/untrusted → wrapped + guard raises `CONTEXT_INSTRUCTION_INJECTION_BLOCKED`; output never carries authority | unit (adversarial fixtures) | `vitest run tests/security/prompt-injection` | ❌ Wave 0 — `tests/security/prompt-injection/` new |
| CTX-03 | `deriveContextReceipt` maps manifest+originalTokens+sections → entries (included/omitReason/original→final/compression/cacheEligible) | unit | `vitest run tests/core/context/trust` | ❌ Wave 0 |
| CTX-04 | Golden snapshot byte-identical + FNV-1a hash cross-check; diff blocks gate | snapshot | `vitest run tests/core/context/trust` (via `verify:phase-7`) | ❌ Wave 0 — golden fixtures new |
| CTX-05 | N skills / M active → M full bodies + N-M one-liners; token-count assertion | unit (fixture) | `vitest run tests/core/context/trust` | ❌ Wave 0 |
| CTX-06 | Metrics = aggregates only; assertion no section body text appears | unit | `vitest run tests/core/context/trust` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm lint` (strict type gate; zero NP-STRICT markers)
- **Per wave merge:** `pnpm test -- tests/core/context/trust tests/security/prompt-injection` (fast, pure unit suites — no Chrome mocks needed)
- **Phase gate:** `pnpm run verify:phase-7` green before `/gsd-verify-work` (D-103 re-point is part of this phase)

### Wave 0 Gaps
- [ ] `tests/core/context/trust/` — new dir: TrustPolicy, ContextReceipt, SkillDisclosure, ContextQualityMetrics, item-pipeline tests + `*.snapshot.*` + `fixtures/stable-prefix.golden.txt`
- [ ] `tests/security/prompt-injection/` — new dir: malicious page / poisoned note / hostile tool-output fixtures (extends the tests/core/security/secrets-inspection.test.ts and tests/isolation/cross-entrypoint-imports.test.ts adversarial-fixture style)
- [ ] `package.json` — re-point `verify:phase-7` to `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection` (D-103; the only package.json edit)
- [ ] `src/types/harness.ts` — append `TrustLevel`/`ContextItem`/`ContextReceiptEntry` verbatim (spec 4879-4900)

## Security Domain

> `security_enforcement: true` in `.planning/config.json` — this section is required. ASVS level 1 baseline.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in scope (local-first extension; provider keys are Phase-3/5 territory) |
| V3 Session Management | no | No sessions in scope |
| V4 Access Control | yes | Structural instruction-authority map (O.3) — untrusted/retrieved data is never granted instruction authority; permission/tool policy is system-owned (CTX-02) |
| V5 Input Validation | yes | zod-validated cross-boundary shapes (manifest already schema-parsed; new receipt/metrics are derived — validate at the boundary when consumed); untrusted page/note/tool content is quarantined by the trust policy, not sanitized heuristically (L1 is Phase 6) |
| V6 Cryptography | no | No crypto in scope |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Indirect prompt injection via extracted page/note/tool content (PITFALLS P7) | Tampering / Elevation of Privilege | Six-layer defense (ADR-SEC-01): L5 = this phase — `instructionAuthority:false` for retrieved/untrusted (D-94), O.3 `<untrusted_data>` wrap on claimed authority, structural guard raises `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` (spec 5093). L1 (Phase 6) / L2 (Phase 4) / L4 (Phase 18/12) ship elsewhere; L3 deferred to v0.2. |
| Policy-redefinition attempt (item fabricating authority) | Elevation of Privilege | Guard keys on the C.1 field combination `trust∈{retrieved,untrusted} ∧ instructionAuthority:true` — structural, no content regexes (D-99). |
| Sensitive text leaking into diagnostics | Information Disclosure | CTX-06/D-102: metrics are aggregates only — no section bodies, no raw text; receipt derivation mirrors the D-77 trace surface (sourceIds only). |
| Prompt-cache poisoning via unstable system prefix | Tampering | CTX-04/D-100: committed golden snapshots + `hashStableSections` FNV-1a cross-check gate byte-stability; a system-prompt diff blocks release via `verify:phase-7`. |

**Do NOT re-implement:** L1 extraction sanitization (Phase 6), L2 Executor action screening (Phase 4), L4 output screening before destructive actions (Phase 18/12), L3 dual-LLM quarantine (v0.2 — never in v0.1). Phase 7 owns L5 + the L6 disclosure signal only (D-98).

## Sources

### Primary (HIGH confidence) — read directly this session
- `.planning/phases/07-trust-aware-context-and-receipts/07-CONTEXT.md` — locked decisions D-93…D-103, scope boundary, canonical refs, code context
- `.planning/phases/07-trust-aware-context-and-receipts/07-UI-SPEC.md` — approved (2026-08-30); locks Contract A (`untrustedDataPresent`), B (metrics aggregates), C (receipt derivation rules), D (disclosure), scope `src/core/context/trust/**`, copy seeds
- `.planning/PRODUCT_SPEC_v0_1.md` — §18 Phase 7 (2646-2654), §28.3 (3947-3954), §2.4 ladder (491-502), §2.6 manifest (526-544), §1.3 order (331-350), §14.1 ISkill (1826-1856), Appendix C.1 trust types (4878-4900), C.1 canonical home table (4833-4844), Appendix C.2 registry (5070-5096, `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` @ 5093), Appendix O.3 (6363-6389), §24 gate (3611), Appendix K (5747-5821)
- `src/core/context/ContextOptimizer.ts` — assemble/buildSourcedSections/applyDegradationLadder, WorkingSection, sourceIdFor, rungs 1-2 reserved no-ops, USER PREFERENCES stable:false
- `src/core/context/ContextProvenanceManifest.ts` — verbatim schema, MANIFEST_KIND_MAP, buildManifest omission records
- `src/core/context/ContextPack.ts` — CANONICAL_SECTION_ORDER, pack() throw on non-canonical kinds
- `src/core/context/types.ts` — D-72/D-83 re-export pattern, RetrievedMemory/ToolSchemaRef supersession points
- `src/core/ai/types.ts` — A8 PromptSectionSchema (95-100), StreamErrorCodeSchema
- `src/core/ai/PromptCacheAdapter.ts` — hashStableSections FNV-1a (83-95), applyCacheHints
- `src/types/harness.ts` — current Phase-4 reliability types (20-60); the file trust types append to
- `src/core/content/PageContext.ts` — Phase-6 canonical PageContext (untrusted CONTEXT source)
- `package.json` — verify:phase-7 mis-pointing confirmed; deps zod ^4.4.3 / TS ~5.8.2 / vitest ^3.0.0
- `.planning/adr/ADR-SEC-01-dual-llm-quarantine-v0.2.md` — six-layer mapping (D-98)
- `.planning/research/PITFALLS.md` P7 — why structural layering beats labels/heuristics (D-99)
- `.planning/phases/05-context-adaptive-execution/05-CONTEXT.md` — D-69 create-only, D-72 re-export, D-77 trace surface precedent, D-78 gate re-point precedent
- `tests/core/context/ContextOptimizer.test.ts`, `tests/core/security/secrets-inspection.test.ts`, `tests/setup.ts`, `vitest.config.ts` — test conventions and Wave-0 baseline
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md` §28.3, `.planning/ROADMAP.md` Phase 7 — CTX-01…06 rows, success criteria, decision 17 (NP-STRICT → 0)

### Secondary (MEDIUM confidence)
- None — every claim in this research is verified against in-repo authoritative sources read this session; no web research was required (zero new packages, no external APIs, no framework docs).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all existing versions verified via `package.json` + `pnpm list` this session.
- Architecture: HIGH — every integration point (assemble, manifest, pack, PromptCacheAdapter, harness.ts) read in full this session; derivation rules locked by D-95 + 07-UI-SPEC Contract C.
- Pitfalls: HIGH — grounded in the shipped code's invariants (never-throw assemble, closed canonical order, verbatim schemas, zero NP-STRICT) and the locked decisions.
- Open design tensions: the four Open Questions are additive/reversible, flagged for the planner, and all four are now RESOLVED (inline markers) — the plans adopt each recommendation; none blocks planning.

**Research date:** 2026-08-30
**Valid until:** 2026-09-30 (stable in-repo contracts; re-verify package versions at any future install — VAI-04 watch item)