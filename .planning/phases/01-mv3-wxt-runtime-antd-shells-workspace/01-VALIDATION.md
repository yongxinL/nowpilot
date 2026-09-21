---
phase: "1"
slug: "mv3-wxt-runtime-antd-shells-workspace"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-21"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `01-RESEARCH.md` § Validation Architecture. Task IDs are finalized when plans land; rows below are the requirement-level seed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (jsdom 25.0.1, `globals: true`) |
| **Config file** | `vitest.config.ts` — `environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']` |
| **Quick run command** | `npx vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme` (the §24 Phase-1 minimum) |
| **Full suite command** | `npx vitest run` — baseline **18 files / 166 tests / ~6.2 s, all green** |
| **Phase gate** | `pnpm run verify:phase-1` (realigned to include every new suite — Wave 0 task) |
| **Typecheck** | `npx tsc --noEmit` — baseline exit 0 |
| **Build inspection** | `pnpm run build:ext` then read `.output/chrome-mv3/manifest.json` (no automated test exists yet — Wave 0 gap) |
| **Estimated runtime** | ~7 s full suite; ~1–3 s quick run |

**Baseline floor, not target:** 166 tests already pass. Every new suite must be *added* to `verify:phase-1`'s path list or it will not run in the gate.

---

## Sampling Rate

- **After every task commit:** the narrowest suite the task touches, plus `npx tsc --noEmit`. For the `srcDir` move plan specifically: `npx tsc --noEmit && npx vitest run && bash scripts/verify-no-tailwind.sh`.
- **After every plan wave:** `npx vitest run` (full suite) + `pnpm run build:ext` + manifest inspection.
- **Before `/gsd-verify-work`:** Full suite must be green, `pnpm run verify:phase-1` green, and the freshly built extension loaded unpacked in real Chrome for the manual criteria.
- **Max feedback latency:** ~10 seconds (quick run + typecheck).

---

## Per-Task Verification Map

> Task IDs are assigned when PLAN.md files land. `W0` = Wave 0 suite to create; `ext` = extend an existing suite.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0 | — | 0 | CORE-01 | — | Both surfaces render through WXT with exactly one provider each | component | `npx vitest run tests/components/SidePanelShell.test.tsx tests/components/StandaloneShell.test.tsx` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | CORE-01 | T-01-manifest | Generated manifest is the authorised shape (least-privilege permissions, `side_panel`, no `options_ui`) | build-inspection | `pnpm run build:ext && npx vitest run tests/isolation/generated-manifest.test.ts` | ❌ W0 | ⬜ pending |
| ext | — | 1 | CORE-01 | — | Background listeners attach synchronously on a cold SW | integration | `npx vitest run tests/background` | ✅ (extend) | ⬜ pending |
| ext | — | 1 | SP-02 | — | Standalone opens, focuses existing tab, never duplicates | integration | `npx vitest run tests/core/workspace/WorkspaceRouter.test.ts` | ✅ (extend) | ⬜ pending |
| W0 | — | 0 | SP-02 / FLOW-11 | T-01-handoff | READY precedes transfer; ACK gates success; draft never in URL | unit | `npx vitest run tests/core/workspace/WorkspaceHandoff.test.ts` | ❌ W0 | ⬜ pending |
| ext | — | 1 | SP-08 / APPR-03 | — | `np_theme` written by exactly one writer, read by both surfaces | unit + integration | `npx vitest run tests/core/theme` | ✅ (extend) | ⬜ pending |
| ext | — | 1 | SP-08 | — | `Toggle theme` cycles Auto→Light→Dark and writes `np_theme` | unit | `npx vitest run tests/core/commands/registerWorkspaceCommands.test.ts` | ✅ (extend) | ⬜ pending |
| W0 | — | 0 | SP-09 / SA-09 / FLOW-8 | — | `Cmd+K` opens the palette on macOS **and** Windows/Linux; `KEYMAP_CONFLICT` throws | unit | `npx vitest run tests/core/input/KeymapRegistry.test.ts` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | SP-09 / SA-09 | — | Palette renders exactly the Phase-1 command set; `reload-extension` absent in production builds | component | `npx vitest run tests/components/CommandPalette.test.tsx` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | SA-08 / FLOW-9 | T-01-secret | Onboarding appears when completion state is false/unknown/missing/schema-incompatible; 4 steps render | component | `npx vitest run tests/components/OnboardingFlow.test.tsx` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | SA-08 | T-01-secret | Fixture adapter conforms to `ProviderValidationPort`; no network; no SDK | unit | same suite + `vi.spyOn(globalThis,'fetch')` | ❌ W0 | ⬜ pending |
| manual | — | 3 | SA-10 | T-01-gesture | `Focus Side Panel` calls `sidePanel.open()` inside the gesture stack | unit (mock) + **manual** | unit: `npx vitest run tests/core/commands`; manual: real Chrome evidence | ⚠️ manual gap | ⬜ pending |
| ext | — | 1 | APPR-03 | — | No `themeMode` on the persisted preference blob | unit | `npx vitest run tests/core/store/useExtensionStore.test.ts` | ✅ (extend) | ⬜ pending |
| ext | — | 1 | APPR-03 | — | Legacy raw-string `np_theme` migrates to the single representation | unit | `npx vitest run tests/core/theme/ThemeStore.test.ts` | ✅ (extend) | ⬜ pending |
| W0 | — | 0 | APPR-04 / APPR-05 | — | `getAntdConfig({mode,pack,compact})` never `undefined`; compact/default algorithm split | unit | `npx vitest run tests/core/theme/antdConfig.test.ts` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | APPR-04 | — | Mode change updates the provider theme without remount | component | same suite + remount-spy assertion | ❌ W0 | ⬜ pending |
| W0 | — | 0 | FLOW-8 | — | Global keydown → handler → `preventDefault`; no ad-hoc listeners remain | unit + source-grep | `npx vitest run tests/core/input` + grep over `src/entrypoints` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | FLOW-10 | — | Palette filters, keyboard-navigates, zero-results state holds height | component | `npx vitest run tests/components/CommandPalette.test.tsx` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | D-07 | T-01-secret | Legacy plaintext cleanup: idempotent, redacted, metadata preserved | unit | `npx vitest run tests/core/storage/legacyCredentialCleanup.test.ts` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | D-07 / D-08 | T-01-secret | Sentinel secret absent from storage / serialised state / messages / logs / DOM | unit + component | `npx vitest run tests/core/storage tests/components/OnboardingFlow.test.tsx` | ❌ W0 | ⬜ pending |
| W0 | — | 0 | D-11 | — | `WorkspaceState` shape, safe defaults, producer allowlist, unknown-field rejection | unit | `npx vitest run tests/core/workspace/WorkspaceState.test.ts` | ❌ W0 | ⬜ pending |
| ext | — | 1 | D-14 | — | No Phase-1 code writes `np_workspace` / `np_workspace_store` | unit (source-scan + store assertion) | `npx vitest run tests/core/workspace` | ✅ (extend) | ⬜ pending |
| W0 | — | 0 | D-16 | — | Every non-Phase-1 page carries `data-np-backing` `fixture` or `deferred`; no perpetual skeleton | component + DOM | `npx vitest run tests/components/pages` | ❌ W0 | ⬜ pending |
| ext | — | 1 | §24 | — | Banned imports zero: `innerHTML`/`dangerouslySetInnerHTML`, `tailwind`/`shadcn`/`@radix-ui`, `framer-motion` | source-grep gate | `bash scripts/verify-no-tailwind.sh` + new grep gate for the other two patterns | ⚠️ partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/input/KeymapRegistry.test.ts` — covers FLOW-8/SP-09/SA-09; asserts the **macOS** `Cmd+K` case and the `KEYMAP_CONFLICT` path. **Directory does not exist.**
- [ ] `tests/core/theme/antdConfig.test.ts` — APPR-04/APPR-05, including "never returns `undefined`" and the compact/default algorithm split.
- [ ] `tests/core/workspace/WorkspaceHandoff.test.ts` — D-13 protocol: cold ready-before-transfer, warm path, duplicate request id, timeout, retry, ack gate, malformed URL params, unsupported schema version, invalid source/target, draft never in URL, secret never in the broadcast.
- [ ] `tests/core/workspace/WorkspaceState.test.ts` — D-11 shape, safe defaults, producer allowlist, inert later-phase fields, unknown-field rejection, no `np_workspace` write (D-14).
- [ ] `tests/core/storage/legacyCredentialCleanup.test.ts` — D-07 idempotence, redaction, metadata preservation, no relocation, sentinel absence.
- [ ] `tests/components/OnboardingFlow.test.tsx` — D-05/D-06/D-08 across both surface presentations.
- [ ] `tests/components/CommandPalette.test.tsx` — pinned Phase-1 command set, zero-results, dev-only `reload-extension`, 12 px floor, token-derived selected-row background.
- [ ] `tests/components/DeferredNotice.test.tsx` + `tests/components/pages/*.test.tsx` — D-16 presence/absence of `data-np-backing` and the no-perpetual-skeleton rule.
- [ ] `tests/isolation/generated-manifest.test.ts` — reads `.output/chrome-mv3/manifest.json`; the single highest-value gap (CONCERNS names it as the reason two defects shipped).
- [ ] Repo-level banned-import gate covering `innerHTML`/`dangerouslySetInnerHTML` and `framer-motion` (the Tailwind gate exists; the other two success-criterion-5 patterns have no script today).
- [ ] Update `tests/isolation/cross-entrypoint-imports.test.ts` and `tests/core/strict/np-strict-ceiling.test.ts` for the new `src/entrypoints` paths; extend the isolation self-test so the new path cannot pass vacuously.
- [ ] Update `package.json` `verify:phase-1` to include every new suite while keeping the §24 minimum and the existing `tests/background tests/components tests/isolation` sets.

*No framework install needed — Vitest + jsdom + testing-library already present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side Panel opens and onboarding appears on a fresh install | CORE-01 / SA-08 | Requires a real Chrome MV3 runtime and a clean profile; jsdom cannot open the Side Panel | Load `.output/chrome-mv3` unpacked in a fresh Chrome profile → click the action → Side Panel opens → onboarding presents; record the observed result |
| `Cmd+K` opens the palette on both surfaces (macOS and Windows/Linux chords) | SP-09 / SA-09 / FLOW-8 | OS-level chord handling cannot be fully simulated in jsdom | In real Chrome, press `⌘K` (macOS) and `Ctrl+K` (Windows/Linux) on each surface; record the observed result |
| Standalone handoff: opens once, focuses existing on re-open, theme applies to both surfaces with no reload | SP-02 / SP-08 / FLOW-11 | Requires two real extension surfaces + `chrome.storage.onChanged` across contexts | Open Side Panel → Switch to Full chat → Standalone opens; repeat → existing tab focused, no duplicate; toggle theme from the palette → both surfaces update without reload; record the observed result |
| `Focus Side Panel` opens the panel inside the user-gesture stack | SA-10 | `chrome.sidePanel.open()` gesture semantics are runtime-only | In Standalone, run `Focus Side Panel` from the palette; record the observed result |
| Legacy plaintext credential cleanup notice shows once and is dismissible; no value is revealed | D-07 | Needs real `chrome.storage.local` seeded with a legacy record | Seed a legacy `apiKey` in `np_store`, reload the extension, observe the neutral notice and verify the field is gone; record the observed result |

*A screenshot without an observed-result record is not evidence (nowpilot-phase-verification skill).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
