---
status: testing
phase: 03-cost-effective-ai-runtime-persona-seed
source: [03-VERIFICATION.md]
started: 2026-08-28T09:05:00Z
updated: 2026-08-28T09:05:00Z
---

## Current Test

number: 1
name: Live-provider E2E stream on the fixed pipeline
expected: |
  A complete answer streams into the side panel from a real user-configured provider; the assistant message persists as a completed turn in ChatHistoryDB after reload; an abort drops the partial with no persisted turn; a second turn is persona-consistent.
awaiting: user response

## Tests

### 1. Live-provider E2E stream on the fixed pipeline
expected: |
  Load the extension with a real user-configured provider (OpenAI/Anthropic/Gemini/Ollama), set fast+balanced tier models in Options → General, and send a chat message. Confirm the full Planner → Executor → Renderer pipeline streams a real answer end-to-end. The answer persists as a completed turn after reload; an abort drops the partial (nothing persisted); a second turn is persona-consistent (name/tone/brevity from the seeded persona).
  IMPORTANT: the recorded 03-07 human smoke checkpoint (task 4, APPROVED) ran against the PRE-FIX code (142 tests at checkpoint time; 153 after the CR fixes in 1e0f98f..da136a4). The fixes changed the production request path (per-route provider instances, hydrate-seeded model cache, router lock point), so the live smoke must be re-confirmed on the fixed code.
result: pending

### 2. Chat streaming UI behavior
expected: |
  Watch a streamed answer render in the side panel chat bubble (progressive reveal via ChunkBuffer) and trigger the Stop button mid-stream. Text reveals progressively without jank; Stop drops the partial assistant message, clears the generating state, and shows the "Generation stopped" note; no error text is interpolated into the message content.
result: pending

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps