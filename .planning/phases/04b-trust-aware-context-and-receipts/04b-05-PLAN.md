---
phase: 04b-trust-aware-context-and-receipts
plan: 05
type: execute
wave: 4
depends_on: [04b-04]
files_modified:
  - src/components/pages/useStreamingLLM.ts
  - src/core/i18n/strings.ts
  - src/core/registry/TrustSettingsStore.ts
  - src/components/pages/OptionsPage.tsx
  - tests/components/pages/useStreamingLLM.test.tsx
  - tests/components/pages/OptionsPage.test.tsx
autonomous: true
requirements: [TRUST-03]
must_haves:
  truths:
    - "useStreamingLLM.ts wires the trust-aware pageContext feed (D-4b-09): inside send() it resolves `const currentPage = useWorkspaceStore((s) => s.workspace.currentPageContext)` and `const trustPrefs = await readTrustPrefs()` and passes both into optimizerBase as `pageContext: currentPage` (guarded — undefined stays undefined → no context section) and `trustPrefs` — the hook stays a Golden-Rule-3 import-only consumer (no prompt assembly)."
    - "src/core/registry/TrustSettingsStore.ts exists (NEW — AddonSettingsStore precedent): plain zustand store over `{ prefs: TrustPrefs }` with init() hydrating np_trust from chrome.storage.local (sanitize via TrustPrefsSchema, all-true fallback), setSource(kind, on) → immer produce + fire-and-forget write-through to np_trust, chrome.storage.onChanged remove-then-add listener (T-1-11) for cross-surface sync — never throws (Golden Rule 9, debugLog on failure)."
    - "OptionsPage.tsx gains a content-trust Card AFTER the Appearance card (UI-SPEC Visual Hierarchy): title STR.options.contentTrust, helper caption STR.options.trustHelper, four antd Switch rows in fixed order Pages → Notes → Memory → Tool results (STR.options.trustSources.pages/notes/memory/toolResults) bound to useTrustSettingsStore, and the structural note STR.options.trustStructuralNote at the bottom — all four default ON (D-4b-07)."
    - "Toggle failure → optimistic set rolled back to the last persisted value + notification.error toast with STR.options.trustSaveFailed (UI-SPEC error row; theme.saveFailed E5 toast precedent)."
    - "src/core/i18n/strings.ts gains the new canonical STR keys verbatim from the UI-SPEC Copywriting Contract: options.contentTrust = 'Content trust', options.trustHelper = 'Choose which content sources can feed the model.', options.trustStructuralNote = 'Pages is the only active source in this version. Notes, memory, and tool results arrive in later phases.', options.trustSources.pages/notes/memory/toolResults, options.trustSaveFailed = \"Couldn't save your content trust settings. We'll retry on the next change.\" (Golden Rule 2 — canonical addition precedent)."
    - "UI-SPEC loading row: mount renders all four switches immediately at default-true while init() hydrates from chrome.storage.local (fast read; no skeleton; brief true→persisted flip is the only transition)."
    - "UI-SPEC populated/partial/zero-one-many rows: exactly 4 labeled Switch rows always render in fixed order, each an independent boolean (any mix of ON/OFF renders cleanly); zero-row/N-row variants do not exist."
    - "UI-SPEC overflow/long-text rows: labels and captions are short fixed strings that wrap normally within the Standalone content column (≥1024 px) — no truncation, no ellipsis, no clipping."
  artifacts:
    - "src/components/pages/useStreamingLLM.ts (pageContext + trustPrefs wiring)"
    - "src/core/registry/TrustSettingsStore.ts (zustand store)"
    - "src/components/pages/OptionsPage.tsx (content-trust Card)"
    - "src/core/i18n/strings.ts (6 new STR keys)"
    - "tests/components/pages/OptionsPage.test.tsx"
    - "tests/components/pages/useStreamingLLM.test.tsx (extended)"
  key_links:
    - "The hook is the only chrome-boundary input resolver (page + prefs) — the optimizer stays pure (Pitfall 5); Golden Rule 3 holds (core builder import only)."
    - "TrustSettingsStore persists np_trust (registry row from 04b-01) and enforces nothing itself — runtime enforcement is core-side at the TrustPolicy boundary (D-4b-08)."
  flagged_assumptions:
    - "TRUST-03 [unresolved — spec-less probe, concurrency]: np_trust writes are fire-and-forget last-write-wins with an optimistic local set + rollback on failure — parallel toggle flips converge on the last write (AddonSettingsStore precedent); the optimizer side is synchronous so no read/write race crosses into packing."
    - "Per-source-ID trust controls, chat-embedded controls, and the Prompt Inspector UI are DEFERRED (D-4b-07 lean, Phase 5+/6/7) — this plan ships only the per-source-type Options section."
  prohibitions:
    - "No prompt assembly in components — OptionsPage only persists a preference (GR-3); runtime enforcement stays in the core TrustPolicy boundary (D-4b-08)."
    - "No quarantine toast, trust chips/badges, receipt/inspector UI, or CTX-06 readout in 4b — the card is the ONLY user-facing surface (UI-SPEC Invisible-by-contract; D-4b-06/10/14)."
    - "No new MessageType and no background-SW involvement — the trust preference is a plain chrome.storage.local write from Options (R-3)."
    - "No new packages (R-9) — antd Switch is already installed and verified; no icons in the trust card (UI-SPEC)."
---

<!-- 04b-05 (2026-08-13): Wave-4 surface wiring — the ONLY user-facing 4b surface
     (UI-SPEC scope-honesty: near-zero-UI phase). The hook resolves page + prefs and
     passes them into the trust-wired optimizer (D-4b-09); TrustSettingsStore persists
     np_trust (AddonSettingsStore precedent); OptionsPage renders the 4-Switch content-
     trust card with the verbatim UI-SPEC copy keys. -->

<objective>
Wire the trust-aware pageContext feed into the hook (`useStreamingLLM.ts`, D-4b-09) and ship the content-trust Options card: `TrustSettingsStore` (np_trust persistence, AddonSettingsStore precedent), the `OptionsPage` content-trust Card (4 Switch rows + verbatim UI-SPEC copy), and the new STR keys.

Purpose: D-4b-07/09 — the user gains control over which sources feed the model (TRUST-03), and the 4a-unplugged pageContext feed becomes live end-to-end while the optimizer stays pure (Golden Rule 3).

Output: wired hook + trust store + Options card + component tests green.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-CONTEXT.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-UI-SPEC.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-RESEARCH.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-PATTERNS.md
@src/components/pages/useStreamingLLM.ts
@src/components/pages/OptionsPage.tsx
@src/core/registry/AddonSettingsStore.ts
@src/core/i18n/strings.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Trust-aware pageContext wiring in useStreamingLLM.ts (D-4b-09)</name>
  <files>src/components/pages/useStreamingLLM.ts, tests/components/pages/useStreamingLLM.test.tsx</files>
  <read_first>
    - src/components/pages/useStreamingLLM.ts (send() L135-209 — the persona pipeline precedent L150-154, optimizerBase L174-185, WorkspaceStore import L41)
    - src/core/workspace/WorkspaceStore.ts (currentPageContext field — written by PageContentService.deliverContext)
    - src/core/preferences/trustConfig.ts (readTrustPrefs from 04b-01)
  </read_first>
  <action>
    In src/components/pages/useStreamingLLM.ts:
    - Import `readTrustPrefs` from '@/core/preferences/trustConfig'.
    - Inside send() alongside the persona resolution (L150-154): `const trustPrefs = await readTrustPrefs();` and `const currentPage = useWorkspaceStore((s) => s.workspace.currentPageContext);` (store subscription precedent L115-116).
    - In optimizerBase (L174-185): replace `pageContext: undefined,` with `pageContext: currentPage,` (guarded — when undefined the optimizer's trust stage returns null → no context section, byte-identical pre-4b behavior) and add `trustPrefs,` after it.
    - Do NOT assemble any prompt text (Golden Rule 3 — the header contract); the hook only resolves inputs and imports optimize().

    Extend tests/components/pages/useStreamingLLM.test.tsx:
    - Add cases: (a) when WorkspaceStore.currentPageContext is seeded (seed via the store's update/deliver path or direct state set with a fixed fixture) and np_trust default-all-true, send() → the produced planner/renderer contexts include a 'context' section whose text contains the wrap marker and the page text; (b) when currentPageContext is undefined → no 'context' section (pre-4b drop-in); (c) readTrustPrefs mock returns { page: false, ... } → no context section (trust_disabled gate path through the real optimizer).
    - Keep the existing suite green (abort/caps/error mapping cases untouched).
  </action>
  <acceptance_criteria>
    - useStreamingLLM.ts contains `readTrustPrefs` and `currentPageContext` usages; optimizerBase passes `pageContext: currentPage` and `trustPrefs`.
    - useStreamingLLM.ts contains no prompt-template literal assembly (no new string-template prompt building — Golden Rule 3).
    - useStreamingLLM.test.tsx exits 0 with `pnpm vitest run tests/components/pages/useStreamingLLM.test.tsx --bail=1` (existing + new page-feed cases).
    - `pnpm exec tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/components/pages/useStreamingLLM.test.tsx --bail=1</automated>
  </verify>
  <done>Hook resolves page + prefs and passes both into the trust-wired optimizer; page-feed + no-page + trust_disabled cases tested; existing suite green.</done>
</task>

<task type="auto">
  <name>Task 2: TrustSettingsStore — np_trust persistence store</name>
  <files>src/core/registry/TrustSettingsStore.ts</files>
  <read_first>
    - src/core/registry/AddonSettingsStore.ts (the near-exact analog: zustand create + produce + writeStorage + onChanged remove-then-add T-1-11)
    - src/core/preferences/trustConfig.ts (TrustPrefs, TrustPrefsSchema, DEFAULT_TRUST_PREFS, NP_TRUST_KEY from 04b-01)
  </read_first>
  <action>
    Create src/core/registry/TrustSettingsStore.ts (NEW — RESEARCH recommended path src/core/registry/TrustSettingsStore.ts; AddonSettingsStore structural copy, sanitize via TrustPrefsSchema instead of sanitizeStored):
    - `interface TrustSettingsState { prefs: TrustPrefs; init(): Promise<void>; setSource(kind: keyof TrustPrefs, on: boolean): void; }`
    - `export const useTrustSettingsStore = create<TrustSettingsState>()((set, get) => ({ prefs: DEFAULT_TRUST_PREFS, ... }))` — initial state all-true (UI-SPEC hydrating row: switches render at default-true immediately).
    - init(): chrome.storage.local.get(NP_TRUST_KEY) → TrustPrefsSchema.safeParse → set prefs (invalid → DEFAULT_TRUST_PREFS + debugLog(ERROR_CODES.STORE_READ, ...)); catch → debugLog, never throw; then chrome.storage.onChanged remove-then-add listener (area 'local', key np_trust) re-hydrating from change.newValue (T-1-11 pattern).
    - setSource(kind, on): `const next = produce(get().prefs, (draft) => { draft[kind] = on; }); set({ prefs: next }); void writeStorage(next);` where writeStorage = chrome.storage.local.set({ [NP_TRUST_KEY]: next }) in try/catch with debugLog (never throws) — write-through, fire-and-forget (UI-SPEC auto-save).
  </action>
  <acceptance_criteria>
    - TrustSettingsStore.ts contains `useTrustSettingsStore` and `setSource` and `init` and the np_trust key usage and the onChanged remove-then-add listener.
    - TrustSettingsStore.ts contains NO throw statement and uses TrustPrefsSchema for inbound validation.
    - `pnpm exec tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec tsc --noEmit</automated>
  </verify>
  <done>TrustSettingsStore ships (all-true initial + Zod-gated hydrate + write-through + onChanged sync, never throws).</done>
</task>

<task type="auto">
  <name>Task 3: OptionsPage content-trust Card + STR keys + component test</name>
  <files>src/core/i18n/strings.ts, src/components/pages/OptionsPage.tsx, tests/components/pages/OptionsPage.test.tsx</files>
  <read_first>
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-UI-SPEC.md (Copywriting Contract verbatim copy + Visual Hierarchy card layout + Interaction Contract + UI Considerations rows)
    - src/components/pages/OptionsPage.tsx (Appearance card L43-51 + E5 toast L26-33 — the card + notification patterns)
    - src/core/i18n/strings.ts (options block L103-119 + theme.saveFailed L120-123 — canonical-addition precedent)
    - src/core/registry/TrustSettingsStore.ts (from Task 2)
  </read_first>
  <action>
    In src/core/i18n/strings.ts under `options: {` (after noProvider, L118), add verbatim (UI-SPEC Copywriting Contract — Golden Rule 2 canonical additions): `contentTrust: 'Content trust',` `trustHelper: 'Choose which content sources can feed the model.',` `trustStructuralNote: 'Pages is the only active source in this version. Notes, memory, and tool results arrive in later phases.',` `trustSources: { pages: 'Pages', notes: 'Notes', memory: 'Memory', toolResults: 'Tool results' },` `trustSaveFailed: "Couldn't save your content trust settings. We'll retry on the next change.",` (verbatim strings incl. the apostrophes — byte-exact per the Copywriting Contract).

    In src/components/pages/OptionsPage.tsx:
    - Import `Switch` from 'antd', `useTrustSettingsStore` from '@/core/registry/TrustSettingsStore', and the STR keys.
    - After the Appearance Card (L43-51), render a NEW `<Card title={STR.options.contentTrust}>` per UI-SPEC Visual Hierarchy: helper caption (`Typography.Text type="secondary"`), hairline divider (Card internal divider — antd Card divider or a styled row separator), then FOUR Switch rows in FIXED order Pages → Notes → Memory → Tool results, each row = label (STR.options.trustSources.pages/notes/memory/toolResults) + `<Switch checked={prefs.page} onChange={(on) => void handleTrustToggle('page', on)} />` (and .notes/.memory/.tool_result respectively — map kind keys to STR keys), then the structural note `STR.options.trustStructuralNote` as a muted caption (Typography.Text type="secondary" or tertiary per UI-SPEC color contract).
    - `const prefs = useTrustSettingsStore((s) => s.prefs);` and `const handleTrustToggle = async (kind, on) => { await useTrustSettingsStore.getState().setSource(kind, on); if (useTrustSettingsStore.getState().prefs[kind] !== on) notification.error({ message: STR.options.trustSaveFailed, duration: 0 }); };` (E5 toast precedent — rollback detection by comparing store state).
    - NO icons, NO Save button (auto-save), NO quarantine/trust badges — UI-SPEC Invisible-by-contract.
    - The `const { notification } = App.useApp();` is already present (L24) — reuse it.

    Create tests/components/pages/OptionsPage.test.tsx (NEW — PATTERNS note: use tests/components/pages/OptionsPage.test.tsx, the existing component tree):
    - Render with fakeBrowser chrome.storage.local seeded with np_trust → 4 Switch rows at persisted values; helper + structural note visible.
    - Toggle write-through: clicking the Pages switch flips store state and writes np_trust to chrome.storage.local (fakeBrowser assertion).
    - Failure rollback: make chrome.storage.local.set reject → toast STR.options.trustSaveFailed appears (notification) + switch state reverts.
    - Invalid storage → all-true fallback (seed garbage np_trust → 4 switches ON).
    - Defaults: empty storage → all four switches checked (default-true, D-4b-07).
  </action>
  <acceptance_criteria>
    - strings.ts contains the six verbatim copy literals under options (contentTrust, trustHelper, trustStructuralNote, trustSources.{pages,notes,memory,toolResults}, trustSaveFailed) — byte-exact per the UI-SPEC Copywriting Contract.
    - OptionsPage.tsx contains `<Card title={STR.options.contentTrust}>` and four `<Switch` rows and the trustStructuralNote caption; the Account/Appearance cards are unchanged.
    - OptionsPage.test.tsx exits 0 with `pnpm vitest run tests/components/pages/OptionsPage.test.tsx --bail=1`.
    - `pnpm exec tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/components/pages/OptionsPage.test.tsx --bail=1</automated>
  </verify>
  <done>Content-trust Card ships (4 Switches, verbatim copy, auto-save + E5-style rollback toast); component test green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| OptionsPage → chrome.storage.local (np_trust) | user preference crosses into the extension-wide storage bus — write-through + rollback on failure |
| chrome.storage.onChanged → TrustSettingsStore | foreign-surface writes re-hydrate the store — stale/tampered values must be schema-gated |
| hook → ContextOptimizer | page + prefs inputs cross the chrome boundary into the pure core — the ONLY async resolution point (Pitfall 5) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4b-06 | Tampering | TrustSettingsStore (np_trust read/write) | medium | mitigate | TrustPrefsSchema.safeParse on every hydrate (invalid → all-true DEFAULT_TRUST_PREFS, debugLog STORE_READ, never throws); write-through in try/catch with rollback detection at the call site (store-state ≠ requested → E5-style toast); onChanged re-hydration schema-gated — a tampered key degrades to safe defaults (no source silently excluded), never to a crash or a bypass. |
| T-4b-11 | Information Disclosure | OptionsPage rendering | low | mitigate | The card renders preference booleans + fixed copy only — no raw context, no quarantine payloads, no source text (R-10; UI-SPEC Invisible-by-contract). |
| T-4b-12 | Tampering | hook → optimizer input seam | medium | mitigate | The hook resolves page + prefs and passes them as data; the optimizer stays pure (Pitfall 5) — no chrome access inside the core; the page feed is trust-stripped/wrapped inside optimize() (04b-04) regardless of what the hook passes (defense in depth: a compromised hook cannot inject instruction authority — applyTrustPolicy is the boundary). |
</threat_model>

<verification>
- `pnpm vitest run tests/components/pages/useStreamingLLM.test.tsx --bail=1` green (existing + extended).
- `pnpm vitest run tests/components/pages/OptionsPage.test.tsx --bail=1` green.
- `pnpm exec tsc --noEmit` green.
- `pnpm vitest run tests/core/context/ContextOptimizer.test.ts --bail=1` still green (hook wiring must not disturb the optimizer contract).
</verification>

<success_criteria>
- D-4b-09 hook wiring live (pageContext + trustPrefs into optimizerBase; Golden Rule 3 intact; no-page path byte-identical).
- TrustSettingsStore persists np_trust (AddonSettingsStore precedent; all-true fallback; onChanged sync).
- OptionsPage content-trust Card ships with verbatim UI-SPEC copy (6 STR keys) + 4 Switches + auto-save + rollback toast.
- UI-SPEC covered rows (loading/error/populated/partial/overflow/zero-one-many/long-text) all exercised by the component test.
- No new packages, no quarantine/trust UI beyond the card (Invisible-by-contract).
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-and-receipts/04b-05-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- `src/components/pages/useStreamingLLM.ts` — send() resolves `trustPrefs` (readTrustPrefs) + `currentPage` (WorkspaceStore.currentPageContext); optimizerBase passes `pageContext: currentPage` + `trustPrefs`
- `src/core/registry/TrustSettingsStore.ts` — `TrustSettingsState` interface, `useTrustSettingsStore` (zustand), `init()`, `setSource(kind: keyof TrustPrefs, on: boolean)`, internal `writeStorage`
- `src/components/pages/OptionsPage.tsx` — content-trust Card (title/helper/4 Switch rows/structural note), `handleTrustToggle(kind, on)`, 4 STR keys consumed
- `src/core/i18n/strings.ts` — `options.contentTrust`, `options.trustHelper`, `options.trustStructuralNote`, `options.trustSources.{pages,notes,memory,toolResults}`, `options.trustSaveFailed`
- `tests/components/pages/OptionsPage.test.tsx` (new)
- `tests/components/pages/useStreamingLLM.test.tsx` (extended: page-feed / no-page / trust_disabled cases)
