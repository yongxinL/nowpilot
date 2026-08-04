# Research Summary — NowPilot v0.1

> Produced during `/gsd-new-project --auto`. All findings are synthesized from the project's canonical design contract `.planning/PRODUCT_SPEC_v0_1.md` (which declares itself the single authoritative implementation reference). Companion files: `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`.

## Verdict

**Greenfield build; stack, architecture, and features are fully pre-specified. No open research questions — the spec §18 is the authoritative roadmap.** The GSD artifacts (PROJECT.md, REQUIREMENTS.md, ROADMAP.md) should mirror the spec, not re-derive it.

## Key Findings

1. **Product**: privacy-first Chrome MV3 AI assistant + personal knowledge platform. Two surfaces (Side Panel chat-only + Standalone full workspace) sharing a Zustand `WorkspaceStore`. Local-first (Ollama/openai/anthropic/gemini), offline-capable, cost-effective by design.

2. **Stack** (§7): WXT ^0.19 + React 19 + TypeScript strict + Ant Design v6 + @ant-design/x ^2 + motion ^12 (never framer-motion). Vercel AI SDK ^4 (ai, @ai-sdk/openai|anthropic|google). idb ^8, defuddle ^0.6, minisearch ^7, zod ^3. Banned: tailwind, shadcn/ui, radix, react-markdown chain, x-sdk, x-card.

3. **Architecture** (§1/§8): Planner→Executor→Renderer orchestration, coordinator-based agent platform, single-agent default = one-role CollaborationPlan. AI + IndexedDB in Side Panel/Standalone only (never background SW). Content scripts extraction-only, no host-page UI. TraceRedactor on every sensitive flow. Trust-aware context; CompletionEvidence for side-effecting tools. Human-verified evolution, never autonomous.

4. **Phases** (§18, canonical order): `1 → 2 → 3 → 3a → 4 → 4a → 4b → 5 → 5a → 5b → 6 → 6a → 6b → 6c → 7 → 7a → 8 → 8a → 9`. Reorg principle: acquire → store → understand → display → extend → harden, with reliability sub-phases adjacent to the capability they extend (PageContentService=4a, Knowledge Base=5, LLM-Wiki+FS sync=5a, Workspace+RICH=7, Add-ons=8, Tool governance=8a, Hardening=9).

5. **Pitfalls**: the spec ships a ready-made 10 golden rules + 10-entry risk register (§0.5) for cheap-model implementers — one phase per response, never invent identifiers, all prompts through pipeline, Zod+one-repair structured output, no nested retries, respect token budgets, retrieved data is never instructions, no success without evidence, canonical error codes, every phase ends green (`verify:phase-N`).

6. **Governance**: add-ons register via AddonRegistry (Zod settings, no host-page UI). ServiceNow site-scoped; Write + TeamGQM global. Verified evolution only proposes; human activates.

## Recommendations

- Roadmap must preserve the spec §18 canonical phase order verbatim — §18 declares itself the sole implementation sequencing authority.
- Phase success criteria should be drawn from each phase's DONE-when list in §18.
- Keep REQUIREMENTS.md categories aligned to spec requirement namespaces (§9 features, §27 LLM-Wiki/CAT/LLM-WIKI/SYNC, §28 AGT/CTX/MEM/KNW/TOL/EVAL/EVO/PROP/MM/COLLAB).
- Cost-effective model guardrails (§0.5) should be re-stated in AGENTS.md so any implementing agent follows them.
