# Phase 7: Trust-Aware Context and Receipts - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers the **trust layer over the Phase-5 context spine and the Phase-6 extraction output**: every `ContextItem` carries trust/authority metadata (CTX-01), retrieved/untrusted data is structurally quarantined so it can never redefine system/tool/permission policy (CTX-02), the `ContextProvenanceManifest` becomes a user-inspectable **context receipt** (CTX-03), stable-prefix snapshot tests gate releases (CTX-04), skills disclose progressively (CTX-05), and context quality is diagnosable without raw text (CTX-06). It is the Phase-7 home of ADR-SEC-01's **layer 5 (containment/degraded privileges)** + **layer 6 (user disclosure signal)** of the six-layer injection defense.

**Scope is per spec §18 Phase 7** (spec 2646-2654). `Create/modify`: ContextItem, trust policy, context receipt, injection defences, stable-prefix snapshots, progressive skill disclosure. Required tests (verbatim §18):

```
tests/core/context/trust/**      # trust policy + receipt + stable-prefix snapshots
tests/security/prompt-injection/**  # adversarial fixtures: cannot redefine policy
```

**DONE-when (verbatim §18 + ROADMAP SC):** malicious page/note/tool-output fixtures cannot alter system/tool/permission policy (CTX-02); stable-prefix snapshot tests run and a system-prompt diff blocks release (CTX-04); Prompt Inspector reconstructs packing decisions from a transaction id — inclusion/omission, original/final tokens, compression, cache eligibility (CTX-03, spec 235); irrelevant full skill instructions consume zero prompt tokens (CTX-05, spec 236). Gate: `pnpm run verify:phase-7`.

**Out of scope (verified in spec §18 / PROJECT.md / REQUIREMENTS.md / ADR-SEC-01):** live chat/agent pipeline adoption of `OptimizedContext` (D-69 discipline — assemble stays proven-by-tests; `memoryHints` doesn't exist until Phase 8 so live adoption is premature); PromptTrace/AITransactionLog persistence + DiagnosticsSection/TransactionTraceView UI (Phase 11 — Phase 7 exposes only the derived metrics surface); dual-LLM quarantine (layer 3, ADR-SEC-01 deferred to v0.2); input sanitization at extraction (layer 1 = Phase 6 hygiene); Executor action screening (layer 2 = Phase 4); output screening before destructive actions (layer 4 = Phase 18 tool governance / Phase 12); user disclosure **UI** (layer 6 = Phase 15 — Phase 7 ships only the disclosure *signal*); real skill manifests + RICH command catalog (Phase 15); actual memory/note sources (Phase 8/9); `servicenow-api` strategy (Phase 17); tool registration (Phase 18); red-team corpus (Phase 19).

**Research-driven notes:** the `verify:phase-7` gate currently targets `tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes` (Phase 15/16 territory) and must be re-pointed to the §18 dirs — the exact Phase-4/5/6 D-68/D-78/D-92 precedent. Spec §24 canonical gate (spec 3611): `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection`. The `ContextItem`/`ContextReceiptEntry`/`TrustLevel` types are **unimplemented** (they exist only at spec 4878-4900); `src/types/harness.ts` currently holds only the Phase-4 reliability types. Appendix O.3 (spec 6363-6389) is the canonical `TrustPolicy.ts` worked example — `applyTrustPolicy` wraps untrusted text in `<untrusted_data source=…>` and forces `instructionAuthority:false`. CTX-02's enforcement is **structural** (authority map + wrapping), never content-heuristic.

</domain>

<decisions>
## Implementation Decisions

### Trust architecture — item-level pipeline + O.3 policy
- **D-93 (Trust operates on a `ContextItem[]` intermediate inside `assemble`, not on packed sections):** `ContextItem` (spec 4878-4891) is the item-level trust model; `TrustLevel = 'system'|'user'|'tool'|'retrieved'|'untrusted'` and `instructionAuthority` are attached per item BEFORE sections are packed. `ContextOptimizer.assemble` (Phase 5) builds its sourced sections through this item pipeline: sources → `ContextItem[]` (each tagged with trust/authority/relevance/freshness/sensitivity/sourceId) → `applyTrustPolicy` (Appendix O.3 verbatim: wrap untrusted + force `instructionAuthority:false`) → pack into the A8 `PromptSection[]`. The wrapped text is what lands in the prompt; the manifest/context-item metadata is what the receipt records. `AUTHORITY_BY_TRUST` map comes verbatim from O.3 (spec 6371). — **Reversibility:** `reversible` — rationale: internal pipeline ordering inside assemble; re-splitting later is a local change.
- **D-94 (Trust-level mapping per source, locked):** `[SYSTEM]`/`[TOOL SCHEMAS]` → `trust:'system'`, `instructionAuthority:true`; `[USER PREFERENCES]`/`[USER INPUT]` → `trust:'user'`, `instructionAuthority:true`; `[MEMORY]` → `trust:'retrieved'` (memory is stored page/note-derived content), `instructionAuthority:false`; `[CONTEXT]` (pageContext, Phase-6 output) → `trust:'untrusted'` when it arrives raw from extraction, `instructionAuthority:false`. This is the CTX-01 metadata contract and the CTX-02 enforcement precondition. — **Reversibility:** `reversible` — rationale: constant table; per-source tuning later is a data change.

### Receipt derivation + original tokens
- **D-95 (Receipt is an additive derived view over the manifest — do NOT edit the Phase-5 manifest schema):** CTX-03's receipt fields (`originalTokens`, `cacheEligible`, `omitReason`) are NOT in the §2.6 manifest (spec 530-544). Decision: keep `ContextProvenanceManifest` verbatim (D-77 lock) and derive a **`ContextReceiptEntry[]`** (spec 4892-4900) from the manifest + retained original per-section token counts. `cacheEligible` = `section.stable` (the §1.3/A8 stable flag that drives PromptCacheAdapter hashing, spec 5747+); `included` = !record.truncated-with-omission (by-design system/task omission records → `included:false` + `omitReason`); `compression` maps from manifest `compressionApplied`; `originalTokens` = pre-degradation count, `finalTokens` = record.tokens. Do NOT add fields to the manifest schema or A8 PromptSection (D-72). — **Reversibility:** `reversible` — rationale: additive derived module; the manifest contract stays untouched.
- **D-96 (assemble retains original per-section token counts for the receipt):** Phase-5 `assemble`/`applyDegradationLadder` must retain the pre-degradation token count per section so the receipt can report original→final. This is an additive bookkeeping change inside assemble (capture counts at `buildSourcedSections`, keep alongside the manifest record); no public-signature change to `assemble(ContextOptimizerInput) → AssembleResult`. — **Reversibility:** `reversible` — rationale: internal accounting; caller contract unchanged.
- **D-97 (Rungs 1-2 of the §2.4 ladder activate for debug/notes when the caller supplies them):** Phase-5's degradation ladder rungs 1 (`drop debug-only context`) and 2 (`drop secondary notes and optional metadata`) are documented RESERVED no-ops awaiting Phase-7 callers. Phase 7 wires them: the context item pipeline exposes an optional debug-sections input and optional secondary-notes input; when present they're dropped by rungs 1-2 with a manifest `truncated` record. When absent the rungs stay no-ops (spec 495-496 preserved). — **Reversibility:** `reversible` — rationale: additive optional inputs; absent inputs keep verbatim behavior.

### Injection defense scope + policy guard
- **D-98 (Phase 7 ships layers 5 + 6-signal + policy-redefinition guard; layers 1/2/4 owned elsewhere, layer 3 deferred):** ADR-SEC-01 maps v0.1 to six layers: L1 input sanitization = Phase 6 extraction hygiene (DONE), L2 action screening = Phase 4 Executor allowlist (DONE), L3 dual-LLM quarantine = **deferred to v0.2** (never implement), L4 output screening = Phase 18/12, L5 containment/degraded privileges = **this phase** (trust metadata + authority stripping + `<untrusted_data>` wrapping + the policy guard), L6 user disclosure = **signal only here**, UI in Phase 15. Phase 7 must NOT re-implement L1/L2/L4 mechanisms — only the L5 containment seam they feed. — **Reversibility:** `reversible` — rationale: layer assignment is an ADR mapping; shifts later are annotation edits.
- **D-99 (CTX-02 enforced structurally — authority map + wrapping + typed guard; NO content heuristics):** `applyTrustPolicy` (O.3) is the universal enforcement: any item whose `trust` maps to `false` authority is wrapped and force-stripped of `instructionAuthority`. The `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` code (spec 5093, already in the §21.6 closed set) is raised **structurally** when a retrieved/untrusted item is observed attempting to carry instruction authority past the policy boundary (e.g., a fixture that fabricates `instructionAuthority:true` on retrieved data, or a policy-redefinition marker on the item). The `tests/security/prompt-injection/**` fixtures simulate these attempts (malicious page HTML, poisoned note, hostile tool output) and assert the guard raises the typed code / the wrapped output never carries authority. No regex/pattern matching against content — content heuristics are fragile (research P7: "labels and quarantined chains were subverted"; the defense is structural layering, not spotting). — **Reversibility:** `reversible` — rationale: enforcement seam + fixture suite; hardening later is additive.

### Stable-prefix snapshots (CTX-04)
- **D-100 (Golden snapshot fixtures of the assembled stable prefix + the verify gate as the release block):** CTX-04 "stable-prefix snapshot tests are mandatory; a system-prompt diff blocks release". This repo has no CI (no `.github/`) — the release-block gate is `verify:phase-7` (spec 3611). Decision: commit golden snapshot files of the **packed stable prefix** (the §1.3 stable sections: SYSTEM + TOOL SCHEMAS + USER PREFERENCES byte-identical output) for canonical fixture inputs; `tests/core/context/trust/*.snapshot.*` asserts the assembled output is byte-identical to the golden; any system-prompt change fails the test → blocks the gate. Cross-check with `PromptCacheAdapter.hashStableSections` (stable sections hash-stable, spec 5747+). — **Reversibility:** `reversible` — rationale: golden fixtures; regenerating on intentional prompt change is a fixture update.

### Progressive skill disclosure (CTX-05, P1)
- **D-101 (Declare-now disclosure mechanism; real skill manifests Phase 15/17):** Skills (`ISkill`, spec 1826-1856) don't exist until Phase 15/17. Phase 7 ships the **disclosure contract + mechanism**: a registry/selector that, given candidate skills with trigger/description metadata, injects only the **trigger + one-line description** for skills not yet activated, and the **full instructions** only for the activated skill — so irrelevant full instructions consume zero prompt tokens (SC#4). Proven by fixtures (N skills present, M active → prompt carries M full bodies + N-M one-liners; token count assertion). The concrete `ISkill` implementations, slash commands, and RICH catalog land Phase 15. — **Reversibility:** `reversible` — rationale: additive declaration + fixture proof; Phase 15 consumes the seam.

### Context-quality diagnostics (CTX-06, P1)
- **D-102 (Derived aggregate metrics surface — no raw text persisted):** CTX-06 requires diagnostics of context quality without persisting raw sensitive text. Phase 7 exposes a derived metrics surface over the receipt/manifest (aggregates only: section count, trust mix counts, truncation/compression counts, token utilization ratio original→final, minimalMode flag) — no section bodies, no sourceId content beyond the existing manifest sourceIds. This mirrors Phase-5's D-77 derived trace surface; Phase 11 lifts it into `PromptTrace`/DiagnosticsSection. — **Reversibility:** `reversible` — rationale: derived read-only metrics; Phase 11 persistence is additive.

### Verification gate
- **D-103 (Re-point `verify:phase-7` to `tests/core/context/trust tests/security/prompt-injection` — D-92 analog):** package.json `verify:phase-7` currently targets `tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes` (Phase 15/16). Re-point to the §18 required dirs: `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection` (spec 3611 verbatim). — **Reversibility:** `reversible` — rationale: package.json script edit (D-68/D-78/D-92 precedent).

### the agent's Discretion
- Exact file layout under `src/core/context/trust/` (one file per concern vs a barrel `index.ts` — mirror the `src/core/ai/` convention) and where `TrustPolicy.ts` lands (O.3 names `src/core/context/TrustPolicy.ts`; a `trust/` subdir may mirror `tests/core/context/trust/`).
- Whether `ContextItem`/`ContextReceiptEntry`/`TrustLevel` go in `src/types/harness.ts` (the existing Phase-4 canonical home per spec 4838-4839 "Trust context" row) or `src/core/context/trust/types.ts` — spec's canonical-home rule points to `@/types/harness`; the researcher should confirm the exact import path used by O.3 (spec 6369 imports `@/types/harness`).
- Exact shape of the structural "policy-redefinition attempt" signal the guard keys on (an explicit marker on the item vs fabricating `instructionAuthority:true` on retrieved data — both fixture-testable; must not become a content regex).
- Whether the disclosure mechanism is a standalone module or a `ContextOptimizer` input seam (assembled as part of `[TOOL SCHEMAS]`/a dedicated section) — either satisfies CTX-05's zero-token proof.
- Whether the L6 disclosure signal is a boolean flag on the receipt (`untrustedDataPresent: true`) vs a richer per-item marker — the Phase-15 UI consumes whichever ships.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 7 block, lines 2646-2654) — Create/modify list, required test dirs, DONE-when. Sole authority on Phase-7 scope.
- `.planning/PRODUCT_SPEC_v0_1.md` §28.3 (lines 3947-3954) — CTX-01…06 verbatim requirements (drives D-93…D-102).
- `.planning/PRODUCT_SPEC_v0_1.md` §2.4 (lines 491-502) — degradation ladder; rungs 1-2 are Phase-7 caller seams (D-97).
- `.planning/PRODUCT_SPEC_v0_1.md` §2.6 (lines 526-544) — `ContextProvenanceManifest` verbatim (D-95 keeps it untouched).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 trust types (lines 4878-4900) — `TrustLevel`/`ContextItem`/`ContextReceiptEntry` verbatim (D-93/D-95).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O.3 (lines 6363-6389) — `TrustPolicy.ts` worked example: `AUTHORITY_BY_TRUST`, `applyTrustPolicy` `<untrusted_data>` wrap, `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` (drives D-93/D-99).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.2 (lines 5070-5096) — closed error-code registry; `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` already present (D-99, no new codes, D-38).
- `.planning/PRODUCT_SPEC_v0_1.md` §24 (line 3611) — canonical `verify:phase-7` gate string (D-103).
- `.planning/PRODUCT_SPEC_v0_1.md` §1.3 (lines 331-350) + Appendix K (lines 5747-5821) — canonical section order + stable-first cache semantics (`cacheEligible` derivation, D-95; stable-prefix snapshots, D-100).
- `.planning/PRODUCT_SPEC_v0_1.md` §14.1 (lines 1826-1856) — `ISkill` interface the disclosure mechanism's triggers/descriptions shape against (D-101).
- `.planning/PRODUCT_SPEC_v0_1.md` §2.3/§19.3 — `ContextOptimizerInput`/`OptimizedContext`; the Phase-5 trace surface Phase 7 extends (D-95/D-102).
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: the trust layer runs in UI contexts only, never the background SW.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 7: Trust-Aware Context and Receipts" (lines 225-238) — goal, depends-on (Phases 5 & 6), success criteria (SC#1-4).
- `.planning/REQUIREMENTS.md` §28.3 rows (lines 214-223, 471-476) — CTX-01…06 assigned to Phase 7.
- `.planning/adr/ADR-SEC-01-dual-llm-quarantine.md` — six-layer defense mapping (drives D-98); layer 3 deferred to v0.2.
- `.planning/research/PITFALLS.md` P7 (lines 164-185) — indirect prompt injection; why structural layering beats single labels/heuristics (D-99).
- `.planning/phases/05-context-adaptive-execution/05-CONTEXT.md` — D-69 create-only (live adoption is premature here), D-72 re-export, D-73 degradation ladder, D-74 minimal-mode, D-75/D-76 compression/pack, D-77 manifest verbatim + derived trace surface, D-78 gate re-point precedent.
- `.planning/phases/06-pagecontentservice-knowledge-acquisition/06-CONTEXT.md` — D-82 (`pageContext` feeds `ContextOptimizerInput.pageContext` — the CONTEXT item source for Phase 7), D-88/D-89 cache subscription (surface wiring deferred), D-90 TraceRedactor seam, D-92 gate re-point precedent (D-103 follows verbatim).
- `.planning/phases/04-agent-reliability-and-evidence/04-CONTEXT.md` — D-68 gate re-point precedent; `@/types/harness` canonical-home pattern (D-93/D-95 type placement).
- `.planning/STATE.md` — decision 10 (ADR-SEC-01 six-layer mapping), decision 17 (strict ceiling → new code strict-clean, zero NP-STRICT markers).

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/ARCHITECTURE.md` — per-surface module singletons; `src/core/` is UI-framework-agnostic; core imports no React.
- `.planning/codebase/STACK.md` — zod ^3.24 (schema-first), no tokenizer/SDK (heuristic counter), minisearch/defuddle per Phase 6.
- `.planning/codebase/CONCERNS.md` — "AI response / prompt-injection surface" + "No injection defense beyond a 'from web' label" (lines 157-161, 446) — the Phase-7 target.

### Source (integration targets — the Phase-7 consumer contracts)
- `src/core/context/ContextOptimizer.ts` — `assemble` item pipeline insertion point (D-93), `buildSourcedSections`, `applyDegradationLadder` (rungs 1-2, D-97), original-token retention (D-96).
- `src/core/context/ContextProvenanceManifest.ts` — the verbatim manifest D-95 derives the receipt from; `MANIFEST_KIND_MAP`.
- `src/core/context/ContextPack.ts` — `pack()` canonical-order assembly the stable-prefix snapshots snapshot (D-100); throws on non-canonical kinds.
- `src/core/ai/PromptCacheAdapter.ts` — `hashStableSections`/stable-first (cacheEligible derivation + snapshot cross-check, D-95/D-100).
- `src/core/ai/types.ts` — A8 `PromptSection` (`kind`/`text`/`stable`/`tokens`); D-72 re-export target; DO NOT add sourceId (D-95).
- `src/core/content/PageContext.ts` — the Phase-6 canonical `PageContext` (the untrusted CONTEXT item source, D-94).
- `src/types/harness.ts` — current canonical home of reliability types; candidate home for the trust types (spec 4838 "Trust context" row).
- `tests/core/context/ContextOptimizer.test.ts` / `ContextCompressor.test.ts` / `TokenBudget.test.ts` — existing Phase-5 suites the trust tests extend.
- `tests/isolation/cross-entrypoint-imports.test.ts` + `tests/core/security/secrets-inspection.test.ts` — existing security-test conventions the `tests/security/prompt-injection` suite follows.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/context/ContextOptimizer.ts` — `assemble` is the single item→section pipeline; `buildSourcedSections` and `applyDegradationLadder` are the insertion points for trust tagging + original-token capture (D-93/D-96/D-97). The A8 section kinds and §1.3 order already exist.
- `src/core/context/ContextProvenanceManifest.ts` — verbatim manifest + `MANIFEST_KIND_MAP` + by-design system/task omission records (the receipt's `included:false`/`omitReason` source, D-95).
- `src/core/context/ContextPack.ts` — `CANONICAL_SECTION_ORDER` + `pack()`; the stable-prefix snapshot target (D-100).
- `src/core/ai/PromptCacheAdapter.ts` — `applyCacheHints` + `hashStableSections`; the `cacheEligible` derivation rule (D-95) and stable-hash cross-check (D-100).
- `src/types/harness.ts` — established canonical-home file for C.1 types; trust types follow the same pattern (D-93/D-95).
- `tests/core/security/secrets-inspection.test.ts` — precedent for security-focus suites with adversarial fixtures (D-99's prompt-injection suite style).

### Established Patterns
- **Create-only discipline (D-69/D-81)** — Phase 7 modifies assemble (trust tagging, original tokens) but does NOT wire it into the live chat/agent loop (D-93/D-96); proven by tests.
- **Verbatim schema preservation (D-72/D-77)** — manifest and A8 PromptSection stay untouched; the receipt is additive/derived (D-95).
- **Structural enforcement over heuristics (D-38/D-99)** — closed authority map + wrapping + typed guard code; no content regexes.
- **Derived surfaces (D-77/D-102)** — metrics/trace derived from canonical state, never a parallel copy.
- **Gate re-pointing (D-68/D-78/D-92/D-103)** — `verify:phase-7` edited in package.json to the phase's own test dirs.
- **Fixture-driven security tests** — adversarial page/note/tool-output fixtures prove CTX-02 (D-99), extending the Phase-6 fixture style.

### Integration Points
- `assemble()` item pipeline → trust-tagged `ContextItem[]` → wrapped `PromptSection[]` → manifest → derived receipt + metrics (Phase-7 spine).
- `ContextOptimizerInput.pageContext` (Phase-6 `PageContext`) → the untrusted CONTEXT item (D-94); already declared at `src/core/context/ContextOptimizer.ts:49`.
- Receipt + metrics surface → Phase 11 `PromptTrace`/DiagnosticsSection (D-95/D-102, declared-now/populate-later).
- Disclosure mechanism seam → Phase 15 `ISkill`/RICH catalog (D-101).
- L6 disclosure signal → Phase 15 UI disclosure (D-98).
- `verify:phase-7` script in package.json → re-point to `tests/core/context/trust tests/security/prompt-injection` (D-103).

</code_context>

<specifics>
## Specific Ideas

- **"Retrieved data is data, never instructions" (CTX-02)** is the phase's spine — `instructionAuthority` is structurally false for retrieved/untrusted; the `<untrusted_data source=…>` wrap is the enforcement, and the `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` code is the guard for attempts to cross the boundary (O.3 / D-99).
- **The receipt is a derived view, not a second manifest** — CTX-03 is satisfied by mapping the untouched §2.6 manifest + original token counts + stable flags into `ContextReceiptEntry[]`; Prompt Inspector (Phase 11) reconstructs packing decisions from it (D-95).
- **Six layers, one phase** — Phase 7 is the L5 containment home; L1 (Phase 6), L2 (Phase 4) already ship, L3 deferred (ADR-SEC-01), L4 (Phase 18), L6 UI (Phase 15). No dual-LLM module in v0.1 (D-98).
- **No content heuristics** — the defense is the structural authority map + wrapping + typed guard; adversarial fixtures prove fixtures cannot redefine policy (D-99).
- **NP-STRICT ceiling → 0** — new Phase-7 code must be strict-clean; zero new `@ts-expect-error NP-STRICT` markers (STATE.md decision 17).
- **No invented requirement IDs / error codes** — CTX-01…06 are spec-native; `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` already exists in the §21.6 closed set (D-38/D-99).
- **verify:phase-7 gate mis-pointing must be fixed** — the gate is the release block for CTX-04; it must run the trust + prompt-injection suites (D-103).

</specifics>

<deferred>
## Deferred Ideas

- **Live `OptimizedContext` adoption in AgentOrchestrator/useChatStreaming** — Phase 7 keeps assemble proven-by-tests (D-69 discipline); adoption waits until `memoryHints` exists (Phase 8) and the pipeline is wired (D-93 note).
- **`PromptTrace`/AITransactionLog persistence + DiagnosticsSection/TransactionTraceView UI** — Phase 11; Phase 7 ships only the derived metrics/receipt surface (D-95/D-102).
- **Dual-LLM quarantine (injection layer 3)** — v0.2 (ADR-SEC-01); never implement in v0.1 (D-98).
- **Output screening before destructive actions (layer 4)** — Phase 18 tool governance / Phase 12; Phase 7 ships the containment seam they feed (D-98).
- **User-disclosure UI (layer 6)** — Phase 15 (RICH); Phase 7 ships only the disclosure signal (D-98).
- **Real skill manifests + slash commands + RICH catalog (CTX-05 consumers)** — Phase 15; Phase 7 ships the disclosure mechanism + zero-token proof (D-101).
- **Actual memory/note sources for MEMORY items** — Phase 8/9; Phase 7's MEMORY trust mapping applies to whatever retrieval ships then (D-94).
- **Red-team adversarial corpus (HashJack fragments, encoded instructions, Unicode confusables)** — Phase 19; the Phase-7 fixtures are the structural guarantee, not the full red-team suite (D-99).

None of these belong in Phase 7 — discussion stayed within phase scope.

</deferred>

---
*Phase: 7-Trust-Aware Context and Receipts*
*Context gathered: 2026-08-30*