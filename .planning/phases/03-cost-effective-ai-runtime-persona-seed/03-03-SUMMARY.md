---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 03
subsystem: ai-runtime
tags: [sse, stream-adapter, providers, openai, openai-compat, ollama, anthropic, gemini, requester, conformance-fixtures]

# Dependency graph
requires:
  - phase: 03-01
    provides: ILLMProvider interface (stream/requestJson), StreamEvent union (D-47), createStreamAdapter OpenAI wire adapter, D-48 fixture conventions, StreamErrorCode closed set
provides:
  - Five ILLMProvider adapters (OpenAI, OpenAICompat, Ollama, Anthropic, Gemini) — all I/O via Requester.request, no raw fetch, no SDKs, native per-provider JSON-mode flags (Appendix L rule)
  - StreamAdapter extended to all four wire families: OpenAI [DONE], Anthropic event:/text_delta + message_stop, Gemini candidates[].content.parts[].text + finishReason terminator, Ollama OpenAI-compat [DONE] + native done:true NDJSON
  - D-48 conformance fixtures with exact RESEARCH wire bytes (anthropic/gemini/ollama) + 20-test StreamAdapter.test.ts (4 providers × happy/missing-terminator/empty + boundary/error cases)
  - D-54a model guard on both stream and requestJson — no provider request starts without a resolved model
  - Gemini header auth (x-goog-api-key) instead of key= query param (T-3-06 mitigation)
affects: [03-04, 03-05, 03-06, 03-07]

actuals:
  tokens: 16145    # chars/4 over the realized diff (64,580 chars, git diff HEAD~4 HEAD)
  tasks: 3         # tasks completed
  commits: 4       # 3 task commits + 1 Rule-2 fix commit

# Tech tracking
tech-stack:
  added: []        # no new dependencies — fetch-only per INTEGRATIONS.md
  patterns:
    - "OpenAIWireProvider shared base (providers/base.ts): one streaming loop + one error mapper for the three OpenAI-wire adapters"
    - "Wire-format-aware StreamAdapter: createStreamAdapter(operationId, wire) dispatches per-provider line parsing behind one TextDecoder({stream:true}) line buffer"
    - "streamBodyEvents shared byte→event loop — all five providers use the identical read/abort/error path"
    - "D-54a model guard: provider requests never start without a resolved model (stream → STREAM_ERROR PROVIDER_MODEL_UNKNOWN, requestJson → ProviderError)"

key-files:
  created:
    - src/core/ai/providers/base.ts
    - src/core/ai/providers/OpenAIProvider.ts
    - src/core/ai/providers/OpenAICompatProvider.ts
    - src/core/ai/providers/OllamaProvider.ts
    - src/core/ai/providers/AnthropicProvider.ts
    - src/core/ai/providers/GeminiProvider.ts
    - tests/core/ai/StreamAdapter.test.ts
    - tests/core/ai/fixtures/anthropic-stream.ts
    - tests/core/ai/fixtures/gemini-stream.ts
    - tests/core/ai/fixtures/ollama-stream.ts
  modified:
    - src/core/ai/StreamAdapter.ts

key-decisions:
  - "A6 resolved: Anthropic JSON mode uses output_config.format {type:'json_schema'} — the current GA structured-output mechanism (moved from the beta output_format field; verified against platform.claude.com docs at implementation, no beta header needed). The conformance fixture matches this shape."
  - "Gemini auth uses the x-goog-api-key HEADER, not the INTEGRATIONS.md key= query param — CONCERNS.md flags query-param leakage into proxies/logs (T-3-06); the key never appears in a URL, so no URL-bearing-key can reach a log call"
  - "Gemini stream terminator = a chunk whose candidates[0].finishReason is non-empty (the wire has no [DONE] marker); missing finishReason at EOF → STREAM_ERROR (REQ-R09)"
  - "requestJson model gap: the D-47 interface carries no model on requestJson(prompt, jsonSchema, signal), so provider instances hold the tier-resolved model in constructor config (03-05 registry constructs per-resolved-route instances); stream() uses request.model with a D-54a guard"
  - "Shared providers/base.ts added outside the strict 8-file inventory — identical status→code mapping and one byte→event loop across five files would risk inconsistent canonical codes (D-38); a single shared module is the correctness-safe choice"
  - "StreamAdapter wire-format extension committed with Task 2 (not Task 3): Anthropic/Gemini providers cannot stream without the parsers — dependency-driven ordering, end state matches the plan exactly"

patterns-established:
  - "Canonical error mapping in one place (statusToStreamError): 401/403→PROVIDER_AUTH, 404/400-model→PROVIDER_MODEL_UNKNOWN, 429→RATE_LIMITED, 5xx→PROVIDER_5XX, else NETWORK — no invented codes"
  - "T-01-10 error-text discipline: buildErrorMessage uses status + server body only, capped at 300 chars, never a key"
  - "Gemini system→systemInstruction, assistant→model role mapping; Anthropic system→top-level system field"

requirements-completed: [RICH-R-10]

coverage:
  - id: D1
    description: "OpenAI-wire family providers (OpenAI/OpenAICompat/Ollama) — ILLMProvider stream+requestJson, all I/O via Requester, native JSON-mode flags (response_format json_object / format json), canonical error codes, D-54a guards"
    requirement: "RICH-R-10"
    verification:
      - kind: other
        ref: "pnpm run verify:phase-3 (tsc strict-clean, zero NP-STRICT markers, 60 tests green)"
        status: pass
      - kind: other
        ref: "grep: no raw fetch( and no SDK imports in src/core/ai/providers"
        status: pass
    human_judgment: true
    rationale: "Provider request shapes verified by tsc + grep only; live-API wire conformance requires operator keys (deferred to UAT per plan) — 03-05 ProviderRouter tests exercise the wiring"
  - id: D2
    description: "Native-wire providers (Anthropic/Gemini) — x-api-key + anthropic-version headers, A6 output_config json_schema JSON mode recorded in code comment, Gemini responseMimeType application/json, x-goog-api-key header auth (no key in URL)"
    verification:
      - kind: other
        ref: "pnpm run verify:phase-3 (tsc strict-clean, zero NP-STRICT markers, 60 tests green)"
        status: pass
      - kind: other
        ref: "grep: x-api-key/anthropic-version headers present, responseMimeType application/json present, no URL in any debugLog"
        status: pass
    human_judgment: true
    rationale: "A6 mechanism chosen from provider docs (not live-verified without keys); live streaming conformance deferred to UAT"
  - id: D3
    description: "StreamAdapter four-wire-family conformance — OpenAI [DONE], Anthropic content_block_delta/text_delta + message_stop + error events, Gemini candidates[].content.parts[].text + finishReason terminator, Ollama OpenAI-compat [DONE] + native done:true NDJSON; missing terminator and empty streams error (REQ-R09); CRLF + 1-byte multi-byte UTF-8 boundary discipline (T-3-07)"
    verification:
      - kind: unit
        ref: "tests/core/ai/StreamAdapter.test.ts#OpenAI wire happy path → STREAM_COMPLETE"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StreamAdapter.test.ts#Anthropic wire happy/error/ping → STREAM_COMPLETE/STREAM_ERROR"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StreamAdapter.test.ts#Gemini wire happy/multi-part → STREAM_COMPLETE"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StreamAdapter.test.ts#Ollama wire compat + native NDJSON → STREAM_COMPLETE"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StreamAdapter.test.ts#missing terminator + empty stream → STREAM_ERROR for all four providers"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StreamAdapter.test.ts#multi-byte UTF-8 split across 1-byte pushes + CRLF"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-27
status: complete
---

# Phase 3 Plan 3: Provider Adapters + StreamAdapter Wire Conformance Summary

**Five ILLMProvider adapters (OpenAI, OpenAICompat, Ollama, Anthropic, Gemini) streaming real provider wire formats through Requester with native per-provider JSON-mode flags, backed by a four-wire-family StreamAdapter proven by exact-byte D-48 conformance fixtures — completing the REQ-R09 SSE rebuild**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-27T21:06:01Z
- **Completed:** 2026-08-27T21:15:05Z
- **Tasks:** 3
- **Files modified:** 11 (10 created, 1 modified)

## Accomplishments

- **Five ILLMProvider implementations** — OpenAI (Bearer, `response_format` json_object), OpenAICompat (D-56 operator endpoint + auth, no tier default), Ollama (A4 `/v1` OpenAI-compatible, native `format: 'json'`), Anthropic (`x-api-key` + `anthropic-version: 2023-06-01`, A6 `output_config.format` json_schema), Gemini (`streamGenerateContent?alt=sse`, `responseMimeType: 'application/json'`, `x-goog-api-key` header auth). All I/O through `Requester.request` — grep-asserted zero raw `fetch(` and zero SDK imports in `src/core/ai`.
- **StreamAdapter now normalizes all four wire families** into the canonical D-47 event union: OpenAI `[DONE]`, Anthropic `event:`/`content_block_delta` `text_delta` + `message_stop` + `error` events, Gemini `candidates[].content.parts[].text` with the `finishReason` chunk as terminator, Ollama OpenAI-compat `[DONE]` + native `/api/chat` `done:true` NDJSON (fixtures-only). Missing terminator and empty streams → `STREAM_ERROR` (REQ-R09) on every adapter.
- **D-48 conformance fixture library extended** with the exact RESEARCH wire bytes (lines 437-452): `anthropic-stream.ts`, `gemini-stream.ts`, `ollama-stream.ts` + a 20-test `StreamAdapter.test.ts` (4 providers × happy/missing-terminator/empty, plus multi-delta accumulation, Anthropic ping/error tolerance, Gemini multi-part, native NDJSON, CRLF + 1-byte multi-byte UTF-8 boundary discipline per T-3-07). Suite grew 40 → 60 tests, all green.
- **T-3-06 mitigation:** Gemini auth moved off the `key=` query param onto the `x-goog-api-key` header — the key can never appear in a URL, so no key-bearing URL can reach any log call (verified: no URL in any provider debugLog).
- **D-54a enforced at the provider boundary:** both `stream()` (→ `STREAM_ERROR` `PROVIDER_MODEL_UNKNOWN`) and `requestJson()` (→ `ProviderError`) refuse to start a request without a resolved model — the router can never silently emit a model-less body.
- **T-01-10 error discipline:** all error strings built from HTTP status + capped server body only; structured `error.message` preferred; never a key, never a request URL.

## Task Commits

Each task was committed atomically:

1. **Task 1: OpenAI-wire family — OpenAI, OpenAICompat, Ollama providers** - `c1a5b53` (feat)
2. **Task 2: Native-wire family — Anthropic + Gemini providers (+ StreamAdapter wire adapters)** - `15629e3` (feat)
3. **Task 3: StreamAdapter.test.ts + D-48 conformance fixtures** - `63acec3` (test)
4. **Rule 2 fix: D-54a stream guard** - `4dabb64` (fix)

**Plan metadata:** `pending` (committed with this SUMMARY)

## Files Created/Modified

- `src/core/ai/providers/base.ts` - Shared provider plumbing: `ProviderError`, `statusToStreamError`/`buildErrorMessage`/`toStreamErrorCode` (canonical §21.6 mapping, D-38), strict-safe JSON readers, `streamBodyEvents` byte→event loop, and the `OpenAIWireProvider` abstract base (stream/requestJson for all three OpenAI-wire adapters)
- `src/core/ai/providers/OpenAIProvider.ts` - Chat Completions adapter, Bearer auth, `response_format: {type:'json_object'}`, `OPENAI_DEFAULT_BASE_URL` + `openaiProvider` singleton
- `src/core/ai/providers/OpenAICompatProvider.ts` - D-56 self-hosted adapter, operator-assigned endpoint + optional Bearer auth, no tier default
- `src/core/ai/providers/OllamaProvider.ts` - A4 `/v1/chat/completions` production path, `format: 'json'`, no auth, `OLLAMA_DEFAULT_BASE_URL` + singleton
- `src/core/ai/providers/AnthropicProvider.ts` - Messages adapter: `x-api-key` + `anthropic-version: 2023-06-01`, `stream: true`, A6 `output_config.format` json_schema (mechanism recorded in code comment), system→top-level field split
- `src/core/ai/providers/GeminiProvider.ts` - generateContent adapter: `:streamGenerateContent?alt=sse` + `:generateContent`, `x-goog-api-key` header, `responseMimeType: 'application/json'`, system→systemInstruction + assistant→model role mapping
- `src/core/ai/StreamAdapter.ts` (modified) - `WireFormat` param on `createStreamAdapter` + `parseAnthropicStream`/`parseGeminiStream`/`parseOllamaStream`; line buffer now handles `event:` headers (Anthropic) and bare NDJSON lines (Ollama); every wire errors on a missing terminator
- `tests/core/ai/StreamAdapter.test.ts` - 20 tests: 4 providers × (happy/missing-terminator/empty) + ping/error events, multi-part, native NDJSON, CRLF + 1-byte UTF-8 boundary, split-line deltas
- `tests/core/ai/fixtures/anthropic-stream.ts` - Exact RESEARCH wire bytes: `content_block_delta`/`text_delta` + `message_stop` (incl. ping flow, error event, missing-terminator, empty)
- `tests/core/ai/fixtures/gemini-stream.ts` - Exact wire bytes: `candidates[].content.parts[].text` + `finishReason` terminator (incl. multi-part, missing-terminator, empty)
- `tests/core/ai/fixtures/ollama-stream.ts` - OpenAI-compat `[DONE]` + native NDJSON `done:true` (incl. missing-terminator, empty)

## Decisions Made

- **A6 (Anthropic JSON mode) resolved:** `output_config.format: {type:'json_schema', schema}` — the current GA structured-output mechanism per platform.claude.com docs (moved from the beta `output_format` field; no beta header required). Chosen and recorded in a code comment; the fixture matches the implemented shape.
- **Gemini header auth:** `x-goog-api-key` header instead of the documented `key=` query param — CONCERNS.md's query-param leakage flag (T-3-06) makes the header the privacy-safe choice; Gemini accepts it.
- **Gemini terminator semantics:** no `[DONE]` exists on that wire; the `finishReason`-carrying chunk is the terminator, and its absence at EOF is a truncation error (REQ-R09) — never a silent success.
- **requestJson model placement:** the D-47 interface carries no model on `requestJson`, so the provider instance holds the tier-resolved model in constructor config; `stream()` takes `request.model`. Both paths D-54a-guard against a missing model.
- **Shared base module:** `providers/base.ts` is one file outside the plan's strict 8-file inventory — identical status→code mapping and one byte→event loop across five files would risk inconsistent canonical codes; the shared module is the correctness-safe choice (documented as an inventory deviation below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] D-54a stream guard on all five providers**
- **Found during:** Task 2 (post-commit review against the plan's prohibition "No provider request starts without a resolved model")
- **Issue:** `requestJson` carried the D-54a guard but `stream()` would emit a model-less request body when neither `request.model` nor the instance model was resolved (JSON.stringify drops `undefined` → the provider 400s).
- **Fix:** `stream()` now yields `STREAM_ERROR` with canonical `PROVIDER_MODEL_UNKNOWN` before any network work when no model is resolved; same guard added to Anthropic and Gemini.
- **Files modified:** src/core/ai/providers/base.ts, AnthropicProvider.ts, GeminiProvider.ts
- **Verification:** `pnpm run verify:phase-3` green (tsc + 60 tests)
- **Committed in:** 4dabb64 (Rule 2 fix commit)

**2. [Rule 3 - Blocking / dependency-driven ordering] StreamAdapter wire-format extension landed in Task 2's commit**
- **Found during:** Task 2 (Anthropic/Gemini provider implementation)
- **Issue:** The providers cannot stream without the Anthropic/Gemini wire parsers, which the plan attributes to Task 3 — committing Task 2 without them would ship non-functional providers.
- **Fix:** The `WireFormat` param + `parseAnthropicStream`/`parseGeminiStream`/`parseOllamaStream` landed in Task 2's commit; Task 3's commit carries the fixtures + `StreamAdapter.test.ts` (its remaining planned scope). End state matches the plan's file inventory exactly.
- **Files modified:** src/core/ai/StreamAdapter.ts (Task 2 commit)
- **Verification:** `pnpm run verify:phase-3` green after every commit
- **Committed in:** 15629e3 (Task 2 commit)

**3. [Inventory note - not a code deviation] `providers/base.ts` shared module added**
- **Found during:** Task 1 (provider implementation)
- **Issue:** The plan's file inventory names only the five provider files + StreamAdapter + tests; identical status→code mapping, error-text building, and the byte→event loop would otherwise be duplicated across five files (D-38 consistency risk).
- **Fix:** One internal shared module (`base.ts`) in the same directory holding the canonical error mapper, T-01-10 error-text builder, strict-safe JSON readers, `streamBodyEvents`, and the `OpenAIWireProvider` base class. No exports escape `src/core/ai`.
- **Files modified:** src/core/ai/providers/base.ts
- **Verification:** tsc clean; grep guards pass; 60 tests green
- **Committed in:** c1a5b53 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking-ordering), 1 inventory note
**Impact on plan:** All auto-fixes were required for correctness (D-54a guard) or functional ordering (wire adapters before providers). No scope creep — the deliverable set matches the plan exactly, plus one internal shared module.

## Issues Encountered

- None — all three tasks and their acceptance criteria passed on the first verification run; no auth gates, no package-install issues (no new dependencies).

## User Setup Required

None - no external service configuration required. Live provider smoke tests (real keys) are deferred to UAT per plan; the conformance fixtures are the deterministic Phase-3 test path.

## Next Phase Readiness

- **Ready for 03-05 (ProviderRegistry/TierResolver/ProviderRouter):** all five provider adapters are registered via singletons/instances, expose `providerId`, and consume a constructor config `{baseUrl, apiKey, model, timeoutMs}` — the registry's D-49/D-50 hydrate merges `np_endpoint_overrides` and constructs per-route instances; `streamBodyEvents` + the conformance fixtures seed the ProviderRouter failure/fallback/abort test matrix (D-48).
- **Ready for 03-04 (Executor/Renderer + PromptCache):** the planner's `callProviderJsonMode` wires to `provider.requestJson`; `A6` output_config json_schema shape is confirmed and recorded.
- **Watch items:** Gemini wire shape (A2) remains flagged ASSUMED — `ai.google.dev` was unreachable at research; the finishReason-terminator choice must be re-verified against the live API during UAT. Anthropic `output_config` (A6) verified against provider docs at implementation — re-confirm at UAT if the operator uses a beta-era key.

---

*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-27*
## Self-Check: PASSED

- All 12 files exist on disk (10 created + StreamAdapter.ts modified + SUMMARY.md)
- All 5 commits found in git log: c1a5b53 (Task 1), 15629e3 (Task 2), 63acec3 (Task 3), 4dabb64 (Rule 2 fix), 185d5f1 (docs)
- `pnpm run verify:phase-3` green after every commit (tsc strict-clean + 60 tests across 7 files)
- Zero strict-suppression markers in src/core/ai (NP-STRICT ceiling 0)
- Grep guards pass: no raw `fetch(` in providers, no SDK imports in src/core/ai, no URL in any provider debugLog
