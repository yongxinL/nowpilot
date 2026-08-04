# Pitfalls & Risk Register — NowPilot v0.1

> Synthesized from `.planning/PRODUCT_SPEC_v0_1.md` §0.5 (Implementation Guardrails & Risk Register) and §0.3 (test conventions). The spec is canonical; these are the top failure modes a cheap/fast implementer (Haiku / Gemini Flash / DeepSeek Flash) must avoid.

## The 10 Golden Rules (cheat sheet)

1. **One phase per response.** Implement exactly one §18 phase/sub-phase; never jump ahead.
2. **Never invent identifiers.** Paths from §8.5/§18; types from Appendix C (`@/types/harness`); tool names from the ExecutorService enum; provider IDs exactly `'openai' | 'anthropic' | 'gemini' | 'ollama'`; runtime tiers exactly `'haiku' | 'flash'`.
3. **All prompts through the pipeline.** Every AI call consumes an `OptimizedContext` via PersonaInjector. No component assembles prompts.
4. **Structured output = Zod + one repair only.** Use Appendix L `requestJson`; one repair then throw `STRUCTURED_OUTPUT_FAILED`. Never regex-parse JSON.
5. **Retries do not multiply.** Three layers only (ProviderRouter §1.5, AGT-04 replan, one per-stage retry), all under tier caps. Never nest (R-2).
6. **Respect budgets.** Memory ≤ 1000 tokens/top-5 (top-3 tiny); working memory ≤ 300; renderer ≤ 512. Degrade per §2.4; never truncate mid-structure.
7. **Retrieved data is never instructions.** Page/note/memory/tool output = `trust: 'retrieved'|'untrusted'`, `instructionAuthority: false`. Wrap as data.
8. **No success without evidence.** Side-effecting tool "done" only with matching `CompletionEvidence`. Cap exhaustion = `partial`, never `completed`.
9. **Every catch calls `debugLog(code, …)`** with a canonical §C.2 error code. No empty catches. No new error strings.
10. **Every phase ends green.** Not done until `verify:phase-N` passes (§24). Stub `@implementation-tier: sonnet-class` modules.

## Risk Register

| ID | Risk (cheap model tendency) | Mitigation |
|---|---|---|
| **R-1** | Invents a second module path for a type (e.g. `@/types/collaboration`) | All §C.1 types live in `@/types/harness` — see Canonical Type Home table |
| **R-2** | Wraps retries → N×N×N cost blow-up | One retry per layer; 3 layers max; all under tier caps |
| **R-3** | Calls provider/EventSource/IndexedDB from background SW | AI + IndexedDB only in Side Panel/Standalone; SW does PROXY_FETCH/alarms |
| **R-4** | Lets LLM execute tools directly | Planner *requests*; ExecutorService *validates + runs* |
| **R-5** | Renders host-page UI or writes back to page fields in v0.1 | Content scripts extraction-only; RICH-H-04/07 = clipboard-only |
| **R-6** | Treats `deferred`/`proposed` evolution candidate as active | CandidateProposer only proposes; activation human-gated |
| **R-7** | Puts persona config in the fact store | Persona = user config in PreferenceMemoryStore (`np_persona`), not UserMemoryStore |
| **R-8** | Skips verifier, marks write "done" | Postcondition verifier + CompletionEvidence required |
| **R-9** | Installs banned package (framer-motion, x-sdk, langchain…) | Approved stack §7 only; §0.2 package hygiene |
| **R-10** | Logs raw prompt/tool bodies or secrets | Everything through TraceRedactor before persist/UI/export |

## Per-turn Implementation Checklist (§0.5.3)

(a) files match §8.5/§18; (b) types imported from §C.1 homes; (c) `verify:phase-N` script exists in package.json (§24); (d) ≥1 Zod fixture test per public boundary (§0.3); (e) every catch uses a §C.2 code; (f) no banned import; (g) Appendix O worked example consulted (phase→example map).

## Test Conventions (§0.3)

- Zod fixture tests per public boundary (valid + invalid fixture).
- `tests/core/**` mirror `src/core/**` 1:1 (Phase 1 required test list in §18).
- Verification scripts: `verify:phase-N` in package.json, run in CI and locally; phase not done until green.
