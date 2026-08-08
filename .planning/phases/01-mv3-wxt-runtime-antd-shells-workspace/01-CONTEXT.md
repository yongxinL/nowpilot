# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the foundational Chrome MV3 extension runtime: a WXT scaffold with two surfaces (Side Panel + Standalone view) that share a WorkspaceStore, a theme system, first-run onboarding, a Cmd+K palette, an extraction-only content-script skeleton, the core runtime/messaging primitives (RuntimeEnvelope, OperationId, BroadcastBus, PortReader, workerState, MessageBus, EventBus, debugLog), registries, and Chat/Agent/Notes/Options page skeletons. All file paths, types, and flows are locked by spec §18 / §8.4 / Appendix C/E/F/G.

</domain>

<decisions>
## Implementation Decisions

### Package Manager & Tooling
- **D-01:** Standardize on **pnpm**. Remove the npm `package-lock.json` to avoid lockfile drift. pnpm 11.18.0 is installed.
- **D-02:** Verification is per-phase: `verify:phase-1` … `verify:phase-9` scripts plus an aggregate `verify:all` (per spec §24).
- **D-03:** Test stack: **vitest + @testing-library/react + jsdom + msw** (spec §7.8) — established now, msw ready for later provider mocking.
- **D-04:** Quality gates inside `verify:phase-N`: eslint + prettier + `tsc --noEmit` (typecheck), in addition to the phase's Zod fixture tests and isolation checks.
- **D-05:** Bootstrap via **WXT scaffold** (`pnpm dlx wxt@latest init` / `wxt add`), then overlay the spec §18 / Appendix G file set. Do not hand-write the scaffold from scratch.

### Onboarding (Flow 9)
- **D-06:** Phase 1 ships **Step 1 (persona card) + a "configure later" gate** — not the full 4-step provider flow. Provider steps (pick provider → enter key → validate) arrive with Phase 3.
- **D-07:** The gate condition is a **ProviderRegistry check** for an active provider (`activeProvider`). No provider configured ⇒ onboarding shows persona card then a disabled surface.
- **D-08 [informational]:** The persona card is **read-only default persona** (name/tone/brevity from `np_persona` defaults in PreferenceMemoryStore) — not editable (editing is Phase 7 Options → Persona). Already delivered in OnboardingModal, verified; drove read-only persona constraint.
- **D-09:** The "Configure provider" CTA **deep-links to Options** in the Standalone view (via WorkspaceRouter). Onboarding completes once a provider is configured.

### Theme (Appendix F)
- **D-10:** Phase 1 establishes the **complete theming architecture**: `themePack` + `displayMode` + token overlay system + persistence + system appearance detection. Only the **Default** pack is required to be fully implemented; Liquid Glass and Claude Warm may be registered but are **not** required for Phase 1 DONE.
- **D-11:** Display modes (Light / Dark / Auto) **are required** in Phase 1.
- **D-12:** Packs register via a **ThemePackRegistry with a `ready` flag**. Default is `ready`; liquid-glass/claude-warm are registered as not-ready.
- **D-13:** Theme persistence: **chrome.storage.local is the canonical source of truth** for `themePack` + `displayMode`, with **chrome.storage.onChanged synchronisation** across surfaces. Optional optimization: a local BroadcastBus event for immediate same-context updates. All surfaces stay consistent after reloads and browser restarts.
- **D-14:** The Phase 1 UI exposes **displayMode selection (light/dark/auto) only**. No theme-pack selector appears until at least one additional pack reaches active status. No schema or service changes should be required when future packs become enabled.

### Cmd+K Palette (Flow 10)
- **D-15:** Phase 1 registers **only commands whose targets exist** in Phase 1: Open Standalone view, Focus Side Panel, Open Options (Options is a page skeleton). Do not register stub commands for features landing in later phases.

### Content Script (core.content.ts)
- **D-16:** Ships as an **architecture skeleton only**: ISOLATED-world execution, ContentScriptHost skeleton, PageContextBridge plumbing, message routing, and ping/status handlers. **No** DOM extraction, readability parsing, SPA navigation monitoring, page annotations, or page actions. Extraction begins in Phase 4a.
- **D-17:** The content bridge **MUST use the canonical RuntimeEnvelope + MessageType protocol** (Appendix C/E). Throwaway or phase-specific message contracts are prohibited. Phase 1 implements the minimum message subset: `PING`, `PONG`, `GET_CONTENT_CAPABILITIES`, `CONTENT_CAPABILITIES`. Future phases extend via additional MessageType values without changing the transport contract.

### Workspace (Appendix M / §8.4)
- **D-18:** The shared WorkspaceStore declares the **full §8.4 field set** in its type (workspaceId, conversationId, activeProvider, selectedModel, pinnedTabs, currentPageContext, selectedNotes, activeAddonContext, activeSkillRun, activeSurface, openedStandaloneTabId), with only the fields Phase 1 needs **active** (workspaceId, conversationId, activeSurface, openedStandaloneTabId). The rest are present in the type but inert — this prevents type churn in later phases.

### the agent's Discretion
- Empty-state layouts for the four page skeletons (Chat/Agent/Notes/Options) — render a functional placeholder consistent with the AntD theme; no innerHTML.
- KeymapRegistry defaults for Cmd+K (macOS `mod+k`, Windows/Linux `ctrl+k`) — follow WXT/Chrome conventions.
- i18n strings: seed from spec Appendix B canonical strings; no full translation framework in Phase 1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §18 "Master Implementation Phases" (Phase 1 at lines ~2418–2473) — authoritative file list, required tests, DONE-when criteria for Phase 1
- `.planning/PRODUCT_SPEC_v0_1.md` §8.1 "Extension Contexts" (lines ~1190–1234) — background SW / side panel / standalone / content-script structure
- `.planning/PRODUCT_SPEC_v0_1.md` §8.4 "Shared Workspace Model" (lines ~1285–1309) — WorkspaceStore field set, handoff URL format, single-writer election
- `.planning/PRODUCT_SPEC_v0_1.md` §0.5 "Implementation Guardrails & Risk Register" (lines ~191–226) — 10 golden rules + risk register (R-1…R-10) + per-turn checklist

### Appendices (all in `.planning/PRODUCT_SPEC_v0_1.md`)
- **Appendix G** (line ~5302) — complete `wxt.config.ts` (manifest permissions, CSP, manualChunks, content-bundle isolation rules)
- **Appendix F** (line ~5103) — Ant Design Theme System: `ThemeStore.ts`, `antdConfig.ts`, pack token overlays
- **Appendix C** (line ~4137) — Canonical Type Registry (MANDATORY): `RuntimeEnvelope`, `ResponseEnvelope`, provider/LLM types
- **Appendix C.2** (line ~4918) — canonical error codes for `debugLog(code, …)`
- **Appendix E** (line ~5019) — MessageType Registry and Port Protocol (PING/PONG etc.)
- **Appendix M** (line ~5729) — WorkspaceStore reference implementation
- **Appendix A** (line ~3962) — Canonical Prompt Constants (`src/core/prompts/index.ts`)
- **Appendix B** (line ~4029) — Canonical User Strings (`src/core/i18n/strings.ts`)
- **Appendix H** (line ~5360) — Reserved

### Flows (in `.planning/PRODUCT_SPEC_v0_1.md`)
- **Flow 9** (line ~1702) — First-Run Onboarding
- **Flow 10** (line ~1706) — Command Palette (Cmd+K)
- **Flow 11** (line ~1710) — Open Standalone view (Workspace Handoff)
- **Flow 14/15** (lines ~1734–1746) — background on FS sync (not Phase 1, context only)

### Project planning artifacts
- `.planning/ROADMAP.md` — Phase 1 goal + success criteria (lines ~31–43)
- `.planning/REQUIREMENTS.md` — RUNTIME-01…05, WSPC-01…05 traceability
- `.planning/PROJECT.md` — core value, constraints, key decisions (esp. stack, no banned packages, extension-context rules)
- `AGENTS.md` — project instruction file (10 golden rules, risk register, approved stack, banned list)

### Reference implementation
- Appendix O (line ~6006) — Worked reference implementations for cost-effective models (consult the phase→example map for Phase 1-relevant examples)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing source code — greenfield. The spec's Appendices F, G, M, and Appendix O contain ready-to-adapt reference implementations (ThemeStore, wxt.config.ts, WorkspaceStore).

### Established Patterns
- Project planning structure established: STATE.md, PROJECT.md, REQUIREMENTS.md, ROADMAP.md, AGENTS.md (spec §18 canonical order, cost-effective-model guardrails).

### Integration Points
- `.planning/` is the planning root; `src/` does not exist yet — Phase 1 creates it per spec §8.5/§18.
- Spec mandates `tests/core/**` mirrors `src/core/**`; Phase 1 required tests are listed in §18.
- Existing `.planning/config.json` has `commit_docs: true`, `parallelization: true`, `workflow` agents on, `mode: yolo`, `granularity: fine`.

</code_context>

<specifics>
## Specific Ideas

- The extension is a **Chrome MV3** extension; minimum supported Chrome is chrome120 (Appendix G target) because `chrome.sidePanel.open` requires it.
- AntD v6 uses CSS-variable theming by default; React 19.
- Content-script bundle MUST NOT include antd, @ant-design/x, @ant-design/x-markdown, react, react-dom, defuddle, or yaml (Appendix G manualChunks + isolation test).

</specifics>

<deferred>
## Deferred Ideas

- **Full 4-step onboarding (pick provider → enter key → validate)** — belongs to Phase 3 when provider config exists.
- **Theme pack selector UI** — appears once a second pack (liquid-glass / claude-warm) reaches active status (Phase 7 Options appearance section likely).
- **Provider editing, diagnostics, prompt management, MCP editor, feature flags, Import/Export in side panel** — spec §9.1 explicitly excludes these from the side panel; they belong to the Standalone view in later phases.
- **Page injection / host-page automation** — explicitly out of scope for v0.1 (spec §0.2 R1, §6.5).

None — discussion stayed within phase scope; all deferred items are tracked above.

---

*Phase: 1-MV3/WXT Runtime + AntD Shells + Workspace*
*Context gathered: 2026-08-04*
