# Phase 4b: Trust-Aware Context and Receipts — Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 25 (6 new core/registry/pref files + 8 new test files + 9 in-place modifications + 2 planning/config docs)
**Analogs found:** 24 / 25 (one file — `injectionScreener.ts` — has no exact analog; pattern assembled from TokenBudget + TraceRedactor + research Code Example)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/types/harness.ts` (MODIFY) | types | — | itself (Phase-3a in-place extension, L20-117) | exact (in-place) |
| `src/core/context/trust/TrustPolicy.ts` (NEW) | service (pure policy) | transform | spec O.3 verbatim (L6433-6459) + `ContextCompressor.ts` pure-primitive module | role-match |
| `src/core/context/trust/injectionScreener.ts` (NEW) | utility (deterministic classifier) | transform | `TokenBudget.ts` (pure regex) + `TraceRedactor.ts` (pattern array) | partial |
| `src/core/context/trust/contextFeed.ts` (NEW) | service (converter) | transform | `PageContentSerializer.ts` (pure fn + module const) + `TokenBudget.ts` | role-match |
| `src/core/context/contextReceipt.ts` (NEW) | service (builder) | transform | `ContextProvenanceManifest.ts` (in-place extension target) | exact |
| `src/core/preferences/trustConfig.ts` (NEW) | config / accessor | request-response | `src/core/ai/persona/personaConfig.ts` | exact |
| `src/core/registry/TrustSettingsStore.ts` (NEW) | store (zustand) | CRUD / write-through | `src/core/registry/AddonSettingsStore.ts` | exact |
| `src/core/ai/types.ts` (MODIFY) | types | — | itself (additive `contextUpdate?` seam, L172-181) | exact (in-place) |
| `src/core/context/ContextProvenanceManifest.ts` (MODIFY) | model | — | itself (D-04-17/18 in-place extension) | exact (in-place) |
| `src/core/context/ContextOptimizer.ts` (MODIFY) | service (orchestrator) | CRUD / transform | itself (ladder stage + provenance stamping) | exact (in-place) |
| `src/core/storage/Setting.ts` (MODIFY) | config | — | itself (`np_persona` registry row, L67) | exact (in-place) |
| `src/core/error/errorCodes.ts` (MODIFY) | config | — | itself (`CONTEXT_TOO_LARGE` addition, L90-96) | exact (in-place) |
| `src/core/i18n/strings.ts` (MODIFY) | config | — | itself (`options` block L103-119, `theme.saveFailed` L120-123) | exact (in-place) |
| `src/components/pages/useStreamingLLM.ts` (MODIFY) | hook | request-response | itself (persona pipeline L150-154, optimizerBase L174-185) | exact (in-place) |
| `src/components/pages/OptionsPage.tsx` (MODIFY) | component | request-response | itself (Appearance card L43-51 + toast pattern) | exact (in-place) |
| `tests/core/context/trust/TrustTypes.test.ts` (NEW) | test | — | `ContextProvenanceManifest.test.ts` (Zod gate + union parity) | exact |
| `tests/core/context/trust/TrustPolicy.test.ts` (NEW) | test | — | `ContextCompressor.test.ts` (pure-primitive behavior) | exact |
| `tests/core/context/trust/contextFeed.test.ts` (NEW) | test | — | `PageContentSerializer.test.ts` / `TokenBudget.test.ts` | role-match |
| `tests/core/context/trust/contextReceipt.test.ts` (NEW) | test | — | `ContextProvenanceManifest.test.ts` | exact |
| `tests/core/context/trust/stablePrefix.test.ts` (NEW) | test (snapshot) | — | `ContextOptimizer.test.ts` drop-in identity block (L276-326) | exact |
| `tests/core/context/trust/qualityCounters.test.ts` (NEW) | test | — | `ContextProvenanceManifest.test.ts` | exact |
| `tests/security/prompt-injection/injectionScreener.test.ts` (NEW) | test | — | `tests/core/security/redactSensitive.test.ts` (regex behavior) | role-match |
| `tests/security/prompt-injection/quarantine.test.ts` (NEW) | test | — | `ContextOptimizer.test.ts` + `tests/isolation/` (new top-level dir precedent) | role-match |
| `tests/components/pages/OptionsPage.test.tsx` (NEW) | test (component) | — | `tests/components/pages/ChatPage.test.tsx` | role-match |
| `tests/core/context/ContextOptimizer.test.ts` (MODIFY) | test | — | itself (extend drop-in identity + add page feed cases) | exact (in-place) |
| `package.json` (MODIFY) | config | — | itself (`verify:phase-4a` script, L24) | exact (in-place) |
| `REQUIREMENTS.md` (MODIFY) | planning doc | — | itself (AI-07 precedent re-map note) | exact (in-place) |

> Note: The Options test lives in the existing component test tree at `tests/components/pages/OptionsPage.test.tsx` (ChatPage.test.tsx, useStreamingLLM.test.tsx precedent) — RESEARCH and all plan files use this synced path.

---

## Pattern Assignments

### `src/types/harness.ts` (types — MODIFY IN PLACE)

**Analog:** itself — the Phase-3a extension (AgentTrajectory types + co-located Zod schemas) is the exact template; the header (L13-16) already declares ContextItem as the next extension point.

**Header-extension comment pattern** (L1-17 — append a Phase 4b block, do not disturb the 3a block):
```typescript
// src/types/harness.ts — Source: §C.1 canonical home rule (R-1, Golden Rule 2)
// ...
// Later harness-track groups (ContextItem, WorkingMemory, ToolCapabilityManifest,
// StageEvent, collaboration types, ...) extend THIS file in their target
// phases — never relocate. Consumers ... import from here, never re-declare (R-1 ...)
import { z } from 'zod';
```

**Type + co-located Zod schema pattern** (L22-117 — TrustLevel/ContextItem/ContextReceiptEntry land VERBATIM from C.1 L4877-4899, with `ContextItemSchema`/`ContextReceiptEntrySchema`/`TrustOmitReason` co-located):
```typescript
/** C.1: the 10-state trajectory machine of a single agent run (AGT-01). */
export type AgentTrajectoryPhase = ...;
export interface AgentTrajectoryState { ... }
// ---- Zod boundary schemas (GR-4, D-3a-20 — zod 3 API only, research A5) ----
export const AgentTrajectoryPhaseSchema = z.enum([...]);
export const AgentTrajectoryStateSchema = z.object({ ... });
```

**C.1 verbatim source (spec L4877-4899):**
```typescript
export type TrustLevel = 'system' | 'user' | 'tool' | 'retrieved' | 'untrusted';
export interface ContextItem {
  id: string;
  kind: PromptSection['kind'];
  text: string;
  tokens: number;
  trust: TrustLevel;
  instructionAuthority: boolean;   // MUST be false for retrieved/untrusted data
  relevance: number;               // 0..1
  freshness: number;               // 0..1
  sensitivity: 'none' | 'low' | 'high';
  sourceId: string;
}
export interface ContextReceiptEntry {
  sourceId: string;
  included: boolean;
  originalTokens: number;
  finalTokens: number;
  compression?: 'summarise' | 'structural' | 'topk';
  cacheEligible: boolean;
  omitReason?: string;
}
```
**GR-4 note:** `ContextItem.kind` must mirror `PromptSection['kind']` (ai/types.ts L135-143) — the D-04-18 union-parity test pattern applies (see ContextProvenanceManifest.test.ts L79-102).

---

### `src/core/context/trust/TrustPolicy.ts` (service, transform — NEW)

**Analog:** spec Appendix O.3 verbatim (L6433-6459) + `ContextCompressor.ts` (pure section-level primitives module).

**Module shape — pure primitives, type-only imports, no async/model/storage** (ContextCompressor.ts L1-25, L25-28):
```typescript
// src/core/context/TrustPolicy.ts — O.3 verbatim
import type { ContextItem, TrustLevel } from '@/types/harness';

const AUTHORITY_BY_TRUST: Record<TrustLevel, boolean> = {
  system: true, user: true, tool: false, retrieved: false, untrusted: false,
};

/** Enforce CTX-02: only system/user may carry instruction authority. */
export function applyTrustPolicy(items: ContextItem[]): ContextItem[] {
  return items.map(it => {
    const allowed = AUTHORITY_BY_TRUST[it.trust];
    if (it.instructionAuthority && !allowed) {
      return { ...it, instructionAuthority: false,
        text: `<untrusted_data source="${it.sourceId}">\n${it.text}\n</untrusted_data>` };
    }
    return it;
  });
}
```

**Typed-error carrier for the blocked-injection code** — mirror ContextOptimizer's `ContextTooLargeError` (ContextOptimizer.ts L64-74, L119-127):
```typescript
export interface ContextTooLargeError extends Error {
  code: 'CONTEXT_TOO_LARGE';
  reason: 'minimal_mode_exceeded';
  totalTokens: number;
  inputBudget: number;
}
export function isContextTooLargeError(err: unknown): err is ContextTooLargeError {
  return err instanceof Error && (err as ContextTooLargeError).code === 'CONTEXT_TOO_LARGE';
}
// throw-site pattern (L120-127):
const err = new Error('CONTEXT_TOO_LARGE') as ContextTooLargeError;
err.code = 'CONTEXT_TOO_LARGE'; ...
```
Apply the same shape for `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` (O.3 comment L6457-6458).

**Anti-pattern (locked):** TrustPolicy must NEVER touch system/user items, never mutate the personaBlock, never call a model, never be async. Pure function only — tests call it synchronously (Pitfall 5).

---

### `src/core/context/trust/injectionScreener.ts` (utility, transform — NEW)

**Analog (partial):** `TokenBudget.ts` (module-level regex + pure deterministic function) + `TraceRedactor.ts` (module-level regex-pattern array). Research Code Example 1 is the recommended starting set (A1/A2 assumptions).

**Module-level regex constant pattern** (TokenBudget.ts L28-29):
```typescript
/** D-04-10 CJK unicode-range class (single-char test per loop iteration). */
const CJK_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;
```

**Pattern-array + reduce pattern** (TraceRedactor.ts L10-28):
```typescript
const REDACTION_PATTERNS: RegExp[] = [ ... ];
export function redact(s: string): string {
  return REDACTION_PATTERNS.reduce((out, re) => out.replace(re, '[REDACTED]'), s);
}
```

**Classifier shape (research L362-393, discretion D-4b-05):**
```typescript
const INVISIBLE_UNICODE = /[\u200B\u200C\u200D\u2060\uE0000-\uE007F\uFE00-\uFE0F]/g;
export function stripInvisibleUnicode(text: string): string {
  return text.replace(INVISIBLE_UNICODE, '');
}
export type ScreenVerdict = 'safe' | 'quarantine';
const INSTRUCTION_OVERRIDE: RegExp[] = [ ...word-bounded, high-precision patterns... ];
export function classifyInjection(text: string): ScreenVerdict {
  const cleaned = stripInvisibleUnicode(text);
  return INSTRUCTION_OVERRIDE.some((re) => re.test(cleaned)) ? 'quarantine' : 'safe';
}
```
Dependency-free, deterministic, zero model calls. No DOMPurify in the core pipeline (D-4b-05).

---

### `src/core/context/trust/contextFeed.ts` (service, transform — NEW)

**Analog:** `PageContentSerializer.ts` (pure fn + module const) + `TokenBudget.ts` (`estimateTokens` is the ONLY token counter). Research Code Example 2.

**Pure converter + module constant pattern** (PageContentSerializer.ts L12-25):
```typescript
export const TURNDOWN_OPTIONS = { ... } as const;
const turndown = new TurndownService(TURNDOWN_OPTIONS);
/** The ONLY HTML→markdown path — do not hand-roll a second converter. */
export function htmlToMarkdown(html: string): string { return turndown.turndown(html); }
```

**Feed shape (research L398-425):**
```typescript
import type { PageContext } from '@/core/content/PageContext';
import type { ContextItem } from '@/types/harness';
import { estimateTokens } from '../TokenBudget';
export const PAGE_BUDGET_TOKENS = 2_000;   // §22.2/§26.5 webpage budget
export function pageToContextItems(page: PageContext): ContextItem[] {
  // structural cap (first paragraph + first heading, truncated:true) — §22.2,
  // applied HERE at conversion, NEVER inside ContextOptimizer (D-04-13 no-slice gate)
  return [{
    id: `page:${page.url}`, kind: 'context', text, tokens: estimateTokens(text),
    trust: 'retrieved', instructionAuthority: false, relevance: 1,
    freshness: freshnessFrom(page.extractedAt), sensitivity: 'none', sourceId: page.url,
  }];
}
```
**Budget semantics (A3/A7):** `compression:'structural'`/`truncated` recorded in the receipt; top-k `selectRelevant` deferred to Phase 5a.

---

### `src/core/context/contextReceipt.ts` (service, transform — NEW)

**Analog:** `ContextProvenanceManifest.ts` (the manifest it extends; R-1 keeps the TYPE + schema in the manifest module — the BUILDER may co-locate in trust/ or here; Open Q2).

**Builder shape (research Code Example 3):**
```typescript
import type { ContextItem, ContextReceiptEntry, TrustLevel, TrustOmitReason } from '@/types/harness';
import { estimateTokens } from './TokenBudget';
export interface TrustedFeedResult {
  contextText: string;                    // joined included items (wrap applied)
  receipt: ContextReceiptEntry[];         // one row per source item (included + excluded)
  counters: { screened: number; quarantined: number;
              byTrust: Record<TrustLevel, number>; totalIncludedTokens: number };
}
export function buildReceipt(
  items: ContextItem[],            // post-policy, post-gate items (wrapped text present)
  decisions: { excluded: Map<string, { reason: TrustOmitReason }> },
  kindStable: (kind: ContextItem['kind']) => boolean,   // cacheEligible via CACHED_KINDS
): TrustedFeedResult { ... }
```
**Token semantics (A5):** `originalTokens` = `estimateTokens(item.text)` pre-wrap; `finalTokens` = `estimateTokens(wrappedText)` when included, `0` when excluded; `cacheEligible` = target section kind stability (page→context→false). **R-10:** receipt carries ids + counts, NEVER raw text.

---

### `src/core/preferences/trustConfig.ts` (config, request-response — NEW)

**Analog:** `src/core/ai/persona/personaConfig.ts` — near-exact (storage key accessor + Zod-gated read + never-throws fallback).

**Accessor pattern (personaConfig.ts L18-27, L39-63, L66-68 — copy structurally):**
```typescript
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { settingRead } from '@/core/storage/Setting';
/** §15.1 key — registered area:'local' at Setting.ts (D-09). */
export const NP_PERSONA_KEY = 'np_persona';
async function loadPersona(): Promise<PersonaLoad> {
  const stored = await settingRead<unknown>(NP_PERSONA_KEY, (v) => v, undefined);
  if (stored === undefined) return { persona: DEFAULT_PERSONA, loaded: false };
  const parsed = PersonaProfileSchema.safeParse(stored);
  if (!parsed.success) {
    debugLog(ERROR_CODES.PERSONA_LOAD_FAILED, 'np_persona failed ... validation — using DEFAULT_PERSONA', {
      module: 'personaConfig', extra: { issueCount: parsed.error.issues.length },
    });
    return { persona: DEFAULT_PERSONA, loaded: false };
  }
  return { persona: parsed.data, loaded: true };
}
export async function readPersona(): Promise<PersonaProfile> {
  return (await loadPersona()).persona;
}
```
**4b translation:** `NP_TRUST_KEY = 'np_trust'`, `TrustPrefsSchema = z.object({ page, notes, memory, tool_result: z.boolean() })`, `DEFAULT_TRUST_PREFS` all-true, `readTrustPrefs()` with `ERROR_CODES.STORE_READ` fallback — never throws (research L456-489). **Pitfall 4:** the np_trust registry row MUST be added to Setting.ts or every read silently falls back.

---

### `src/core/registry/TrustSettingsStore.ts` (store, CRUD/write-through — NEW)

**Analog:** `src/core/registry/AddonSettingsStore.ts` — near-exact (plain zustand + chrome.storage.local write-through + onChanged sync).

**Store pattern (AddonSettingsStore.ts L9-12, L33, L52-62, L64-107):**
```typescript
import { create } from 'zustand';
import { produce } from 'immer';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

// remove-then-add keeps exactly ONE active listener per chrome instance (T-1-11)
let onChangedListener: OnChangedListener | null = null;

/** Write-through adapter — never throws. */
async function writeStorage(settings: Record<string, Record<string, unknown>>): Promise<void> {
  try {
    await chrome.storage.local.set({ [NP_ADDON_SETTINGS_KEY]: settings });
  } catch (err) {
    debugLog(ERROR_CODES.ADDON_SETTINGS, 'failed to write np_addon_settings', {
      error: err instanceof Error ? err : undefined, module: 'AddonSettingsStore',
    });
  }
}

export const useAddonSettingsStore = create<AddonSettingsState>()((set, get) => ({
  init: async () => {
    // chrome.storage.local.get → set(sanitizeStored(...)); catch → debugLog, never throw
    // then chrome.storage.onChanged remove-then-add listener (area 'local', key match)
  },
  setSetting: (addonId, key, value) => {
    const next = produce(get().settings, (draft) => { ... });
    set({ settings: next });
    void writeStorage(next);   // fire-and-forget
  },
  getSetting: (addonId, key, fallback) => { ... },
}));
```
**4b translation:** state `{ prefs: TrustPrefs }`; `init()` hydrates from `np_trust`; `setSource(kind, on)` → `produce` + `void writeStorage`; sanitize via `TrustPrefsSchema.safeParse` fallback all-true. R-3: runs in Standalone (Options) only — a plain storage write, never background SW.

---

### `src/core/context/ContextOptimizer.ts` (service, transform — MODIFY IN PLACE)

**Analog:** itself — the ladder stage (L183-283), provenance stamping (L291-311), and typed-error throw (L316-323) are the templates.

**Trust stage insertion point** — between input and `buildPackInput` (L135-144):
```typescript
export function optimize(input: ContextOptimizerInput): OptimizedContext {
  const tier: ModelContextTier = classifyModelContext(input.modelContextWindow);
  const { inputBudget, outputBudget } = computeBudgets(input.modelContextWindow);
  const stepsFired: LadderStepName[] = [];
  let minimalMode = tier === 'tiny';

  let sections = packSections(buildPackInput(input, minimalMode));   // ← trust feed must
  // produce contextText BEFORE this call: pageContext → contextFeed → classifier →
  // quarantine → applyTrustPolicy → gates → contextText + receipt (D-4b-04/08/09)
```
`buildPackInput` (L106-117) gains `contextText` (from the trust stage) → `ContextPackInput.contextText` → the existing `'context'` section slot (ContextPack.ts L95-103, `stable:false`).

**Provenance stamping + Zod gate** (L291-323) — the receipt extension lands here:
```typescript
const provenance: ContextProvenanceManifest = { sections: ..., totalTokens, minimalMode,
  workspaceId: input.workspaceId, activeSurface: input.activeSurface, tier, model,
  window: input.modelContextWindow, counterMethod: 'heuristic', stepsFired,
  // + receipt: ContextReceiptEntry[] and counters (CTX-03/06) from the trust stage
};
const parsed = ContextProvenanceManifestSchema.safeParse(provenance);
if (!parsed.success) {
  debugLog(ERROR_CODES.SCHEMA_INVALID, 'context provenance manifest failed Zod validation', {
    module: 'ContextOptimizer', extra: { operationId: input.operationId },
  });
  throw new Error('SCHEMA_INVALID');
}
```
**Determinism contract (L31-32):** zero model calls, zero async, no Date.now/crypto. The trust stage is pure — the hook resolves page + prefs and passes them in (Pitfall 5). **No slice/substring** anywhere in this module (D-04-13) — the §22.2 cap happens in `contextFeed` (Pitfall 6).

---

### In-place config edits (exact one-line/copy precedents)

**`src/core/ai/types.ts`** — additive input seam precedent (L172-181): `contextUpdate?: ContextUpdate` with doc comment; add `trustPrefs?: TrustPrefs` (import type from `@/core/preferences/trustConfig`; additive only, D-04-07 precedent — output shape untouched).

**`src/core/context/ContextProvenanceManifest.ts`** — in-place extension precedent (L38-70 interface, L79-107 schema): add `receipt: ContextReceiptEntry[]` + `counters: { screened; quarantined; byTrust; totalIncludedTokens }` to the interface and the Zod object in lockstep (GR-4). Header L5 already names CTX-03 as the next extension.

**`src/core/storage/Setting.ts`** — registry row precedent (L67):
```typescript
np_persona: { area: 'local' },
// + np_trust: { area: 'local' },   (new registration, NOT a migration — Runtime State Inventory)
```

**`src/core/error/errorCodes.ts`** — canonical addition precedent (L90-96):
```typescript
// --- Context-adaptive execution (Phase 4, ...) ---
CONTEXT_TOO_LARGE: 'CONTEXT_TOO_LARGE',
// + CONTEXT_INSTRUCTION_INJECTION_BLOCKED: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED',
//   (O.3 canonical, Phase 4b — GR-9; spec C.2 mirror note, W-1 gate precedent)
```

**`src/core/i18n/strings.ts`** — block precedent (L103-119 options, L120-123 theme): add under `options: { ... }` → `contentTrust`, `trustHelper`, `trustStructuralNote`, `trustSources.page|notes|memory|tool_result`, `trustSaveFailed` (keys per research L209; dotted paths via i18n/index.ts StringKey).

**`package.json`** — script precedent (L19-24): add `"verify:phase-4b": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run"` (A8 — §24 chain form consistent with the 6 existing scripts; spec's scoped form L3684 is a subset).

**`REQUIREMENTS.md`** — re-map note precedent (D-4b-00): TRUST-01 = CTX-01/02, TRUST-02 = CTX-02 injection defences, TRUST-03 = CTX-03 controls; AI-07-style note (04-CONTEXT D-04-01 precedent).

---

### `src/components/pages/useStreamingLLM.ts` (hook — MODIFY IN PLACE)

**Analog:** itself. Two seams:

**1. Async input resolution — persona pipeline precedent (L150-154):**
```typescript
const prefs = await readPersonaPrefs();
const persona = resolvePersona(DEFAULT_PERSONA, prefs);
const personaBlock = buildPersonaBlock(persona);
```
4b adds (inside `send`, same pattern): `const trustPrefs = await readTrustPrefs();` and reads the page from the store: `const currentPage = useWorkspaceStore((s) => s.workspace.currentPageContext)` (workspace.ts L22; store updates via `PageContentService.deliverContext`, PageContentService.ts L160-167).

**2. optimizerBase — replace the unplugged feed (L174-185):**
```typescript
const optimizerBase = {
  operationId, userInput: trimmed, personaBlock,
  conversationId: 'default', workspaceId, activeSurface,
  selectedToolSchemas: [], memoryHints: [], preferences: prefs,
  pageContext: undefined,          // ← wire: currentPage (guard undefined → no section)
  // + trustPrefs,                  (additive — D-04-07 input-extension precedent)
};
```
Golden Rule 3: the hook only resolves inputs and imports the core builder (`optimize`) — NO prompt assembly (header L3-6).

---

### `src/components/pages/OptionsPage.tsx` (component — MODIFY IN PLACE)

**Analog:** itself — the Appearance card (L43-51) + the persistence-failure toast (L26-33).

**Card + toast pattern:**
```tsx
<Card title="Appearance">
  <Segmented block options={MODE_OPTIONS} value={mode} onChange={(value) => void handleModeChange(value as ThemeMode)} />
  <Typography.Text type="secondary">Display mode</Typography.Text>
</Card>
```
```typescript
const handleModeChange = async (next: ThemeMode): Promise<void> => {
  await useThemeStore.getState().setMode(next);
  if (useThemeStore.getState().mode !== next) {
    notification.error({ message: STR.theme.saveFailed, duration: 0 });  // E5 toast
  }
};
```
**4b translation:** new `<Card title={STR.options.contentTrust}>` after Appearance with 4 `antd Switch` rows (one per source type) bound to `useTrustSettingsStore`, write-through via `setSource(kind, on)`; on failure (store state ≠ requested) → `notification.error({ message: STR.options.trustSaveFailed, duration: 0 })`. UI-SPEC locked: 4 toggles, no icons, no prompt assembly.

---

## Test Patterns (new `tests/core/context/trust/**`, `tests/security/prompt-injection/**`)

### `tests/core/context/trust/TrustTypes.test.ts` — Zod gate + union parity
**Analog:** `tests/core/context/ContextProvenanceManifest.test.ts` (L37-102):
- `safeParse` accepts fixture shapes, rejects unknown kinds/trusts (L55-66 pattern: `parsed.error.issues.some((i) => i.path.join('.') === ...)`)
- CTX-01 invariant: `ContextItemSchema` rejects `instructionAuthority: true` with trust `retrieved`/`untrusted`/`tool`
- CTX-05 seam: type-level disclosure-readiness field presence
- Union-parity: `ContextItem.kind` mirrors `PromptSection['kind']` — copy the D-04-18 block (L79-102) comparing `ContextItemSchema.shape.kind.options` vs the 8-kind set

### `tests/core/context/trust/TrustPolicy.test.ts` — pure-function behavior
**Analog:** `tests/core/context/ContextCompressor.test.ts` (L154, L285 byte-identity + no-slice assertions):
- `AUTHORITY_BY_TRUST` mapping; wrap format `<untrusted_data source="…">` exact string
- system/user items byte-identical (untouched); retrieved/untrusted/tool wrapped + `instructionAuthority:false`
- `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` raised for policy-redefinition attempts (typed carrier check via `isContext…` guard pattern — ContextOptimizer.test.ts L145-158)

### `tests/core/context/trust/contextFeed.test.ts` — converter + gates
**Analog:** `tests/core/context/ContextOptimizer.test.ts` baseInput builder (L52-69) + fixtures convention (`tests/fixtures/pageContent.ts` L31-38 — `FIXED_TIMESTAMP`, `FIXED_URL` fixed constants, no Date.now):
- `pageToContextItems` fills trust/relevance/freshness/sensitivity; `instructionAuthority === false` (CTX-01)
- §22.2 2,000-token structural cap marks `truncated` (deterministic input → pinned expected values)
- source-type gates: `trustPrefs.page: false` → excluded, receipt `included:false, omitReason:'trust_disabled'`

### `tests/core/context/trust/contextReceipt.test.ts` — reconstruction contract (D-4b-11)
**Analog:** `ContextProvenanceManifest.test.ts` + ContextOptimizer sumTokens helper (L72-74):
- receipt rebuilt → context section text recomputed from included entries (wrapped `estimateTokens`) equals packed section — WITHOUT re-running the optimizer
- quarantined row: `included:false, omitReason:'prompt_injection'`; disabled row: `omitReason:'trust_disabled'` (Zod enum `z.enum(['prompt_injection','trust_disabled'])` on `TrustOmitReason` — Open Q3)
- **R-10:** no raw text in receipt/counters

### `tests/core/context/trust/stablePrefix.test.ts` — CTX-04 snapshots
**Analog:** `ContextOptimizer.test.ts` drop-in identity block (L276-326) — hardcoded snapshot + deep-equal:
- `[SYSTEM]` byte-identical across equivalent turns; identical with vs without `pageContext` (extend L307-318: `optimize(baseInput({ pageContext }))` system section `toEqual` the no-page system section)
- system section text NEVER contains `<untrusted_data`; wrap only in the `context` section (`TASK_KINDS` — ProviderRouter.ts L86-91)

### `tests/core/context/trust/qualityCounters.test.ts` — CTX-06
**Analog:** `ContextProvenanceManifest.test.ts` schema-gate pattern: counters shape (`screened/quarantined/byTrust/totalIncludedTokens`) parses the extended manifest schema; assert counters contain no page text (R-10).

### `tests/security/prompt-injection/injectionScreener.test.ts`
**Analog:** `tests/core/security/redactSensitive.test.ts` (L18-45 — fixture-driven regex behavior):
- `stripInvisibleUnicode` removes zero-width/tag-block/variation-selector chars (exact codepoint assertions)
- `classifyInjection` flags known instruction-override shapes; determinism (same input → same verdict)
- **Anti-pitfall (Pitfall 2):** do NOT assert paraphrased/adversarial payloads MUST be quarantined — the authority strip is the boundary, the classifier is a screen

### `tests/security/prompt-injection/quarantine.test.ts`
**Analog:** `tests/isolation/no-content-script-ui.test.ts` (top-level dir precedent, L1-13 header style) + ContextOptimizer.test.ts assertions:
- quarantine-not-drop: flagged item stays a `ContextItem`, never a `PromptSection`; receipt row records it
- malicious fixtures (page/note/tool) cannot alter policy: even a classifier-miss is inert after `applyTrustPolicy` (boundary test)
- `@vitest-environment node` not needed (pure functions; jsdom-align default fine)

### `tests/components/pages/OptionsPage.test.tsx`
**Analog:** `tests/components/pages/ChatPage.test.tsx` + `useStreamingLLM.test.tsx` (fakeBrowser for chrome.storage, research L606): 4 Switch rows render at persisted values; toggle write-through to `np_trust`; rollback + `STR.options.trustSaveFailed` toast on failure; all-true fallback on invalid storage.

### `tests/core/context/ContextOptimizer.test.ts` (extend)
**Analog:** itself — extend `baseInput` (L52-69) with `pageContext`/`trustPrefs` overrides; add:
- page feed produces a `context` section (wrapped, `stable:false`)
- `pageContext: undefined` path byte-identical to pre-4b (drop-in regression L307-318 still passes)
- receipt `included:true` rows whose source text IS in the packed section (Pitfall 3 guard)

---

## Shared Patterns

### GR-9 — every catch calls `debugLog(code, …)` with a canonical code
**Source:** `src/core/error/debugLog.ts` L26-45 (never throws; R-10 redaction automatic). **Apply to:** all new core modules + store + accessor. New code: `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` (errorCodes.ts, O.3 canonical).

### GR-4 — co-located Zod schema + safeParse at every public boundary
**Source:** `harness.ts` L70-117; `ContextOptimizer.ts` L316-323 (SCHEMA_INVALID throw); `personaConfig.ts` L50-61 (fallback, never throws). **Apply to:** harness.ts (ContextItemSchema/ContextReceiptEntrySchema), trustConfig.ts (TrustPrefsSchema), ContextProvenanceManifest.ts (extended schema), contextReceipt.ts (TrustOmitReason enum).

### Determinism — no Date.now / crypto / Math.random in core or fixtures
**Source:** `ContextOptimizer.ts` L31-32; `ContextCompressor.test.ts`/fixtures L26-28 convention. **Apply to:** trust modules + all new tests (fixed inputs → pinned expected values).

### R-10 — redaction on every log/receipt path
**Source:** `debugLog.ts` L29-38 (redact + redactSensitive automatic); `TraceRedactor.ts` L10-28. **Apply to:** receipts/counters never carry raw text (CTX-06); debugLog module+operationId only.

### F-5 — byte-stable `[SYSTEM]` cache + kind→stability mapping
**Source:** `ContextPack.ts` L8-22 (stability flags); `ProviderRouter.ts` L74-91 (CACHED_KINDS/TASK_KINDS — the SINGLE mapping site). **Apply to:** trust wrap confined to the `context` section (`stable:false`, TASK_KINDS); never in CACHED_KINDS; snapshot tests pin it.

### Storage — registry-gated chrome.storage access
**Source:** `Setting.ts` L60-80 (registry), L177-203 (settingRead — unknown keys refused → fallback). **Apply to:** `np_trust: { area: 'local' }` row MUST be registered before trustConfig reads (Pitfall 4); Options store writes via the AddonSettingsStore pattern.

### Token counting — `estimateTokens` is the ONLY counter
**Source:** `TokenBudget.ts` L36-44. **Apply to:** `originalTokens`/`finalTokens`/`totalIncludedTokens` all derive from it — never a hand-rolled second counter (manifest/pack token parity).

### Section-granularity only — no slice/substring/replace of section text
**Source:** `ContextOptimizer.ts` D-04-13 (L27-30); `ContextCompressor.ts` L21-24. **Apply to:** the §22.2 2,000-token page cap is enforced at `contextFeed` conversion, never in ContextOptimizer/ContextPack (Pitfall 6).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/context/trust/injectionScreener.ts` | utility | transform | No existing deterministic classifier module; assemble from TokenBudget (pure regex fn) + TraceRedactor (pattern array) + research Code Example 1 (A1/A2) |

Everything else has an in-place or in-repo analog. The security test dir `tests/security/` is new at top level but follows the `tests/isolation/` precedent (verify chain + header comment style).

## Metadata

**Analog search scope:** `src/types/`, `src/core/context/`, `src/core/ai/`, `src/core/preferences/` (ai/persona), `src/core/registry/`, `src/core/storage/`, `src/core/error/`, `src/core/security/`, `src/core/i18n/`, `src/components/pages/`, `tests/core/context/`, `tests/core/security/`, `tests/components/pages/`, `tests/isolation/`, `tests/fixtures/`, `package.json`, `.planning/PRODUCT_SPEC_v0_1.md` (C.1 L4877-4899, O.3 L6433-6459, §18 L2742-2750)
**Files scanned:** ~30 source + 10 test files + spec sections
**Pattern extraction date:** 2026-08-13
