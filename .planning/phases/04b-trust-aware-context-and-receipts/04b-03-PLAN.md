---
phase: 04b-trust-aware-context-and-receipts
plan: 03
type: execute
wave: 2
depends_on: [04b-01]
files_modified:
  - src/core/context/trust/contextFeed.ts
  - src/core/context/contextReceipt.ts
  - src/core/context/ContextProvenanceManifest.ts
  - src/core/context/ContextOptimizer.ts
  - tests/fixtures/optimizedContext.ts
  - tests/core/context/trust/contextFeed.test.ts
  - tests/core/context/trust/contextReceipt.test.ts
  - tests/core/context/trust/qualityCounters.test.ts
autonomous: true
requirements: [TRUST-01, TRUST-03]
must_haves:
  truths:
    - "src/core/context/trust/contextFeed.ts exists (NEW): PAGE_BUDGET_TOKENS = 2_000 (§22.2/§26.5 webpage budget, RESEARCH Code Example 2) and pageToContextItems(page: PageContext): ContextItem[] fills the C.1 metadata deterministically — id 'page:<url>', kind 'context', trust 'retrieved', instructionAuthority false (CTX-01 MUST-be-false), relevance 1, freshness from page.extractedAt via a deterministic decay, sensitivity 'none', sourceId page.url; the §22.2 budget is enforced STRUCTURALLY at conversion (first paragraph + first heading, marked truncated) — never inside ContextOptimizer (D-04-13 no-slice gate, RESEARCH Pitfall 6)."
    - "Source-type gates (D-4b-08) run at the feed boundary: a disabled source kind excludes its items with the receipt recording included:false + omitReason 'trust_disabled' — the gates are applied via trustPrefs (TrustPrefs type from 04b-01) BEFORE items can become sections."
    - "src/core/context/contextReceipt.ts exists (NEW, RESEARCH recommended path src/core/context/): exports TrustedFeedResult { contextText, receipt: ContextReceiptEntry[], counters } and buildReceipt(...) deriving one ContextReceiptEntry per source item (all kinds enumerated — D-4b-01 future-proofing), with originalTokens = estimateTokens(item.text) pre-wrap, finalTokens = estimateTokens(wrappedText) when included and 0 when excluded, cacheEligible from the target section kind's stability (page→context→false), omitReason recorded for prompt_injection and trust_disabled (TrustOmitReason from 04b-01) — R-10: the receipt carries ids + token counts, NEVER raw text."
    - "ContextProvenanceManifest (src/core/context/ContextProvenanceManifest.ts) is extended IN PLACE (D-04-17/R-1) with receipt: ContextReceiptEntry[] and counters: { screened, quarantined, byTrust: Record<TrustLevel, number>, totalIncludedTokens } (CTX-06, D-4b-14) and ContextProvenanceManifestSchema is extended in lockstep (GR-4) — the D-04-18 union-parity test pattern still holds."
    - "Receipt reconstruction contract (D-4b-11): context section text recomputed from the receipt entries (included items joined in deterministic order with wrapped estimateTokens counts) EQUALS the packed section text WITHOUT re-running ContextOptimizer — pinned by a contextReceipt.test.ts reconstruction test (RESEARCH Pitfall 3 guard)."
    - "Token counting uses estimateTokens (TokenBudget) as the ONLY counter — never a hand-rolled second heuristic (manifest/pack token parity, RESEARCH Don't Hand-Roll)."
  artifacts:
    - "src/core/context/trust/contextFeed.ts (PAGE_BUDGET_TOKENS, pageToContextItems, gate filtering)"
    - "src/core/context/contextReceipt.ts (TrustedFeedResult, buildReceipt)"
    - "src/core/context/ContextProvenanceManifest.ts (receipt + counters + schema extension)"
    - "src/core/context/ContextOptimizer.ts (placeholder receipt/counters stamp — 04b-04 wires the trust stage)"
    - "tests/fixtures/optimizedContext.ts (provenance builder synced with the required fields)"
    - "tests/core/context/trust/contextFeed.test.ts, contextReceipt.test.ts, qualityCounters.test.ts"
  key_links:
    - "contextFeed output feeds 04b-04's optimizer trust stage: PageContext → ContextItem[] → classifier → quarantine → applyTrustPolicy → gates → contextText + receipt (D-4b-09 pipeline)."
    - "The manifest extension is consumed by ContextOptimizer provenance stamping (04b-04) — the receipt + counters ride the SAME OptimizedContext the hook already returns."
  flagged_assumptions:
    - "A3 [research, ASSUMED]: the §22.2 2,000-token page budget is enforced structurally at contextFeed conversion (first paragraph + first heading, truncated:true provenance), NOT via top-k selectRelevant (deferred to Phase 5a — RESEARCH Open Question 1 recommendation)."
    - "A5 [research, ASSUMED]: receipt token semantics — finalTokens = 0 for excluded items; originalTokens = pre-wrap estimateTokens; cacheEligible from target section kind stability (RESEARCH Pattern 2)."
    - "A6 [research, ASSUMED]: quarantined/disabled items are excluded from the packed contextText but enumerated in the receipt (ids + counts only — raw text NOT retained in the result; D-4b-06 'kept as ContextItem' means receipt-auditable, not turn-delivered)."
    - "A7 [research, ASSUMED]: relevance 1 + deterministic age-decay freshness (e.g. max(0, 1 - ageHours/24) — Open Question 4 recommended fixed curve, fixture-pinned) + sensitivity 'none' for the single-page feed."
    - "TRUST-01 [unresolved — spec-less probe, empty]: null/undefined pageContext → pageToContextItems yields [] (no context section emitted — hook guard in 04b-05); empty/whitespace markdown → single item with empty text is dropped at conversion so no zero-length context section is produced — pinned by an empty-markdown test in contextFeed.test.ts."
    - "TRUST-01 [unresolved — spec-less probe, encoding]: length/token semantics = JavaScript string length (UTF-16 code units) for the structural cap; token counts via the canonical estimateTokens heuristic (CJK ratio) — no byte-level or grapheme-level custom counting (04a precedent)."
  prohibitions:
    - "No raw text in receipts or counters — ids + token counts only (R-10, CTX-06); a receipt row never embeds the source body."
    - "No second token counter — estimateTokens is the ONLY counter (pack/manifest parity, RESEARCH Don't Hand-Roll)."
    - "No slice/substring of page text inside ContextOptimizer — the §22.2 cap happens in contextFeed only (D-04-13, RESEARCH Pitfall 6)."
---

<!-- 04b-03 (2026-08-13): Wave-2 feed + receipt layer. contextFeed converts the
     4a PageContext into trust-carrying ContextItem[] (CTX-01 metadata + §22.2
     structural cap + D-4b-08 source gates); contextReceipt builds the
     reconstruction-sufficient receipt + CTX-06 counters; the manifest is
     extended IN PLACE (R-1, D-04-17). Parallel to 04b-02 (no shared files). -->

<objective>
Ship the page-feed conversion and the context-receipt layer: `contextFeed.pageToContextItems` (CTX-01 metadata fill, §22.2 structural budget cap, D-4b-08 source-type gates), `contextReceipt.buildReceipt` (reconstruction-sufficient `ContextReceiptEntry[]` + CTX-06 counters, R-10), and the in-place `ContextProvenanceManifest` extension (receipt + counters + Zod schema, GR-4).

Purpose: D-4b-01/02/10/11/14 — the page-only feed becomes trust-carrying ContextItem[], and the manifest becomes a receipt sufficient to reconstruct every packing decision without re-running the optimizer (Phase 6 PromptInspector consumes it).

Output: contextFeed.ts + contextReceipt.ts + manifest extension + 3 test files green.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-CONTEXT.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-RESEARCH.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-PATTERNS.md
@src/core/context/ContextProvenanceManifest.ts
@src/core/content/PageContext.ts
@src/core/context/TokenBudget.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: contextFeed.ts — PageContext → ContextItem[] with budget cap + source gates</name>
  <files>src/core/context/trust/contextFeed.ts, tests/core/context/trust/contextFeed.test.ts</files>
  <read_first>
    - src/core/content/PageContext.ts (the C.1 PageContext type — url/origin/hostname/title/html/markdown/meta/extractedAt fields)
    - src/types/harness.ts (ContextItem/TrustPrefs from 04b-01)
    - src/core/context/TokenBudget.ts (estimateTokens — the ONLY counter)
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-RESEARCH.md (Code Example 2 L398-425 — the feed shape; Common Pitfalls Pitfall 6 — cap at conversion, never in the optimizer)
  </read_first>
  <action>
    Create src/core/context/trust/contextFeed.ts (NEW). Header comment: D-4b-01/04/08, §22.2 budget (spec L3581/L3794), D-04-13 no-slice-in-optimizer rule (cap lives HERE), determinism (no Date.now — freshness uses injected/derived deterministic decay).
    - `export const PAGE_BUDGET_TOKENS = 2_000;`
    - `export function pageToContextItems(page: PageContext): ContextItem[]` — returns [] when page is null/undefined or markdown is empty/whitespace (TRUST-01 empty probe resolution); otherwise builds ONE ContextItem: id `page:${page.url}`, kind 'context', text = structural cap (first paragraph + first heading, marked truncated — see capToBudget below), tokens = estimateTokens(text), trust 'retrieved', instructionAuthority false (CTX-01), relevance 1, freshness = deterministic decay from page.extractedAt (document the fixed curve, e.g. max(0, 1 - ageHours/24) with a clamped 0..1 result — Open Question 4 recommendation; fixture-pinned), sensitivity 'none', sourceId page.url, disclosureReady absent (CTX-05 seam is type-level only, D-4b-13).
    - A module-internal `capToBudget(markdown: string, budgetTokens: number): { text: string; truncated: boolean }` implementing the structural §22.2 fallback deterministically: keep the first paragraph + first heading; when estimateTokens exceeds budget, truncate at a PARAGRAPH boundary (never mid-sentence/mid-token — D-04-13 whole-structure rule) and mark truncated:true. Export a small marker type if a test needs the truncated flag, otherwise keep internal and test through pageToContextItems.
    - `export function applySourceGates(items: ContextItem[], prefs: TrustPrefs): { included: ContextItem[]; excluded: Map<string, { reason: TrustOmitReason }> }` — per D-4b-08: map each item's kind to its prefs key (context → prefs.page; memory → prefs.memory; tool_result → prefs.tool_result; others default-included); disabled kind → excluded map keyed by item.id with value `{ reason: 'trust_disabled' }`. The map value is the SAME structured `{ reason: TrustOmitReason }` shape buildReceipt consumes (TrustOmitReason from 04b-01 harness.ts, `TrustOmitReasonSchema = z.enum(['prompt_injection','trust_disabled'])`) — the gate output feeds the receipt input with NO conversion (D-4b-06/08 contract-aligned).

    Create tests/core/context/trust/contextFeed.test.ts (deterministic fixtures — FIXED_TIMESTAMP/FIXED_URL convention from tests/fixtures/pageContent.ts, no Date.now):
    - pageToContextItems fills trust 'retrieved' + instructionAuthority false + relevance 1 + sensitivity 'none' + sourceId page.url (CTX-01).
    - §22.2 cap: an over-budget fixture (large markdown) yields text within PAGE_BUDGET_TOKENS with the truncated marker; a small fixture yields full text, not truncated.
    - Empty/null page + empty markdown → [] (TRUST-01 empty probe).
    - Determinism: same page twice → deep-equal ContextItem[].
    - applySourceGates: prefs { page: false, ... } → the excluded map holds the item id with value { reason: 'trust_disabled' }; prefs page:true → included; kind with no prefs key (e.g. 'system' item in a future feed) → default-included.
    - Freshness: pinned expected value for a fixed extractedAt (deterministic curve — no Date.now).
  </action>
  <acceptance_criteria>
    - contextFeed.ts contains `export const PAGE_BUDGET_TOKENS = 2_000` and `export function pageToContextItems` and `export function applySourceGates`.
    - pageToContextItems emits instructionAuthority:false + trust 'retrieved' for every item (CTX-01).
    - contextFeed.ts contains NO `chrome.` reference and no model/SDK import; estimateTokens is the only token counter used.
    - contextFeed.test.ts exits 0 with `pnpm vitest run tests/core/context/trust/contextFeed.test.ts --bail=1`.
    - `pnpm exec tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/context/trust/contextFeed.test.ts --bail=1</automated>
  </verify>
  <done>pageToContextItems + applySourceGates ship with §22.2 structural cap, CTX-01 metadata, and D-4b-08 gates; empty-input + determinism + budget cases pinned.</done>
</task>

<task type="auto">
  <name>Task 2: contextReceipt.ts builder + ContextProvenanceManifest in-place extension</name>
  <files>src/core/context/contextReceipt.ts, src/core/context/ContextProvenanceManifest.ts, src/core/context/ContextOptimizer.ts, tests/fixtures/optimizedContext.ts, tests/core/context/trust/contextReceipt.test.ts, tests/core/context/trust/qualityCounters.test.ts</files>
  <read_first>
    - src/core/context/ContextProvenanceManifest.ts (the in-place extension target — interface L38-70 + ContextProvenanceManifestSchema L79-107; header L5 already names CTX-03 as the next extension)
    - src/types/harness.ts (ContextReceiptEntry, ContextItem, TrustLevel, TrustOmitReason from 04b-01)
    - src/core/context/TokenBudget.ts (estimateTokens)
    - src/core/context/ContextOptimizer.ts (L291 provenance literal — the producer to stamp with placeholders)
    - tests/fixtures/optimizedContext.ts (L208 provenance builder — the fixture producer to sync)
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-RESEARCH.md (Code Example 3 L428-452 — the TrustedFeedResult/buildReceipt recommended shape; Pattern 2 token semantics; Common Pitfalls Pitfall 3 — receipt divergence guard)
  </read_first>
  <action>
    Create src/core/context/contextReceipt.ts (NEW; RESEARCH recommended path src/core/context/contextReceipt.ts — the receipt TYPE + schema stay in the manifest module R-1; the BUILDER lives here, next to the decisions it consumes — Open Question 2 resolution). Header comment: D-4b-10/11/14, R-10 (ids + counts, never raw text), estimateTokens-only counting.
    - `export interface TrustedFeedResult { contextText: string; receipt: ContextReceiptEntry[]; counters: { screened: number; quarantined: number; byTrust: Record<TrustLevel, number>; totalIncludedTokens: number }; }` — byTrust keys exactly the 5 TrustLevel members.
    - `export function buildReceipt(items: ContextItem[], decisions: { excluded: Map<string, { reason: TrustOmitReason }> }, kindStable: (kind: ContextItem['kind']) => boolean, screened: number, quarantined: number): TrustedFeedResult` — `decisions.excluded` values are `{ reason: TrustOmitReason }` (exactly 'prompt_injection' | 'trust_disabled'); BOTH producers share this exact map shape — applySourceGates emits it (trust_disabled) and the 04b-04 quarantine stage writes the same shape (prompt_injection) — so buildReceipt consumes one structured map with no conversion:
      - one ContextReceiptEntry per input item (included AND excluded — D-4b-06 no-silent-drop; all kinds enumerated D-4b-01): sourceId, included (false when in decisions.excluded), originalTokens = estimateTokens(item.text) pre-wrap, finalTokens = estimateTokens(wrappedText) when included else 0 (A5 semantics), compression from the item/feed (e.g. 'structural' when the feed marked truncated — the field is optional), cacheEligible = kindStable(item.kind) (page→context section→false), omitReason when excluded ('prompt_injection' | 'trust_disabled').
      - contextText = included items joined in DETERMINISTIC input order (preserved — TRUST-02 ordering probe resolution; no dedup/merge).
      - counters: screened = items passed through the classifier (the value the optimizer supplies), quarantined = items excluded with omitReason 'prompt_injection', byTrust counts per TrustLevel across the INPUT items, totalIncludedTokens = sum of finalTokens for included items.

    Extend src/core/context/ContextProvenanceManifest.ts IN PLACE (R-1/D-04-17 — do NOT relocate or rename existing fields):
    - Interface gains `receipt: ContextReceiptEntry[];` and `counters: { screened: number; quarantined: number; byTrust: Record<TrustLevel, number>; totalIncludedTokens: number };` (import type { ContextReceiptEntry, TrustLevel } from '@/types/harness').
    - ContextProvenanceManifestSchema gains the matching `receipt: z.array(ContextReceiptEntrySchema)` (import ContextReceiptEntrySchema from '@/types/harness') and `counters: z.object({ screened: z.number().int().nonnegative(), quarantined: z.number().int().nonnegative(), byTrust: z.record(TrustLevelSchema, z.number().int().nonnegative()), totalIncludedTokens: z.number().int().nonnegative() })` — GR-4 lockstep.

    **SYNC BOTH SURVIVING PRODUCERS IN THE SAME TASK** (04-03 precedent — the new fields are REQUIRED; without both syncs, `pnpm typecheck` fails at every boundary until 04b-04 wires the real trust stage):
    - `tests/fixtures/optimizedContext.ts` (L208 provenance builder): add `receipt: []` and zeroed `counters: { screened: 0, quarantined: 0, byTrust: { system: 0, user: 0, tool: 0, retrieved: 0, untrusted: 0 }, totalIncludedTokens: 0 }` — deterministic constants; the fixture's manifest stays schema-valid (ContextProvenanceManifest.test.ts positive gate keeps passing).
    - `src/core/context/ContextOptimizer.ts` (L291 provenance literal): stamp PLACEHOLDER values so the module compiles against the extended interface until 04b-04 (depends_on this plan) replaces them with the real trust-stage output: `receipt: []` + the same zeroed counters literal, with a comment: "placeholder — 04b-04 (trust stage) stamps the real receipt/counters". Do NOT wire the trust stage here (04b-04 owns that); this stamp exists ONLY to keep tsc green at every task boundary.

    Create tests/core/context/trust/contextReceipt.test.ts:
    - Reconstruction contract (D-4b-11/Pitfall 3): build a feed via contextFeed.pageToContextItems + applySourceGates + a minimal local wrap step (construct the wrapped item text in the test with the EXACT O.3 wrap format `\`<untrusted_data source="${id}">\n${text}\n</untrusted_data>\`` — stay plan-local; 04b-02 is a parallel wave-2 plan so no cross-plan import), then buildReceipt; recompute contextText from the receipt's included entries and assert it EQUALS the packed contextText (and the section text 04b-04 would emit).
    - Quarantined row: excluded with omitReason 'prompt_injection' → included:false, finalTokens 0, row present (no silent drop).
    - Disabled row: omitReason 'trust_disabled' → included:false.
    - R-10: the receipt array and counters contain no source text — assert every entry's serialized JSON lacks the source body substring.
    - Cache eligibility: page-kind item → cacheEligible false (kindStable(context) → false); a memory-kind item → true (kindStable(memory) → true) — proves the CACHED_KINDS-driven fn.
    - Token semantics: originalTokens = estimateTokens(pre-wrap text); finalTokens = estimateTokens(wrapped) when included; 0 when excluded.

    Create tests/core/context/trust/qualityCounters.test.ts (CTX-06, D-4b-14):
    - Extended ContextProvenanceManifestSchema parses a manifest carrying receipt + counters (positive gate).
    - Counters shape: screened/quarantined/byTrust (5 keys)/totalIncludedTokens present and numeric.
    - R-10: counters contain no page text (assert JSON of counters lacks the source body).
  </action>
  <acceptance_criteria>
    - contextReceipt.ts contains `export interface TrustedFeedResult` and `export function buildReceipt`.
    - ContextProvenanceManifest.ts contains `receipt: ContextReceiptEntry[]` in the interface and `receipt: z.array(ContextReceiptEntrySchema)` in the schema; the existing manifest fields are UNCHANGED.
    - contextReceipt.ts uses estimateTokens only for token counting and never embeds item.text into receipt/counters (R-10 — grep the file for `text` appearing only in estimateTokens calls).
    - tests/fixtures/optimizedContext.ts provenance builder emits `receipt: []` + zeroed counters (deterministic constants); ContextOptimizer.ts provenance literal stamps the same placeholders with the 04b-04 comment — `pnpm exec tsc --noEmit` passes at THIS task boundary (04-03 precedent).
    - contextReceipt.test.ts + qualityCounters.test.ts exit 0 with `pnpm vitest run tests/core/context/trust/contextReceipt.test.ts tests/core/context/trust/qualityCounters.test.ts --bail=1`.
    - `pnpm vitest run tests/core/context/ContextProvenanceManifest.test.ts --bail=1` still passes (existing manifest test positive gate uses the synced fixture).
    - `pnpm vitest run tests/core/context/ContextOptimizer.test.ts --bail=1` still passes (placeholder receipt/counters keep the stamped manifests schema-valid).
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec tsc --noEmit && pnpm vitest run tests/core/context/trust/contextReceipt.test.ts tests/core/context/trust/qualityCounters.test.ts tests/core/context/ContextProvenanceManifest.test.ts tests/core/context/ContextOptimizer.test.ts --bail=1</automated>
  </verify>
  <done>buildReceipt + TrustedFeedResult ship (reconstruction contract pinned, R-10 clean); manifest + schema extended in lockstep; BOTH producers (fixture + ContextOptimizer placeholder) synced so tsc stays green at every boundary.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| PageContext (4a extraction) → contextFeed | untrusted page markdown crosses into the trust envelope here — metadata is stamped, budget is capped |
| contextReceipt → manifest | per-item decisions (included/excluded, tokens) cross into the emitted manifest — must be reconstruction-faithful and raw-text-free |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4b-08 | Tampering | source-type gates (applySourceGates in contextFeed.ts) | medium | mitigate | D-4b-08 enforcement at the feed boundary: a disabled source kind is excluded BEFORE conversion with a recorded omitReason 'trust_disabled' (receipt included:false) — never silently passing an undesired source into the model; TrustPrefs arrives Zod-validated (04b-01) so a malformed pref cannot bypass a gate. |
| T-4b-07 | Information Disclosure | contextReceipt.ts + counters (CTX-06) | medium | mitigate | R-10 structural: receipt rows carry sourceId + token counts + decisions, NEVER the source body; counters carry counts only; the R-10 test asserts the serialized receipt/counters lack the source text; debugLog paths redact automatically. |
| T-4b-09 | Tampering | manifest extension (ContextProvenanceManifest.ts) | medium | mitigate | Additive in-place extension (R-1/D-04-17) with a Zod gate extended in lockstep (GR-4) — the D-04-18 runtime union-parity test (existing) plus the new positive-gate test ensure receipt/counters shape cannot drift from the emitted manifest; a malformed manifest fails SCHEMA_INVALID at the optimizer stamp site (04b-04). |
| T-4b-01 | Tampering | feed → receipt trust chain | high | mitigate | CTX-01 metadata stamped at conversion (instructionAuthority:false, trust 'retrieved'); the receipt enumerates EVERY item incl. excluded (D-4b-06 no-silent-drop) so a quarantine/disable decision is always auditable; the wrap + authority strip (04b-02) remain the boundary for content that does pass. |
</threat_model>

<verification>
- `pnpm vitest run tests/core/context/trust/contextFeed.test.ts --bail=1` green.
- `pnpm vitest run tests/core/context/trust/contextReceipt.test.ts tests/core/context/trust/qualityCounters.test.ts --bail=1` green.
- `pnpm vitest run tests/core/context/ContextProvenanceManifest.test.ts --bail=1` still green (additive extension regression, fixture synced).
- `pnpm vitest run tests/core/context/ContextOptimizer.test.ts --bail=1` still green (placeholder stamp keeps stamped manifests schema-valid).
- `pnpm exec tsc --noEmit` green AT EVERY TASK BOUNDARY — both surviving producers (fixture + ContextOptimizer placeholder) are synced in Task 2 (04-03 precedent; 04b-04 replaces the placeholder with the real trust-stage output).
</verification>

<success_criteria>
- pageToContextItems + applySourceGates ship (CTX-01 metadata, §22.2 structural cap at conversion — D-04-13 honored, D-4b-08 gates).
- buildReceipt + TrustedFeedResult ship with the A5 token semantics and the D-4b-11 reconstruction contract pinned (Pitfall 3 guard).
- Manifest + schema extended in lockstep (GR-4), existing manifest tests green.
- CTX-06 counters present, raw-text-free (R-10).
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-and-receipts/04b-03-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- `src/core/context/trust/contextFeed.ts` — `PAGE_BUDGET_TOKENS` (2_000), `pageToContextItems(page: PageContext): ContextItem[]`, `applySourceGates(items, prefs): { included, excluded: Map<string, { reason: TrustOmitReason }> }`, internal `capToBudget(markdown, budgetTokens): { text, truncated }`
- `src/core/context/contextReceipt.ts` — `TrustedFeedResult` (interface), `buildReceipt(items, decisions, kindStable, screened, quarantined): TrustedFeedResult`
- `src/core/context/ContextProvenanceManifest.ts` — interface fields `receipt: ContextReceiptEntry[]`, `counters: {...}`; schema fields `receipt`, `counters` (Zod)
- `src/core/context/ContextOptimizer.ts` — placeholder `receipt: []` + zeroed `counters` in the provenance literal (04b-04 replaces with the real trust-stage output)
- `tests/fixtures/optimizedContext.ts` — provenance builder emits `receipt: []` + zeroed counters (fixture sync)
- `tests/core/context/trust/contextFeed.test.ts`
- `tests/core/context/trust/contextReceipt.test.ts`
- `tests/core/context/trust/qualityCounters.test.ts`
