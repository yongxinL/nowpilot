---
name: nowpilot-security-review
description: Review NowPilot changes for secret handling, storage safety, prompt injection, permissions, redaction, side effects, message security, and extension-context isolation.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: security
---

# NowPilot Security Review

## Review areas

### Secrets and storage

- Session tokens must use session storage.
- API keys must be encrypted at rest.
- Message bodies must not use Chrome local storage.
- Raw sensitive content must not be persisted in traces.

### Logging and diagnostics

- Redaction must run before persistence, console output, UI display, or export.
- No raw prompt, tool body, cookie, clipboard text, customer content, or filesystem path may be logged.

### Context trust

- Retrieved page, note, memory, upload, and tool content has no instruction authority.
- Untrusted data must not modify system policy, tool policy, permissions, prompts, or code.

### Tools and side effects

- Tool input and output must be schema validated.
- Side effects must use permission policy.
- Side effects must have idempotency protection.
- Completion claims require postcondition evidence.

### Extension isolation

- Validate message sender and message type.
- Content scripts must remain read-only.
- Password values must never be extracted.
- Manifest permissions must remain least-privilege.
- Background service workers must not own persistent AI operations.

## Output

Return:

- assets and trust boundaries reviewed
- findings by severity
- exploit or failure scenario
- exact mitigation
- missing tests
- final result: PASS or BLOCKED
