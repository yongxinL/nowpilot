# Phase 4b: Trust-Aware Context and Receipts — Research

**Researched:** 2026-08-13
**Domain:** LLM context trust boundary · deterministic prompt-injection screening · context receipts · cache-stable prompt prefixes · content-trust preferences
**Confidence:** HIGH (spec-bound core) / MEDIUM (classifier heuristics, storage shape)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-4b-00 [TRUST→CTX re-map]:** REQUIREMENTS.md TRUST-01..03 rows map to the spec §28.3 CTX-01..06 namespace (Phase 4b owns those ids per D-04-01). AI-07-style re-map note added: TRUST-01 = CTX-01/02, TRUST-02 = CTX-02 injection defences, TRUST-03 = CTX-03 controls. CTX-05/06 are P1 → structural (D-4b-11/12).
- **D-4b-01 [page-only ContextItem feed]:** `PageContext` (4a) → `ContextItem[]` is the only real data feed in 4b. RetrievedMemory and tool_result stay structural no-ops (memory data lands in Phase 5; tool_result already carries `trust:false` via its kind). Receipts still enumerate all three kinds so the envelope is future-proof.
- **D-4b-02 [ContextItem → PromptSection boundary]:** `ContextItem` is the trust-carrying input buffer; `PromptSection` is the model-consumable output. **TrustPolicy operates entirely on `ContextItem[]`**; only trusted/re-written items become `PromptSection[]`. Quarantined items remain ContextItems only (never become sections). Receipts record both included and excluded items.
- **D-4b-03 [policy purity]:** `TrustPolicy` is deterministic and pure — never mutates SYSTEM content, never calls a model. The `<untrusted_data source=...>` wrap (O.3) must not disturb the byte-stable cached `[SYSTEM]` persona block (F-5 cache eligibility; CACHED_KINDS untouched).
- **D-4b-04 [applyTrustPolicy placement]:** `applyTrustPolicy(items: ContextItem[]): ContextItem[]` runs at the feed boundary BEFORE conversion to sections (O.3 verbatim, `AUTHORITY_BY_TRUST` map). Items whose `trust` is `retrieved`/`untrusted`/`tool` get `instructionAuthority: false` + the `<untrusted_data>` wrap. The `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` code (O.3) is the canonical error for an attempt to redefine policy via retrieved content.
- **D-4b-05 [deterministic classifier]:** Prompt-injection screening = a deterministic, dependency-free heuristic classifier (regex patterns for "ignore previous instructions", system-prompt redefinition, tool/permission-grant attempts) that CLASSIFIES items. Zero LLM, zero model calls. No DOMPurify in the core pipeline in 4b (page markdown is text by the time it reaches the optimizer; §16.1 XSS matrix covers render-side).
- **D-4b-06 [quarantine-not-drop]:** On a detection hit the item is **quarantined** — kept as a `ContextItem`, wrapped + flagged (`omitReason: 'prompt_injection'` recorded in the receipt), never dropped silently and never converted to a `PromptSection`. Receipt records the quarantine decision so it is auditable. Risk: over-blocking legitimate content (e.g. a page ABOUT prompt injection) is mitigated by quarantine-not-drop + auditability.
- **D-4b-07 [per-source-type Options controls]:** TRUST-03 ships as **per-source-type toggles** (`page`, `notes`, `memory`, `tool_result`) in a new Options section, persisted in chrome.storage (np_trust preference — exact shape = the agent's discretion). Default: page on, all others on-but-structural.
- **D-4b-08 [runtime enforcement in TrustPolicy]:** Trust filtering/quarantine happens **before `ContextItem[]` enters the optimizer** — the same TrustPolicy boundary as D-4b-02/04. Disabled source-type → its items are excluded (receipt `included: false`, `omitReason: 'trust_disabled'`).
- **D-4b-09 [trust-aware pageContext wiring]:** The 4a-unplugged `ContextOptimizerInput.pageContext` feed is wired here through the trust envelope: `PageContext` → `ContextItem[]` → `applyTrustPolicy` + classifier + source-type gates → converted to the `context` PromptSection (ContextPack). The hook still imports a core builder — Golden Rule 3, no prompt assembly in `useStreamingLLM.ts`.
- **D-4b-10 [receipt data, no UI]:** `ContextProvenanceManifest` extends with `ContextReceiptEntry[]` (C.1: `sourceId`, `included`, `originalTokens`, `finalTokens`, `compression?`, `cacheEligible`, `omitReason?`) covering every section: page, memory, tool_result, context, plus quarantine/trust decisions. Receipt is **in-memory per-turn only** in 4b (durable storage = Phase 6 AITransactionLog).
- **D-4b-11 [reconstruction contract]:** The receipt MUST be sufficient to reconstruct every packing decision **without re-running ContextOptimizer** — token counts, trust decisions, degradation steps, quarantine, source identifiers, instructionAuthority. PromptInspector becomes a Phase-6 visualization over data 4b already emits; 4b ships no UI.
- **D-4b-12 [stable-prefix snapshots (CTX-04)]:** Mandatory snapshot tests pin the byte-stable prefix — the cached `[SYSTEM]` block + policy wrap must be byte-identical across turns when inputs are equivalent. Lives in `tests/core/context/trust/**`.
- **D-4b-13 [CTX-05 structural seam only]:** Progressive skill disclosure = a structural seam only (metadata field on ContextItem/kind signaling disclosure readiness). Skills don't exist until Phase 8 — no real disclosure logic.
- **D-4b-14 [CTX-06 quality counters]:** Context-quality diagnostics = receipt-side quality counters (items screened, quarantined, per-trust-bucket counts, tokens) WITHOUT raw text. Emitted via the receipt/telemetry seam for Phase 6 diagnostics — no readout UI in 4b.

### the agent's Discretion
- Exact regex heuristic set for the injection classifier (D-4b-05).
- Exact `ContextItem[]` → `PromptSection[]` conversion mechanics inside ContextOptimizer/ContextPack (where in the pipeline the conversion + wrap happens precisely).
- Exact np_trust preference shape + storage key (chrome.storage sync/local; PreferenceMemoryStore precedent).
- Exact `ContextReceiptEntry[]` field wiring onto the existing manifest + Zod schema extension (GR-4).
- Where the context receipt reconstruction helper lives (co-located with the manifest vs TrustPolicy).
- `verify:phase-4b` script shape — spec §18 line 3684 gives `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection`; follow the §24 chain template (eslint + prettier + tsc + wxt build + vitest run) consistent with prior phases.

### Deferred Ideas (OUT OF SCOPE)
- Per-source-ID trust controls (per-site/page, per-note, per-memory-fact) — Phase 5+ (D-4b-07 lean).
- Chat-embedded trust controls (per-conversation chips/toggles) — Phase 7 RICH territory (D-4b-07 lean).
- Full Prompt Inspector UI — Phase 6 telemetry create-list; 4b emits the data only (D-4b-10/11).
- Durable receipt storage / AITransactionLog — Phase 6 (D-4b-10).
- Real memory + tool_result as ContextItem feeds — Phase 5 (memory) / Phase 8 (tool suite) (D-4b-01).
- Real progressive skill disclosure — Phase 8 when skills exist (D-4b-13).
- DOMPurify in the core context pipeline — not needed in 4b; §16.1 render-side matrix covers UI (D-4b-05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRUST-01 (CTX-01/02) | Content sources carry trust/authority metadata (`instructionAuthority: false` for retrieved); retrieved data can never redefine policy | C.1 types land verbatim in `@/types/harness` (L4877-4899); O.3 `AUTHORITY_BY_TRUST` + `applyTrustPolicy` verbatim (L6433-6459); OWASP LLM01 prevention #6 provenance-labeled channel |
| TRUST-02 (CTX-02) | XSS-risk screening + prompt-injection quarantine before AI context use | Deterministic regex classifier (D-4b-05) + quarantine-not-drop (D-4b-06) + invisible-Unicode strip (OWASP LLM01 #5); `tests/security/prompt-injection/**`; OWASP #3 filters evadable → authority strip is the real boundary |
| TRUST-03 (CTX-03/04) | User controls which sources feed the model; manifest → context receipt; stable-prefix snapshots | np_trust per-source toggles (D-4b-07/08, UI-SPEC contract locked); receipt extends `ContextProvenanceManifest` in place (D-04-17, §2.6 L516-534); snapshot tests pin byte-stable `[SYSTEM]` (Anthropic caching: exact-prefix byte matching, any cached-block change = full re-write) |
| CTX-05 (P1, D-4b-13) | Progressive skill disclosure structural seam | Metadata field on ContextItem/kind; no logic until Phase 8 |
| CTX-06 (P1, D-4b-14) | Context-quality diagnostics without raw text | Receipt-side counters (screened/quarantined/per-trust-bucket/tokens); R-10 redaction; no UI |
</phase_requirements>

## Summary

Phase 4b makes retrieved content structurally unable to instruct the model. The security boundary is **not** a filter — it is the **O.3 trust envelope**: every `ContextItem` carries `trust` + `instructionAuthority`, and `applyTrustPolicy` strips authority and wraps untrusted text in `<untrusted_data source=...>` **before** it becomes a `PromptSection`. OWASP GenAI LLM Top 10 2026 LLM01 confirms the architecture: "no reliable prevention mechanism exists… defense is architectural rather than interceptive" — the provenance-labeled channel (prevention #6) is exactly the O.3 wrap, and the deterministic regex classifier is a screening **extra** (prevention #3, explicitly evadable), never the boundary. This is the layered story the tests must pin: even a classifier miss is rendered inert by the authority strip.

The phase is almost entirely spec-bound and in-repo-precedented: `TrustLevel`/`ContextItem`/`ContextReceiptEntry` land **verbatim** in `@/types/harness` (C.1 L4877-4899), `TrustPolicy.ts` is the **O.3 worked reference verbatim** (L6433-6459), the receipt extends `ContextProvenanceManifest` in place (D-04-17/R-1), the trust feed wires the 4a-unplugged `ContextOptimizerInput.pageContext` (D-4a-06) at the `buildPackInput` seam inside `ContextOptimizer.optimize()` — the hook stays a Golden-Rule-3 import-only consumer. Zero new npm packages; `tests/security/` is a brand-new top-level test dir; `np_trust` needs a one-line `Setting.ts` registry addition.

**Primary recommendation:** Implement the trust pipeline as a pure, synchronous, zero-model-call stage *inside* `ContextOptimizer.optimize()` between input and `packSections` (`PageContext → ContextItem[] → classifier → quarantine → applyTrustPolicy → source gates → contextText + receipt`). The hook resolves the two async inputs (current `PageContext` from `WorkspaceStore`, `np_trust` prefs via a personaConfig-style accessor) and passes them in; the optimizer stays deterministic. Receipts and CTX-06 counters ride the manifest extension in memory per turn. Everything is verifiable via `tests/core/context/trust/**` + `tests/security/prompt-injection/**`.

## Project Constraints (from AGENTS.md)

- **One phase per response; never jump ahead.** 4b implements only the §18 Phase-4b block + §28.3 CTX-01..06. No Phase-5/6/7/8 features (receipts are data-only; inspector UI is Phase 6; real memory feeds are Phase 5).
- **Never invent identifiers (Golden Rule 2).** File paths from §8.5/§18; types from Appendix C (`@/types/harness` — `ContextItem`, `TrustLevel`, `ContextReceiptEntry`); canonical codes from §C.2 (`CONTEXT_INSTRUCTION_INJECTION_BLOCKED` is the only new code — mirror in `errorCodes.ts`); runtime tiers exactly `'haiku' | 'flash'`; provider IDs unchanged.
- **All prompts through the pipeline (GR-3).** No React component/hook assembles prompts. The hook imports core builders; the trust-aware pageContext wiring lives in core.
- **Structured output = Zod + one repair (GR-4).** Every public boundary gets a co-located Zod schema (`ContextItemSchema`, `ContextReceiptEntrySchema`, `TrustPrefsSchema`, extended `ContextProvenanceManifestSchema`). Zod 3 API only — the registry's zod 4.4.3 latest tag is NOT adopted (project locks `^3.25.76`; harness.ts comment "zod 3 API only").
- **Retrieved data is never instructions (GR-7).** `trust: 'retrieved'|'untrusted'` + `instructionAuthority: false` on every retrieved item.
- **Every catch calls `debugLog(code, …)` (GR-9).** No new free-form error strings; new canonical code goes in `errorCodes.ts` with a spec-mirror note (W-1 gate precedent).
- **Risk R-1:** no invented module path for the types — they extend `src/types/harness.ts` IN PLACE (its header already declares ContextItem as the next extension point, L13-16).
- **Risk R-2:** no nested retries; trust evaluation adds zero model calls (the 2-call/healthy-turn invariant survives).
- **Risk R-3:** AI + IndexedDB live in Side Panel/Standalone only. Background SW untouched — the trust preference is a plain storage write from Options (Standalone surface).
- **Risk R-9:** no banned packages; no new packages at all (regex classifier is dependency-free).
- **Risk R-10:** TraceRedactor on every sensitive flow; receipts/counters never persist raw text (CTX-06).
- **Approved stack only:** the phase uses antd `Switch` (verified exported in installed 6.5.3), zustand ^5, immer ^10, zod ^3 — all already installed. **Banned list unchanged** (no tailwind/shadcn/react-markdown).
- **verify:phase-N gate:** not done until `verify:phase-4b` passes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trust/authority metadata (CTX-01) | Core (`src/core/context/trust/**`, `@/types/harness`) | — | R-1 home; spec C.1/O.3 verbatim; pure types, no UI |
| Authority stripping + `<untrusted_data>` wrap (CTX-02) | Core (`TrustPolicy.applyTrustPolicy`) | — | O.3 verbatim; zero model calls; must run before section conversion |
| Injection classification + quarantine (TRUST-02) | Core (deterministic screener) | Tests (`tests/security/prompt-injection/**`) | Dependency-free regex; quarantine recorded in receipt only |
| Context receipt + quality counters (CTX-03/06) | Core (`ContextProvenanceManifest` extension) | Phase 6 PromptInspector (visualization over same data) | 4b emits data in memory; no UI in 4b |
| Source-type gates (TRUST-03) | Core (TrustPolicy boundary, reads `np_trust` passed in) | Options UI writes the preference only | GR-3: UI persists a preference; enforcement is core-side |
| Content-trust Options card | Browser (OptionsPage.tsx, Standalone) | Core preference store/accessor | Settings chrome; auto-save write-through; no prompt assembly |
| Stable-prefix `[SYSTEM]` cache (CTX-04) | Core (ContextPack/ProviderRouter `CACHED_KINDS`) | — | F-5 byte-stability; TrustPolicy must never touch system sections |
| Hook wiring (D-4b-09) | Frontend (useStreamingLLM.ts) | Core optimizer | Hook resolves async inputs (page + prefs) and passes them in; optimizer stays pure |

## Standard Stack

### Core

No new runtime libraries. All capabilities are implemented with the existing approved stack ([VERIFIED: in-repo — AGENTS.md Approved Stack §7 and package.json]).

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| zod | ^3.25.76 (zod 3 API) | Zod gates: `ContextItemSchema`, `ContextReceiptEntrySchema`, `TrustPrefsSchema`, manifest extension | GR-4; ProviderConfigSchema/PersonaProfileSchema precedent |
| zustand | ^5.0.14 | Content-trust preference store (Options side) | AddonSettingsStore precedent (plain zustand + chrome.storage.local write-through) |
| immer | ^10.2.0 | Immutable store writes | AddonSettingsStore `produce` precedent |
| antd | ^6.5.3 | `Switch` only (4 toggle rows) | UI-SPEC locks one component; verified exported from `antd/es/switch` |
| @ant-design/icons | ^6 | Not used in 4b | UI-SPEC: no icon surfaces in the trust card |
| vitest | ^4.1.10 | Unit + snapshot + component tests | Repo-standard; **`--bail=1`, not `-x`** (vitest 4 removed the `-x` alias — verified in `vitest --help`; only `--bail <number>` exists) |

### Supporting

| Module | Purpose | When to Use |
|---------|---------|-------------|
| `src/core/error/errorCodes.ts` | Add `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` (O.3 canonical code) | Every error path in the trust layer; GR-9 |
| `src/core/error/debugLog.ts` | GR-9 observability; auto-redacts via TraceRedactor | Store/classifier failure paths |
| `src/core/security/TraceRedactor.ts` | R-10 on any logged/receipt-carrying path | CTX-06 counters must never carry raw text |
| `src/core/storage/Setting.ts` | Register `np_trust: { area: 'local' }` in `STORAGE_KEY_REGISTRY` | Core read via `settingRead` needs a registry entry (unregistered keys are refused — verified in `settingRead`) |
| `src/core/ai/ProviderRouter.ts` `CACHED_KINDS`/`TASK_KINDS` | Kind→cache mapping; wrapped context stays in TASK_KINDS | Byte-stable cache constraint (F-5) |
| `src/core/context/TokenBudget.ts` `estimateTokens` | The ONLY token counter — receipts' original/finalTokens use it | Same-counter determinism (ContextPack precedent: "pack tokens and manifest tokens non-divergent") |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deterministic regex classifier (D-4b-05 locked) | ML text classifier (e.g. llm-guard style) | LLM Guard (protectai) is **archived 2026-07-09** [VERIFIED: github.com/protectai/llm-guard]; ML classifiers need a model runtime, break the zero-model-call invariant, and are non-deterministic. Regex keeps determinism + zero cost; recall is lower, but OWASP #3 confirms all filters are evadable — the O.3 authority strip is the boundary, the classifier is a screen |
| Wrapping in `<untrusted_data>` (O.3 verbatim) | Dropping untrusted content outright | Drop loses user value + audit trail; wrap preserves data-as-data (OWASP #6 channel separation). O.3 is spec-locked |
| Quarantine-not-drop (D-4b-06) | Silent drop / pass-through | Drop hides evidence; pass-through violates CTX-02. Quarantine keeps items as ContextItems + receipt `omitReason` |

**Installation:** `none — zero new packages. The phase is fully in-stack.` The classifier is dependency-free regex; the UI uses the already-installed antd `Switch`.

**Version verification (npm registry, 2026-08-13):**
- `zod` latest is 4.4.3 — **not used**; project locks ^3.25.76 (zod 3 API, harness.ts L70 "zod 3 API only, research A5").
- `zustand` latest 5.0.15 (project ^5.0.14) · `immer` latest 11.1.16 (project ^10.2.0) · `antd` latest 6.6.0 (project ^6.5.3 installed, `Switch` export verified).
- No package is added, upgraded, or downgraded in 4b.

## Package Legitimacy Audit

> **Phase 4b installs ZERO new packages.** The package-legitimacy gate was run on the touched runtime deps for completeness; all are long-established (7–8 yr) members of the AGENTS.md Approved Stack with public source repos. The `SUS`/`too-new` flags below refer to **registry latest tags published recently** (e.g. zustand 5.0.15 published 2026-08-13) — the project's **installed, locked** versions (zustand ^5.0.14, immer ^10.2.0, antd 6.5.3) are the ones used, and they are unchanged in 4b. No install/verify checkpoint tasks are required.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| zod | npm | 8 yrs | 254M/wk | github.com/colinhacks/zod | OK | Approved (already installed, ^3.25.76) |
| zustand | npm | 7 yrs | 50M/wk | github.com/pmndrs/zustand | OK* | Approved (installed ^5.0.14; *registry latest tag "too-new" signal is the 2026-08-13 publish of 5.0.15, not adopted) |
| immer | npm | 8 yrs | 57M/wk | github.com/immerjs/immer | OK* | Approved (installed ^10.2.0; *same "too-new" signal on latest tag, not adopted) |
| antd | npm | 9 yrs | 3.6M/wk | github.com/ant-design/ant-design | OK* | Approved (installed 6.5.3; `Switch` export verified in-tree) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none adopted — the `too-new` flags are registry-latest-tag artifacts only; the installed locked versions are the ones 4b uses, and no install task exists.
**Postinstall-script check:** `npm view <pkg> scripts.postinstall` → none of the four carry a postinstall (null for zod/zustand/immer; antd none).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────── Side Panel / Standalone ───────────────────────────┐
                    │                                                                                │
  PageContentService (4a)                    OptionsPage.tsx (Standalone)                            │
  └─ WorkspaceStore.currentPageContext  ─┐   └─ Content-trust card (4× antd Switch)                  │
                                        │      └─ TrustSettingsStore (zustand)                       │
                                        │         └─ chrome.storage.local "np_trust" ◄── write-through│
                                        │                                                           │
  useStreamingLLM.ts (hook)              │                                                           │
  ├─ reads currentPageContext  ──────────┘                                                           │
  ├─ reads np_trust via trustConfig accessor (Zod-gated)                                             │
  └─ calls ContextOptimizer.optimize({ pageContext, trustPrefs, ... })  ── pure, deterministic        │
                                                                                                     │
  ContextOptimizer.optimize()  [src/core/context]                                                    │
  ├─ pageContext ──► contextFeed: PageContext → ContextItem[]        (fills trust/relevance/         │
  │                    freshness/sensitivity; §22.2 2,000-token budget cap)                          │
  ├─ injectionScreener: stripInvisibleUnicode + classifyInjection     ──► quarantine decision        │
  ├─ applyTrustPolicy (O.3): AUTHORITY_BY_TRUST strip + <untrusted_data source=…> wrap               │
  ├─ source-type gates (trustPrefs): disabled kind → excluded (omitReason 'trust_disabled')          │
  ├─ buildContextReceipt: ContextReceiptEntry[] + CTX-06 counters    ──► manifest extension           │
  ├─ packSections (ContextPack): [SYSTEM] personaBlock verbatim (byte-stable, untouched)             │
  │     + context section (wrapped, stable:false, TASK_KINDS)                                        │
  └─ ContextProvenanceManifest + receipt + counters → OptimizedContext (in-memory, R-10 redacted)    │
                                                                                                     │
  ProviderRouter.joinSections: CACHED_KINDS (system/…/memory) → provider system block (cached)       │
                              TASK_KINDS (context/…/tool_result) → provider prompt block (per-turn)   │
  └─ anthropic prompt cache: prefix hash byte-identical across turns  ◄── CTX-04 stable-prefix pins   │
                                                                                                     │
  Phase 6: PromptInspector reads receipt + counters (no raw text) — data only, no 4b UI               │
```

**Reading the diagram:** two async inputs (page + prefs) are resolved by the hook; every trust decision happens inside the pure optimizer before packing. The `[SYSTEM]` block flows straight from `personaBlock` into `packSections` untouched — the wrap only touches the per-turn `context` section. The receipt rides the same `OptimizedContext` the hook already returns.

### Recommended Project Structure

```
src/
├── types/harness.ts            # + TrustLevel, ContextItem, ContextReceiptEntry (C.1 verbatim) + co-located Zod schemas
├── core/context/
│   ├── trust/                  # NEW (4b create-list home)
│   │   ├── TrustPolicy.ts      # O.3 verbatim: AUTHORITY_BY_TRUST, applyTrustPolicy, injection-blocked error
│   │   ├── injectionScreener.ts# D-4b-05: stripInvisibleUnicode + classifyInjection (dependency-free regex)
│   │   └── contextFeed.ts      # PageContext → ContextItem[] (budget cap, metadata fill) + TrustedFeedResult
│   ├── contextReceipt.ts       # NEW (or extend ContextProvenanceManifest.ts in place): buildContextReceipt + counters
│   ├── ContextProvenanceManifest.ts  # IN-PLACE extension: ContextReceiptEntry[] + counters + schema (R-1/D-04-17)
│   ├── ContextOptimizer.ts     # trust stage inserted between input and buildPackInput (D-4b-04/08/09)
│   └── ContextPack.ts          # unchanged — contextText slot already exists (L95-103); system section untouched
├── core/preferences/
│   └── trustConfig.ts          # np_trust accessor (personaConfig precedent): Zod gate + all-true fallback
├── core/registry/
│   └── TrustSettingsStore.ts   # Options-side zustand store (AddonSettingsStore precedent: write-through + onChanged)
├── core/ai/types.ts            # + ContextOptimizerInput.trustPrefs? (additive only, D-04-07 precedent)
├── core/storage/Setting.ts     # + np_trust: { area: 'local' } registry row
├── core/error/errorCodes.ts    # + CONTEXT_INSTRUCTION_INJECTION_BLOCKED (O.3 canonical)
├── core/i18n/strings.ts        # + STR.options.contentTrust/trustHelper/trustStructuralNote/trustSources.*/trustSaveFailed
└── components/pages/
    ├── useStreamingLLM.ts      # pageContext: WorkspaceStore.currentPageContext; trustPrefs via accessor (D-4b-09)
    └── OptionsPage.tsx         # + Content-trust Card after Appearance (UI-SPEC locked)
tests/
├── core/context/trust/         # NEW — TrustPolicy, contextFeed, contextReceipt, counters, stable-prefix snapshots
└── security/prompt-injection/  # NEW top-level dir — classifier fixtures, quarantine-not-drop, malicious-fixture invariants
```

### Pattern 1: The TrustPolicy Boundary (P4b-1 — the ownership decision)

**What:** `TrustPolicy` is the SINGLE owner of all trust logic. Nothing else inspects `trust`/`instructionAuthority` — neither the hook, nor ContextPack, nor ProviderRouter. The pipeline shape is `ContextItem[] (input) → applyTrustPolicy + gates → contextText → PromptSection[] (output)`.

**When to use:** Every source-kind that reaches the model (page now; memory Phase 5; tool_result Phase 8) flows through this one boundary, so a trust rule is changed in exactly one place.

**Example (O.3 verbatim, spec L6433-6459):**

```typescript
// src/core/context/trust/TrustPolicy.ts
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

### Pattern 2: Receipt-as-reconstruction-data (D-4b-10/11)

**What:** The manifest extension carries `ContextReceiptEntry[]` + CTX-06 counters; a `buildContextReceipt` helper derives entries from the trust pipeline's decisions. The receipt is sufficient to reconstruct every packing decision WITHOUT re-running the optimizer (Phase 6 PromptInspector renders it).

**When to use:** Every per-turn optimizer run with a page feed emits entries; entries must be pure data (sourceId, token counts, decisions) — never raw text (R-10).

**Recommended shape (D-4b-10 discretion, from C.1 L4892-4898):**

```typescript
// src/core/context/ContextProvenanceManifest.ts — IN-PLACE extension
import type { ContextReceiptEntry } from '@/types/harness';
// ContextProvenanceManifest gains:
//   receipt: ContextReceiptEntry[]        // per-source-item decisions (all kinds enumerated, D-4b-01)
//   counters: {                           // CTX-06, no raw text
//     screened: number;                   // items passed through the classifier
//     quarantined: number;                // classifier hits
//     byTrust: Record<TrustLevel, number>;
//     totalIncludedTokens: number;
//   }
// ContextProvenanceManifestSchema extended to match (GR-4, D-04-18 union-parity test extended)
```

**Token semantics:** `originalTokens` = `estimateTokens(item.text)` pre-wrap; `finalTokens` = `estimateTokens(wrappedText)` when included, `0` when excluded (`included:false` + `omitReason`); `cacheEligible` = whether the target section kind is stable (page→context section→false; memory→memory section→true). Excluded reasons: `'prompt_injection'` (D-4b-06) and `'trust_disabled'` (D-4b-08).

### Pattern 3: Stable-Prefix Snapshot (CTX-04 / F-5)

**What:** Snapshot tests pin the byte-stable prefix — the cached `[SYSTEM]` persona block must be byte-identical across equivalent turns AND identical with/without a page feed, and the wrap must never enter the system section.

**Why (verified constraint):** Anthropic prompt caching requires **100% identical prompt segments** — a change to any block at or before the cache breakpoint changes the prefix hash and forces a full re-write; modifying system content invalidates the system AND messages caches [CITED: docs.anthropic.com prompt-caching]. The repo's `CACHED_KINDS` (system/tool_schemas/preferences/memory → provider `system`) is the enforcement point; the wrapped `context` section maps to `TASK_KINDS` (per-turn `prompt`).

**When to use:** D-4b-12 mandates these in `tests/core/context/trust/**`; the drop-in-identity regression (04-04 precedent) extends to assert the system section is byte-identical with vs without pageContext and never contains `<untrusted_data`.

### Anti-Patterns to Avoid

- **Trust logic leaking into multiple places:** if any module other than TrustPolicy reads `instructionAuthority` or re-wraps text, the ownership boundary (P4b-1) breaks. Rule: ContextPack/ProviderRouter treat the context section as opaque text.
- **Classifier as the security boundary:** a regex screen is an interceptive control — OWASP #3 documents filters are evadable by rephrasing/encoding [CITED: OWASP GenAI LLM Top 10 2026 LLM01]. If a test asserts "the classifier catches everything", it encodes a false claim. The boundary is the authority strip; the classifier's job is quarantine + audit counters.
- **Dropping quarantined items silently:** violates D-4b-06 — receipts must enumerate excluded items (both `included:false` rows). A user whose page about prompt injection vanishes with no receipt row is the exact failure the design avoids.
- **Mutating SYSTEM from the trust layer:** TrustPolicy must never touch system/user items or the personaBlock. The wrap path is only for retrieved/untrusted/tool items.
- **Putting the wrap into a cached kind:** any `<untrusted_data>` text inside CACHED_KINDS text would rotate the prefix hash every turn (page content is per-turn). The context section is `stable:false`; the pack order already isolates it.
- **`-x` in vitest commands:** vitest 4.1.10 removed the `-x` alias (verified via `vitest --help`; only `--bail <number>` exists). Use `--bail=1` in quick-run commands. The 04a RESEARCH's `-x` invocations are stale.
- **Hand-rolling a second token counter:** receipts' token counts MUST use `estimateTokens` (the same counter ContextPack uses) or manifest totals diverge from pack totals (ContextPack header: "the SAME estimateTokens counter… keeps pack tokens and manifest tokens non-divergent").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting for receipts/manifest | A second counting heuristic | `estimateTokens` (TokenBudget) | Same-counter determinism (ContextPack precedent); a second counter diverges original/finalTokens from pack tokens |
| Zod boundary validation | Hand-written `if`-chains over trust objects | Co-located `*Schema` per type (`ContextItemSchema`, `ContextReceiptEntrySchema`, `TrustPrefsSchema`) | GR-4; ProviderConfigSchema/PersonaProfileSchema precedent; V5 input validation on every inbound path |
| Cross-surface preference sync | Custom messaging between surfaces | `chrome.storage.local` + `chrome.storage.onChanged` via a zustand store | AddonSettingsStore precedent (remove-then-add listener, T-1-11); storage is the extension-wide sync bus |
| Kind→cache mapping | A second stability flag list | `ProviderRouter.CACHED_KINDS`/`TASK_KINDS` (single site) | F-5: a wrong/missing flag kills anthropic prompt caching (Pitfall 7, T-04-09) |
| Error identity | Free-form throw strings | `ERROR_CODES` + `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` (O.3 canonical, added to errorCodes.ts) | GR-9; W-1 gate re-verifies the spec C.2 mirror line-anchored |
| Redaction of logged context | Logging raw receipt text | `TraceRedactor.redact`/`redactSensitive` (R-10) | CTX-06: counters without raw text; receipts never persist raw bodies |
| Injection screening | An ML classifier or an external guard library | Deterministic dependency-free regex screener (D-4b-05) | Zero model calls (cost invariant); determinism (identical input → identical verdict); llm-guard is archived; no new deps (R-9) |

**Key insight:** the deceptively complex problems in this phase (cache stability, token parity, cross-surface sync, trust-boundary ownership) all have an existing in-repo owner — ProviderRouter for caching, TokenBudget for counting, Setting/AddonSettingsStore for storage, harness.ts for types, errorCodes for codes. Every hand-rolled duplicate of those would create the exact divergence the Phase-4 tests were built to catch.

## Runtime State Inventory

> Not a rename/refactor/migration phase — but the "extend IN PLACE" work touches shared type homes, so the negative findings are stated explicitly (the planner must not assume "unchecked").

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no runtime datastore stores trust strings; `WorkspaceStore.currentPageContext` (4a) is transient in-memory state with no trust fields (verified: PageContextBridge header "the transport carries none") | none |
| Live service config | None — no external service configuration references trust (no n8n/Cloudflare/etc. in this project) | none |
| OS-registered state | None — no OS-level registrations embed trust strings | none |
| Secrets/env vars | None — `np_trust` is a NEW key (no existing key renamed); `np_persona`/`np_addon_settings` are untouched (verified in Setting.ts registry) | none — add `np_trust: { area: 'local' }` (new registration, not a migration) |
| Build artifacts | None — no installed/compiled artifact carries trust names; zero new packages | none |

**Nothing found in category:** verified above for all five categories. The only "extensions" are additive type additions to `src/types/harness.ts` and `ContextProvenanceManifest.ts` (R-1 in-place rule) — no existing declarations are renamed or reshaped.

## Common Pitfalls

### Pitfall 1: Trust wrap leaking into the byte-stable SYSTEM block
**What goes wrong:** `<untrusted_data>` text appears inside the cached `[SYSTEM]` persona block → the anthropic cache prefix hash changes every turn → cache never hits → cost blows up (F-5).
**Why it happens:** a trust stage that appends the wrap to the personaBlock or re-orders sections before packing.
**How to avoid:** TrustPolicy operates on `ContextItem[]` only; `buildPackInput` keeps `personaBlock` verbatim; the context section is `stable:false` and lands in TASK_KINDS. Snapshot test asserts the system section text is byte-identical with vs without pageContext.
**Warning signs:** `[SYSTEM]` text containing `<untrusted_data` or page text; cache-stability tests (04-04 drop-in identity) failing after the trust stage lands.

### Pitfall 2: Classifier false-negative framed as a security failure
**What goes wrong:** a test asserts a paraphrased injection MUST be quarantined; it isn't (regex recall is bounded); the test fails and someone "fixes" it with a broader pattern that over-blocks legitimate pages (e.g. any page containing the phrase "ignore previous instructions" in prose).
**Why it happens:** treating the classifier as the boundary (OWASP #3: semantic filters are evadable by rephrasing/encoding; low-resource and code-mixed inputs degrade accuracy).
**How to avoid:** separate concerns — authority-strip tests assert the *boundary* (wrapped items can never instruct); classifier tests assert *screening* behavior on known pattern shapes + the unicode-strip invariant + quarantine-not-drop. Over-blocking risk is mitigated by auditability (D-4b-06), not by recall maximization.
**Warning signs:** classifier tests using adversarial/paraphrased payloads as REQUIRED quarantine; receipt rows missing for legitimately quarantined items.

### Pitfall 3: Receipt divergence from actual packing
**What goes wrong:** the receipt claims an item was included when the packed context text doesn't contain it (or vice versa) — PromptInspector (Phase 6) then reconstructs decisions that don't match what the model actually saw.
**Why it happens:** building the receipt from a different code path than the one that built `contextText`.
**How to avoid:** one `TrustedFeedResult` carries BOTH the contextText and the receipt entries + counters; a test recomputes the context section from the receipt (included items only, wrapped token counts) and asserts it equals the packed section text (reconstruction contract, D-4b-11).
**Warning signs:** receipt `included:true` rows whose source text is absent from the section; token sums not matching `estimateTokens` on the packed text.

### Pitfall 4: np_trust read without a storage-registry entry
**What goes wrong:** `settingRead('np_trust', …)` silently returns the fallback because unregistered keys are refused (`resolveKeyPermission` → undefined → STORE_READ + fallback) — the user toggles are ignored at runtime.
**Why it happens:** personaConfig worked with NO Setting.ts change because `np_persona` was already registered; 4b's new key is not.
**How to avoid:** one-line `np_trust: { area: 'local' }` in `STORAGE_KEY_REGISTRY` (mirroring `np_persona` L67), plus a Zod-gated `trustConfig` accessor with all-true fallback.
**Warning signs:** toggling a source off in Options has no effect on the optimizer output; `STORE_READ` logs on every turn.

### Pitfall 5: Async/impurity sneaking into the trust stage
**What goes wrong:** someone adds a `chrome.storage` read or `await` inside `applyTrustPolicy`/classifier to "simplify" the hook → the optimizer is no longer pure/deterministic; tests that call `optimize()` synchronously break.
**Why it happens:** the 4b decisions are pure but the two inputs are async — the seam between them must live at the hook.
**How to avoid:** `ContextOptimizerInput` gains `trustPrefs?: TrustPrefs` (additive, D-04-07 precedent); the hook resolves page + prefs and passes both in. Optimizer stays zero-async, zero-model, deterministic (its module contract, L30-32).
**Warning signs:** `chrome.` or `await` appearing in `src/core/context/trust/**`; optimizer tests needing fakeBrowser.

### Pitfall 6: String-slicing page text inside the optimizer
**What goes wrong:** enforcing the §22.2 2,000-token page budget with `text.slice(0, 2000)` inside ContextOptimizer/ContextPack — violates the D-04-13 absolute no-slice gate in that module.
**Why it happens:** the budget must be honored somewhere, and the optimizer "is where packing happens."
**How to avoid:** the §22.2 structural cap ("keep only first paragraph + first heading", `truncated:true` provenance) is applied at the `contextFeed` conversion layer (page → ContextItem[]), which is NOT the optimizer; the optimizer only sees the already-bounded ContextItem. The receipt records `compression:'structural'`/`truncated` state. (Top-k `selectRelevant` query-ranking stays deferred to Phase 5a — see Open Questions Q1.)
**Warning signs:** `.slice(`/`.substring(`/`.replace(` in ContextOptimizer.ts/ContextPack.ts (there is a phase grep gate for this).

## Code Examples

### Common Operation 1: Deterministic injection screening (recommended D-4b-05 set)

```typescript
// src/core/context/trust/injectionScreener.ts — dependency-free, pure, deterministic
// OWASP GenAI LLM Top 10 2026 LLM01 prevention #5 [CITED]: strip invisible Unicode at
// every ingest boundary: zero-width (U+200B/200C/200D/2060), tag-block (U+E0000-E007F),
// variation selectors (U+FE00-FE0F). These smuggle instructions/exfiltration bytes.
const INVISIBLE_UNICODE = /[\u200B\u200C\u200D\u2060\uE0000-\uE007F\uFE00-\uFE0F]/g;

/** Deterministic sanitizer — always applied to retrieved text before classification. */
export function stripInvisibleUnicode(text: string): string {
  return text.replace(INVISIBLE_UNICODE, '');
}

export type ScreenVerdict = 'safe' | 'quarantine';

// High-precision, case-insensitive, word-bounded patterns (D-4b-05 discretion).
// Precision over recall: a miss is still inert (O.3 authority strip); a false
// positive is auditable (quarantine-not-drop, D-4b-06).
const INSTRUCTION_OVERRIDE = [
  /\bignore\s+(all|any|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|commands?)\b/i,
  /\bdisregard\s+(the\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)\b/i,
  /\byou\s+are\s+now\b/i,
  /\b(redefine|rewrite|update)\s+(your\s+)?(system\s+)?(prompt|instructions?)\b/i,
  /\b(you\s+)?(have|are\s+granted|now\s+have)\s+(permission|authority|access)\s+to\s+(use|call|execute|access)\s+(all\s+)?(tools?|commands?)\b/i,
  /\bignore\s+(your\s+)?(guidelines|safety|rules|protocols)\b/i,
  /\bdo\s+not\s+(mention|tell|reveal|report)\s+(the\s+)?(user|this|anyone)\b/i,
];

/** Deterministic classifier — zero model calls; identical input → identical verdict. */
export function classifyInjection(text: string): ScreenVerdict {
  const cleaned = stripInvisibleUnicode(text);
  return INSTRUCTION_OVERRIDE.some((re) => re.test(cleaned)) ? 'quarantine' : 'safe';
}
```

### Common Operation 2: PageContext → ContextItem conversion (D-4b-01/09 feed)

```typescript
// src/core/context/trust/contextFeed.ts — the page-only 4b feed
import type { PageContext } from '@/core/content/PageContext';
import type { ContextItem } from '@/types/harness';
import { estimateTokens } from '../TokenBudget';

// §26.5/§22.2 webpage budget [VERIFIED: spec L3794, L3581] — capped structurally at
// conversion (paragraph/heading boundary), NEVER inside the optimizer (D-04-13).
export const PAGE_BUDGET_TOKENS = 2_000;

/** Deterministic metadata fill (CTX-01): single-item page feed. Freshness from extractedAt. */
export function pageToContextItems(page: PageContext): ContextItem[] {
  const markdown = page.markdown ?? '';
  // structural §22.2 fallback: first paragraph + first heading, marked truncated
  const { text, truncated } = capToBudget(markdown, PAGE_BUDGET_TOKENS);
  return [{
    id: `page:${page.url}`,
    kind: 'context',
    text,
    tokens: estimateTokens(text),
    trust: 'retrieved',
    instructionAuthority: false,           // CTX-01: MUST be false for retrieved (C.1)
    relevance: 1,                          // single-item feed (top-k ranking deferred, Q1)
    freshness: freshnessFrom(page.extractedAt), // 0..1 deterministic age decay
    sensitivity: 'none',                   // page sensitivity heuristics out of 4b scope
    sourceId: page.url,
  }];
}
```

### Common Operation 3: Manifest → receipt wiring (D-4b-10)

```typescript
// src/core/context/contextReceipt.ts — builds receipt entries from trust decisions
import type { ContextItem, ContextReceiptEntry, TrustLevel } from '@/types/harness';
import { estimateTokens } from './TokenBudget';

export interface TrustedFeedResult {
  contextText: string;                    // joined included items (wrap applied)
  receipt: ContextReceiptEntry[];         // one row per source item (included + excluded)
  counters: { screened: number; quarantined: number;
              byTrust: Record<TrustLevel, number>; totalIncludedTokens: number };
}

export function buildReceipt(
  items: ContextItem[],            // post-policy, post-gate items (wrapped text present)
  decisions: { excluded: Map<string, { reason: string }> }, // omitted items + reasons
  kindStable: (kind: ContextItem['kind']) => boolean,       // cacheEligible fn (CACHED_KINDS)
): TrustedFeedResult {
  // one entry per item: sourceId, included, originalTokens (pre-wrap), finalTokens
  // (post-wrap when included, 0 when excluded), compression?, cacheEligible, omitReason?
  // contextText = included items joined (deterministic order preserved).
  // NEVER includes raw text in the receipt — token counts + ids only (R-10).
}
```

### Common Operation 4: np_trust accessor (personaConfig precedent, D-4b-07)

```typescript
// src/core/preferences/trustConfig.ts — D-4b-07/08: read-only core accessor
import { z } from 'zod';
import { settingRead } from '@/core/storage/Setting';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export const NP_TRUST_KEY = 'np_trust';   // Setting.ts registry: np_trust: { area: 'local' }

/** GR-4/V5 inbound gate — shape is discretion; UI-SPEC binds behavior + all-true defaults. */
export const TrustPrefsSchema = z.object({
  page: z.boolean(),
  notes: z.boolean(),
  memory: z.boolean(),
  tool_result: z.boolean(),
});
export type TrustPrefs = z.infer<typeof TrustPrefsSchema>;

export const DEFAULT_TRUST_PREFS: TrustPrefs = { page: true, notes: true, memory: true, tool_result: true };

/** Never throws; invalid/missing → all-true (safe default: no source silently excluded). */
export async function readTrustPrefs(): Promise<TrustPrefs> {
  const stored = await settingRead<unknown>(NP_TRUST_KEY, (v) => v, undefined);
  if (stored === undefined) return DEFAULT_TRUST_PREFS;
  const parsed = TrustPrefsSchema.safeParse(stored);
  if (!parsed.success) {
    debugLog(ERROR_CODES.STORE_READ, 'np_trust failed TrustPrefsSchema — using defaults', {
      module: 'trustConfig', extra: { issueCount: parsed.error.issues.length },
    });
    return DEFAULT_TRUST_PREFS;
  }
  return parsed.data;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Filter or sanitize the input and hope" | Architectural trust separation: authority stripping + provenance-labeled channel (O.3 / OWASP LLM01 #6) | OWASP GenAI LLM Top 10 2026 (published 2026-08-04); spec O.3 is the project's worked reference | The classifier is explicitly demoted from boundary to screen; tests assert the boundary, not filter recall |
| Regex-only injection screening as primary defense | Deterministic screening as one layer over structural separation | 2026 consensus (NIST AI 100-2, NCSC 2025, Debenedetti et al. 2025 — cited in OWASP LLM01) | "No reliable prevention mechanism exists today; defense is architectural" — matches the phase's layered design |
| Guard-library injection scanners | In-house deterministic screener or no screener | protectai/llm-guard archived 2026-07-09 (ML-classifier approach, now unmaintained) | Validates the D-4b-05 choice of a dependency-free regex screen inside an owned core |
| Unicode-invisible injection undetected | Mandatory strip at ingest (zero-width, tag-block, variation selectors) | OWASP LLM01 2026 prevention #5 (M365 Copilot ASCII-smuggling PoC, Aug 2024) | A concrete, deterministic, testable control the 4b classifier should include |
| Manifest = provenance of what was emitted | Manifest + context receipt = reconstruction of every packing decision | §2.6 → CTX-03 (4b); PromptInspector UI Phase 6 | Receipt must be sufficient without re-running the optimizer (D-4b-11) |

**Deprecated/outdated:**
- **`-x` vitest flag:** removed in vitest 4; use `--bail=1` [VERIFIED: vitest 4.1.10 `--help`].
- **External guard libraries for injection screening:** llm-guard (protectai) archived; the project's zero-dependency, zero-model-call posture (R-9, cost invariant) rules them out anyway.
- **`framer-motion`:** already banned in this repo (approved `motion` only) — not touched by 4b.

## Assumptions Log

> All `[ASSUMED]` claims in this research. The planner/discuss-phase must confirm before these become locked.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recommended regex heuristic set (`INSTRUCTION_OVERRIDE` + `stripInvisibleUnicode`) is the D-4b-05 "exact set" the agent should ship | Common Pitfalls / Code Examples | If the user wanted a different/leaner set, the classifier tests are over-specified; patterns are cheap to change but fixtures pin them |
| A2 | The invisible-Unicode strip (OWASP #5) should be part of the 4b screener even though the spec's 4b block only lists instruction-phrase patterns | Code Examples (Operation 1) | Not including it loses a cheap deterministic control; including it adds a sanitizer the spec didn't name (still within D-4b-05 discretion) |
| A3 | The §22.2 2,000-token page budget is enforced structurally at `contextFeed` conversion (first paragraph + first heading, `truncated:true`), NOT via top-k `selectRelevant` (deferred to Phase 5a) | Common Pitfalls / Code Examples (Operation 2) | If the user expects the top-k feed (4a deferred item 14) in 4b, the page feed behavior differs; the receipt's `compression` field semantics change |
| A4 | `np_trust` shape is `{ page, notes, memory, tool_result }` all-boolean, area `local`, key `np_trust` | Code Examples (Operation 4) | UI-SPEC binds behavior + defaults only; shape is discretion — any shape change is contained in trustConfig + store |
| A5 | Receipt token semantics: `finalTokens = 0` for excluded items; `originalTokens` = pre-wrap `estimateTokens`; `cacheEligible` from the target section kind's stability | Architecture Patterns (Pattern 2) | PromptInspector (Phase 6) consumes these semantics; a different convention (e.g. finalTokens = wrapped count for quarantined) changes the reconstruction contract |
| A6 | Quarantined/disabled items are excluded from the packed `contextText` but enumerated in the receipt (their raw text is NOT retained in the result — only ids + counts) | Code Examples (Operation 3) | D-4b-06 says "kept as a ContextItem" — if the user expects quarantined items to be *available* in the turn result (not just receipt rows), the `TrustedFeedResult` carrier needs a `quarantined: ContextItem[]` field |
| A7 | `relevance: 1` and a deterministic age-decay `freshness` for the single-page feed; `sensitivity: 'none'` | Code Examples (Operation 2) | CTX-01 metadata semantics feed Phase-6 diagnostics; different defaults change the counters' meaning |
| A8 | `verify:phase-4b` follows the repo's actual §24 chain form (`eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run`) — the spec's scoped form (L3684) is satisfied as a subset | Environment Availability | Prior phases all deviate from the spec's scoped strings to the full chain; consistency with the 6 existing scripts is the safer call |

## Open Questions

1. **Does 4b deliver the top-k `selectRelevant` page feed (4a deferred item 14), or only the structural budget cap?**
   - What we know: §26.5 says pages over 2,000 tokens route through `selectRelevant(query)` with `compressionApplied:'topk'`; the 4a CONTEXT deferred list names that feed → 4b; 4b's own CONTEXT.md D-4b-01 names only `PageContext → ContextItem[]` and does not commit to query-dependent ranking. `ContextOptimizerInput` has no query-relevance surface today.
   - What's unclear: whether "item 14" is in 4b's scope or was superseded by the D-4b-01 single-item page feed.
   - Recommendation: defer top-k to Phase 5a (query-dependent ranking belongs with the RAG/MiniSearch consumer); 4b enforces the §22.2 budget structurally at conversion (A3). If the discuss-phase disagrees, the feed needs a relevance source the optimizer doesn't have.

2. **Where does the receipt reconstruction helper live?** (D-4b-10 discretion)
   - What we know: manifest extension is R-1-bound to `ContextProvenanceManifest.ts`; the helper (`buildContextReceipt`) is pure derivation from trust decisions.
   - What's unclear: co-location (manifest module) vs trust module.
   - Recommendation: co-locate `contextReceipt.ts` as a sibling of `TrustPolicy` in `src/core/context/trust/` OR extend the manifest module in place — either is fine; the receipt TYPE + schema stay in the manifest module (R-1), the BUILDER lives next to the decisions it consumes.

3. **Should the classifier's quarantine reason be structured?** (D-4b-06)
   - What we know: `omitReason?: string` is a free string in C.1; the spec's canonical codes live in §C.2.
   - What's unclear: whether `'prompt_injection'`/`'trust_disabled'` become enum members of a receipt schema or stay strings.
   - Recommendation: keep them as string literals in the Zod enum for the receipt schema (`z.enum(['prompt_injection','trust_disabled'])` on a `TrustOmitReason` type) — exact, testable, and forward-compatible with Phase-5 memory reasons — without adding non-canonical §C.2 codes.

4. **Freshness decay semantics for the page item.**
   - What we know: `freshness: 0..1`; page carries `extractedAt`.
   - What's unclear: the exact deterministic decay curve (e.g. `max(0, 1 - ageHours/24)`).
   - Recommendation: a fixed curve documented in the converter with fixture-pinned values; the receipt only records the resulting number.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test/dev | ✓ | v24.18.1 | — |
| pnpm | scripts (`pnpm run verify:phase-4b`) | ✓ | 11.18.0 | npm (project uses pnpm-lock) |
| vitest | unit/snapshot/component tests | ✓ | 4.1.10 | — (use `--bail=1`, not `-x`) |
| tsc | `verify:phase-4b` compile gate | ✓ | project 5.9.3 (global CLI reports 7.0.2 — use the project's via pnpm) | — |
| antd `Switch` | content-trust card | ✓ | 6.5.3 installed (`antd/es/switch` export verified) | — |
| zod (3.x) | all new schemas | ✓ | ^3.25.76 installed | do NOT upgrade to zod 4.4.3 (zod-3 API only) |
| chrome.storage.local | np_trust persistence + onChanged sync | ✓ (runtime) | — | tests use `fakeBrowser` (wxt/testing) |
| WorkspaceStore.currentPageContext | page feed source (D-4b-09) | ✓ | 4a delivered (primary writer) | hook guards `undefined` → no page section |

**Missing dependencies with no fallback:** none — Phase 4b is fully in-stack; zero new packages, zero new external services.

**Missing dependencies with fallback:** none. (Search providers exa/brave/tavily/firecrawl are unconfigured in config.json — irrelevant to this phase: no web data needed at runtime.)

## Validation Architecture

> `workflow.nyquist_validation: true` (config.json) — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (existing; config: `vitest.config.ts` with `jsdom-align` env, `threads` pool, `tests/setup.ts` + fakeBrowser + fake-indexeddb) |
| Config file | vitest.config.ts (existing) |
| Quick run command | `pnpm vitest run tests/core/context/trust tests/security/prompt-injection --bail=1` |
| Full suite command | `pnpm run verify:phase-4b` (new script; §24 chain form consistent with the 6 existing scripts: `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRUST-01 (CTX-01) | C.1 types verbatim: TrustLevel union, ContextItem shape (`instructionAuthority` must be false for retrieved), ContextReceiptEntry — Zod gates parse fixtures, reject unknown kinds/trusts | unit | `pnpm vitest run tests/core/context/trust/TrustTypes.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-01 (CTX-01) | Zod schema for ContextItem rejects `instructionAuthority: true` with trust `retrieved`/`untrusted`/`tool` (CTX-01 MUST-be-false invariant at the boundary) | unit | `pnpm vitest run tests/core/context/trust/TrustTypes.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-01 (CTX-02) | `applyTrustPolicy` (O.3 verbatim): AUTHORITY_BY_TRUST mapping; wrap format `<untrusted_data source="…">`; system/user items untouched | unit | `pnpm vitest run tests/core/context/trust/TrustPolicy.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-01 (CTX-02) | `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` error raised when a retrieved item tries to redefine policy; code exists in errorCodes.ts (GR-9) | unit | `pnpm vitest run tests/core/context/trust/TrustPolicy.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-02 (CTX-02) | Classifier: `stripInvisibleUnicode` removes zero-width/tag-block/variation-selector chars; `classifyInjection` flags known instruction-override shapes; determinism (same input → same verdict) | unit (security dir) | `pnpm vitest run tests/security/prompt-injection/injectionScreener.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-02 (CTX-02) | Quarantine-not-drop: flagged item stays a ContextItem, never a PromptSection; receipt row `included:false, omitReason:'prompt_injection'`; legit page ABOUT injection is auditably recoverable | unit | `pnpm vitest run tests/security/prompt-injection/quarantine.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-02 (CTX-02) | Malicious page/note/tool fixtures cannot alter policy or inject: authority strip renders even a classifier-miss inert (boundary test, not filter recall) | unit | `pnpm vitest run tests/security/prompt-injection/quarantine.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-03 (CTX-03) | Feed: `pageToContextItems` fills trust/relevance/freshness/sensitivity; §22.2 2,000-token structural cap marks truncated | unit | `pnpm vitest run tests/core/context/trust/contextFeed.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-03 (CTX-03) | Source-type gates: `trustPrefs` disabled kind → excluded, receipt `included:false, omitReason:'trust_disabled'`; enabled default all-true includes page | unit | `pnpm vitest run tests/core/context/trust/contextFeed.test.ts --bail=1` | ❌ Wave 0 |
| TRUST-03 (CTX-03) | Receipt reconstruction contract: context section text recomputed from receipt (included items, wrapped tokens) equals packed section; D-4b-11 without re-running optimizer | unit | `pnpm vitest run tests/core/context/trust/contextReceipt.test.ts --bail=1` | ❌ Wave 0 |
| CTX-04 (D-4b-12) | Stable-prefix snapshots: `[SYSTEM]` byte-identical across equivalent turns; identical with vs without pageContext; never contains `<untrusted_data`; wrap only in TASK_KINDS context | unit (snapshot) | `pnpm vitest run tests/core/context/trust/stablePrefix.test.ts --bail=1` | ❌ Wave 0 |
| CTX-06 (D-4b-14) | Quality counters: screened/quarantined/per-trust-bucket/totalIncludedTokens, no raw text in counters; manifest schema extended (union-parity test D-04-18 extended) | unit | `pnpm vitest run tests/core/context/trust/qualityCounters.test.ts --bail=1` | ❌ Wave 0 |
| CTX-05 (D-4b-13) | Structural seam: ContextItem carries disclosure-readiness metadata field; type-level (no logic) | unit (type-level) | `pnpm vitest run tests/core/context/trust/TrustTypes.test.ts --bail=1` | ❌ Wave 0 |
| D-4b-09 | Hook wiring: optimizer `pageContext` + `trustPrefs` path — page feed produces a `context` section; `pageContext: undefined` path byte-identical to pre-4b (drop-in regression extended) | unit | `pnpm vitest run tests/core/context/ContextOptimizer.test.ts --bail=1` | ❌ extend existing |
| D-4b-07 | Options content-trust card: 4 Switch rows render at persisted values, toggle write-through to np_trust, rollback + `STR.options.trustSaveFailed` toast on failure, all-true fallback on invalid storage | component | `pnpm vitest run tests/components/OptionsPage.test.tsx --bail=1` | ❌ Wave 0 |
| verify gate | `verify:phase-4b` green (chain + scoped dirs) | — | `pnpm run verify:phase-4b` | ❌ Wave 0 (script) |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/core/context/trust tests/security/prompt-injection --bail=1`
- **Per wave merge:** `pnpm run verify:phase-4b`
- **Phase gate:** Full suite green before `/gsd-verify-work` (P-5: §24 chain, NO exact test-count assertions — the gate is the chain passing, per 04-RESEARCH L502 precedent)

### Wave 0 Gaps
- [ ] `tests/core/context/trust/TrustTypes.test.ts` — C.1 types + Zod gates + CTX-01 invariant + CTX-05 seam (new dir)
- [ ] `tests/core/context/trust/TrustPolicy.test.ts` — O.3 applyTrustPolicy + CONTEXT_INSTRUCTION_INJECTION_BLOCKED
- [ ] `tests/core/context/trust/contextFeed.test.ts` — pageToContextItems, budget cap, source gates
- [ ] `tests/core/context/trust/contextReceipt.test.ts` — receipt build + reconstruction contract
- [ ] `tests/core/context/trust/stablePrefix.test.ts` — byte-stable prefix snapshots (CTX-04)
- [ ] `tests/core/context/trust/qualityCounters.test.ts` — CTX-06 counters, no raw text
- [ ] `tests/security/prompt-injection/injectionScreener.test.ts` — classifier + unicode strip (new top-level dir `tests/security/`)
- [ ] `tests/security/prompt-injection/quarantine.test.ts` — quarantine-not-drop + malicious-fixture invariants
- [ ] `tests/components/OptionsPage.test.tsx` — content-trust card (extend or add; fakeBrowser for chrome.storage)
- [ ] `tests/core/context/ContextOptimizer.test.ts` — extend: trust-aware pageContext feed + drop-in identity with/without page
- [ ] Framework install: none — zero new packages
- [ ] `verify:phase-4b` script in package.json (§24 chain, consistent with prior phases)

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` (config.json) — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in this phase) |
| V3 Session Management | no | — (no sessions) |
| V4 Access Control | no | — (no roles; tool permission is Phase 8) |
| V5 Input Validation | yes | Zod gates on every boundary: `ContextItemSchema`/`ContextReceiptEntrySchema`/`TrustPrefsSchema`, extended `ContextProvenanceManifestSchema`, `settingRead` sanitize (TrustPrefsSchema.safeParse on np_trust read) |
| V6 Cryptography | no | — (vault is Phase 2; no new crypto) |
| V10 Malicious Code | yes | Prompt-injection quarantine (D-4b-06), invisible-Unicode strip (OWASP #5), authority stripping renders retrieved content inert (CTX-02), R-10 redaction on receipts |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Indirect prompt injection via retrieved page content (instructions in extracted markdown) | Tampering | O.3 authority strip: every retrieved item gets `instructionAuthority:false` + `<untrusted_data source=…>` wrap before it can become a section — the boundary survives classifier misses |
| System-prompt redefinition attempt in retrieved content | Tampering | Deterministic classifier flags + quarantines (receipt `omitReason:'prompt_injection'`); `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` for policy-redefinition attempts; system section never contains untrusted text (CTX-04 pin) |
| Invisible-Unicode smuggling (zero-width/tag-block/variation-selector) | Tampering | `stripInvisibleUnicode` at conversion (OWASP LLM01 #5) |
| Tool/permission-grant instructions in retrieved content | Elevation of Privilege | Classifier pattern set + quarantine; tool execution governance is Phase 8 (ExecutorService) — 4b prevents the instruction from reaching the model with authority |
| Cache poisoning via mutable "system" content | Tampering | TrustPolicy never mutates SYSTEM/personaBlock; wrap confined to TASK_KINDS context section; stable-prefix snapshot tests (D-4b-12) |
| Preference-store tampering (np_trust) | Tampering | Zod-gated read with all-true fallback; `sanitizeStored`-style guard; store never throws (Golden Rule 9) |

## Sources

### Primary (HIGH confidence)
- **PRODUCT_SPEC_v0_1.md (in-repo, read verbatim)** — §18 Phase-4b block (L2742-2750), §28.3 CTX-01..06 (L3931-3938), Appendix C.1 types (L4837, L4877-4899), Appendix O.3 TrustPolicy (L6433-6459), §2.6 manifest (L516-534), §24 verify commands (L3671+), §22.2/§26.5 page budget (L3581, L3794), §16.1 XSS matrix (L1995-2003)
- **04b-CONTEXT.md + 04b-UI-SPEC.md (in-repo)** — D-4b-00..14 locked decisions; UI contract (4 Switch rows, STR keys, np_trust local-area, auto-save/rollback)
- **Code seams (read in-repo)** — `src/types/harness.ts` (R-1 home, extension header), `src/core/ai/types.ts` (PromptSection/ContextOptimizerInput.pageContext L158), `src/core/context/ContextProvenanceManifest.ts` (extension point), `ContextOptimizer.ts` (buildPackInput seam; no contextText passed today), `ContextPack.ts` (contextText slot L95-103), `ContextCompressor.ts` (compress-page no-op), `PageContentService.ts`/`WorkspaceStore.currentPageContext` (feed source), `useStreamingLLM.ts` (pageContext:undefined L184), `OptionsPage.tsx`, `AddonSettingsStore.ts`, `personaConfig.ts`, `Setting.ts` (registry + settingRead permission), `errorCodes.ts`, `TokenBudget.ts` (estimateTokens)
- **Anthropic prompt caching docs** — [CITED: platform.claude.com/docs/en/build-with-claude/prompt-caching] exact-prefix byte matching; any cached-block change invalidates system + messages caches
- **OWASP GenAI LLM Top 10 2026, LLM01 Prompt Injection** — [CITED: github.com/GenAI-Security-Project/GenAI-LLM-Top10 `2026/final/LLM01_PromptInjection.md`] architectural-not-interceptive defense; prevention #3 (filters evadable), #5 (invisible Unicode strip), #6 (provenance-labeled channel)

### Secondary (MEDIUM confidence)
- [CITED: github.com/protectai/llm-guard] — ML-classifier guard library, **archived 2026-07-09**; informs the D-4b-05 rationale (industry ML approach is unmaintained + breaks zero-model-call invariant)
- **Prior-phase precedent (in-repo)** — 04-RESEARCH.md (P-5 no test-count assertions, F-5 cache stability), 04a-RESEARCH.md (Validation Architecture format; stale `-x` invocations superseded by `--bail=1`), 04a-CONTEXT.md (D-4a-06 unplugged feed), 04-CONTEXT.md (D-04-01/02/17/18)

### Tertiary (LOW confidence)
- Training-knowledge regex shapes for instruction-override phrases (consolidated into the Code Examples pattern set) — tagged `[ASSUMED]` (A1)
- Freshness decay curve and metadata defaults — tagged `[ASSUMED]` (A7)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; every library verified in-repo/registry; zod-3 API constraint verified in harness.ts
- Architecture: HIGH — spec-verbatim types (C.1/O.3), in-repo seams read directly, cache constraint verified against Anthropic docs
- Pitfalls: MEDIUM — regex classifier recall/false-positive behavior is inherently heuristic (OWASP #3 documents evadability); the authority-strip boundary is the mitigant

**Research date:** 2026-08-13
**Valid until:** 2026-09-12 (30 days; stack stable, security guidance fast-moving — OWASP GenAI Top 10 2026 is current as of 2026-08-04)
