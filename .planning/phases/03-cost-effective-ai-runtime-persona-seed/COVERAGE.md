# Phase 3 — External API Coverage Matrix

**Detector:** `api-coverage.cjs --json` over 03-RESEARCH.md + 03-CONTEXT.md → `detected: true`
**Generated:** 2026-08-26 (planning) — coverage decisions locked here; implementers follow the INTEGRATE rows.

## External API Coverage Matrix

| capability | decision | reason |
|---|---|---|
| OpenAI Chat Completions | INTEGRATE | Endpoint https://api.openai.com/v1/chat/completions — SSE + JSON mode + Bearer auth. Primary production provider; StreamAdapter OpenAI wire adapter (03-01) + OpenAIProvider (03-03) |
| Anthropic Messages | INTEGRATE | Endpoint https://api.anthropic.com/v1/messages — streaming events + structured output + x-api-key + anthropic-version. Primary provider; AnthropicProvider (03-03) |
| Gemini generateContent | INTEGRATE | Endpoint generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent — streaming inline data + JSON mode + key= param (A2). Primary provider; GeminiProvider (03-03) |
| Ollama OpenAI-compatible | INTEGRATE | Endpoint http://localhost:11434/v1/chat/completions — OpenAI wire format (SSE [DONE]) + JSON mode; no auth. Primary production path per §10.6/D-50/A4 |
| Ollama native NDJSON | OPT-OUT | Endpoint http://localhost:11434/api/chat (NDJSON). §10.6/D-50 lock the OpenAI-compatible /v1 as the production path (A4); native NDJSON documented only — no production code path |
| OpenAICompat self-hosted | INTEGRATE | LM Studio / vLLM / proxies; operator-assigned endpoint + auth via np_endpoint_overrides (D-50). D-56: registered, tier-mapped only when operator assigns fast/balanced in Options |
| Model discovery | INTEGRATE | openai/anthropic GET /models, gemini GET /v1beta/models, ollama GET /api/tags. Live model list for Options refresh + TierResolver matching (D-52); reuse fetchModelsOrError; no static catalog |
| Provider SDKs | OPT-OUT | openai/anthropic/gemini npm chat/streaming SDKs. INTEGRATIONS.md: client-side fetch, no SDKs; MV3 bundle size; SDKs don't run cleanly in extension UI contexts |
| Azure OpenAI / other vendor endpoints | OPT-OUT | Not in Phase 3 scope; OpenAICompat covers compatible self-hosted endpoints |

## Auth Surface

| API | Auth mechanism | Notes |
|-----|----------------|-------|
| OpenAI / OpenAICompat | `Authorization: Bearer <key>` | Key from encrypted `np_providers` (Phase 2 EncryptedStorage read) |
| Anthropic | `x-api-key` + `anthropic-version: 2023-06-01` | Matches existing `aiProvider.ts:78-88` pattern |
| Gemini | `key=` query param (INTEGRATIONS.md) | CONCERNS.md flags query-param leakage — prefer header auth where the provider allows; never debugLog URLs containing the key |
| Ollama | none (local) | — |

## OPT-OUT Rationales (every one recorded)

- **Ollama native NDJSON**: production path is the OpenAI-compatible `/v1/chat/completions` per §10.6/D-50 (locked). Native NDJSON stays a documented alternative wire shape (REQ-R09 mentions "Ollama NDJSON") — the StreamAdapter may parse it in fixtures, but no production call site targets `/api/chat`.
- **Provider SDKs**: locked by INTEGRATIONS.md ("client-side fetch, no SDKs") + MV3 bundle-size constraint. All provider I/O goes through `Requester` (Phase 2) + per-provider fetch in `src/core/ai/providers/*`.
- **Azure/etc.**: out of Phase 3 scope; the OpenAICompat provider (D-56) is the extensibility point for OpenAI-wire-compatible endpoints.