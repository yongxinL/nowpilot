# NowPilot Product Specification

**Status:** implementation baseline  
**Product:** NowPilot v0.1  
**Primary platform:** Chrome Manifest V3 extension  
**Framework:** WXT, React, TypeScript, Ant Design, Ant Design X presentation components

## 1. Product outcome

NowPilot is a privacy-first Chrome extension for support engineers. It provides context-aware AI chat, a full-page workspace, local notes and memory, governed tools, and a ServiceNow integration without modifying host-page UI in v0.1.

## 2. v0.1 surfaces

### Side Panel

The Side Panel is **Chat-only**. It contains:

- streaming chat and abort;
- model selector;
- page context and pinned context;
- attachments and screenshot input where supported;
- conversation history;
- quick save to note;
- Options and Switch to Full Chat actions.

It must not contain Agent, Notes, Write, Tools, TeamGQM, provider management, diagnostics, or other administration screens.

### Standalone view

The Standalone view is served from `standalone.html` and contains:

- Chat;
- Agent;
- Notes;
- Write;
- Tools;
- optional TeamGQM add-on;
- Options and Diagnostics.

Canonical paths use the `standalone` stem:

- `src/entrypoints/standalone/`
- `src/components/standalone/`
- `StandaloneShell`
- `StandaloneRouter`
- `StandalonePageRegistry`

The `app` stem must not be introduced.

## 3. v0.1 scope

### Required

1. MV3/WXT runtime and two UI surfaces.
2. Shared workspace handoff and single-writer coordination.
3. Storage, encryption, migrations, and write journal.
4. Provider-neutral Planner, Executor, Renderer pipeline.
5. Context optimisation and bounded execution.
6. Read-only page extraction.
7. Trust-aware context and prompt-injection isolation.
8. Notes, wikilinks, memory, and local search.
9. LLM-assisted note enrichment and optional one-way filesystem backup.
10. Diagnostics, redaction, and release verification.
11. ServiceNow extraction and API integration inside extension-owned surfaces.

### Deferred

- host-page UI injection;
- host-page write-back;
- browser automation;
- autonomous self-modification;
- open-ended multi-agent systems;
- bidirectional filesystem sync;
- embedding downloads or remote vector databases;
- A2UI-generated component trees.

Multimodal input, continual evolution, and bounded multi-role collaboration require separate post-MVP approval.

## 4. Non-negotiable invariants

### Runtime boundaries

- Provider and MCP streaming run only in Side Panel or Standalone contexts.
- The background service worker handles routing, alarms, permissions, cookies, and bounded proxy fetches.
- Content scripts are extraction-only and render no UI.
- Cross-context messages use the canonical runtime envelope.

### AI execution

- UI code never calls providers directly.
- All calls pass through ContextOptimizer and PersonaInjector.
- The model may request a tool, but only ExecutorService validates and executes it.
- Structured output uses Zod and exactly one repair attempt.
- Planner and tool-call limits are enforced centrally.
- Side effects are never reported as complete without verification evidence.

### Storage and privacy

- Session tokens use session storage.
- API keys are encrypted at rest.
- Message bodies and large content use IndexedDB.
- Raw prompts, tool bodies, cookies, clipboard content, and customer data are not logged by default.
- Every diagnostic sink uses redaction.
- Password values are never extracted.

### Code organisation

- Core never imports add-ons.
- ServiceNow selectors and token names remain inside the ServiceNow add-on.
- No invented paths, identifiers, error codes, prompts, or provider model slugs.
- Advanced modules are stubbed unless the current phase explicitly authorises implementation.

## 5. Canonical extraction policy

1. If a registered ServiceNow strategy applies, try the ServiceNow API first.
2. For default reading mode, use Defuddle in an extension-owned surface with its internal Readability fallback.
3. For actionable structural mode, use APC-lite.
4. Defuddle, React, Ant Design, YAML, and filesystem APIs must not enter the content-script bundle.
5. Extraction is on demand. Navigation marks cached content stale and re-extracts only for subscribed or pinned tabs.

## 6. Delivery slices

### MVP foundation

- Phase 1: runtime, shells, workspace.
- Phase 2: storage and security.
- Phase 3: AI runtime.
- Phase 4: completion evidence.
- Phase 5: context optimisation.
- Phase 6: page extraction.
- Phase 7: trust-aware context.
- Phase 8: notes, memory, local search.
- Phase 9: LLM-Wiki and filesystem backup.
- Phase 10: diagnostics and evaluation baseline.
- Phase 11: workspace user experience.
- Phase 12: add-ons, hardening, and release.

Each phase requires its own approved design and executable plan. The phase is complete only when its automated gate passes and required manual evidence is recorded.

## 7. Global acceptance criteria

- TypeScript strict compilation passes.
- Unit, integration, isolation, security, and performance suites pass.
- Content-script bundle contains no prohibited dependencies and stays within its approved budget.
- No unresolved critical or high-severity review finding exists.
- Release artefacts are reproducible from the tagged commit.
- Unpacked and packaged builds pass the smoke-test checklist.
- Rollback instructions and previous release artefact are available.
