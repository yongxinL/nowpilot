---
phase: 05-context-adaptive-execution
reviewed: 2026-08-29T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/core/context/types.ts
  - src/core/context/ModelContextTier.ts
  - src/core/context/TokenBudget.ts
  - src/core/context/ContextCompressor.ts
  - src/core/context/ContextPack.ts
  - src/core/context/ContextProvenanceManifest.ts
  - src/core/context/ContextOptimizer.ts
  - tests/core/context/TokenBudget.test.ts
  - tests/core/context/ContextCompressor.test.ts
  - tests/core/context/ContextOptimizer.test.ts
  - package.json
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the seven Phase-5 context modules (`src/core/context/*`), the three required test files, and the `verify:phase-5` gate re-point (D-78). Verified against locked decisions D-69..D-78: D-69 create-only holds (zero imports of `src/core/context/*` anywhere in `src/`; PromptCacheAdapter still imports `./types`), zero NP-STRICT markers, no debug artifacts, D-38 respected (`CONTEXT_TOO_LARGE` is a union literal, not a StreamErrorCodeSchema addition), untrusted content confined to context/memory/tool_schemas kinds, and `truncatedSources` carries sourceIds only — never bodies (T-05-03).

The core spine — tier classification, floor-based 70/20/10 budgets, the degradation ladder order, the never-oversized invariant (holds by construction for all Phase-5 paths), and the manifest on every context — is sound and well-tested. The five warnings are concentrated in the two *seams* the phase declares-but-doesn't-populate (Summarizer, and the ladder's no-op rungs): the shipped seam contracts encode token-accounting and manifest-fidelity defects that Phase 7 will inherit, plus one code-unit slicing bug that can fire in Phase 5 itself (surrogate-pair split in structural compression) and one duplicate-name hole that can defeat rung 5. No BLOCKERs in Phase-5 exercised paths.

## Warnings

### WR-01: `summarizeHistory` undercounts tokens when a Summarizer is plugged in — breaks the never-oversized invariant

**File:** `src/core/context/ContextCompressor.ts:108-112`
**Issue:** In the Summarizer branch, `text` is `[...header, summary.text, ...tail].join('\n')` but `tokens` is set to `summary.tokens` alone — the header (URL/TITLE + page body) and tail (trailing notes) token counts are silently dropped from the tally. The phase's spine is "never sends an oversized prompt" (SC#2/§19.3): the moment a Phase-7 consumer plugs a real Summarizer into this seam, `assemble`'s ladder can report `ok:true` with a `totalTokens` that undercounts the actual prompt text by the full header+tail weight, and the guarantee silently breaks. The test locks the wrong behavior: `ContextCompressor.test.ts:113` asserts `out.tokens === 9` while `out.text` is `'URL: https://example.com\nTITLE: Example\nHISTORY SUMMARY\ntrailing note'` (~66 chars ≈ 17 heuristic tokens — a 60% undercount). The no-summarizer fallback branch (line 117) does it correctly (`countTokensHeuristic(text)`), so the divergence is provable, not speculative.
**Fix:**
```typescript
if (summarizer) {
  const summary = summarizer.summarize([{ ...section, text: turns.join('\n') }]);
  const text = [...header, summary.text, ...tail].join('\n');
  // Count the FULL replacement text — summary.tokens covers only the summary line.
  return { ...section, text, tokens: countTokensHeuristic(text) };
}
```
(Update the test to assert `countTokensHeuristic(out.text)` rather than the raw `9`.)

### WR-02: `truncated: true` / `compressionApplied: 'summarise'` mislabel the drop-not-silence fallback and the no-op case

**File:** `src/core/context/ContextCompressor.ts:106,114-117` + `src/core/context/ContextOptimizer.ts:209-213`
**Issue:** `truncated` is set to `true` whenever `turnIndexes.length > 0` — even when there are ≤ 2 turns and `turns.slice(-2)` drops *nothing* (a pure no-op reported as truncation). Separately, the no-summarizer fallback **drops** older turns (never summarizes), yet the ladder marks the record with `compressionApplied: 'summarise'` (`markRecord(working, 'context', 'summarise')` at ContextOptimizer.ts:211) — the manifest claims a summarization that never happened. `compressionApplied` is the §2.6 audit field PromptInspector displays; both mislabels degrade provenance fidelity. Latent in Phase 5 (assembled CONTEXT has no `TURN ` lines) but the seam is shipped and the drop fallback is explicitly unit-tested — the mislabel is part of the contract Phase 7 inherits.
**Fix:** Report the actual operation. Add a `compressionApplied` value only when a summary was produced; for the drop fallback either leave `compressionApplied` unset (truncation is already carried by `truncated: true`) or extend the union with a `'drop'` literal (spec-side change needed), and only set `truncated` when `keptTurns.length < turns.length`.

### WR-03: `compressStructural` code-unit `.slice()` can split surrogate pairs — lone surrogates in the shipped prompt

**File:** `src/core/context/ContextCompressor.ts:38-39`
**Issue:** `bodyText.slice(0, keep)` slices on UTF-16 code units. If the 40% cutoff lands between a high and low surrogate (a page body containing emoji or any supplementary-plane character — realistic for ServiceNow ticket bodies), the compressed section ends with a lone high surrogate and the packed prompt contains invalid UTF-16, rendered as `�` by any consumer. This contradicts the module's own code-point-awareness discipline (Pitfall 7 is applied in `countTokensHeuristic` via `Array.from` but not here), and it corrupts the byte stream that Phase-7's cache-key hashing depends on. This one is **not** latent: it fires in Phase 5 whenever a real page body overflows and hits rung 4.
**Fix:**
```typescript
const chars = Array.from(bodyText); // code-point aware
const keep = Math.ceil(chars.length * STRUCTURAL_COMPRESS_RATIO);
const text = [...header, chars.slice(0, keep).join('')].join('\n');
```

### WR-04: Duplicate tool names defeat rung 5's halving — silent premature `CONTEXT_TOO_LARGE`

**File:** `src/core/context/ContextOptimizer.ts:231-241` (+ root cause `ContextOptimizer.ts:363-369`, `ContextCompressor.ts:66-74`)
**Issue:** `buildToolSchemasText` and `toolNamesSorted` do not deduplicate. If `selectedToolSchemas` contains two entries with the same `name` (the `ToolSchemaRef[]` input type permits it — no validation anywhere), the [TOOL SCHEMAS] section carries two identical lines. Rung 5 halves `inScopeTools` to `['toolA']`, but `trimToolSchemas`'s set filter `inScope.has(name)` keeps **both** duplicate lines, so `totalTokens` does not drop, the `totalTokens >= before` guard breaks out, and the ladder advances with the tool section effectively un-trimmed. A prompt that would fit after dedupe (or after trimming to 1 line) instead walks to rung 7 and returns `CONTEXT_TOO_LARGE` — the degradation ladder silently fails its job for a legal input.
**Fix:** Deduplicate by name at section build time:
```typescript
const seen = new Set<string>();
const unique = [...tools].filter((t) => (seen.has(t.name) ? false : (seen.add(t.name), true)));
```
or reject duplicate names via zod at the Phase-7 input boundary.

### WR-05: Summarizer `tokens: number` can flow into `z.number().int().nonnegative()` inside a "never-throw" function — `buildManifest` throws

**File:** `src/core/context/types.ts:59` → `src/core/context/ContextProvenanceManifest.ts:33` → `src/core/context/ContextOptimizer.ts:155-161,456-462`
**Issue:** The `Summarizer` seam returns `tokens: number` (unconstrained). Those tokens are copied into `ManifestSectionRecord.tokens` via `applySections` and fed to `buildManifest`, whose schema requires `z.number().int().nonnegative()`. A consumer summarizer returning a float (e.g. a weighted tokenizer average) or a negative count makes `ContextProvenanceManifestSchema.parse` **throw** — and `assemble` is contractually "never a throw" (Q4, returned `AssembleResult` union). The same throw path exists in `tooLargeResult`. The interface contract must constrain the value at the seam, not rely on Phase-7 summarizer authors.
**Fix:** Make the seam type enforce the invariant and/or sanitize at the boundary:
```typescript
export interface Summarizer {
  summarize(sections: PromptSection[]): { text: string; tokens: number }; // document: int ≥ 0
}
// in summarizeHistory:
const tokens = Number.isInteger(summary.tokens) && summary.tokens >= 0
  ? summary.tokens
  : countTokensHeuristic(text); // sanitize instead of throwing downstream
```

## Info

### IN-01: Body-line prefix collisions with the LOCKED section-text conventions

**File:** `src/core/context/ContextCompressor.ts:34,97`
**Issue:** `compressStructural` hoists any body line starting with `URL: ` / `TITLE: ` into the preserved header; `summarizeHistory` treats any line starting with `TURN ` as a history turn. Real page markdown routinely contains lines like `URL: https://…` (link lists) or prose beginning "Turn …". Such lines are either wrongly preserved past the 40% cut or wrongly dropped as "history". Phase 5's assembled CONTEXT cannot contain `TURN ` lines, but arbitrary page bodies can contain `URL: `/`TITLE: ` lines today. Suggest documenting the collision (or delimiting header lines with a marker that cannot appear in body text) before Phase 7 supplies real turns.
**Fix:** Prefer a reserved delimiter for header/history lines (e.g. a leading control marker) or document the collision as an accepted heuristic in the module header.

### IN-02: `operationId`, `model`, `conversationId` are accepted but never read

**File:** `src/core/context/ContextOptimizer.ts:42,44,46`
**Issue:** All three §2.3 input fields are declared and typed but never referenced in `assemble` or any helper — no validation, no manifest field, no trace. Verbatim contract fidelity is fine (Phase 7 may consume them), but the dead inputs are a footgun: callers may assume `operationId` correlation lands in the manifest or trace; it does not.
**Fix:** Either document explicitly ("accepted for Phase-7 contract fidelity, unused in Phase 5") in the interface JSDoc, or wire `operationId` into the trace surface now.

### IN-03: `truncatedSources` lists the full source identity, including entries that were *not* truncated

**File:** `src/core/context/ContextOptimizer.ts:349-360,441-445`
**Issue:** `sourceIdFor` returns ALL initial tool names / memory ids joined (never the surviving subset). After rung 5/6, `truncatedSources` names tools/memories that were **kept** alongside the dropped ones. Tests lock this (ContextOptimizer.test.ts:218 asserts the full 240-id join), and the doc frames sourceId as "source identity", but a consumer reading `truncatedSources` as "what was truncated" gets an over-broad list. Flagging for Phase 7/11 PromptTrace semantics.
**Fix:** Consider emitting the *removed* subset (or a count) for tool/memory kinds; at minimum rename the field's JSDoc to "source identities of truncated sections (may include surviving entries)".

### IN-04: `localeCompare` sort is not byte-deterministic across ICU versions

**File:** `src/core/context/ContextOptimizer.ts:366,398`
**Issue:** `[TOOL SCHEMAS]` is cache-eligible (`stable: true`) and §1.3 requires name-sorted order — but `a.name.localeCompare(b.name)` is locale/ICU-version dependent (e.g. Turkish `I`/`i` ordering, or different default collation between Node builds). Two machines can sort the same tool list differently, producing different cache keys for a supposedly stable section. Phase 5 has no live cache consumer, but the byte-stability contract is the module's own stated rationale.
**Fix:** Use a deterministic ordinal comparator: `(a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)`.

### IN-05: Manifest omission records appended out of canonical order

**File:** `src/core/context/ContextProvenanceManifest.ts:83-89`
**Issue:** `buildManifest` appends the `system`/`task` omission records *after* the shipped sections, so the manifest's `sections[]` order is `tool_schemas, preferences, memory, context, user_input, system, task` — not the §1.3 canonical order the shipped sections follow. The test locks this order, and it is a documented Q3 choice, but any consumer iterating the manifest expecting canonical order (PromptInspector in Phase 7) must handle the discontinuity.
**Fix:** Either insert omission records at their canonical positions (`system` first, `task` before `user_input`) or document the receipt ordering in the schema JSDoc.

### IN-06: CJK ranges omit full-width forms and CJK punctuation — density gate undercounts

**File:** `src/core/context/TokenBudget.ts:25-32`
**Issue:** `CJK_RANGES` covers ideographs/hiragana/katakana/hangul but not `0xFF00-0xFFEF` (Halfwidth/Fullwidth Forms — full-width comma `，`, parens, etc.) nor `0x3000-0x303F` (CJK punctuation). A CJK-heavy paragraph using full-width punctuation counts those code points as non-CJK, lowering the density below `0.3` and switching the section to `ceil(len/4)` — undercounting a genuine CJK section. Pure heuristic, so low impact, but the density gate's purpose (Pitfall 8) is partially defeated by the same text conventions it is meant to detect.
**Fix:** Add `[0xff00, 0xffef]` and `[0x3000, 0x303f]` to `CJK_RANGES` (or document the omission as accepted heuristic drift).

---

_Reviewed: 2026-08-29T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_