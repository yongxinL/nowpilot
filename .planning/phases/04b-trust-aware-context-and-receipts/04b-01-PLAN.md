---
phase: 04b-trust-aware-context-and-receipts
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/harness.ts
  - src/core/error/errorCodes.ts
  - src/core/storage/Setting.ts
  - src/core/preferences/trustConfig.ts
  - package.json
  - tests/core/context/trust/TrustTypes.test.ts
autonomous: true
requirements: [TRUST-01, TRUST-03]
must_haves:
  truths:
    - "TrustLevel, ContextItem, and ContextReceiptEntry are declared in src/types/harness.ts from Appendix C.1 verbatim (spec L4877-4899): TrustLevel union ('system'|'user'|'tool'|'retrieved'|'untrusted'), ContextItem with kind mirroring PromptSection['kind'], text, tokens, trust, instructionAuthority, relevance, freshness, sensitivity, sourceId — and co-located Zod boundary schemas ContextItemSchema/ContextReceiptEntrySchema (GR-4, D-3a-20 precedent) are exported from the same file."
    - "ContextItemSchema rejects instructionAuthority:true combined with trust 'retrieved'/'untrusted'/'tool' (CTX-01 MUST-be-false invariant enforced at the Zod boundary) and rejects unknown kinds/trusts."
    - "ContextItem.kind mirrors PromptSection['kind'] — the 8-member union including 'tool_result' — so the D-04-18 runtime union-parity test pattern holds for the trust types."
    - "CONTEXT_INSTRUCTION_INJECTION_BLOCKED exists as a canonical ERROR_CODES member in src/core/error/errorCodes.ts (O.3 canonical, GR-9) with a spec-mirror doc comment (W-1 gate precedent)."
    - "np_trust is registered in Setting.ts STORAGE_KEY_REGISTRY as { area: 'local' } so settingRead('np_trust') resolves instead of falling back (Pitfall 4)."
    - "package.json gains verify:phase-4b = the §24 chain: eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run (A8 — same shape as the 6 existing verify scripts)."
    - "trustConfig.ts exports NP_TRUST_KEY='np_trust', TrustPrefsSchema (z.object page/notes/memory/tool_result booleans), DEFAULT_TRUST_PREFS all-true, and readTrustPrefs() which Zod-gates the stored value and returns DEFAULT_TRUST_PREFS on empty/invalid (never throws, ERROR_CODES.STORE_READ debugLog — personaConfig precedent)."
  artifacts:
    - "src/types/harness.ts (TrustLevel, ContextItem, ContextReceiptEntry + Zod schemas)"
    - "src/core/error/errorCodes.ts (CONTEXT_INSTRUCTION_INJECTION_BLOCKED)"
    - "src/core/storage/Setting.ts (np_trust registry row)"
    - "src/core/preferences/trustConfig.ts (NP_TRUST_KEY, TrustPrefsSchema, DEFAULT_TRUST_PREFS, readTrustPrefs)"
    - "package.json (verify:phase-4b script)"
    - "tests/core/context/trust/TrustTypes.test.ts"
  key_links:
    - "harness.ts header (L13-16) declares ContextItem as the next extension point — this plan realizes it IN PLACE (R-1); downstream plans import the types from here, never re-declare."
    - "TrustPrefs is consumed by ContextOptimizerInput.trustPrefs (04b-04) and TrustSettingsStore (04b-05) — the shape + defaults locked here are the contract both wire against."
    - "verify:phase-4b is the phase gate every later plan's final wave seals against (04b-06)."
  flagged_assumptions:
    - "A4 [research, ASSUMED]: np_trust preference shape is { page, notes, memory, tool_result } all-boolean, area 'local', key 'np_trust' (RESEARCH Code Example 4). UI-SPEC binds behavior + all-true defaults only — shape is agent discretion (D-4b-07)."
    - "A8 [research, ASSUMED]: verify:phase-4b follows the repo's actual §24 chain form (eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run) — the spec's scoped form (L3684 'tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection') is satisfied as a subset; consistent with the 6 existing verify scripts (PATTERNS L368)."
  prohibitions:
    - "No new packages: the trust layer is dependency-free (D-4b-05), zero model calls in trust evaluation — nothing is added to package.json dependencies (R-9)."
    - "No invented identifiers: trust types land in @/types/harness.ts verbatim from Appendix C.1; the ONLY new canonical code is CONTEXT_INSTRUCTION_INJECTION_BLOCKED (GR-2/GR-9); no second type home (R-1)."
---

<!-- 04b-01 (2026-08-13): Wave-1 foundation. The R-1 trust type homes (TrustLevel /
     ContextItem / ContextReceiptEntry in harness.ts, C.1 verbatim) + the one new
     canonical code (CONTEXT_INSTRUCTION_INJECTION_BLOCKED, O.3) + the np_trust
     storage-registry row (Pitfall 4) + the np_trust Zod-gated accessor + the
     verify:phase-4b gate script. Assumption-delta: no-change — trust metadata is
     a NEW envelope on existing inputs (pageContext/memoryHints), it never renames
     an existing identity (detector returned detected:false). API coverage: no
     external API (detector returned detected:false). Schema push: no ORM schema
     files in scope. -->

<objective>
Lay the Wave-1 foundation for the trust-aware context phase: the C.1 trust types land verbatim in `@/types/harness` with co-located Zod gates, the one new canonical error code (`CONTEXT_INSTRUCTION_INJECTION_BLOCKED`) is added to `errorCodes.ts`, `np_trust` is registered in `Setting.ts`, the Zod-gated `trustConfig` accessor is created, and the `verify:phase-4b` gate script is added to package.json.

Purpose: every later 4b plan imports these types/schemas/codes/seams (R-1 — the header at harness.ts L13-16 declares ContextItem as the next extension point). Nothing in the phase can build without them; the accessor is what Pitfall 4 (np_trust unregistered → silent fallback) exists to prevent.

Output: harness.ts + errorCodes.ts + Setting.ts + trustConfig.ts extended, verify:phase-4b script in package.json, TrustTypes.test.ts green.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-CONTEXT.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-RESEARCH.md
@.planning/phases/04b-trust-aware-context-and-receipts/04b-PATTERNS.md
@src/types/harness.ts
@src/core/error/errorCodes.ts
@src/core/storage/Setting.ts
@src/core/ai/persona/personaConfig.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Land C.1 trust types + co-located Zod schemas in harness.ts (R-1)</name>
  <files>src/types/harness.ts, tests/core/context/trust/TrustTypes.test.ts</files>
  <read_first>
    - src/types/harness.ts (the R-1 home — header L13-16 names ContextItem as the next extension point; the Phase-3a block L20-117 is the in-place template to follow)
    - .planning/PRODUCT_SPEC_v0_1.md Appendix C.1 trust-aware types (L4877-4899) — the VERBATIM source
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-PATTERNS.md (harness.ts section: header-extension comment pattern + type + co-located Zod schema pattern)
    - src/core/ai/types.ts (PromptSection['kind'] L134-148 — the union ContextItem.kind must mirror; 8 members incl. 'tool_result')
  </read_first>
  <action>
    Append a Phase-4b block to src/types/harness.ts AFTER the existing Phase-3a block (L117) — do not disturb the 3a types (R-1 in-place rule; PATTERNS header-extension pattern). Add:
    - A section comment naming the C.1 source lines (L4877-4899) and the phase (CTX-01/D-4b-01).
    - `export type TrustLevel = 'system' | 'user' | 'tool' | 'retrieved' | 'untrusted';` verbatim from C.1.
    - `export interface ContextItem` with EXACTLY the C.1 fields: id: string; kind: PromptSection['kind'] (import the type via `import type { PromptSection } from '@/core/ai/types'` — NEVER re-declare the union, R-1); text: string; tokens: number; trust: TrustLevel; instructionAuthority: boolean; relevance: number; freshness: number; sensitivity: 'none' | 'low' | 'high'; sourceId: string. Add the CTX-05 structural seam per D-4b-13: an optional field `disclosureReady?: boolean` (progressive-skill-disclosure readiness, type-level only — no logic in 4b; skills land Phase 8).
    - `export interface ContextReceiptEntry` verbatim from C.1: sourceId: string; included: boolean; originalTokens: number; finalTokens: number; compression?: 'summarise' | 'structural' | 'topk'; cacheEligible: boolean; omitReason?: string.
    - Co-located Zod boundary schemas (GR-4, D-3a-20 precedent, zod 3 API only): `TrustLevelSchema = z.enum([...5 members...])`; `ContextItemSchema = z.object({...})` matching the interface AND carrying the CTX-01 invariant refine — reject instructionAuthority:true when trust is 'retrieved'/'untrusted'/'tool' (use `.refine((c) => !(c.instructionAuthority && c.trust !== 'system' && c.trust !== 'user'), {...})` — the D-4a-20 arrow-paren-normalized refine precedent); `ContextReceiptEntrySchema = z.object({...})` with `compression: z.enum(['summarise','structural','topk']).optional()` and `omitReason: z.string().optional()`.
    - `export const TrustOmitReasonSchema = z.enum(['prompt_injection', 'trust_disabled'])` + `export type TrustOmitReason = z.infer<typeof TrustOmitReasonSchema>` (Open Q3 resolution — structured omit reasons, forward-compatible with Phase-5 memory reasons; no new C.2 codes).
    - `ContextItemSchema.shape.kind` must equal `z.enum([...8 PromptSection kinds...])` — the kind union mirrors PromptSection['kind'] INCLUDING 'tool_result' (03a-01 lockstep).

    In tests/core/context/trust/TrustTypes.test.ts (new file, new `tests/core/context/trust/` dir — `@vitest-environment` default jsdom-align is fine; determinism rule: no Date.now/crypto/Math.random — fixed fixture values only):
    - safeParse accepts a valid fixture ContextItem and ContextReceiptEntry (positive gate).
    - safeParse REJECTS unknown kind / unknown trust / out-of-range relevance (negative gates — assert `parsed.error.issues.some((i) => i.path.join('.') === ...)` pattern, ContextProvenanceManifest.test.ts L55-66 precedent).
    - CTX-01 invariant: a fixture with trust 'retrieved' (and 'untrusted'/'tool') + instructionAuthority:true FAILS the schema; the same item with instructionAuthority:false passes.
    - CTX-05 seam: the fixture ContextItem may set `disclosureReady: true` and still pass (type-level field presence — D-4b-13).
    - D-04-18-style union parity: `ContextItemSchema.shape.kind.options` deep-equals the 8-kind set from PromptSection (copy the ContextProvenanceManifest.test.ts L79-102 parity block pattern).
  </action>
  <acceptance_criteria>
    - src/types/harness.ts contains the literals `export type TrustLevel =` and `export interface ContextItem {` and `export interface ContextReceiptEntry {` and `export const ContextItemSchema` and `export const ContextReceiptEntrySchema` and `export const TrustOmitReasonSchema`.
    - ContextItem.kind is typed as PromptSection['kind'] via a type import — no re-declared kind union in harness.ts (grep: harness.ts contains `import type { PromptSection }`).
    - ContextItemSchema includes a refine rejecting instructionAuthority:true for non-system/user trust (CTX-01 boundary invariant).
    - TrustTypes.test.ts exits 0 with `pnpm vitest run tests/core/context/trust/TrustTypes.test.ts --bail=1` (vitest 4: `--bail=1`, NOT `-x`).
    - `pnpm tsc --noEmit` (via `pnpm exec tsc --noEmit`) passes — the PromptSection type import resolves and the file stays zod-3 clean.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/context/trust/TrustTypes.test.ts --bail=1</automated>
  </verify>
  <done>TrustLevel/ContextItem/ContextReceiptEntry + Zod schemas + TrustOmitReason landed verbatim in harness.ts (C.1, R-1); the CTX-01 boundary refine and CTX-05 disclosureReady seam exist; TrustTypes.test.ts green.</done>
</task>

<task type="auto">
  <name>Task 2: Add the O.3 canonical error code + np_trust storage registry row</name>
  <files>src/core/error/errorCodes.ts, src/core/storage/Setting.ts</files>
  <read_first>
    - src/core/error/errorCodes.ts (the CONTEXT_TOO_LARGE canonical-addition block L90-96 — the exact template; the code object closes with UNKNOWN)
    - src/core/storage/Setting.ts (STORAGE_KEY_REGISTRY L60-80 — np_persona row L67 is the precedent)
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-PATTERNS.md (in-place config edit precedents section)
  </read_first>
  <action>
    In src/core/error/errorCodes.ts: inside the canonical `as const` object, add `CONTEXT_INSTRUCTION_INJECTION_BLOCKED: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED',` next to CONTEXT_TOO_LARGE (L96), with a doc comment naming: the O.3 canonical source (spec L6457-6458), the phase (Phase 4b, CTX-02/D-4b-04), and a W-1 spec-mirror note (the C.2 mirror re-verification precedent from Phase-1/04). Do NOT touch any existing member.

    In src/core/storage/Setting.ts: add `np_trust: { area: 'local' },` to STORAGE_KEY_REGISTRY directly after the np_persona row (L67) — a NEW registration, NOT a migration (Runtime State Inventory: no existing key renamed or reshaped).
  </action>
  <acceptance_criteria>
    - errorCodes.ts contains `CONTEXT_INSTRUCTION_INJECTION_BLOCKED: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED',` and the string count of that code in the file is exactly 1 (definition only — no other literal echo; `grep -c "CONTEXT_INSTRUCTION_INJECTION_BLOCKED" src/core/error/errorCodes.ts` prints 1 with the definition line; header comments avoid repeating the literal — comment-text discipline).
    - Setting.ts STORAGE_KEY_REGISTRY contains the line `np_trust: { area: 'local' },` and np_persona is unchanged.
    - `pnpm exec tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec tsc --noEmit</automated>
  </verify>
  <done>CONTEXT_INSTRUCTION_INJECTION_BLOCKED canonical in errorCodes.ts (O.3, GR-9); np_trust registered area:'local' in Setting.ts (Pitfall 4 closed).</done>
</task>

<task type="auto">
  <name>Task 3: trustConfig.ts accessor + verify:phase-4b script</name>
  <files>src/core/preferences/trustConfig.ts, package.json</files>
  <read_first>
    - src/core/ai/persona/personaConfig.ts (the near-exact analog — copy structurally: NP_PERSONA_KEY export, settingRead + safeParse + fallback, never-throws)
    - src/core/storage/Setting.ts (settingRead signature + STORE_READ fallback behavior)
    - package.json scripts block (verify:phase-4..4a L23-24 — the §24 chain to mirror)
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-RESEARCH.md Code Example 4 (the recommended trustConfig shape, L456-489)
  </read_first>
  <action>
    Create src/core/preferences/trustConfig.ts (personaConfig structural copy — NEW file, RESEARCH recommended path):
    - `export const NP_TRUST_KEY = 'np_trust';`
    - `export const TrustPrefsSchema = z.object({ page: z.boolean(), notes: z.boolean(), memory: z.boolean(), tool_result: z.boolean() });` and `export type TrustPrefs = z.infer<typeof TrustPrefsSchema>;` (zod 3 API only).
    - `export const DEFAULT_TRUST_PREFS: TrustPrefs = { page: true, notes: true, memory: true, tool_result: true };` (all-true safe default — no source silently excluded, D-4b-07/08).
    - `export async function readTrustPrefs(): Promise<TrustPrefs>` — settingRead<unknown>(NP_TRUST_KEY, (v) => v, undefined); stored undefined → DEFAULT_TRUST_PREFS; TrustPrefsSchema.safeParse failure → debugLog(ERROR_CODES.STORE_READ, 'np_trust failed TrustPrefsSchema — using defaults', { module: 'trustConfig', extra: { issueCount } }) then DEFAULT_TRUST_PREFS; valid → parsed.data. NEVER throws (personaConfig precedent).
    - Header comment naming: D-4b-07 (shape is agent discretion, UI-SPEC binds behavior), Pitfall 4 (np_trust MUST be in Setting.ts registry — Task 2 of this plan), GR-4/V5 inbound gate.

    In package.json scripts: add `"verify:phase-4b": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run"` — byte-identical chain shape to verify:phase-4 (L23). Do NOT modify the existing verify:phase-1..4a keys. Do NOT add test-count assertions (P-5).
  </action>
  <acceptance_criteria>
    - trustConfig.ts contains the literals `export const NP_TRUST_KEY = 'np_trust'` and `export const TrustPrefsSchema = z.object({` and `export const DEFAULT_TRUST_PREFS` and `export async function readTrustPrefs`.
    - trustConfig.ts contains NO `throw` statement (never-throws contract) and imports ERROR_CODES.STORE_READ via debugLog.
    - package.json scripts contains `"verify:phase-4b": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run"` (node -e assertion prints the full chain).
    - verify:phase-1..4a keys byte-unchanged.
    - `pnpm exec tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>node -e "const p=require('./package.json'); const s=p.scripts['verify:phase-4b']; if(!s||!s.includes('wxt build')||!s.includes('prettier --check')) process.exit(1)" && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>trustConfig.ts accessor created (Zod-gated, all-true fallback, never throws); verify:phase-4b script added mirroring the §24 chain; existing verify scripts untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| chrome.storage.local (np_trust) → trustConfig | persisted preference crosses into the core read path — untrusted/malformed storage must never crash or silently exclude a source |
| types/harness.ts → core consumers | the C.1 trust envelope crosses into every downstream module — the boundary schema is the CTX-01 gate |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4b-06 | Tampering | np_trust preference store (Setting.ts registry + trustConfig.ts read) | medium | mitigate | Zod-gated read with all-true fallback (TrustPrefsSchema.safeParse — never merges raw storage), ERROR_CODES.STORE_READ debugLog on invalid, readTrustPrefs never throws (personaConfig precedent). A tampered key degrades to safe defaults (no source silently excluded), never to a crash. |
| T-4b-01 | Tampering | ContextItem trust metadata (harness.ts boundary) | high | mitigate | CTX-01 boundary refine in ContextItemSchema REJECTS instructionAuthority:true for retrieved/untrusted/tool trust at the Zod gate — a forged authority claim cannot survive the boundary; applyTrustPolicy (04b-02) is the second, runtime layer (authority strip + wrap, O.3). |
| T-4b-07 | Information Disclosure | errorCodes/debugLog paths | low | mitigate | No new log surfaces in this plan; R-10 redaction is automatic in debugLog; trustConfig logs only module + issueCount, never the stored payload. |
</threat_model>

<verification>
- `pnpm vitest run tests/core/context/trust/TrustTypes.test.ts --bail=1` green (Wave-0 file created in this plan).
- `pnpm exec tsc --noEmit` green — the PromptSection type import + zod-3 schema additions compile.
- `node -e` package.json assertion confirms the verify:phase-4b chain.
- Setting.ts registry + errorCodes.ts additions verified by tsc and the acceptance greps above.
</verification>

<success_criteria>
- TrustLevel/ContextItem/ContextReceiptEntry verbatim in harness.ts with co-located Zod schemas incl. the CTX-01 boundary refine and the CTX-05 disclosureReady seam (D-4b-13).
- CONTEXT_INSTRUCTION_INJECTION_BLOCKED canonical in errorCodes.ts (GR-9, O.3).
- np_trust registered area:'local' (Pitfall 4 closed).
- trustConfig.ts accessor with all-true fallback (D-4b-07 shape discretion resolved: { page, notes, memory, tool_result }).
- verify:phase-4b script present (§24 chain, A8).
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-and-receipts/04b-01-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- `src/types/harness.ts` — `TrustLevel` (5-member union), `ContextItem` (interface, kind = PromptSection['kind'], optional `disclosureReady?: boolean` CTX-05 seam), `ContextReceiptEntry` (interface), `TrustLevelSchema`, `ContextItemSchema` (with CTX-01 refine), `ContextReceiptEntrySchema`, `TrustOmitReasonSchema` + `TrustOmitReason` (z.enum(['prompt_injection','trust_disabled']))
- `src/core/error/errorCodes.ts` — `ERROR_CODES.CONTEXT_INSTRUCTION_INJECTION_BLOCKED` (canonical member)
- `src/core/storage/Setting.ts` — `STORAGE_KEY_REGISTRY.np_trust` = { area: 'local' }
- `src/core/preferences/trustConfig.ts` — `NP_TRUST_KEY`, `TrustPrefsSchema`, `TrustPrefs` type, `DEFAULT_TRUST_PREFS`, `readTrustPrefs()`
- `package.json` — `scripts.verify:phase-4b` (§24 chain)
- `tests/core/context/trust/TrustTypes.test.ts` (new dir `tests/core/context/trust/`)
