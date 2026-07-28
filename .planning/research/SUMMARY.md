# Research Summary: NowPilot Stack

**Domain:** Chrome MV3 AI Assistant Extension + Personal Knowledge Platform
**Researched:** 2026-07-28
**Overall confidence:** HIGH

## Executive Summary

The 2025/2026 standard stack for a Chrome MV3 AI assistant extension has converged on **WXT + React 19 + antd 6 + AI SDK v7** as the foundation layer. WXT has become the de facto framework for MV3 extension development, replacing raw webpack/rollup setups and Plasmo for projects requiring explicit manifest control. The Vercel AI SDK has rapidly evolved from v1 to v7 in under a year, with provider packages at v4 and the core at v7 — this is the most critical version finding, as the project's original `@ai-sdk/* ^1` constraint is now multiple major versions behind.

The AI chat UI landscape has consolidated around Ant Design X v2 with its RICH paradigm (Role, Intention, Conversation, Hybrid UI), but the project's deliberate decision to exclude `@ant-design/x-sdk` (useXChat/ChatProvider) is architecturally sound — the AgentOrchestrator/ProviderRouter/ContextOptimizer pipeline must own the data flow to enforce PlannerService→ExecutorService→RendererService tier caps and memory injection.

For personal knowledge management, the stack combines MiniSearch v7 (in-memory full-text search for notes), idb v8 (type-safe IndexedDB for structured data), and defuddle v0.19 (page content extraction) — all lightweight, zero-dependency libraries that avoid MV3 bundle bloat. The filesystem sync layer uses yaml v2 for frontmatter parsing, and DOMPurify v3.4 guards all AI-generated content before rendering.

The two most impactful version corrections from the project's initial constraints are: (1) `@ai-sdk/*` providers must be v4 (v1 is unsupported and throws `AI_UnsupportedModelVersionError`), and (2) zod must be v4 (v3's `.strict()`/`.passthrough()` are deprecated in favor of `z.strictObject()`/`z.looseObject()`). Both are breaking but necessary changes that affect every phase of development.

## Key Findings

**Stack:** WXT 0.21 + React 19.2 + antd 6.5 + Ant Design X 2.9 + AI SDK v7 (core) / v4 (providers) + Zustand 5.0 + MiniSearch 7.2 + idb 8.0 + Motion 12.42

**Architecture:** Four-tier MV3 architecture: Service Worker (chrome.storage, alarms, fetch), Side Panel (full React/antd/x stack, primary WorkspaceStore), Full App Tab (shared stack, secondary WorkspaceStore), Content Scripts (defuddle extraction only, <50KB bundle)

**Critical version corrections:**
1. `@ai-sdk/*` v1 → v4 (v1 unsupported, v4 is current stable for providers)
2. `ai` (core) v7 (system→instructions rename, stabilized activeTools)
3. `zod` v3 → v4 (strictObject replaces .strict())
4. `wxt` ^0.19 → ^0.21 (latest stable)
5. `motion` NOT `framer-motion` (rebranded, old package deprecated)

**Critical pitfall:** AI SDK v7's `system→instructions` rename is a breaking change that affects every AI call in the codebase. Must be addressed before any AI integration work begins. The project's AgentOrchestrator should use `instructions:` instead of `system:`.

## Implications for Roadmap

Based on research, the stack is ready for immediate implementation. Version corrections are breaking but well-understood:

**Phase ordering remains valid.** The knowledge-first ordering (acquire→store→understand→display→extend→harden) is unchanged by stack revisions. The stack supports all phases as designed.

**Version bump impact by phase:**
- **Phase 1 (Shell):** No version impact — WXT/React/antd versions are close enough
- **Phase 2 (AI Core):** CRITICAL — Must adopt AI SDK v7 API (`instructions:` not `system:`, `activeTools` not `experimental_activeTools`). Zod v4 schemas (`z.strictObject()`).
- **Phase 3 (Memory):** No version impact
- **Phase 4 (Context/Page):** defuddle v0.19 has richer metadata than v0.6
- **Phase 5 (Notes/Link):** No version impact
- **Phase 6 (LLM-Wiki):** AI SDK v7 tool calling with `stopWhen: isStepCount(5)`
- **Phase 7 (Add-ons):** AI SDK unified provider interface simplifies multi-provider support
- **Phase 8 (RICH UI):** Motion v12 with `AnimatePresence` for message/panel transitions
- **Phase 9 (Security):** DOMPurify v3.4 with Trusted Types support

**Phase ordering rationale:**
- Shell (Phase 1) must come first — establishes WXT entrypoints, Side Panel/Full App Tab shells, Zustand WorkspaceStore
- AI Core (Phase 2) must come early — the AI SDK v7 API surfaces influence every subsequent AI integration
- Storage (Phase 5/NOTES) must precede LLM-Wiki (Phase 6) — notes must be stored before they can be enriched

**Research flags for phases:**
- Phase 2: AI SDK v7 migration from v1 API patterns — deep research needed on `streamText`/`generateText` differences, tool calling with Zod v4 schemas
- Phase 4: defuddle v0.19 metadata extraction — verify all fields used in PageContentService are available
- Phase 8: Motion v12 API surface — verify `AnimatePresence` layout animations work within antd 6's CSS-in-JS context

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry and official docs (Context7) as of 2026-07-28 |
| AI SDK versions | HIGH | AI SDK core v7, providers v4 confirmed via npm and Context7 migration guides |
| MV3 architecture | HIGH | chrome.sidePanel API, service worker restrictions verified against developer.chrome.com |
| UI compatibility | HIGH | antd 6 + React 19 compatibility confirmed in antd migration guide |
| Ant Design X | HIGH | v2.9.0 confirmed. x-sdk exclusion is deliberate and architecturally correct |

## Gaps to Address

- **Ollama provider stability:** `ollama-ai-provider` v1.2.0 is a community package. If it lags behind AI SDK v7 updates, may need a custom provider adapter
- **IndexedDB sizing:** Large note databases with embedded images may exceed practical IndexedDB limits. Quantitative testing needed in Phase 5
- **Motion + antd CSS-in-JS:** Need to verify that Motion's layout animations work within antd 6's CSS-in-JS style injection order in Phase 8
- **WXT 0.21 HMR reliability:** Need to verify HMR works correctly across both Side Panel and Full App Tab simultaneously (two WXT entrypoints in same extension)
