---
phase: 03-cost-effective-ai-runtime
plan: 01
subsystem: ai-runtime
tags: [ai-sdk, vercel-ai, zod, packages, types, foundation]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: EncryptedStorage, WriteJournal, providerStore
provides:
  - AI SDK v4 packages installed (ai@4.3.19, @ai-sdk/openai@4.0.11, @ai-sdk/anthropic@4.0.12, @ai-sdk/google@4.0.12)
  - jsonrepair@3.15.0 for one-shot JSON repair
  - src/core/ai/ directory structure with 7 foundational type/config files
  - ProviderConfig, ModelEntry, CostTier, ModelCapabilities types and Zod schemas
  - PlannerDecision Zod schema, ToolExecutionResult interface, OrchestratorEvent discriminated union
  - RouterConfig, FallbackEntry, RetryPolicy interfaces
  - CacheSection Zod enum, CacheHint, CacheKey interfaces
  - ToolDefinition with z.ZodType for input/output schema
  - TimeoutConfig interface + DEFAULT_TIMEOUT_CONFIG
  - AI_CONFIG with tier caps (tiny:1, small:2, medium:3, large:5) and maxFallbackAttempts:3
affects:
  - All subsequent Phase 3 plans (02-09) that implement services, routers, caches, and streaming

# Tech tracking
tech-stack:
  added:
    - ai@4.3.19 (Vercel AI SDK v4 core)
    - @ai-sdk/openai@4.0.11 (OpenAI + OpenAI-compatible provider)
    - @ai-sdk/anthropic@4.0.12 (Anthropic Claude provider)
    - @ai-sdk/google@4.0.12 (Google Gemini provider)
    - jsonrepair@3.15.0 (JSON repair for malformed LLM output)
  patterns:
    - Type + co-located Zod v4 schema: interface for service types, z.object() for runtime validation
    - z.enum() for string literal unions (CostTier, PlannerAction, CacheSection)
    - z.ZodType (not z.Schema) for Zod v4 schema references in ToolDefinition
    - Named exports only — no default exports

key-files:
  created:
    - src/core/ai/providers/providerTypes.ts
    - src/core/ai/pipeline/pipelineTypes.ts
    - src/core/ai/router/routerTypes.ts
    - src/core/ai/cache/cacheTypes.ts
    - src/core/ai/tools/ToolDefinition.ts
    - src/core/ai/streaming/TimeoutConfig.ts
    - src/core/ai/config/aiConfig.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "All 5 AI SDK packages installed at exact pinned versions (no ^) per RESEARCH.md [SUS] audit findings"
  - "--legacy-peer-deps required due to known Zod v4 / AI SDK v4 incompatibility (RESEARCH.md Pitfall 1)"
  - "All 7 type/config files use Zod v4 API patterns: z.record() requires 2 arguments (key + value)"
  - "ToolDefinition uses z.ZodType (not z.Schema) for input/output schema references"

patterns-established:
  - "Type-only modules in src/core/ai/ use named exports, co-located Zod v4 schemas, and direct relative path imports (no barrel files)"
  - "Config constants follow the AS_CONST pattern with readonly objects"

requirements-completed:
  - PROV-01
  - PROV-02
  - PROV-03
  - PROV-04
  - PROV-05
  - PROV-06
  - PROV-07
  - AIRN-01
  - AIRN-02
  - AIRN-03
  - AIRN-04
  - AIRN-05
  - AIRN-06
  - AIRN-07
  - AIRN-08
  - AIRN-09

# Coverage metadata
coverage:
  - id: D1
    description: "AI SDK v4 packages installed at exact pinned versions — ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, jsonrepair"
    verification:
      - kind: unit
        ref: "node -e \"require('ai'); require('@ai-sdk/openai'); require('@ai-sdk/anthropic'); require('@ai-sdk/google'); require('jsonrepair'); console.log('OK')\""
        status: pass
      - kind: unit
        ref: "node -e \"const p=JSON.parse(require('fs').readFileSync('package.json','utf8')).dependencies; ...\""
        status: pass
    human_judgment: false
  - id: D2
    description: "7 type/config files created in src/core/ai/ directory structure matching RESEARCH.md layout"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (full project, 0 errors)"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-07-12
status: complete
---

# Phase 03 Plan 01: AI SDK Packages + Type Definitions

**AI SDK v4 packages installed at pinned versions, 7 foundational type/config files created in src/core/ai/ matching RESEARCH.md layout and Zod v4 conventions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-12T11:40:14Z
- **Completed:** 2026-07-12T11:42:35Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- 5 npm packages installed at exact pinned versions: `ai@4.3.19`, `@ai-sdk/openai@4.0.11`, `@ai-sdk/anthropic@4.0.12`, `@ai-sdk/google@4.0.12`, `jsonrepair@3.15.0`
- `--legacy-peer-deps` used for known Zod v4 / AI SDK v4 incompatibility per RESEARCH.md Pitfall 1
- 7 type/config files created in `src/core/ai/` with the exact type definitions from the plan
- All files use named exports, Zod v4 `z.object()` for runtime validation, `z.enum()` for string unions
- `z.ZodType` (not `z.Schema`) used in ToolDefinition for Zod v4 schema references
- All files compile cleanly with `npx tsc --noEmit` (full project, 0 errors)

## Task Commits

Each task was committed atomically:

1. **Task 2: Install AI SDK v4 and jsonrepair Packages** - `f0ffea8` (feat)
2. **Task 3: Create All Type Definition Files and Config Files** - `49d8627` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

### Modified
- `package.json` - Added 5 pinned dependencies (ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, jsonrepair)
- `package-lock.json` - Updated lock file with 27 new packages

### Created
- `src/core/ai/providers/providerTypes.ts` - ProviderConfig, ModelEntry, CostTier & ModelCapabilities types + modelEntrySchema, providerConfigSchema Zod schemas (64 lines)
- `src/core/ai/pipeline/pipelineTypes.ts` - PlannerAction, PlannerDecision Zod schemas, ToolExecutionResult interface, OrchestratorEvent discriminated union (26 lines)
- `src/core/ai/router/routerTypes.ts` - RouterConfig, FallbackEntry, RetryPolicy interfaces (17 lines)
- `src/core/ai/cache/cacheTypes.ts` - CacheSection Zod enum, CacheHint, CacheKey interfaces (16 lines)
- `src/core/ai/tools/ToolDefinition.ts` - ToolDefinition interface with z.ZodType for input/outputSchema (11 lines)
- `src/core/ai/streaming/TimeoutConfig.ts` - TimeoutConfig interface + DEFAULT_TIMEOUT_CONFIG (11 lines)
- `src/core/ai/config/aiConfig.ts` - AI_CONFIG with tier caps, timeout re-export, maxFallbackAttempts (9 lines)

## Decisions Made

- All packages pinned to exact versions (no `^` range) per RESEARCH.md [SUS] audit mitigation — prevents floating upgrades on recently-published patches
- `--legacy-peer-deps` accepted for AI SDK v4's Zod v3 peer dependency — NowPilot avoids AI SDK Zod-dependent API surface (`tool()`, `generateObject()`) per D-05, so no runtime compatibility issue exists
- Zod v4 `z.record()` requires 2 arguments (keyType, valueType) — single-argument form from Zod v3 is removed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] --legacy-peer-deps for Zod v4 / AI SDK v4 incompatibility**
- **Found during:** Task 2 (npm install)
- **Issue:** `ai@4.3.19` has peer dependency `zod@^3.23.8` but project uses `zod@^4.4.3`. npm ERESOLVE error blocked installation.
- **Fix:** Added `--legacy-peer-deps` flag. This is safe because RESEARCH.md Pitfall 1 documents the incompatibility as known and confined to AI SDK features NowPilot doesn't use (tool(), generateObject()).
- **Files modified:** package.json (installed packages)
- **Verification:** `node -e "require('ai')"` resolves correctly; `npx tsc --noEmit` passes with 0 errors
- **Committed in:** f0ffea8 (Task 2 commit)

**2. [Rule 1 - Bug] Zod v4 z.record() requires 2 arguments**
- **Found during:** Task 3 verification (npx tsc --noEmit)
- **Issue:** `z.record(z.unknown())` fails to compile — Zod v4 removed the single-argument overload; requires explicit key schema.
- **Fix:** Changed to `z.record(z.string(), z.unknown())` — matches the pattern used in WriteJournalEntry.ts (`z.record(z.string(), z.string())`)
- **Files modified:** src/core/ai/pipeline/pipelineTypes.ts
- **Verification:** `npx tsc --noEmit` passes with 0 errors
- **Committed in:** 49d8627 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered

- npm ERESOLVE on AI SDK v4 peer Zod v3 dependency — resolved with `--legacy-peer-deps` per RESEARCH.md guidance
- Zod v4 `z.record()` API change — single-argument form removed, requires explicit key schema

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Foundation packages and types complete — ready for Plans 02-09
- Plan 02 (Provider Adapters) can directly use `providerTypes.ts` types
- Plan 03 (Router) can directly use `routerTypes.ts` interfaces
- Plan 04-06 (Pipeline) can directly use `pipelineTypes.ts`, `ToolDefinition.ts`, and `TimeoutConfig.ts`
- Plan 07 (Cache) can directly use `cacheTypes.ts`
- Plan 08 (Streaming) can directly use `TimeoutConfig.ts`
- Plan 09 (Config) can directly use `aiConfig.ts`

---

*Phase: 03-cost-effective-ai-runtime*
*Completed: 2026-07-12*
