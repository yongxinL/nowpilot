---
status: complete
phase: 03-cost-effective-ai-runtime-persona-seed
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md]
started: 2026-08-28T23:02:33Z
updated: 2026-08-28T23:06:33Z
---

## Current Test

[testing complete]

## Tests

### 1. PlannerService zod-validated decision from real OpenAI SSE wire bytes
expected: PlannerService returns a zod-validated PlannerDecision parsed from real OpenAI SSE wire bytes through StreamAdapter → FixtureProvider → StructuredOutput.requestJson
result: pass
source: automated
coverage_id: 03-01-D1

### 2. StructuredOutput one-shot repair loop per Appendix L
expected: valid passes with no repair, malformed repaired exactly once, double failure terminal with retryable false, abort propagates
result: pass
source: automated
coverage_id: 03-01-D2

### 3. Canonical Appendix A prompts land verbatim in src/core/prompts/index.ts
expected: persona-free, byte-stable; repairJson.system replaced from the non-canonical stub
result: pass
source: automated
coverage_id: 03-01-D3

### 4. Zero-tool runtime schema specialization
expected: empty tool list produces no run_tool variant; non-empty list closes toolName via z.enum
result: pass
source: automated
coverage_id: 03-01-D4

### 5. DEFAULT_PERSONA ships Appendix N.1 verbatim
expected: id nowpilot-default, tagline "Your ServiceNow support co-pilot", personalityCore/behavioralDrivers per spec, tone professional-warm, brevity brief; schema locks §21.6 enums
result: pass
source: automated
coverage_id: 03-02-D1

### 6. PersonaInjector implements the Appendix N.2 contract
expected: resolvePersona data-merges name/tone/brevity with ?? precedence; buildPersonaBlock byte-stable; inject prepends persona block FIRST inside cached [SYSTEM-TEXT] for all four PipelineStage values
result: pass
source: automated
coverage_id: 03-02-D2

### 7. Per-stage persona consistency
expected: inject accepts planner/executor/renderer/memoryExtractor with the same byte-stable persona-first contract (RICH-R-10)
result: pass
source: automated
coverage_id: 03-02-D3

### 8. Minimal UserPreferences shape + np_preferences persistence
expected: schema parses the three fields, rejects empty-string overrides, store persists under np_preferences via chromeStorageAdapter(local) version 1
result: pass
source: automated
coverage_id: 03-02-D4

### 9. StreamAdapter four-wire-family conformance
expected: OpenAI [DONE], Anthropic content_block_delta/text_delta + message_stop + error events, Gemini candidates[].content.parts[].text + finishReason, Ollama OpenAI-compat [DONE] + native done:true NDJSON; missing terminator/empty stream error (REQ-R09); CRLF + multi-byte UTF-8 boundary discipline
result: pass
source: automated
coverage_id: 03-03-D3

### 10. OpenAI-wire family providers (OpenAI/OpenAICompat/Ollama) — live wire conformance
expected: With a configured provider, real stream + JSON-mode requests complete over the live wire; all I/O via Requester; canonical error codes; D-54a guards
result: pass

### 11. Native-wire providers (Anthropic/Gemini) — live wire conformance
expected: Real streaming conformance for Anthropic (x-api-key + anthropic-version headers, A6 JSON mode) and Gemini (responseMimeType application/json, x-goog-api-key header auth, no key in URL)
result: pass

### 12. ChunkBuffer (Appendix J verbatim)
expected: enqueue/onFlush/flushNow/reset with rAF batching and the 8 kB/s → 33 ms upgrade rule; zero chrome.storage access
result: pass
source: automated
coverage_id: 03-04-D1

### 13. PromptCacheAdapter (Appendix K verbatim)
expected: anthropic cache_control ephemeral on ≤4 stable sections (5th → 400); gemini cachedContent split only at stableTokens ≥ 32768; openai/ollama stableFirst sort + prefix-only; FNV-1a 32-bit hash
result: pass
source: automated
coverage_id: 03-04-D2

### 14. ActiveStreamState event→state mapping
expected: workerState.ts carries idle/preparing/streaming/waiting-for-permission/aborting/completed/failed (ActiveSurface import); canonical events map onto it (STREAM_START→preparing/streaming, STREAM_COMPLETE→completed, STREAM_ERROR→failed, STREAM_ABORTED→aborting) when AgentOrchestrator consumes it
result: pass

### 15. PromptCacheManager.buildSystemPrompt — the D-59 single assembly point
expected: persona block prepended FIRST inside cached [SYSTEM-TEXT], byte-stable per persona; §1.3 canonical section order; cache key = profile-version hash over persona block; §19.13 5-consecutive-miss → 60 s disable
result: pass
source: automated
coverage_id: 03-04-D4

### 16. toolSchemas + ExecutorService
expected: ToolDefinition/ToolCapabilityManifest declared with ZERO tools; RegisteredToolNameSchema closed-enum contract (empty → z.never(), never z.enum([])); execute() rejects every run_tool with typed TOOL_REJECTED (§21.6)
result: pass
source: automated
coverage_id: 03-04-D5

### 17. RendererService.render — final answer streaming
expected: streams the final answer (fast tier, D-55) via canonical events into a ChunkBuffer; DEFAULT_MAX_OUTPUT_TOKENS = 512 with override param; verbatim relay; abort surfaces STREAM_ABORTED and stops
result: pass
source: automated
coverage_id: 03-04-D6

### 18. ProviderRegistry hydrate/getEnabled/getById + registerProvider
expected: hydrate() normalizes disk 'claude'→runtime 'anthropic' (disk byte-unchanged), merges np_endpoint_overrides over §10.6 ENDPOINTS (zod-validated http(s)), sync getters, declarative registerProvider, session model cache; both surface boots await hydrate()
result: pass
source: automated
coverage_id: 03-05-D1

### 19. TierResolver capability-tier-only resolution
expected: TIER_TO_MODEL_CANDIDATES ships only fast/balanced capability descriptors (zero vendor slugs); resolveTier returns (providerId, model) only from persisted fastModel/balancedModel validated against discovered cache; null for unpersisted/stale (D-54a); Appendix D privacyMode
result: pass
source: automated
coverage_id: 03-05-D2

### 20. ProviderRouter — §20.10 locked table + §1.5 fallback
expected: retryable/CB votes verbatim; 3 votes/60s → open 5 min, skipped while open; §1.5 fallback (down provider → next enabled; single-provider retry-once; never switch after first token; allowCloudFallbackFromLocal); no model guessing; attempts via debugLog
result: pass
source: automated
coverage_id: 03-05-D3

### 21. AgentOrchestrator bounded loop
expected: Appendix I Planner → Executor → Renderer loop; §1.4 tier caps sole cap-enforcement point; exactly one PlannerService call site (grep == 1); happy path streams renderer's answer
result: pass
source: automated
coverage_id: 03-06-D1

### 22. configuration-required outcome (D-54a)
expected: unresolved stage tier returns typed non-error AgentTurnOutput (reasonCode configuration_required, empty streamedText), starts NO provider request, no persist seam
result: pass
source: automated
coverage_id: 03-06-D2

### 23. Persona consistency across one turn (RICH-R-09)
expected: persona block is string PREFIX of planner/executor/renderer system prompts of one turn; name "NowPilot" in all three; byte-stable per stage (D-59)
result: pass
source: automated
coverage_id: 03-06-D3

### 24. Turn-end persist seam (D-45)
expected: persistTurn invoked exactly once per completed turn with user message + streamedText, never per delta; abort propagates AbortError, drops partial, no seam
result: pass
source: automated
coverage_id: 03-06-D4

### 25. ask_clarification + TOOL_REJECTED surfacing
expected: clarification decision finishes turn with reasonCode ask_clarification and question/options reach renderer; every run_tool with zero tools surfaces typed TOOL_REJECTED while loop continues
result: pass
source: automated
coverage_id: 03-06-D5

### 26. append-chat-turn wired end-to-end
expected: 12th union member in WriteJournalOperation + Schema (additive); createChatTurnSteps factory registered at boot; runJournaled replay-safe persist of completed user/assistant pair into ChatHistoryDB messages store; D-45a boundary respected
result: pass
source: automated
coverage_id: 03-07-D1

### 27. useChatStreaming re-pointed at AgentOrchestrator (D-44)
expected: handleSend routes through runAgentTurn; chunks render via ChunkBuffer with zero per-chunk storage writes; abort mid-stream drops partial with nothing persisted; np_active_stream lifecycle (J.2)
result: pass
source: automated
coverage_id: 03-07-D2

### 28. OptionsPage surfaces — endpoint overrides + tier assignment
expected: D-50 per-provider endpoint overrides persist to np_endpoint_overrides (zod-validated http/https); D-54 fast/balanced assignment writes through to np_preferences; first-setup pre-fill is UI-only until confirmed Save (D-54a)
result: pass
source: automated
coverage_id: 03-07-D3

### 29. Live-provider smoke on the fixed pipeline
expected: Load the extension with a real user-configured provider (OpenAI/Anthropic/Gemini/Ollama), set fast+balanced tier models in Options → General, send a chat message. A real answer streams end-to-end through the fixed Planner → Executor → Renderer pipeline; the completed turn persists in ChatHistoryDB after reload; a second turn is persona-consistent (name/tone/brevity from seeded persona).
  IMPORTANT: the recorded 03-07 human smoke checkpoint (task 4, APPROVED) ran against the PRE-FIX code (142 tests at checkpoint time; 153 after the CR fixes in 1e0f98f..da136a4). The fixes changed the production request path (per-route provider instances, hydrate-seeded model cache, router lock point), so the live smoke must be re-confirmed on the fixed code.
result: pass

## Summary

total: 29
passed: 29
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]