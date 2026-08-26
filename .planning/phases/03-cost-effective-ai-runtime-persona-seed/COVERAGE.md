# Phase 3 — External API Coverage Matrix

**Detector:** `api-coverage.cjs --json` over 03-RESEARCH.md + 03-CONTEXT.md → `detected: true`
**Generated:** 2026-08-26 (planning) — coverage decisions locked here; implementers follow the INTEGRATE rows.

## External API Capability Surface

| # | External API | Endpoint (default, §10.6 / D-50) | Capability | Decision | Reason |
|---|--------------|----------------------------------|------------|----------|--------|
| 1 | OpenAI Chat Completions | `https://api.openai.com/v1/chat/completions` | Streaming SSE (`data:` lines, `[DONE]`) + JSON mode (`response_format: {type:'json_object'}`) + Bearer auth | **INTEGRATE** | Primary production provider; StreamAdapter OpenAI wire adapter (03-01) + OpenAIProvider (03-03) |
| 2 | Anthropic Messages | `https://api.anthropic.com/v1/messages` | Streaming events (`event: content_block_delta` / `message_stop`) + structured output (tool-use/forced output — A6) + `x-api-key` + `anthropic-version` headers | **INTEGRATE** | Primary production provider; AnthropicProvider (03-03) + StreamAdapter Anthropic adapter (03-03) |
| 3 | Gemini generateContent | `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent` | Streaming inline data (`candidates[].content.parts[].text`) + JSON mode (`responseMimeType: 'application/json'`) + `key=` param (A2 — prefer header auth where provider allows) | **INTEGRATE** | Primary production provider; GeminiProvider (03-03) + StreamAdapter Gemini adapter (03-03) |
| 4 | Ollama OpenAI-compatible | `http://localhost:11434/v1/chat/completions` | OpenAI wire format (SSE `[DONE]`) + JSON mode (`format: 'json'`); no auth | **INTEGRATE** | Primary production path per §10.6/D-50/A4 |
| 5 | Ollama native | `http://localhost:11434/api/chat` (NDJSON) | Native NDJSON wire shape | **OPT-OUT** | §10.6/D-50 lock the OpenAI-compatible `/v1` as the production path (A4); native NDJSON documented only — conformance fixtures may cover it, no production code path |
| 6 | OpenAICompat (self-hosted: LM Studio / vLLM / proxies) | operator-assigned via `np_endpoint_overrides` (D-50) | OpenAI wire format + JSON mode; endpoint + auth per operator config | **INTEGRATE** | D-56: registered, tier-mapped only when operator assigns fast/balanced in Options |
| 7 | Model discovery | openai/anthropic `GET /models`, gemini `GET /v1beta/models`, ollama `GET /api/tags` | Live model list for Options refresh + TierResolver matching (D-52) | **INTEGRATE** | Reuse `fetchModelsOrError` semantics from `src/services/aiProvider.ts` (D-52); no static catalog |
| 8 | Provider SDKs (openai/anthropic/gemini npm) | — | Chat/streaming via SDK | **OPT-OUT** | INTEGRATIONS.md: client-side fetch, no SDKs; MV3 bundle size; SDKs don't run cleanly in extension UI contexts |
| 9 | Azure OpenAI / other vendor endpoints | — | — | **OPT-OUT** | Not in Phase 3 scope; OpenAICompat covers compatible self-hosted endpoints |

## Auth Surface

| API | Auth mechanism | Notes |
|-----|----------------|-------|
| OpenAI / OpenAICompat | `Authorization: Bearer <key>` | Key from encrypted `np_providers` (Phase 2 EncryptedStorage read) |
| Anthropic | `x-api-key` + `anthropic-version: 2023-06-01` | Matches existing `aiProvider.ts:78-88` pattern |
| Gemini | `key=` query param (INTEGRATIONS.md) | CONCERNS.md flags query-param leakage — prefer header auth where the provider allows; never debugLog URLs containing the key |
| Ollama | none (local) | — |

## OPT-OUT Rationales (every one recorded)

- **#5 Ollama native NDJSON**: production path is the OpenAI-compatible `/v1/chat/completions` per §10.6/D-50 (locked). Native NDJSON stays a documented alternative wire shape (REQ-R09 mentions "Ollama NDJSON") — the StreamAdapter may parse it in fixtures, but no production call site targets `/api/chat`.
- **#8 Provider SDKs**: locked by INTEGRATIONS.md ("client-side fetch, no SDKs") + MV3 bundle-size constraint. All provider I/O goes through `Requester` (Phase 2) + per-provider fetch in `src/core/ai/providers/*`.
- **#9 Azure/etc.**: out of Phase 3 scope; the OpenAICompat provider (D-56) is the extensibility point for OpenAI-wire-compatible endpoints.