# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 1-MV3/WXT Runtime + AntD Shells + Workspace
**Areas discussed:** Package manager & verify tooling, Onboarding depth, Theme packs, Cmd+K + content-script breadth

---

## Package Manager & Verify Tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Switch to pnpm | Spec §18/§24 commands are pnpm; pnpm 11.18.0 installed; remove npm package-lock.json | ✓ |
| Stay with npm | Keep npm; update spec commands to npm run | |
| Hybrid | Keep npm lockfile, use pnpm for verify | |

**User's choice:** Switch to pnpm
**Notes:** Spec's verification commands are pnpm-native. Standardize; remove npm package-lock.json to prevent drift.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-phase scripts + verify:all | verify:phase-1…9 + aggregate verify:all (spec §24) | ✓ |
| One monolithic verify | Single verify:all, no per-phase gates | |

**User's choice:** Per-phase scripts + verify:all

| Option | Description | Selected |
|--------|-------------|----------|
| vitest + testing-library + jsdom + msw | Full spec §7.8 stack now | ✓ |
| vitest only for Phase 1 | Add testing-library/msw later | |

**User's choice:** vitest + testing-library + jsdom + msw

| Option | Description | Selected |
|--------|-------------|----------|
| Lint + prettier + typecheck | eslint + prettier + tsc --noEmit gating in verify | ✓ |
| Typecheck only | tsc --noEmit only | |

**User's choice:** Lint + prettier + typecheck

| Option | Description | Selected |
|--------|-------------|----------|
| WXT scaffold + spec overlay | `pnpm dlx wxt@latest init` then overlay spec files | ✓ |
| Hand-write from spec | Write every file from §18 + Appendix G manually | |

**User's choice:** WXT scaffold + spec overlay

---

## Onboarding Depth (Flow 9)

| Option | Description | Selected |
|--------|-------------|----------|
| Full 4-step with provider stub | All 4 steps, provider list/key/validate on ProviderConfig schema stub | |
| Persona card + configure-later gate | Step 1 persona card + disabled surface until provider configured | ✓ |
| Placeholder only | Disabled surface placeholder, full flow deferred to Phase 3 | |

**User's choice:** Persona card + configure-later gate

| Option | Description | Selected |
|--------|-------------|----------|
| ProviderRegistry check | Gate = no activeProvider in ProviderRegistry | ✓ |
| Boolean flag | onboarding_complete flag, provider check later | |

**User's choice:** ProviderRegistry check

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only default persona | Display np_persona defaults, not editable | ✓ |
| Editable in onboarding | Inline name/tone/brevity editing now | |

**User's choice:** Read-only default persona

| Option | Description | Selected |
|--------|-------------|----------|
| Deep-link to Options | CTA opens Standalone view → Options via WorkspaceRouter | ✓ |
| Dismiss only | CTA dismisses onboarding, manual setup later | |

**User's choice:** Deep-link to Options

---

## Theme Packs (Appendix F)

| Option | Description | Selected |
|--------|-------------|----------|
| All 3 packs + mode | Implement default/liquid-glass/claude-warm fully | |
| (free-text) | Complete theming architecture; only Default fully implemented; Liquid Glass / Claude Warm registered but not required for DONE; Light/Dark/Auto required | ✓ |

**User's choice (free-text):** Phase 1 establishes the complete theming architecture — themePack, displayMode, token overlay system, persistence, system appearance detection. Only the Default theme pack must be fully implemented. Liquid Glass and Claude Warm may be registered but are not required for Phase 1 DONE. Display modes (Light, Dark, Auto) are required.

| Option | Description | Selected |
|--------|-------------|----------|
| Pack registry with ready flag | Registry of pack → token overlay; not-ready packs hidden | ✓ |
| Default only in code | Only default in antdConfig; others added in Phase 7 | |

**User's choice:** Pack registry with ready flag

| Option | Description | Selected |
|--------|-------------|----------|
| chrome.storage.onChanged sync | Canonical chrome.storage.local + onChanged; optional BroadcastBus optimization | ✓ |
| BroadcastBus only | No chrome.storage persistence | |

**User's choice (free-text):** Theme settings persisted in chrome.storage.local as canonical source of truth. Required: themePack persistence, displayMode persistence, chrome.storage.onChanged synchronisation. Optional: local BroadcastBus event for immediate same-context updates. All surfaces react to storage changes and stay consistent after reloads/browser restarts.

| Option | Description | Selected |
|--------|-------------|----------|
| No pack UI until 2nd pack ready | displayMode toggle only in Phase 1 | ✓ |
| Show selector disabled | Pack selector visible but disabled | |

**User's choice (free-text):** Phase 1 establishes ThemePackRegistry + themePack persistence internally. Only Default active. UI exposes displayMode (light/dark/auto) only. Pack selection UI deferred until at least one additional pack reaches active status. No schema/service changes should be required when future packs become enabled.

---

## Cmd+K + Content-Script Breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Full command set, stub unfilled | All Flow 10 commands, no-op + toast for unfilled targets | |
| Only existing commands | Register commands whose targets exist in Phase 1 | ✓ |

**User's choice:** Only existing commands
**Notes:** Open Standalone view, Focus Side Panel, Open Options (Options = page skeleton). No stubs for later-phase features.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal ISOLATED bridge | ContentScriptHost + PageContextBridge plumbing, ping/status only | ✓ |
| Bridge + navigation watcher skeleton | Also scaffold SPANavigationWatcher (inert) | |

**User's choice (free-text):** core.content.ts ships as an architecture skeleton only. Required: ISOLATED world execution, ContentScriptHost skeleton, PageContextBridge plumbing, message routing, ping/status handlers. Not required: DOM extraction, readability parsing, SPA navigation monitoring, page annotations, page actions. Extraction begins in Phase 4a. Content bundle minimal, no extraction-specific logic.

| Option | Description | Selected |
|--------|-------------|----------|
| RuntimeEnvelope protocol | Real Appendix C/E protocol from day one | ✓ |
| Throwaway ping shape | Minimal shape, migrate in Phase 4a | |

**User's choice (free-text):** Content bridge MUST use canonical RuntimeEnvelope + MessageType (Appendix C/E). Throwaway or phase-specific contracts prohibited. Phase 1 minimum message subset: PING, PONG, GET_CONTENT_CAPABILITIES, CONTENT_CAPABILITIES. Future phases extend via additional MessageType values without changing transport.

| Option | Description | Selected |
|--------|-------------|----------|
| Full §8.4 type, subset active | All 11 fields in type; 4 active in Phase 1 | ✓ |
| Minimal fields now | Only Phase 1 fields; churn later | |

**User's choice:** Full §8.4 type, subset active

---

## the agent's Discretion

- Empty-state layouts for the four page skeletons (Chat/Agent/Notes/Options).
- KeymapRegistry defaults for Cmd+K (mod+k / ctrl+k).
- i18n seeding from Appendix B; no full translation framework in Phase 1.

## Deferred Ideas

- Full 4-step onboarding (provider pick → key → validate) — Phase 3.
- Theme pack selector UI — when a second pack reaches active status (likely Phase 7 Options appearance).
- Side-panel provider editing/diagnostics/prompt management/MCP/feature flags/Import-Export — excluded from side panel by spec §9.1; Standalone view in later phases.
- Page injection / host-page automation — out of scope for v0.1 (spec §0.2 R1, §6.5).
