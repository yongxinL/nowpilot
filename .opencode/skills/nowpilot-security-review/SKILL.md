---
name: nowpilot-security-review
description: Review NowPilot for Chrome extension trust boundaries, permissions, secret handling, redaction, prompt injection, storage, provider/MCP isolation, and verified side effects.
license: Proprietary
compatibility: opencode
metadata:
  project: nowpilot
  category: security
---
# NowPilot Security Review

Review:
- Manifest and host permissions are minimal and approved.
- Runtime sender, source, target, type, payload, correlation, epoch, and version checks fail closed.
- Page, note, memory, upload, tool, provider, and MCP output is untrusted data without instruction authority.
- Tokens use session storage; API keys use approved encrypted storage; large bodies do not use Chrome local/sync.
- Redaction precedes logging, diagnostics, persistence, display, and export.
- No raw prompt, secret, cookie, clipboard, customer content, password value, local sensitive path, or raw tool payload is logged.
- Side effects use policy, confirmation where required, idempotency, and postcondition evidence.
- Background, content, UI, provider, MCP, filesystem, and storage responsibilities remain isolated.
- Imported Google AI Studio code contains no backend secret, provider call, server dependency, or unsafe rendering path.

Return assets/trust boundaries, exploit or failure scenario, exact mitigation, missing tests, and `PASS` or `BLOCKED`.
