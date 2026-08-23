# API Coverage — Phase 2 (storage-security-writejournal-workspace-persistence)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

## No external API integration

Phase 2 integrates **no external API**. It is pure extension-internal infrastructure:

- `src/core/http/Requester.ts` (D-35) is a generic UI-context `fetch` wrapper with **no consumer until Phase 3** (`aiProvider`). It wraps the platform `fetch`, not a third-party service; no service is configured, called, or integrated this phase (RESEARCH.md Runtime State Inventory: "Live service config: None — no external services configured this phase").
- The only external touches are **platform built-ins**: `chrome.*` extension APIs (storage, sidePanel, tabs, runtime) and WebCrypto `crypto.subtle` — both are host-platform capabilities, not API integrations with a capability surface to enumerate.
- The `api-coverage` detector's single hit was the security-table phrase **"API keys at rest"** (a crypto-secrets row, RESEARCH.md Security Domain), not an external service. Re-read of the full phase scope confirms no verb/endpoint surface exists.
- Phase 3 wires `Requester` → `aiProvider` → user-configured providers (OpenAI/Anthropic/Gemini/Ollama). That phase is the first true external-API integration and will carry its own coverage matrix.