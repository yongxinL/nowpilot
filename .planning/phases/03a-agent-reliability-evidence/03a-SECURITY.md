---
phase: 03a
slug: agent-reliability-evidence
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-01
---

# Phase 03a — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| AgentTurnInput → contracts | Caller-supplied IDs, callback, tool metadata | Low sensitivity — validated by Zod schemas, closed unions, operation scope |
| Tool input → ExecutorService | Planner-selected name and JSON input | Low sensitivity — closed RegisteredTool registry, deterministic keys, toolCallId |
| ExecutorService → trajectory observer | Consumer callback | Low sensitivity — copy-only snapshots, isolated failures |
| Tool result → OutcomeVerifier | Tool output and verifier callback output | Medium sensitivity — safe schema, bounded checks, exact IDs, timeout, abort normalization |
| Evidence → ReplanPolicy | Verified/unverified status and technical error classification | Low sensitivity — pure function, closed dispositions |
| Planner → orchestrator | Model-selected action/tool/input | Low sensitivity — closed registry, permission before execution |
| Permission callback → executor | User/caller decision and cancellation | Low sensitivity — waiting state, attributable decision |
| Compression provider → optimizer | External model response/error | Low sensitivity — abort distinction, bounded fallback |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03a-01 | Spoofing | Evidence/replay record association | high | mitigate | Required operationId/toolCallId fields; exact-key tests in types + ExecutorService suites | closed |
| T-03a-02 | Tampering | Trajectory history | high | mitigate | Readonly copies, strict ALLOWED_TRANSITIONS, invalid/terminal transition tests | closed |
| T-03a-03 | Repudiation | Turn attribution | medium | mitigate | operationId, toolCallId, timestamps, immutable finalized entries asserted | closed |
| T-03a-04 | Information disclosure | Evidence/diagnostics | high | mitigate | Safe check fields + negative schema fixtures reject unrestricted fields and public keys | closed |
| T-03a-05 | Denial of service | Duplicate execution/replay | high | mitigate | started/unknown suppression, one failed-before-effect recovery tested | closed |
| T-03a-06 | Elevation of privilege | Tool execution | high | mitigate | Closed RegisteredTool list validation, operation-scoped ledger identity | closed |
| T-03a-07 | Spoofing | Evidence attachment | high | mitigate | Exact operation/toolCall/toolName fixtures, discriminated schema validation | closed |
| T-03a-08 | Tampering | Verifier output/policy | medium | mitigate | Safe check schema rejects unrestricted values; policy immutable | closed |
| T-03a-09 | Repudiation | Verification/permission failure | medium | mitigate | Evidence ID, operation/tool-call IDs, timestamps, duration, explicit failure reason tested | closed |
| T-03a-10 | Information disclosure | Verifier output | high | mitigate | Redaction-safe fields, negative fixtures for raw output/key-like strings | closed |
| T-03a-11 | Denial of service | Slow verifier/recovery loops | high | mitigate | Five-second verifier timeout, shared abort, one-replan tests | closed |
| T-03a-12 | Elevation of privilege | Unverified upgrade/retry | high | mitigate | Missing-verifier failure, permission terminal priority, irreversible termination tests | closed |
| T-03a-13 | Spoofing | Result/evidence attribution | high | mitigate | Exact IDs, closed selected-tool adapter, integration mapping tests | closed |
| T-03a-14 | Tampering | Renderer/callback outcome | medium | mitigate | Orchestrator-derived policy, callback isolation, invalid transition tests, readonly outcome assertions | closed |
| T-03a-15 | Repudiation | Permission/abort/state audit | medium | mitigate | operation/tool-call IDs, timestamps, callback origin, trajectory, redacted diagnostics, exit-path tests | closed |
| T-03a-16 | Information disclosure | Recovery/render prompts | high | mitigate | Redacted observation tests, bounded policy summary, no raw output assertions | closed |
| T-03a-17 | Denial of service | Abort/replan/cap loops | high | mitigate | Shared signal checks, one replan, unchanged deadline/counters, cap flag tests | closed |
| T-03a-18 | Elevation of privilege | Denial bypass/write upgrade/replay | high | mitigate | Permission tests, contradiction fallback tests, irreversible/unknown idempotency integration tests | closed |
| T-03a-25 | Spoofing | Compression error vs caller abort | medium | mitigate | AbortError/signal-specific fixtures | closed |
| T-03a-26 | Tampering | Cancellation swallowed | medium | mitigate | Rethrow-on-abort and unchanged non-abort regression tests | closed |
| T-03a-27 | Repudiation | Nested cancellation stage evidence | low | mitigate | Outer optimizer/orchestrator stage and test assertions | closed |
| T-03a-28 | Information disclosure | Raw model error in diagnostics | medium | mitigate | Bounded warning behavior plus no raw output assertions | closed |
| T-03a-29 | Denial of service | Summarization after cancellation | high | mitigate | Signal passed to provider/generateText and abort tests | closed |
| T-03a-30 | Elevation of privilege | Compressed text changes policy | medium | mitigate | Compressor is data transformation only; no tool/permission mutation | closed |
| T-03a-31 | Spoofing | Wrong tool/operation claims evidence | high | mitigate | Exact ID association security fixture (agent-harness) | closed |
| T-03a-32 | Tampering | Mutable snapshots/contradiction | medium | mitigate | Frozen snapshot and fallback fixtures (agent-harness) | closed |
| T-03a-33 | Repudiation | Permission/terminal attribution | medium | mitigate | ID/timestamp/origin/diagnostic fixture (agent-harness) | closed |
| T-03a-34 | Information disclosure | Raw verifier output/secrets/keys | high | mitigate | Negative diagnostic/recovery-observation assertions (agent-harness) | closed |
| T-03a-35 | Denial of service | Unbounded callbacks/timeout/replay/replan | high | mitigate | Cap/timeout/abort/duplicate tests and explicit verify:phase-3a gate (agent-harness) | closed |
| T-03a-36 | Elevation of privilege | Denial bypass/false completion/replay | high | mitigate | Real orchestrator/executor security integration tests (agent-harness) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-01 | 30 | 30 | 0 | gsd-secure-phase (L1 verification, plan-time register) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-01
