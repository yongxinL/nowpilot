---
phase: 04b-trust-aware-context-and-receipts
plan: 02
type: execute
wave: 2
depends_on: [04b-01]
files_modified:
  - src/core/context/trust/TrustPolicy.ts
  - src/core/context/trust/injectionScreener.ts
  - tests/core/context/trust/TrustPolicy.test.ts
  - tests/security/prompt-injection/injectionScreener.test.ts
autonomous: true
requirements: [TRUST-01, TRUST-02]
must_haves:
  truths:
    - "src/core/context/trust/TrustPolicy.ts exists (NEW, RESEARCH recommended path src/core/context/trust/) and implements Appendix O.3 verbatim (spec L6433-6459): AUTHORITY_BY_TRUST Record<TrustLevel, boolean> mapping system/user→true, tool/retrieved/untrusted→false, and applyTrustPolicy(items: ContextItem[]): ContextItem[] that wraps any item with instructionAuthority:true but non-allowed trust as `<untrusted_data source="${it.sourceId}">\n${it.text}\n</untrusted_data>` with instructionAuthority:false — system/user items byte-identical untouched."
    - "TrustPolicy is deterministic and pure: zero model calls, zero async, zero chrome/storage access, never mutates SYSTEM content (D-4b-03, Pitfall 5) — tests call it synchronously."
    - "TrustPolicy.ts exports a typed error carrier for CONTEXT_INSTRUCTION_INJECTION_BLOCKED mirroring the ContextTooLargeError/isContextTooLargeError pattern (ContextOptimizer.ts L64-74): an interface + guard function (e.g. ContextInjectionBlockedError + isContextInjectionBlockedError) exported for defensive use — it represents a retrieved item attempting to redefine policy (O.3 comment L6457-6458, D-4b-04); strip+wrap+quarantine is the Phase-4b enforcement, so no code in 4b raises it."
    - "src/core/context/trust/injectionScreener.ts exists (NEW): stripInvisibleUnicode(text) removes zero-width (U+200B/200C/200D/2060), tag-block (U+E0000-U+E007F), and variation-selector (U+FE00-U+FE0F) characters (OWASP LLM01 prevention #5); classifyInjection(text): ScreenVerdict ('safe'|'quarantine') runs the INSTRUCTION_OVERRIDE word-bounded regex set after the unicode strip — dependency-free, deterministic, zero model calls (D-4b-05, RESEARCH Code Example 1)."
    - "The classifier is a SCREEN, not the security boundary: tests assert screening behavior on known pattern shapes + unicode-strip invariants + determinism — they do NOT assert paraphrased/adversarial payloads MUST be quarantined (OWASP #3 filters are evadable; the authority strip is the boundary — RESEARCH Pitfall 2)."
  artifacts:
    - "src/core/context/trust/TrustPolicy.ts (AUTHORITY_BY_TRUST, applyTrustPolicy, ContextInjectionBlockedError + guard)"
    - "src/core/context/trust/injectionScreener.ts (stripInvisibleUnicode, classifyInjection, ScreenVerdict, INSTRUCTION_OVERRIDE)"
    - "tests/core/context/trust/TrustPolicy.test.ts"
    - "tests/security/prompt-injection/injectionScreener.test.ts"
  key_links:
    - "applyTrustPolicy is the D-4b-02/04 boundary: it runs on ContextItem[] at the feed BEFORE section conversion — 04b-04 wires it into ContextOptimizer; nothing else inspects trust/instructionAuthority (P4b-1 ownership rule)."
    - "The `<untrusted_data>` wrap must never enter CACHED_KINDS — the wrap lands only on the per-turn context section (F-5); 04b-04's stable-prefix snapshots pin this."
  flagged_assumptions:
    - "A1 [research, ASSUMED]: the INSTRUCTION_OVERRIDE regex set (ignore-previous-instructions, disregard, 'you are now', redefine/rewrite system prompt, permission/tool-grant, ignore-guidelines, do-not-tell) + stripInvisibleUnicode is the D-4b-05 'exact set' to ship (RESEARCH Code Example 1 L379-393 — discretion). Fixtures pin these shapes; patterns are cheap to change."
    - "A2 [research, ASSUMED]: the invisible-Unicode strip is part of the 4b screener even though the spec's 4b block lists only instruction-phrase patterns (OWASP LLM01 #5; within D-4b-05 discretion)."
    - "TRUST-02 [unresolved — spec-less probe, adjacency]: when two items are exactly equal or just touch, the classifier evaluates each item's text independently (per-item regex test on its own cleaned text) — items never merge, collide, or share a verdict; the pipeline preserves input order (no dedup, no coalescing) — pinned by the per-item tests in this plan and the receipt order tests in 04b-03."
    - "TRUST-02 [unresolved — spec-less probe, empty]: classifyInjection('') and classifyInjection(whitespace) return 'safe' (no INSTRUCTION_OVERRIDE pattern matches an empty/whitespace string) — pinned by an explicit empty-input test in injectionScreener.test.ts."
  prohibitions:
    - "No retrieved/untrusted/tool item may carry instructionAuthority:true into a PromptSection — applyTrustPolicy strips it and wraps (CTX-02, GR-7); a test asserting otherwise encodes a false claim."
    - "No silent pass-through of a classified-injection item — quarantine keeps it a ContextItem and records it in the receipt (D-4b-06); quarantine-not-drop is exercised at the optimizer level in 04b-04."
    - "No DOMPurify in the core context pipeline — page markdown is text pre-optimizer; the §16.1 render-side XSS matrix covers UI (D-4b-05, deferred idea)."
---

<!-- 04b-02 (2026-08-13): Wave-2 trust primitives — the O.3 policy boundary
     (TrustPolicy.ts verbatim) and the deterministic injection screener
     (stripInvisibleUnicode + classifyInjection). Both pure/synchronous/zero-model
     (D-4b-03/05). The classifier is a SCREEN over the architectural boundary
     (OWASP LLM01 #6 provenance-labeled channel) — tests assert screening and
     strip invariants, never filter recall (RESEARCH Pitfall 2). -->

<objective>
Ship the two pure trust primitives: `TrustPolicy.applyTrustPolicy` (O.3 verbatim authority stripping + `<untrusted_data>` wrap) and the deterministic injection screener (`stripInvisibleUnicode` + `classifyInjection`), with their unit tests.

Purpose: these are the D-4b-02/04 trust boundary and the D-4b-05 screening layer that 04b-04 wires into ContextOptimizer before section conversion. Both must be deterministic, dependency-free, and zero-model-call (the 2-call/healthy-turn cost invariant survives — RESEARCH R-2).

Output: TrustPolicy.ts + injectionScreener.ts + their test files green.
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
@src/core/context/ContextOptimizer.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: TrustPolicy.ts — O.3 verbatim authority stripping + blocked-injection carrier</name>
  <files>src/core/context/trust/TrustPolicy.ts, tests/core/context/trust/TrustPolicy.test.ts</files>
  <read_first>
    - .planning/PRODUCT_SPEC_v0_1.md Appendix O.3 (L6433-6459) — the VERBATIM worked reference
    - src/core/context/ContextOptimizer.ts (L64-74: the ContextTooLargeError + isContextTooLargeError typed-carrier pattern to mirror for the blocked-injection code)
    - src/types/harness.ts (ContextItem/TrustLevel from 04b-01)
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-PATTERNS.md (TrustPolicy.ts section: pure-primitives module shape, typed-error carrier, anti-pattern notes)
  </read_first>
  <action>
    Create src/core/context/trust/TrustPolicy.ts (NEW, `src/core/context/trust/` dir). Module contract (header comment): O.3 verbatim source (spec L6433-6459), Phase 4b CTX-02/D-4b-02/04, pure + synchronous + zero-model + zero-chrome (Pitfall 5) — determinism rule: no Date.now/crypto.
    - `import type { ContextItem, TrustLevel } from '@/types/harness';` (type-only — R-1 imports, never re-declares).
    - `const AUTHORITY_BY_TRUST: Record<TrustLevel, boolean> = { system: true, user: true, tool: false, retrieved: false, untrusted: false };` — NOT exported unless a test needs it; prefer testing through applyTrustPolicy (P4b-1: TrustPolicy owns ALL trust logic).
    - `export function applyTrustPolicy(items: ContextItem[]): ContextItem[]` — O.3 verbatim: map each item; `const allowed = AUTHORITY_BY_TRUST[it.trust]; if (it.instructionAuthority && !allowed) return { ...it, instructionAuthority: false, text: \`<untrusted_data source="${it.sourceId}">\n${it.text}\n</untrusted_data>\` }; return it;`. Items with trust system/user pass through byte-identical. Items already instructionAuthority:false pass through unmodified (no double-wrap — the wrap happens exactly once).
    - Typed error carrier (O.3 L6457-6458 + ContextTooLargeError precedent): `export interface ContextInjectionBlockedError extends Error { code: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED'; }` + `export function isContextInjectionBlockedError(err: unknown): err is ContextInjectionBlockedError` (guard: `err instanceof Error && (err as ContextInjectionBlockedError).code === 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED'`) + an exported `contextInjectionBlockedError()` builder that constructs the typed carrier the same way contextTooLargeError() does (L120-127). This plan only exports the carrier for defensive use — strip+wrap+quarantine IS the Phase-4b enforcement (D-4b-06 quarantine-not-drop keeps hits auditable in the receipt), so no code in 04b-03/04 raises it and no raise site ships in Phase 4b; the typed carrier + guard are exported so a future caller (e.g. Phase-6 diagnostics or a non-quarantine policy-redefinition path) can represent the O.3 error without inventing one.

    Create tests/core/context/trust/TrustPolicy.test.ts (deterministic fixtures only — fixed strings, no Date.now):
    - AUTHORITY_BY_TRUST mapping behavior: system/user items with instructionAuthority:true pass through BYTE-IDENTICAL (toEqual on the whole object); retrieved/untrusted/tool items with instructionAuthority:true come back instructionAuthority:false with text EXACTLY `\`<untrusted_data source="${sourceId}">\n${originalText}\n</untrusted_data>\`` (assert the exact wrapped string — byte-level, not regex).
    - A retrieved item ALREADY instructionAuthority:false passes through unmodified (no re-wrap, no double wrap — assert text unchanged).
    - isContextInjectionBlockedError returns true for the builder's output and false for a plain Error / CONTEXT_TOO_LARGE carrier (ContextOptimizer.test.ts L145-158 guard-test precedent).
    - Determinism: two calls with identical input return deep-equal arrays.
  </action>
  <acceptance_criteria>
    - TrustPolicy.ts contains the literals `export function applyTrustPolicy` and `const AUTHORITY_BY_TRUST` and `isContextInjectionBlockedError` and the CONTEXT_INSTRUCTION_INJECTION_BLOCKED code string used in the builder.
    - TrustPolicy.ts contains NO `chrome.` reference, NO `async` on applyTrustPolicy, and no model/SDK import (pure module — `grep -v '^#' | grep -c "chrome\."` on the file == 0).
    - TrustPolicy.test.ts exits 0 with `pnpm vitest run tests/core/context/trust/TrustPolicy.test.ts --bail=1`.
    - `pnpm exec tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/context/trust/TrustPolicy.test.ts --bail=1</automated>
  </verify>
  <done>applyTrustPolicy O.3-verbatim with the exact wrap format; system/user byte-identical; typed CONTEXT_INSTRUCTION_INJECTION_BLOCKED carrier exported; tests green.</done>
</task>

<task type="auto">
  <name>Task 2: injectionScreener.ts — unicode strip + deterministic classifier</name>
  <files>src/core/context/trust/injectionScreener.ts, tests/security/prompt-injection/injectionScreener.test.ts</files>
  <read_first>
    - .planning/phases/04b-trust-aware-context-and-receipts/04b-RESEARCH.md (Code Example 1 L360-393 — the recommended pattern set; Common Pitfalls Pitfall 2 — the anti-recall-assertion rule; Security Domain invisible-Unicode row)
    - src/core/context/TokenBudget.ts (module-level regex constant pattern L28-29) and src/core/security/TraceRedactor.ts (REDACTION_PATTERNS reduce pattern L10-28) — the structural analogs
  </read_first>
  <action>
    Create src/core/context/trust/injectionScreener.ts (NEW). Header comment: D-4b-05 discretion (RESEARCH Code Example 1), OWASP LLM01 prevention #5, zero dependencies/zero model calls, determinism.
    - `const INVISIBLE_UNICODE = /[\u200B\u200C\u200D\u2060\uE0000-\uE007F\uFE00-\uFE0F]/g;` and `export function stripInvisibleUnicode(text: string): string { return text.replace(INVISIBLE_UNICODE, ''); }` — exact codepoint classes: zero-width space (U+200B), zero-width non-joiner (U+200C), zero-width joiner (U+200D), word joiner (U+2060), tag block (U+E0000-U+E007F), variation selectors (U+FE00-U+FE0F).
    - `export type ScreenVerdict = 'safe' | 'quarantine';`
    - `const INSTRUCTION_OVERRIDE: RegExp[] = [...]` — the RESEARCH Code Example 1 set (L379-387), all case-insensitive and word-bounded: ignore (all/any/the) (previous|prior|above|earlier) (instructions|prompts|rules|commands); disregard (the) (previous|prior|above) (instructions|prompts|rules); 'you are now'; (redefine|rewrite|update) (your) (system) (prompt|instructions); (you) (have|are granted|now have) (permission|authority|access) to (use|call|execute|access) (all) (tools|commands); ignore (your) (guidelines|safety|rules|protocols); do not (mention|tell|reveal|report) (the) (user|this|anyone). Keep the exact pattern literals from RESEARCH so fixtures pin them.
    - `export function classifyInjection(text: string): ScreenVerdict { const cleaned = stripInvisibleUnicode(text); return INSTRUCTION_OVERRIDE.some((re) => re.test(cleaned)) ? 'quarantine' : 'safe'; }`

    Create tests/security/prompt-injection/injectionScreener.test.ts (NEW top-level dir `tests/security/prompt-injection/` — tests/isolation/ top-level precedent; default jsdom-align env fine):
    - stripInvisibleUnicode exact-codepoint assertions: input containing U+200B, U+200C, U+200D, U+2060, U+E0001 (tag block), U+FE0F (variation selector) → output has each removed (assert exact expected string).
    - classifyInjection flags the known shapes: one fixture per INSTRUCTION_OVERRIDE pattern family (ignore previous instructions; disregard prior rules; you are now my assistant; redefine your system prompt; you have permission to use all tools; ignore your safety guidelines; do not tell the user) → 'quarantine'.
    - Unicode-smuggled variant: 'ignore\u200Bprevious\u200Binstructions' (zero-widths inside the phrase) → 'quarantine' (strip-then-classify).
    - Empty + whitespace-only input → 'safe' (TRUST-02 empty probe resolution, flagged assumption in must_haves).
    - Determinism: same input twice → same verdict (two sequential calls deep-equal).
    - **Do NOT** add a test asserting a paraphrased/adversarial payload MUST be quarantined (RESEARCH Pitfall 2 — the authority strip is the boundary, this file tests the screen only).
  </action>
  <acceptance_criteria>
    - injectionScreener.ts contains `export function stripInvisibleUnicode` and `export function classifyInjection` and `export type ScreenVerdict` and the INVISIBLE_UNICODE regex with the codepoint classes.
    - injectionScreener.ts has no imports at all except type-only if needed (dependency-free — `grep -c "^import"` == 0 or only type imports).
    - injectionScreener.test.ts exits 0 with `pnpm vitest run tests/security/prompt-injection/injectionScreener.test.ts --bail=1`.
    - `pnpm exec tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/security/prompt-injection/injectionScreener.test.ts --bail=1</automated>
  </verify>
  <done>stripInvisibleUnicode + classifyInjection ship with the RESEARCH pattern set; empty-input and unicode-smuggling cases pinned; no adversarial-recall assertions (Pitfall 2).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| retrieved page text → classifier | untrusted markdown crosses the screening layer here — invisible-Unicode smuggling and instruction-override shapes are the attack surface |
| ContextItem[] → applyTrustPolicy | the authority-stripping boundary — items that would carry instruction authority from untrusted sources are neutralized here |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4b-03 | Tampering | stripInvisibleUnicode (injectionScreener.ts) | medium | mitigate | Mandatory strip at ingest (OWASP LLM01 #5): zero-width U+200B/200C/200D/2060, tag-block U+E0000-E+007F, variation selectors U+FE00-FE0F removed BEFORE classification — pins exact codepoints in tests; a miss here degrades to the classifier + authority strip, never to a direct pass-through. |
| T-4b-02 | Tampering | classifyInjection (INSTRUCTION_OVERRIDE) | high | mitigate | Deterministic word-bounded regex screen flags system-prompt redefinition + permission-grant shapes; OWASP #3 filters are evadable so the classifier is a SCREEN — the real boundary is applyTrustPolicy's authority strip (T-4b-01 in 04b-01 + runtime wiring in 04b-04); CONTEXT_INSTRUCTION_INJECTION_BLOCKED typed carrier exists for policy-redefinition attempts; quarantine-not-drop (D-4b-06) keeps hits auditable in the receipt. |
| T-4b-04 | Elevation of Privilege | permission/tool-grant patterns in retrieved content | high | mitigate | The INSTRUCTION_OVERRIDE permission-grant patterns (use/call/execute/access tools) flag + quarantine such items; tool EXECUTION governance is Phase 8 ExecutorService (R-4) — 4b prevents the instruction from reaching the model with authority (authority strip). |
| T-4b-01 | Tampering | applyTrustPolicy boundary | high | mitigate | O.3 verbatim strip: every instructionAuthority:true item whose trust is tool/retrieved/untrusted is force-set false + wrapped `<untrusted_data source=...>` (provenance-labeled channel, OWASP #6); system/user items untouched; even a classifier miss is rendered inert — pinned by the byte-exact wrap tests. |
</threat_model>

<verification>
- `pnpm vitest run tests/core/context/trust/TrustPolicy.test.ts --bail=1` green.
- `pnpm vitest run tests/security/prompt-injection/injectionScreener.test.ts --bail=1` green.
- `pnpm exec tsc --noEmit` green.
- Both new files are in the phase's required test dirs (`tests/core/context/trust/**`, `tests/security/prompt-injection/**` — §18 L2746).
</verification>

<success_criteria>
- applyTrustPolicy O.3-verbatim (authority strip + exact `<untrusted_data source="...">` wrap) — the D-4b-02/04 boundary is ready for 04b-04 wiring.
- CONTEXT_INSTRUCTION_INJECTION_BLOCKED typed carrier exported (isContextInjectionBlockedError guard).
- stripInvisibleUnicode + classifyInjection ship with the RESEARCH pattern set (A1/A2), empty-input + smuggling cases pinned, no adversarial-recall assertions.
- Zero new packages, zero model calls (R-9/R-2).
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-and-receipts/04b-02-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- `src/core/context/trust/TrustPolicy.ts` — `AUTHORITY_BY_TRUST` (module const), `applyTrustPolicy(items: ContextItem[]): ContextItem[]`, `ContextInjectionBlockedError` (interface), `isContextInjectionBlockedError(err: unknown)` guard, `contextInjectionBlockedError()` builder
- `src/core/context/trust/injectionScreener.ts` — `INVISIBLE_UNICODE` (module regex), `stripInvisibleUnicode(text: string): string`, `ScreenVerdict` type ('safe'|'quarantine'), `INSTRUCTION_OVERRIDE` (module RegExp[]), `classifyInjection(text: string): ScreenVerdict`
- `tests/core/context/trust/TrustPolicy.test.ts`
- `tests/security/prompt-injection/injectionScreener.test.ts` (new top-level `tests/security/prompt-injection/` dir)
