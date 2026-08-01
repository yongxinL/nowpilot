# Deferred Items — Phase 05 Knowledge Base

Out-of-scope discoveries logged per executor scope boundary. These are
pre-existing issues NOT caused by 05-01/05-02 changes — do not fix in-phase
unless a later plan explicitly covers them.

## Pre-existing AI provider test failures (verified untouched by 05-02 commits)

- **Found:** 2026-08-02, during Plan 05-02 full-suite verification
- **Files:** `tests/core/ai/StreamAdapter.test.ts`, `tests/core/ai/providers/ProviderAdapter.test.ts`
- **Failures:** 6 tests fail with `TypeError: capturedOnChunk is not a function` /
  `capturedOnFinish is not a function` (StreamAdapter: 2; ProviderAdapter contract:
  OpenAI/Anthropic/Gemini/Ollama `createLanguageModel` — 4)
- **Evidence of pre-existing:** `git diff HEAD~5..HEAD -- src/core/ai tests/core/ai` is
  empty — none of the 6 Plan 05-02 commits touch AI paths; failing tests import only
  AI provider/stream modules.
- **Suspected root cause (not investigated):** harness/ai-sdk version interaction in the
  adapter contract tests (`capturedOnChunk` variable not populated by `vi.waitFor`).
- **Status:** open — revisit in a Phase 6 (telemetry/diagnostics) or Phase 8 plan, or
  via gsd-audit-fix.
