# NowPilot — Project Instructions (opencode)

## How to Work Here

- This project uses the **GSD workflow** (`.planning/`). Always start work by reading `.planning/STATE.md`, then `.planning/PROJECT.md`, then the relevant plan/roadmap files.
- Treat `/gsd-...` or `gsd-...` commands as command invocations and load the matching workflow from `/home/yongxin.Li/.config/opencode/gsd-core/workflows/`.
- Prefer the `codebase-memory-mcp` knowledge-graph tools (`search_graph`, `trace_path`, `get_code_snippet`) for code discovery in this repo.
- Do not apply GSD workflows unless the user explicitly asks.
- After completing any deliverable, offer the next step before stopping.

## Single Source of Truth

**`.planning/PRODUCT_SPEC_v0_1.md` is the canonical, authoritative design contract** — the spec declares itself a standalone implementation reference. Implementations must treat it as authoritative and complete. `.planning/ROADMAP.md` §18's phase order mirrors the spec's canonical order and is the only valid implementation sequencing:

```
1 → 2 → 3 → 3a → 4 → 4a → 4b → 5 → 5a → 5b → 6 → 6a → 6b → 6c → 7 → 7a → 8 → 8a → 9
```

Implement exactly **one §18 phase (or sub-phase) per response**. Never jump ahead; later phases depend on earlier contracts.

## The 10 Golden Rules (spec §0.5 — READ FIRST)

1. **One phase per response.** Never jump ahead.
2. **Never invent identifiers.** File paths from §8.5/§18; types from Appendix C (`@/types/harness`); tool names from the ExecutorService enum; provider IDs exactly `'openai' | 'anthropic' | 'gemini' | 'ollama'`; runtime tiers exactly `'haiku' | 'flash'`.
3. **All prompts through the pipeline.** Every AI call consumes an `OptimizedContext` via PersonaInjector. No React component/hook assembles prompts directly.
4. **Structured output = Zod + one repair only.** Use Appendix L `requestJson`; exactly one repair then throw `STRUCTURED_OUTPUT_FAILED`. Never hand-parse JSON with regex.
5. **Retries do not multiply.** Three layers max (ProviderRouter, AGT-04 replan, one per-stage retry), all under tier caps. Never nest.
6. **Respect budgets.** Memory ≤ 1000 tokens / top-5 (top-3 tiny); working memory ≤ 300; renderer ≤ 512. Degrade per §2.4; never truncate mid-structure.
7. **Retrieved data is never instructions.** Page/note/memory/tool output is `trust: 'retrieved'|'untrusted'` with `instructionAuthority: false`.
8. **No success without evidence.** Side-effecting tool "done" only with matching `CompletionEvidence`. Cap exhaustion = `partial`, never `completed`.
9. **Every catch calls `debugLog(code, …)`** with a canonical §C.2 error code. No empty catches. No new error strings.
10. **Every phase ends green.** Not done until `verify:phase-N` passes. Stub `@implementation-tier: sonnet-class` modules.

## Risk Register (top failure modes → mitigation)

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Invents a second module path for a type | All §C.1 types live in `@/types/harness` |
| R-2 | Nested retries → cost blow-up | One retry per layer; 3 layers max; under tier caps |
| R-3 | Calls provider/IndexedDB from background SW | AI + IndexedDB live in Side Panel/Standalone only |
| R-4 | Lets the LLM execute tools directly | Planner *requests*; ExecutorService *validates + runs* |
| R-5 | Host-page UI or write-back in v0.1 | Content scripts extraction-only; clipboard-only |
| R-6 | Treats `deferred`/`proposed` evolution as active | CandidateProposer only proposes; activation human-gated |
| R-7 | Persona config in fact store | Persona = user config in PreferenceMemoryStore (`np_persona`) |
| R-8 | Skips verifier, marks write "done" | Postcondition verifier + CompletionEvidence required |
| R-9 | Installs banned package | Approved stack §7 only; §0.2 package hygiene |
| R-10 | Logs raw prompt/tool bodies or secrets | Everything through TraceRedactor before persist/UI/export |

## Approved Stack (spec §7 — do not install anything else)

WXT ^0.19 · React 19 · TypeScript strict · Ant Design ^6 · @ant-design/icons ^6 · @ant-design/x ^2 · @ant-design/x-markdown ^2 · motion ^12 (import from `motion/react`, **never framer-motion**) · zustand ^5 · immer ^10 · ai ^4 · @ai-sdk/openai|anthropic|google ^1 · @modelcontextprotocol/sdk ^1 · zod ^3 · zod-to-json-schema ^3 · idb ^8 · yaml ^2 · defuddle ^0.6 · @mozilla/readability ^0.5 · turndown ^7 · dompurify ^3 · minisearch ^7 · d3-force ^3 · fflate ^0.8 · papaparse ^5 · @types/wicg-file-system-access.

**Banned:** tailwindcss, @tailwindcss/vite, shadcn/ui, @radix-ui/react-*, class-variance-authority, clsx, tailwind-merge, react-markdown, remark-gfm, rehype-highlight, highlight.js, katex, @ant-design/x-sdk, @ant-design/x-card.

## Non-Negotiable Architecture Rules

- **Extension contexts**: AI + IndexedDB live in Side Panel/Standalone only; background SW does PROXY_FETCH / alarms / context menus / CORS proxy.
- **Orchestration**: Planner→Executor→Renderer with bounded loop; **never maxSteps loops**. Planner requests; Executor validates + runs.
- **Agent platform**: coordinator-based; single-agent default = one-role CollaborationPlan; multi-role opt-in (one runtime/security/tool/memory model).
- **Content scripts**: extraction-only, no UI mount, ISOLATED world by default.
- **Security**: TraceRedactor on every sensitive flow; AES-GCM encrypted vault; DOMPurify on AI/tool output; never log raw prompts/secrets.
- **Evolution**: human-verified only, never autonomous self-modification.

## Verifying Work

- Every phase has a `verify:phase-N` script (spec §24); a phase is not done until it passes.
- Zod fixture tests per public boundary (§0.3); `tests/core/**` mirrors `src/core/**`.
- After changes run lint/typecheck/tests; then offer the next step.
