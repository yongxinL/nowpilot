# NowPilot v0.1 Requirements

## Purpose

This file provides a compact application-level requirement index for planning and agent context. It does not replace the detailed normative requirements, schemas, constants or acceptance criteria in `.planning/PRODUCT_SPEC_v0_1.md`.

## Product Requirements

- **REQ-P01:** Deliver a Chrome Manifest V3 extension using WXT, React and TypeScript.
- **REQ-P02:** Provide a Chat-only Chrome Side Panel for fast, context-adjacent work.
- **REQ-P03:** Provide a Standalone browser-tab workspace for Chat, Agent, Notes, Write, TeamGQM and Options.
- **REQ-P04:** Preserve workspace and conversation continuity across Side Panel and Standalone surfaces.
- **REQ-P05:** Support operator-configured OpenAI, Anthropic, Gemini and Ollama providers without hard-coded model slugs outside the canonical tier mapping.
- **REQ-P06:** Use Ant Design v6 for extension-owned surfaces and Ant Design X presentation components for AI conversation UI.
- **REQ-P07:** Keep host-page content scripts extraction-only in v0.1. Do not inject UI or write to host-page fields.
- **REQ-P08:** Support extensibility through a core/add-on boundary, including ServiceNow, Write, TeamGQM and global add-ons.
- **REQ-P09:** Provide atomic notes, wikilinks, local search, memory, LLM-assisted knowledge enrichment and one-way Markdown backup with restore.
- **REQ-P10:** Provide bounded single-agent execution by default and explicitly activated, bounded multi-role collaboration for selected workflows.

## Runtime and AI Requirements

- **REQ-AI01:** Route every AI turn through ContextOptimizer and Planner → Executor → Renderer.
- **REQ-AI02:** The LLM may request tools, but only ExecutorService validates, authorises and executes them.
- **REQ-AI03:** Enforce context-tier planner and tool caps. Do not use unbounded agent loops.
- **REQ-AI04:** Validate public AI and tool boundaries with canonical Zod schemas.
- **REQ-AI05:** Permit exactly one structured-output repair attempt before returning the canonical failure.
- **REQ-AI06:** Never switch providers after the first streamed token.
- **REQ-AI07:** Preserve prompt-cache stable prefixes and attach context provenance.
- **REQ-AI08:** Inject the selected persona consistently across applicable pipeline stages.
- **REQ-AI09:** Treat page, note, memory, upload and tool output as data without instruction authority.
- **REQ-AI10:** Require completion evidence before claiming that a side effect succeeded.

## Storage, Privacy and Security Requirements

- **REQ-SEC01:** Store session tokens only in `chrome.storage.session`.
- **REQ-SEC02:** Encrypt API keys at rest using the specified AES-GCM flow.
- **REQ-SEC03:** Store conversation bodies in IndexedDB, not `chrome.storage.local`.
- **REQ-SEC04:** Redact secrets, raw prompts, customer content and sensitive tool data before logging, display or export.
- **REQ-SEC05:** Do not use `eval`, remote code execution, `innerHTML`, `dangerouslySetInnerHTML` or `document.write`.
- **REQ-SEC06:** Keep AI, MCP and IndexedDB operations out of the background service worker.
- **REQ-SEC07:** Use canonical RuntimeEnvelope messages and validate senders.
- **REQ-SEC08:** Make write operations idempotent and verify their postconditions.
- **REQ-SEC09:** Prevent untrusted content from altering active prompts, tools, permissions, code or procedural memory.
- **REQ-SEC10:** Preserve user control over provider routing, cloud fallback, tool approval, memory and filesystem access.

## UI and Accessibility Requirements

- **REQ-UX01:** Side Panel must remain usable at approximately 400 px and below 380 px through the specified responsive fallback.
- **REQ-UX02:** Standalone view must support deep-work layouts and show the specified narrow-screen alert below its supported width.
- **REQ-UX03:** Use one XProvider per surface when Ant Design X components are present.
- **REQ-UX04:** Support light, dark and auto display modes plus the canonical theme packs from one synchronised source of truth.
- **REQ-UX05:** Use `App.useApp()` for imperative Ant Design APIs.
- **REQ-UX06:** Provide loading, empty, error and success states using canonical strings.
- **REQ-UX07:** Meet WCAG AA contrast and keyboard/focus requirements specified in §17.6.
- **REQ-UX08:** Provide RICH persona, welcome, intention, clarification, follow-up, progress and result-application patterns according to their phase priorities.
- **REQ-UX09:** Keep v0.1 code insertion clipboard-only and defer host-page write-back.
- **REQ-UX10:** Match the referenced mockups and record visual acceptance evidence in Phase 15.

## Quality and Delivery Requirements

- **REQ-Q01:** Use exact canonical paths, identifiers, types, constants, storage keys, tool names, provider IDs and error codes.
- **REQ-Q02:** Every phase must define and pass `verify:phase-N`.
- **REQ-Q03:** Every public module boundary must have at least one required fixture test.
- **REQ-Q04:** Every catch path must call `debugLog` with a canonical error code.
- **REQ-Q05:** Do not add banned dependencies or weaken tests to obtain a pass.
- **REQ-Q06:** Track phase work through Git, `PLAN.md`, `RESULT.md`, `ACCEPTANCE.md` and `.planning/STATUS.md`.
- **REQ-Q07:** Record the exact verification command and verified Git commit SHA.
- **REQ-Q08:** Treat verification as stale after any code change.
- **REQ-Q09:** Stub or route `@implementation-tier: advanced` modules according to the canonical specification. Do not improvise partial implementations.
- **REQ-Q10:** Release only after all functional, security, privacy, isolation, evaluation and performance gates pass.

## Requirement Maintenance

- Detailed feature requirements remain in the product specification.
- Phase plans must map applicable requirement IDs to tasks and tests.
- Add a new high-level requirement here only when it changes application-level intent.
- Architecture changes require a decision record and, where appropriate, an ADR.
