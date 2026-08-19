# Phase-1 Planning Addendum — Brownfield Strip / Wire / Migrate

**Created:** 2026-08-19
**For:** `/gsd-plan-phase 1` (hand this to the planner alongside 01-CONTEXT.md + 01-UI-SPEC.md)
**Why this exists:** Phase 1 is NOT a build-from-scratch phase. The frontend (Side Panel, Standalone, Options) is already built by Google AI Studio and shipped WITH demo content. Phase 1 = **converge the messaging/persistence layer + strip demo content + wire real functions to the existing UI**. Standard GSD planning assumes forward-building; this addendum reshapes the plan into strip / wire / migrate tasks so nothing already-working is broken during cleanup.

**Authoritative sources (unchanged):** PRODUCT_SPEC_v0_1.md · 01-CONTEXT.md (D-01…D-23-note, D-07a, D-19a) · 01-UI-SPEC.md · .planning/codebase/CONCERNS.md (VAI-08 verify-first).

> **D-07a resolved (2026-08-19):** Phase 1 **keeps entrypoints at the project root `entrypoints/`** (the WXT default, which the built scaffold already uses). No file move to `src/entrypoints/`. The spec's §5.1/§5.4 `src/entrypoints/` wording is reconciled DOWN to root `entrypoints/`; only the content-script **path shape** is normalized to `entrypoints/content/core.content.ts` (directory form, ISOLATED world). This removes the last open Phase-1 decision.

---

## §0. Five brownfield framings the planner MUST apply

1. **Git baseline is Plan-1 / Task-1 (D-23).** The FIRST action is a single `chore: scaffold import` commit of the built frontend AS-IS (exclude `.output/`, `dist/`, `.wxt/`), plus committing `pnpm-lock.yaml` + `pnpm-workspace.yaml` and removing `package-lock.json` (D-23-note, set `packageManager: "pnpm@11.22.0"`). Every subsequent strip/wire/migrate task is a diffable, revertable commit. No remediation is mixed into the baseline commit.

2. **Verify-against-`src/` before acting (VAI-08).** CONCERNS.md was NOT part of the research set. Before "fixing" any defect, the plan confirms it against the actual code: dual messaging (raw `background.ts` + never-initialized MessageBus), 5 unused permissions, `localhost:12380` default, vacuous isolation test, Tailwind plugin. Do not remediate a phantom.

3. **Tasks are strip / wire / migrate, NOT create.** Phase 1 modifies 6 existing frontend components + the store; it creates only OnboardingModal + BackgroundRouter. Every UI task reads as a surgical edit to a named file (e.g. "SidepanelChat: replace `window.close()` with mirror-banner path"), not "build X".

4. **Migration-safety tasks run BEFORE cosmetic strips.** The two state-corruption risks (theme key move + persist `version`) are sequenced first and tested, so a later cosmetic change can't mask a migration break.

5. **Green-per-commit.** Every remediation commit keeps `verify:phase-1` passing (grep gates + NP-STRICT ceiling + write-rate ≤30/min). A regression must be bisectable to one commit.

---

## §1. Frontend components in Phase-1 scope (strip + wire)

| Component | Action | Wire (real function) | Strip (demo content) | Source |
|---|---|---|---|---|
| **OnboardingWizard → OnboardingModal** | replace | Thin 4-step modal at `src/components/OnboardingModal.tsx`; real `fetchProviderModels` connection test; advance only on explicit Next / success | 1006-line 7-step wizard; 10s Step-4 auto-advance; fake 1s always-success test; Steps 6/7 (MCP-tool/SN-permission, local-state-only) | D-01/02/03 |
| **SidepanelChat** | modify | `handleOpenStandalone`: `window.close()` → mirror-banner path (D-05); empty fresh-install state (D-11); build history as `messages.filter(m=>m.content)` (drop empty-placeholder-to-provider bug) | Fake "screen cut" Unsplash attach; "Share"→"Link copied" mislabel | D-05/D-11 |
| **StandaloneWorkspace → StandaloneShell** | rename + extend | `appPageId → standalonePageId`; `WorkspaceStore.hydrateFromURL` on mount | — | D-07/D-07a |
| **ThemeToggle** | rewire | `useThemeStore.mode` authoritative; cross-surface via `chrome.storage.onChanged('np_theme')`; actionable colorError failure toast ("Try syncing again") | Duplicate `config.themeMode` bridging (2nd source of truth) | D-10 |
| **CommandPalette** | reuse | Register the surface's 4-command Flow 10 set (D-08); only `CommandRegistry.getAll()` callers change | — | D-08 |
| **WorkspaceSidebar** | reuse | Sider chrome only (240/72 px); full Chat/Note/Write/Tools content is Phase 15 | — | UI-SPEC |

---

## §2. Store-level demo-content strip (D-11 / D-12) — the "clean fresh install" tasks

These live in `src/store/useExtensionStore.ts`, not a component:

- [ ] `INITIAL_SESSIONS` → **`[]`** (removes 6 fake convos: INC001234, "critical thinking", "Good morning to you too!")
- [ ] `INITIAL_NOTES` → **`[]`** (removes 5 fake ServiceNow notes, 2024 dates)
- [ ] `INITIAL_WRITE_HISTORY` → **`[]`** (removes 3 fake items)
- [ ] Remove all **Unsplash `images.unsplash.com`** fallbacks (privacy leak — outbound 3rd-party)
- [ ] `simulateStreamResponse` → gate behind `DEMO_MODE` config key **AND** `import.meta.env.DEV`; never the default path (D-12)
- [ ] `localhost:12380` → NOT a canonical default; not pre-filled in onboarding proxy field (D-12; also a UI-SPEC anti-pattern gate)
- [ ] Add persist `version: 1` + no-op `migrate` to the god-store (D-22)

**Scaffold-leftover hygiene (CONCERNS.md — cheap wins, same phase):**
- [ ] `index.html` title "My Google AI Studio App" → "NowPilot"
- [ ] `metadata.json` `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` → remove/rename
- [ ] `src/main.tsx` dev-shell tag "Default AntD v6 & X" → remove

---

## §3. Core (non-UI) convergence tasks — the MV3 discipline

| Task | Detail | Source |
|---|---|---|
| Single messaging layer | `background.ts` calls `BackgroundRouter.register()` (which calls `MessageBus.init()`); remove the raw `chrome.runtime.onMessage` listener; every handler returns `true` sync + `sendResponse` once | D-13/D-14 |
| Frozen extraction envelope types (type-only) | Declare `PAGE_LIVE_CONTEXT`, `PAGE_EXTRACTION_REQUESTED`, `PAGE_HTML_PAYLOAD` (with `baseUrl`/`truncated`) in RuntimeEnvelope; NO strategy logic (Phase 6) | D-15 |
| `isPrimaryWriter()` predicate | Declare on WorkspaceStore; returns `true` in Phase 1 (election = Phase 2); Phase-2 swap point documented in a code comment | D-16 |
| Real isolation tests | Repoint the vacuous grep at real dirs (`chat/`+`standalone/`+`options/`); assert no cross-imports both directions; add `no fetch(` in `entrypoints/content/**` | D-17 |
| Remove Tailwind | Drop `@tailwindcss/vite` plugin, `@import "tailwindcss"` in `src/index.css`, any `tailwind.config.*`; keep `motion` (^12) | D-18 |
| Least-privilege manifest | Authoritative Phase-1 set = `['sidePanel','storage','tabs']` (D-19a); drop the other 6 (declarativeNetRequest unconditional) | D-19a |
| Stack bump + strict | Immer 10→11, Zod 3→4; `strict:true` via `@ts-expect-error NP-STRICT-<n>` sweep + verify:phase-1 marker ceiling | D-20/D-21 |
| Entrypoint canonicalization | **KEEP root `entrypoints/` (WXT default — the built scaffold already uses it).** Do NOT migrate to `src/entrypoints/` (costly file move, no benefit). Set `wxt.config.ts` `srcDir` to match root; reconcile the spec's §5.1/§5.4 `src/entrypoints/` references DOWN to root `entrypoints/`. Content-script PATH SHAPE is still normalized to the directory form `entrypoints/content/core.content.ts` (ISOLATED world), and the D-17 isolation grep targets that path. | D-07a (resolved) |

---

## §4. MIGRATION-SAFETY sequence (run FIRST in execution — §0 framing 4)

These two are the only Phase-1 changes that can corrupt existing persisted state on reload. Execute + test BEFORE the cosmetic strips:

1. **Theme key move:** `chrome.storage.local.np_theme_store` → `chrome.storage.sync.np_theme` (+ declare `pack` field, default `'default'`). Test: existing user reload does not lose theme; `onChanged` propagates cross-surface (D-10 / A1).
2. **Persist version/migrate:** add `version:1` + `migrate` to the god-store BEFORE emptying `INITIAL_*`. Test: reload of a store persisted under the old (no-version) shape does not throw and does not resurrect demo data. Keep zustand `version` DISTINCT from IndexedDB `DB_VERSION` (Phase 2+, reaches v4) — do not conflate (A5).

---

## §5. Verify gates (green-per-commit — §0 framing 5)

Every remediation commit must keep these passing (from UI-SPEC + spec §24):
```
grep -r 'innerHTML|dangerouslySetInnerHTML' src/                → zero
grep 'tailwind|shadcn|@radix-ui'            package.json         → zero
grep 'framer-motion'                        package.json         → zero
grep -r 'fetch('                            entrypoints/content/** → zero
grep -r 'NP-STRICT-'                        src/ entrypoints/    → ≤ declared ceiling
grep -rE '(padding|margin|gap):\s*(2px|12px|20px)' src/ entrypoints/ → zero
grep -rE 'fontSize:\s*(11|20|24|28|30)'     src/ entrypoints/    → zero
tsc --noEmit                                                     → passes
```
Plus behavioral DONE-when (spec §18 Phase 1): fresh install → OnboardingModal; Standalone opens + idempotent re-open by workspaceId; Cmd+K on both surfaces; theme propagates to both surfaces immediately; workspace state hands off with no message loss; write-rate ≤30/min during streaming (D-22).

---

## §6. Explicitly OUT of Phase-1 scope (built-but-deferred — do NOT touch)

The frontend contains these built-with-demo components; they belong to later phases. A Phase-1 agent must NOT strip/rewire them:

| Component | Owning phase | Note |
|---|---|---|
| OptionsPage (incl. hardcoded "George Li / oraclexp@hotmail.com" profile) | Phase 15 | Identity strip is a Phase-15 task; flag now, don't fix in Phase 1 |
| NotesWorkspace | Phase 8/9 | — |
| StandaloneWritePage (100%-template Write/Reply) | Phase 17 | — |
| ToolsGridPanel / AgentPage (placeholder, no behavior) | Phase 3/7/17 | — |
| TabContextSelector / PinnedTabsBar (`availableTabs` always `[]`) | Phase 6/17 | Dead UI — leave as-is |
| Real provider streaming (OpenAI/Anthropic/Gemini SSE) | Phase 3 | — |

**Rule:** if a demo-content or dead-UI item is in a §6 component, it stays for now. Phase 1 only strips demo content from the §1 components + the §2 store defaults.

---

## §7. Suggested plan split (planner's call — ROADMAP lists 0/3)

A brownfield-shaped 3-plan split:
- **Plan 1 — Baseline + core convergence:** git import (D-23), messaging single-layer (D-13/14), manifest least-privilege (D-19a), Tailwind removal (D-18), stack bump + strict scaffold (D-20/21), isolation tests (D-17), entrypoint canonicalization (D-07a — **keep root `entrypoints/`**, normalize content-script path shape only, no file move).
- **Plan 2 — Migration + store strip:** theme key move + persist version/migrate (§4, FIRST), then INITIAL_* empty + simulateStreamResponse gate + scaffold-leftover hygiene (§2).
- **Plan 3 — UI wiring:** OnboardingModal replace (D-01/02/03), SidepanelChat mirror-banner + empty state (D-05/11), StandaloneShell rename + hydrateFromURL (D-07a), ThemeToggle rewire (D-10), CommandPalette Flow 10 set (D-08), frozen envelope types (D-15), isPrimaryWriter predicate (D-16).

_Once applied, `/gsd-plan-phase 1` produces brownfield-correct plans: baseline-first, verify-against-src, strip/wire/migrate-shaped, green-per-commit — not build-from-scratch._
