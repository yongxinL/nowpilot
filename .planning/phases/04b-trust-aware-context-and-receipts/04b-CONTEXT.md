# Phase 4b: Trust-Aware Context and Receipts - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes retrieved content unable to instruct the model. It ships the trust-aware envelope: page/note/memory/tool output is labeled `trust: 'retrieved'|'untrusted'` with `instructionAuthority: false` (spec §28.3, Golden Rule 7). Concretely: **`ContextItem` + `TrustLevel` + `ContextReceiptEntry`** land verbatim in `@/types/harness` (C.1), **`TrustPolicy`** (O.3 verbatim `applyTrustPolicy`) enforces instruction-authority stripping deterministically with zero model calls, a **deterministic prompt-injection classifier** screens + quarantines flagged items before they enter the optimizer, **content trust controls** (per-source-type toggles in Options) gate which sources feed the model, and **`ContextProvenanceManifest` extends into a context receipt** (per-section inclusion/omission, original/final tokens, compression, cache eligibility) sufficient to reconstruct every packing decision. The pageContext feed into `ContextOptimizerInput` — unplugged since Phase 4a (D-4a-06) — gets wired **trust-aware** here.

**Scope authority (G0):** Spec-authoritative. Phase 4b = the §18 Phase-4b block (ContextItem, trust policy, context receipt, injection defences, stable-prefix snapshots, progressive skill disclosure) + the §28.3 CTX-01..06 requirements + `tests/core/context/trust/**` + `tests/security/prompt-injection/**` + `verify:phase-4b`. REQUIREMENTS.md TRUST-01..03 rows get a CTX-01..06 re-map note (AI-07 precedent, D-04-01 disambiguation).

**Boundary notes:**
- **Page-only feed now:** Only `PageContext` (Phase 4a extraction) becomes `ContextItem[]` with real data. RetrievedMemory (Phase 5) and tool_result (already `trust:false` by kind) are **structural no-ops** in 4b — the trust envelope supports them, no real memory/tool data exists yet.
- **Receipt data, no UI:** The context receipt is data emitted by 4b; the Prompt Inspector is a **Phase-6 visualization** over that same data. 4b ships no receipt/inspector UI.
- **Zero model calls in trust evaluation:** TrustPolicy + injection classifier are deterministic and pure — the 2-call/healthy-turn cost truth survives.
- **R-3:** trust machinery lives in Side Panel/Standalone only; nothing here touches the background SW.
- **No event bus (D-04-02 holds):** CTX-02 remains a typed input-only seam; 4b supplies the trigger + consumer, not a runtime event system.

</domain>

<decisions>
## Implementation Decisions

### Requirement Reconciliation (G0)
- **D-4b-00 [TRUST→CTX re-map]:** REQUIREMENTS.md TRUST-01..03 rows map to the spec §28.3 CTX-01..06 namespace (Phase 4b owns those ids per D-04-01). AI-07-style re-map note added: TRUST-01 = CTX-01/02, TRUST-02 = CTX-02 injection defences, TRUST-03 = CTX-03 controls. CTX-05/06 are P1 → structural (D-4b-11/12).

### Trust Envelope & Policy Point
- **D-4b-01 [page-only ContextItem feed]:** `PageContext` (4a) → `ContextItem[]` is the only real data feed in 4b. RetrievedMemory and tool_result stay structural no-ops (memory data lands in Phase 5; tool_result already carries `trust:false` via its kind). Receipts still enumerate all three kinds so the envelope is future-proof.
- **D-4b-02 [ContextItem → PromptSection boundary]:** `ContextItem` is the trust-carrying input buffer; `PromptSection` is the model-consumable output. **TrustPolicy operates entirely on `ContextItem[]`**; only trusted/re-written items become `PromptSection[]`. Quarantined items remain ContextItems only (never become sections). Receipts record both included and excluded items.
- **D-4b-03 [policy purity]:** `TrustPolicy` is deterministic and pure — never mutates SYSTEM content, never calls a model. The `<untrusted_data source=...>` wrap (O.3) must not disturb the byte-stable cached `[SYSTEM]` persona block (F-5 cache eligibility; CACHED_KINDS untouched).
- **D-4b-04 [applyTrustPolicy placement]:** `applyTrustPolicy(items: ContextItem[]): ContextItem[]` runs at the feed boundary BEFORE conversion to sections (O.3 verbatim, `AUTHORITY_BY_TRUST` map). Items whose `trust` is `retrieved`/`untrusted`/`tool` get `instructionAuthority: false` + the `<untrusted_data>` wrap. The `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` code (O.3) is the canonical error for an attempt to redefine policy via retrieved content.

### Injection Defence Stack (TRUST-02 / CTX-02)
- **D-4b-05 [deterministic classifier]:** Prompt-injection screening = a deterministic, dependency-free heuristic classifier (regex patterns for "ignore previous instructions", system-prompt redefinition, tool/permission-grant attempts) that CLASSIFIES items. Zero LLM, zero model calls. No DOMPurify in the core pipeline in 4b (page markdown is text by the time it reaches the optimizer; §16.1 XSS matrix covers render-side).
- **D-4b-06 [quarantine-not-drop]:** On a detection hit the item is **quarantined** — kept as a `ContextItem`, wrapped + flagged (`omitReason: 'prompt_injection'` recorded in the receipt), never dropped silently and never converted to a `PromptSection`. Receipt records the quarantine decision so it is auditable. Risk: over-blocking legitimate content (e.g. a page ABOUT prompt injection) is mitigated by quarantine-not-drop + auditability.

### Content Trust Controls (TRUST-03 / CTX-03)
- **D-4b-07 [per-source-type Options controls]:** TRUST-03 ships as **per-source-type toggles** (`page`, `notes`, `memory`, `tool_result`) in a new Options section, persisted in chrome.storage (np_trust preference — exact shape = the agent's discretion). Default: page on, all others on-but-structural.
- **D-4b-08 [runtime enforcement in TrustPolicy]:** Trust filtering/quarantine happens **before `ContextItem[]` enters the optimizer** — the same TrustPolicy boundary as D-4b-02/04. Disabled source-type → its items are excluded (receipt `included: false`, `omitReason: 'trust_disabled'`).
- **D-4b-09 [trust-aware pageContext wiring]:** The 4a-unplugged `ContextOptimizerInput.pageContext` feed is wired here through the trust envelope: `PageContext` → `ContextItem[]` → `applyTrustPolicy` + classifier + source-type gates → converted to the `context` PromptSection (ContextPack). The hook still imports a core builder — Golden Rule 3, no prompt assembly in `useStreamingLLM.ts`.

### Context Receipt & Inspector Scope (CTX-03 / CTX-04)
- **D-4b-10 [receipt data, no UI]:** `ContextProvenanceManifest` extends with `ContextReceiptEntry[]` (C.1: `sourceId`, `included`, `originalTokens`, `finalTokens`, `compression?`, `cacheEligible`, `omitReason?`) covering every section: page, memory, tool_result, context, plus quarantine/trust decisions. Receipt is **in-memory per-turn only** in 4b (durable storage = Phase 6 AITransactionLog).
- **D-4b-11 [reconstruction contract]:** The receipt MUST be sufficient to reconstruct every packing decision **without re-running ContextOptimizer** — token counts, trust decisions, degradation steps, quarantine, source identifiers, instructionAuthority. PromptInspector becomes a Phase-6 visualization over data 4b already emits; 4b ships no UI (ROADMAP SC #2 "user can open a context receipt" is satisfied by the data being complete + inspectable, UI deferred).
- **D-4b-12 [stable-prefix snapshots (CTX-04)]:** Mandatory snapshot tests pin the byte-stable prefix — the cached `[SYSTEM]` block + policy wrap must be byte-identical across turns when inputs are equivalent. Lives in `tests/core/context/trust/**`.

### P1 Scope (CTX-05 / CTX-06)
- **D-4b-13 [CTX-05 structural seam only]:** Progressive skill disclosure = a structural seam only (metadata field on ContextItem/kind signaling disclosure readiness). Skills don't exist until Phase 8 — no real disclosure logic, irrelevant full instructions already consume zero tokens because skills aren't present. §18 4b lists "progressive skill disclosure" in create/modify — the seam satisfies it.
- **D-4b-14 [CTX-06 quality counters]:** Context-quality diagnostics = receipt-side quality counters (items screened, quarantined, per-trust-bucket counts, tokens) WITHOUT raw text. Emitted via the receipt/telemetry seam for Phase 6 diagnostics — no readout UI in 4b.

### the agent's Discretion
- Exact regex heuristic set for the injection classifier (D-4b-05).
- Exact `ContextItem[]` → `PromptSection[]` conversion mechanics inside ContextOptimizer/ContextPack (where in the pipeline the conversion + wrap happens precisely).
- Exact np_trust preference shape + storage key (chrome.storage sync/local; PreferenceMemoryStore precedent).
- Exact `ContextReceiptEntry[]` field wiring onto the existing manifest + Zod schema extension (GR-4).
- Where the context receipt reconstruction helper lives (co-located with the manifest vs TrustPolicy).
- `verify:phase-4b` script shape — spec §18 line 3684 gives `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection`; follow the §24 chain template (eslint + prettier + tsc + wxt build + vitest run) consistent with prior phases.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase 4b block (lines 2742–2750) — create/modify list (ContextItem, trust policy, context receipt, injection defences, stable-prefix snapshots, progressive skill disclosure), required tests (`tests/core/context/trust/**`, `tests/security/prompt-injection/**`), CTX-01..06 requirements, DONE-when (malicious fixtures cannot alter policy; Prompt Inspector reconstructs packing decisions).
- `.planning/PRODUCT_SPEC_v0_1.md` §28.3 "Trust-aware context requirements" (lines 3931–3938) — CTX-01..06 canonical text (source trust/authority metadata; retrieved data cannot redefine policy; manifest → receipt; stable-prefix snapshots; progressive skill disclosure; quality diagnostics without raw text).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 trust-aware types (lines 4877–4899) — `TrustLevel`, `ContextItem` (`kind` mirrors `PromptSection['kind']`), `ContextReceiptEntry`; type home `@/types/harness` (line 4837).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O.3 (lines 6433–6459) — **TrustPolicy.ts worked reference**: `AUTHORITY_BY_TRUST`, `applyTrustPolicy`, `<untrusted_data source=...>` wrap, `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` canonical code.
- `.planning/PRODUCT_SPEC_v0_1.md` §2.6 Context Provenance Manifest (lines 516–534) — the manifest the receipt extends; "so PromptInspector can display provenance without the raw body".
- `.planning/PRODUCT_SPEC_v0_1.md` §16.1 XSS Prevention (lines 1995–2003) — render-side XSS matrix (PortableMarkdown/DOMPurify, JSX data strings); the injection-screen is prompt-side, distinct surface.
- `.planning/PRODUCT_SPEC_v0_1.md` §0.5 Golden Rules + §0.2 (lines ~65–226) — GR-3 (all AI calls consume an OptimizedContext), GR-4 (Zod + one repair), GR-7 (retrieved data is never instructions), GR-9 (canonical codes), R-2, R-10.
- `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase-3 addendum (lines ~2655–2664) — canonical type-home seeds the 4b types extend IN PLACE (R-1); the authoritative record planners read.
- `.planning/PRODUCT_SPEC_v0_1.md` §22.2 + §26.1 (webpage 2,000-token budget; pageContext feeds ContextOptimizerInput) — the feed budget the trust-aware wiring honors.

### Project planning artifacts
- `.planning/ROADMAP.md` Phase 4b (lines 291–304) — goal, TRUST-01..03, success criteria (malicious fixtures cannot alter policy/inject; user can open a context receipt without raw text; user controls which sources feed the model; XSS screening + quarantine before AI context use).
- `.planning/REQUIREMENTS.md` TRUST-01..03 rows (lines 79–83) — **4b updates these per D-4b-00** (CTX-01..06 re-map note, AI-07 precedent).
- `.planning/phases/04-context-adaptive-execution/04-CONTEXT.md` — **D-04-01** (CTX id namespace disambiguation — 4b owns §28.3 CTX-01..06), **D-04-02** (CTX-02 typed input-only seam — no event bus, L1), D-04-12/15 (pageContext degradation no-op → 4b), D-04-17/18 (manifest + kind lockstep).
- `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-CONTEXT.md` — **D-4a-06** (pageContext feed unplugged → 4b), D-4a-01/03 (subscription-gated extraction, stale-safe coalescing — the feed's data source), deferred item (top-k / `compressionApplied:'topk'` model feed → 4b).
- `.planning/PRODUCT_SPEC_v0_1.md` §18 line 3684 — the `verify:phase-4b` script definition.
- `AGENTS.md` — 10 golden rules, risk register (R-1 no invented paths, R-3 panel/standalone-only, R-6 evolution gating, R-10 redaction), approved stack (`dompurify ^3` approved but render-side only in 4b).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/harness.ts` — the R-1 home; header explicitly declares ContextItem as the next extension point (lines 13–16). Add `TrustLevel`, `ContextItem`, `ContextReceiptEntry` verbatim (C.1) + co-located Zod schemas (GR-4, D-3a-20 precedent).
- `src/core/ai/types.ts` — `PromptSection` (line 134, the `kind` union ContextItem mirrors) + `ContextOptimizerInput` (line 150) with `pageContext?: PageContext` (line 158) + `memoryHints: RetrievedMemory[]` + `contextUpdate?: ContextUpdate` seam. Trust-aware feed wires into `pageContext`.
- `src/core/context/ContextProvenanceManifest.ts` — the manifest to extend into the receipt (add `ContextReceiptEntry[]`), header already names CTX-03 as its next extension. `ContextProvenanceManifestSchema` Zod gate (GR-4).
- `src/core/context/ContextOptimizer.ts` + `ContextPack.ts` — where `PageContext` → `context` section happens (ContextPack kind `'context'`, line 97); the TrustPolicy boundary (D-4b-02) slots before conversion. `compress-page` degradation step is currently a structural no-op (line 229).
- `src/core/content/PageContext.ts` — the C.1 `PageContext` type (url/origin/hostname/title/html/markdown/meta/extractedAt) — the source of the 4b `ContextItem[]` feed.
- `src/core/content/PageContextBridge.ts` + `src/core/runtime/RuntimeEnvelope.ts` — header comments explicitly defer kind/trust/instructionAuthority to "ContextItem in Phase 4b (§C.1)" — the transport carries none.
- `src/core/memory/types.ts` — `RetrievedMemory` (structural in 4b; no trust fields yet — Phase 5 fills).
- `src/core/security/TraceRedactor.ts` + `redactSensitive.ts` — R-10 redaction precedent for any receipt/log path (never raw text).
- `src/components/pages/useStreamingLLM.ts` — currently passes `pageContext: undefined, memoryHints: []` (lines 182–184) — the 4b wiring target (D-4b-09).
- `src/components/pages/OptionsPage.tsx` — existing settings Card sections (Account/Appearance) — the new content-trust section slots here (D-4b-07).

### Established Patterns
- **Spec-verbatim paths (§8.5/§18) + Appendix C types (R-1)** — ContextItem/TrustLevel/ContextReceiptEntry land in harness.ts verbatim; no invented identifiers.
- **Deterministic pure policy (O.3 verbatim)** — `applyTrustPolicy` precedent from O.3; zero model calls in trust evaluation.
- **Input-only seams (`onStreamDelta`/`onTransition`/`contextUpdate` precedent)** — the trust feed is an input to ContextOptimizer, never an event bus (L1).
- **Golden Rule 3** — the hook imports a core builder; the trust-aware pageContext wiring stays in core.
- **GR-4 / Zod fixtures** — every public boundary has a Zod fixture test; the extended manifest + ContextItem get schema gates.
- **F-5 byte-stable [SYSTEM] cache** — the `<untrusted_data>` wrap must never enter CACHED_KINDS; cache-stability tests (04-04 precedent) extended for the trust wrap.
- **R-10 redaction** — receipts/counters never persist raw sensitive text (CTX-06).
- **verify:phase-N gate** — §24 chain; verify:phase-4b per spec line 3684.

### Integration Points
- `ContextOptimizerInput.pageContext` — the feed seam: PageContext → ContextItem[] → TrustPolicy → classifier → gates → context section (D-4b-02/09).
- `ContextOptimizer`/`ContextPack` — conversion point where ContextItem[] becomes PromptSection[]; `compress-page` becomes real.
- `useStreamingLLM.ts` — replaces `pageContext: undefined` with the trust-aware feed; Golden Rule 3 intact.
- `OptionsPage.tsx` — new content-trust section (per-source-type toggles, np_trust).
- `ContextProvenanceManifestSchema` — extended with receipt entries; snapshot tests in `tests/core/context/trust/**`; injection classifier tests in `tests/security/prompt-injection/**`.
- R-3: everything runs in Side Panel/Standalone only; background SW untouched.
- Phase-6 seams: the receipt data + CTX-06 counters are the PromptInspector/diagnostics input.

</code_context>

<specifics>
## Specific Ideas

- **Through-line (user):** Phase 4b establishes trust decisions that are fully auditable and reproducible while preserving the Phase-4 guarantees — deterministic packing, byte-stable SYSTEM prompts, no prompt assembly in the hook, no model calls inside trust evaluation.
- **P4b-1 (user):** The ContextItem → PromptSection boundary is the Phase-4b equivalent of Phase 3a's "verifier → orchestrator → renderer" ownership decision — "if you don't define that ownership boundary early, trust logic tends to leak into multiple places later." TrustPolicy owns ALL trust logic; nothing else inspects `trust`/`instructionAuthority` (D-4b-02/04).
- **P4b-2 (user):** Quarantined items remain ContextItems only — they never become PromptSections; receipts record both included and excluded (D-4b-02/06).
- **P4b-3 (user):** Receipts are in-memory only in 4b; durable storage is Phase 6 (D-4b-10).
- **P4b-4 (user):** CTX-05/06 ship structural/minimal; skill-aware behavior stays blocked on Phase 8 (D-4b-13/14).

</specifics>

<deferred>
## Deferred Ideas

- **Per-source-ID trust controls** (per-site/page, per-note, per-memory-fact) — Phase 5+ when notes/memory exist (D-4b-07 lean).
- **Chat-embedded trust controls** (per-conversation chips/toggles) — Phase 7 RICH territory (D-4b-07 lean).
- **Full Prompt Inspector UI** — Phase 6 telemetry create-list (`src/core/telemetry/PromptInspector.ts`, spec line 2853); 4b emits the data only (D-4b-10/11).
- **Durable receipt storage / AITransactionLog** — Phase 6 (D-4b-10).
- **Real memory + tool_result as ContextItem feeds** — Phase 5 (memory) / Phase 8 (tool suite) (D-4b-01).
- **Real progressive skill disclosure** — Phase 8 when skills exist (D-4b-13).
- **DOMPurify in the core context pipeline** — not needed in 4b (markdown is text pre-optimizer); §16.1 render-side matrix covers UI (D-4b-05).

None — discussion stayed within phase scope; deferred items tracked above.

</deferred>

---

*Phase: 4b-Trust-Aware Context and Receipts*
*Context gathered: 2026-08-13*
