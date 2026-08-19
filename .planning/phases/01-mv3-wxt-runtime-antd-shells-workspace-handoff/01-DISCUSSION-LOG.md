# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Handoff - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-19
**Phase:** 1-MV3/WXT Runtime + AntD Shells + Workspace Handoff
**Areas discussed:** OnboardingWizard → OnboardingModal (Flow 9); Side panel after handoff (Flow 11); Demo content / simulated-AI purge timing; Scaffold cleanup scope (Phase 1 owns what?); Workspace handoff dead-code wiring; Canonicalize Standalone naming; Stack + strictness drift (Immer/Zod/strict); Persistence granularity (REQ-R03); Git baseline first; strict-mode rollout approach

---

## OnboardingWizard → OnboardingModal (Flow 9)

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate to thin OnboardingModal | 4 steps: Meet-NowPilot placeholder → provider → key → validate; drop 10s auto-advance; real fetchProviderModels | ✓ (user pre-confirmed as leaning) |

**User's choice:** Migrate to a thin 4-step OnboardingModal (Meet-NowPilot placeholder → provider → key → validate); drop the 10s auto-advance; wire a real connection test (fetchProviderModels, not the 1s always-success timer); persona card deferred to Phase 15 (RICH-R-03).
**Notes:** New file at spec path `src/components/OnboardingModal.tsx`; OnboardingWizard (1006 lines, 7 steps) becomes dead code.

## Side panel after handoff (Flow 11) — full wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Wire full Flow 11 handoff | np_workspace BroadcastChannel + hydrateFromURL + read-only mirror per §11/§19.14 | ✓ |
| Mirror UI against stubbed handoff | UI shell only; Phase 2 fills the wiring | |

**User's choice:** (a) — wires the full Flow 11 handoff. It's a Phase-1 v1 requirement (REQ-F05/F19/F20).
**Notes:** WorkspaceRouter/WorkspaceSync are dead code today; the standalone tab doesn't share conversation state (CONCERNS). This decision cascades into D-04 (openStandalone) and D-05 (Side Panel demotes to read-only mirror, not `window.close()`).

## Demo content / simulated-AI purge timing

| Option | Description | Selected |
|--------|-------------|----------|
| Strip in Phase 1 | Empty all three INITIAL_* arrays, remove Unsplash, gate simulateStreamResponse behind DEMO_MODE/import.meta.env.DEV | ✓ |
| Defer to Phase 3 | Keep demo defaults until real AI ships | |

**User's choice:** Strip in Phase 1 — empty all three INITIAL_* arrays, remove Unsplash fallbacks, gate simulateStreamResponse behind an explicit DEMO_MODE/import.meta.env.DEV flag (REQ-R20, §0.2). Fresh install must be empty.

## Scaffold cleanup scope (Phase 1 owns what?)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 1 owns all four | REQ-R19 (Tailwind), REQ-R01 (MessageBus), REQ-R02 (isolation grep), REQ-R21 (least-privilege manifest) | ✓ |
| Phase 1 defers some | Hold some for later phases | |

**User's choice:** Phase 1 owns all four — REQ-R19 (remove Tailwind + @tailwindcss/vite), REQ-R01 (init MessageBus, retire the raw background path), REQ-R02 (repoint isolation grep at chat/+standalone/+options/ and assert real cross-imports), REQ-R21 (drop the 6 unused permissions). Verify each against src/ first (VAI-08).

## Workspace handoff is dead code — wire full Flow 11

| Option | Description | Selected |
|--------|-------------|----------|
| Wire full Flow 11 | np_workspace BroadcastChannel + hydrateFromURL + WORKSPACE_HANDOFF + mirror | ✓ |
| Stub UI only | Defer wiring to a later phase | |

**User's choice:** Wire the full Flow 11 handoff.
**Notes:** REQ-F05/F19/F20 drive this. WorkspaceRouter.openFullApp → app.html (doesn't exist) is fixed.

## Canonicalize Standalone naming

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize to "Standalone" | openFullApp→openStandalone, app.html→standalone.html, FullAppPageRegistry→StandalonePageRegistry | ✓ |
| Keep mixed | Leave scaffold names + spec names coexisting | |

**User's choice:** Canonicalize Standalone naming across code + spec. Scaffold uses `openFullApp → app.html` and `FullAppPageRegistry`; the real surface is `entrypoints/standalone/` + `standalone.html`. Spec is itself split (§5.1/§5.4/§18 = standalone; §8.1/§8.5 = app/). Pick `standalone` and normalize together. Fixes CONCERNS "Stale Architecture References".

## Stack + strictness drift vs ADRs

| Option | Description | Selected |
|--------|-------------|----------|
| Bump Immer 11 + Zod 4 + strict:true in Phase 1 | All three land together | ✓ |
| Defer strict to a chore | Bump Immer/Zod only | |

**User's choice:** Bump Immer 10→11 + Zod 3→4 + enable strict:true in Phase 1. (Adrs/STACK-01 already matches; ADR-STACK-02 stays at Phase 2.)
**Notes:** Pairs with the strict-mode rollout approach (next row).

## Persistence granularity (REQ-R03)

| Option | Description | Selected |
|--------|-------------|----------|
| Add version/migrate + write-coalesce in Phase 1 | Cheap, prevents upgrade corruption | ✓ |
| Defer all persistence work to Phase 2 | Hold for the bigger indexed-DB work | |

**User's choice:** Add version/migrate + write-coalescing in Phase 1 (cheap, prevents upgrade corruption); defer full slice-split to Phase 2.
**Notes:** Targets ≤ 30 writes/min during streaming (well under the 120/min `chrome.storage.local` throttle).

## Git baseline first

| Option | Description | Selected |
|--------|-------------|----------|
| Commit scaffold as-is first | One "chore: scaffold import" commit; remediation comes as diffable commits | ✓ |
| Mix scaffold + remediation | Single large commit | |

**User's choice:** The entire implementation is uncommitted (13 tracked files; all of `src/`, `entrypoints/`, `tests/` untracked). Recommend Phase 1 commit the scaffold as-is before any remediation, so every cleanup edit is diffable and reversible.
**Notes:** Also canonicalize lockfile (drop `package-lock.json`, commit `pnpm-lock.yaml`, set `packageManager` field).

## strict-mode rollout approach

| Option | Description | Selected |
|--------|-------------|----------|
| Enable strict + sweep every trivial cast | Suppress only structural residue with `// @ts-expect-error NP-STRICT-<n>: <reason>` | ✓ |
| Sweep all 33 as any immediately | Plus structural residue | |
| Strict + noEmitOnError: false | Type errors don't block; track residue | |

**User's choice:** Phase-1 strict landing plan:
1. Enable `strict: true` (spec §7.8) with Immer 10→11 and Zod 3→4 bumps — both low-risk.
2. Sweep every trivial cast to a real type — anything fixable in ~1 line. No arbitrary cap — fix all the cheap ones.
3. Suppress only the genuinely structural residue with `// @ts-expect-error NP-STRICT-<n>: <reason>` — the `wxt.config.ts:15` tailwind-plugin cast, WXT-generated `.wxt` shims, third-party typing gaps. Each carries a tracked marker. Prefer `@ts-expect-error` over `@ts-ignore` because a suppressed error self-destructs once the underlying type is fixed — no silent rot.
4. Gate the debt: add a `verify:phase-1` assertion that greps `src/` + `entrypoints/` for `NP-STRICT-` markers and fails if the count exceeds a declared ceiling.
5. Track the sweep-down as an explicit Phase 2–3 task ("reduce NP-STRICT ceiling to 0"), recorded in `.planning/`, not left implicit.

Net: Phase 1 ships green (tsc --noEmit passes because expected-errors are suppressed), strict is on from day one, and the remaining debt is explicit, bounded, and self-eliminating.

---

## the agent's Discretion

- **`isPrimaryWriter()` election semantics in Phase 1:** Phase 1 returns `true` for any caller (predicate exists but is not yet enforced). The election algorithm (background-SW authoritative vs. tabs.query highest-id vs. BroadcastBus subscriber) is the planner's call — it only matters in Phase 2 when MemoryEngine writes start calling it. Document the Phase-2 swap point in a code comment.
- **OnboardingModal step labels:** exact copy is the planner's call (spec §12 gives the *state strings*, not the *step labels*). Follow AntD conversational patterns.
- **Demoware-failover for the simulator refactor:** the agent may keep a minimal dev-only `src/dev/simulator.ts` if it makes `simulateStreamResponse` testable; placement is up to the planner.
- **Phase 1 plan split into 2 or 3 plans:** ROADMAP.md Progress Table lists `Phase 1: 0/3`. The planner decides whether 3 plans is appropriate or whether 2 wave-grouped plans is enough given the deliverables.

## Deferred Ideas

None — discussion stayed within Phase 1 scope. Defer-list candidates captured implicitly:
- Persona card art / "Meet NowPilot" character → Phase 15.3 (RICH-R-03).
- Real `unlimitedStorage` permission → Phase 2 (ADR-STACK-02).
- ServiceNow `cookies` / `scripting` / `contextMenus` permissions → Phase 17 (D-19).
- Dual-LLM quarantine (REQ-R11 layer 3) → v0.2+ (ADR-SEC-01).
- Note / memory / MiniSearch / Filesystem Sync / trust-aware context / multimodal / evolution — all in their own phases per ROADMAP.md.
