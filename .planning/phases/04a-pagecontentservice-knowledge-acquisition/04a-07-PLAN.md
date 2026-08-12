---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 07
type: execute
wave: 4
depends_on: ["04a-03", "04a-06"]
files_modified:
  - src/core/runtime/MessageType.ts
  - src/core/content/PageContextBridge.ts
  - src/core/content/ContentScriptHost.ts
  - src/entrypoints/core.content.ts
  - tests/core/content/ContentScriptHost.test.ts
autonomous: true
requirements: [CAT-01, CAT-02, CAT-04]
must_haves:
  truths:
    - "`src/core/runtime/MessageType.ts` gains ONE canonical addition (Pitfall 5 — no throwaway contracts): `PAGE_CONTENT_EXTRACTED: 'PAGE_CONTENT_EXTRACTED'` (the extraction reply) — extending the D-17 additions block in place (L25-30 precedent); EXTRACT_PAGE_CONTENT (request) already exists (L11) and is reused."
    - "`src/core/content/PageContextBridge.ts` (EXTENDED) gains the extraction request/reply contract: `requestExtraction(tabId, mode, {timeoutMs?}): Promise<ExtractionPayload>` publishing an EXTRACT_PAGE_CONTENT envelope with `{tabId, mode}` and resolving on the matching PAGE_CONTENT_EXTRACTED reply — following the getCapabilities bounded-wait pattern (L53-72: always-cleared timer, resolves typed on timeout); `ExtractionPayload = { html: string; baseUrl: string; truncated: boolean }` (D-4a-08 sibling-field shape — the payload carries the baseUrl, the PANEL injects the `<base>` into its DOMParser doc); the reply is a ResponseEnvelope (never a mutated request) with `{id, ok, data}` and is payload-validated before resolve (sanitizeCapabilities L105-113 precedent)."
    - "`src/core/content/ContentScriptHost.ts` (EXTENDED, D-4a-07/08/09) gains `serializeForExtraction(): ExtractionPayload` — clones `document.documentElement`, removes script/style/noscript/svg markup + cross-origin iframes (origin check in try/catch — cross-origin access throws, treat as cross-origin) + form-action attributes, stamps `baseUrl: document.baseURI`, serializes the cleaned tree to ONE HTML string, and truncates at an element boundary when the string exceeds the exported `PAGE_HTML_MAX_BYTES = 2_097_152` (~2 MB, D-4a-09) setting `truncated: true` (§22.2) — no chunk/assembly protocol in v0.1."
    - "ContentScriptHost's EXTRACT_PAGE_CONTENT handler (L68-83) now: keeps the live-context upsert, runs serializeForExtraction for `mode: 'default'` (the tiny bundle stays serialization-only), runs AxDomWalker for `mode: 'actionable'` (D-4a-12), and replies via the bridge with a PAGE_CONTENT_EXTRACTED ResponseEnvelope carrying `{html, baseUrl, truncated}` OR the walked RawNode tree — the payload shape is discriminated by mode."
    - "ContentScriptHost wires SPANavigationWatcher (D-4a-01): on wxt:locationchange it rebuilds the live context + upserts the registry + publishes the lightweight live-context update (mark-stale signal); full re-extraction happens only when a surface requests it (subscribed-only, D-4a-01 hybrid trigger)."
    - "`src/entrypoints/core.content.ts` passes the wxt `ctx` into the host wiring so the watcher uses ctx.addEventListener (auto-clean on invalidation — RESEARCH Common Op 5); the entrypoint stays ISOLATED / document_idle / <all_urls> (CAT-04)."
    - "`tests/core/content/ContentScriptHost.test.ts` (EXTENDED) proves: EXTRACT_PAGE_CONTENT (default mode) → serialized HTML reply (contains the page markup, baseUrl stamped, truncated flag false on a small doc); actionable mode → RawNode reply; a password input inside the serialized HTML is present in the MARKUP (strip-only — the VALUE omission is enforced by AxDomWalker/walker path, not by stripping) but the actionable walk reply has no password value (D-4a-20); PAGE_HTML_MAX_BYTES truncation sets truncated:true at an element boundary."
  artifacts:
    - "src/core/runtime/MessageType.ts"
    - "src/core/content/PageContextBridge.ts"
    - "src/core/content/ContentScriptHost.ts"
    - "src/entrypoints/core.content.ts"
    - "tests/core/content/ContentScriptHost.test.ts"
  key_links:
    - "The bridge request/reply is the transport seam PageContentService (04a-08) consumes — the ExtractionPayload shape {html, baseUrl, truncated} is the interface contract both sides compile against (interface-first ordering)."
    - "serializeForExtraction's PAGE_HTML_MAX_BYTES + truncated flag feed the D-4a-09 provenance (§22.2 semantics) — the service records truncated into StrategyResult/APCLiteDocument stats (D-4a-21)."
    - "The watcher wiring (D-4a-01) is the SPA-nav invalidation trigger — the panel cache invalidation is driven by this signal (04a-08 service subscribes to the bridge)."
  flagged_assumptions:
    - "Open Q2 [research, resolved by planner]: the base-URL stamp shape is the SIBLING `baseUrl` field in ExtractionPayload (keeps the content bundle pure string manipulation; the panel owns DOM injection — RESEARCH recommendation)."
    - "D-4a-09 [discretion]: PAGE_HTML_MAX_BYTES = 2_097_152 (~2 MB) exported + pinned; truncation at element boundary (walk back to the last safe closing tag before the cap — implementation detail at executor discretion, must not split a tag)."
    - "CAT-02 [unresolved — spec-less probe, unclassified]: the bridge roundtrip is covered by the extended ContentScriptHost.test.ts (fakeBrowser + flushRuntime pattern, L27-30 precedent); the background forward of tabs.onUpdated is R-3 forward-only and wired at the service layer (04a-08) — NOT a new background file (create-list is fixed)."
    - "Pitfall 5 discipline: PAGE_CONTENT_EXTRACTED is the ONLY MessageType addition; the reply reuses EXTRACT_PAGE_CONTENT's request envelope + id correlation — no throwaway contract."
  prohibitions:
    - "No new content-side import of defuddle/turndown/minisearch/zod runtime (Appendix G, R-3) — the host serializes + walks with type-only imports only."
    - "No chunk/assembly protocol (D-4a-09 — truncate is the v0.1 degradation; chunking deferred until real pages hit the cap)."
    - "No form-action REMOVAL that breaks Defuddle — the strip removes the action ATTRIBUTE only, keeping inputs (incl. outside forms) so both Defuddle and APC-lite have what they need (D-4a-07)."
    - "No password value ever in the actionable walk reply (D-4a-20 — AxDomWalker omission; the test pins it)."
    - "No bare window.addEventListener for the watcher (ctx.addEventListener only)."
---

<!-- 04a-07 (2026-08-12): Wave-4 content-side transport. MessageType gains the single
     canonical PAGE_CONTENT_EXTRACTED reply (Pitfall 5); PageContextBridge gains the
     requestExtraction bounded-wait roundtrip (getCapabilities precedent); ContentScriptHost
     gains serializeForExtraction (D-4a-07/08/09 — clone/strip/stamp/truncate) + watcher
     wiring (D-4a-01) + the discriminated default/actionable reply. The ExtractionPayload
     {html, baseUrl, truncated} is the interface contract the service (04a-08) compiles against. -->

<objective>
Extend the content-side transport: add the canonical `PAGE_CONTENT_EXTRACTED` MessageType (Pitfall 5), give `PageContextBridge` the bounded-wait extraction request/reply roundtrip (`requestExtraction(tabId, mode)` → `{html, baseUrl, truncated}`), and give `ContentScriptHost` the pre-stripped clone serialization (D-4a-07/08/09), the watcher wiring (D-4a-01), and the mode-discriminated reply (default → HTML, actionable → walked RawNode). Wire `core.content.ts` to pass the wxt ctx.

Purpose: CAT-01/CAT-02's delivery path — the content script serializes one HTML string (never parses — R-5, §26.4) and the panel owns DOMParser + extraction. This plan is the bridge contract the service plan compiles against.

Output: extended MessageType/bridge/host/entrypoint + extended ContentScriptHost test.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md
@src/core/content/PageContextBridge.ts
@src/core/content/ContentScriptHost.ts
@src/core/content/SPANavigationWatcher.ts
@src/core/content/AxDomWalker.ts
@src/core/runtime/MessageType.ts
@src/entrypoints/core.content.ts
@tests/core/content/ContentScriptHost.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: MessageType addition + PageContextBridge request/reply contract (Pitfall 5)</name>
  <files>src/core/runtime/MessageType.ts, src/core/content/PageContextBridge.ts</files>
  <read_first>
    - src/core/runtime/MessageType.ts (L25-30 D-17 additions block — the in-place extension precedent; EXTRACT_PAGE_CONTENT at L11)
    - src/core/content/PageContextBridge.ts (getCapabilities L53-72 bounded-wait + sanitizeCapabilities L105-113 validation + replyPong L75-83 ResponseEnvelope shape)
  </read_first>
  <behavior>
    - Test 1 (fakeBrowser, flushRuntime): requestExtraction(tabId, 'default') publishes EXTRACT_PAGE_CONTENT with {tabId, mode}; the matching PAGE_CONTENT_EXTRACTED ResponseEnvelope reply resolves to the ExtractionPayload {html, baseUrl, truncated}.
    - Test 2: requestExtraction timeout (injected short timeout) resolves with a typed failure (CONTENT_EXTRACT_FAILED carrier) — never an unhandled rejection (getCapabilities precedent resolves default on timeout; here it rejects typed per D-4a-03/19).
    - Test 3: an id-mismatched PAGE_CONTENT_EXTRACTED reply is ignored (correlation by opId — L57-58 precedent).
  </behavior>
  <action>
    Add `PAGE_CONTENT_EXTRACTED: 'PAGE_CONTENT_EXTRACTED'` to MessageType.ts inside the D-17 additions block (canonical extension, Pitfall 5 — update the block comment to note the 4a addition; keep the prettier-ignore line integrity).

    Extend PageContextBridge: export `interface ExtractionPayload { html: string; baseUrl: string; truncated: boolean }`; add `requestExtraction(tabId: number, mode: 'default' | 'actionable', options?: { timeoutMs?: number }): Promise<ExtractionPayload>` — publishes an EXTRACT_PAGE_CONTENT envelope with payload `{tabId, mode}` and opId, subscribes for the PAGE_CONTENT_EXTRACTED reply matching the opId, validates the reply payload shape (ExtractionPayload guard — sanitizeCapabilities precedent; malformed → reject with the CONTENT_EXTRACT_FAILED typed error), and rejects on timeout with a typed carrier (code: ERROR_CODES.CONTENT_EXTRACT_FAILED — the D-4a-22 canonical key, never the non-canonical string); the timeout listener is ALWAYS cleared (T-1-14 bounded wait). Also add `replyExtracted(requestId, payload)` publishing the PAGE_CONTENT_EXTRACTED ResponseEnvelope `{id: requestId, ok: true, data: payload}` (replyPong shape).

    Header comment: keep the dependency-free convention; note the single canonical addition + the ExtractionPayload contract.
  </action>
  <acceptance_criteria>
    - MessageType.ts contains PAGE_CONTENT_EXTRACTED; EXTRACT_PAGE_CONTENT unchanged; MessageTypeValues auto-includes it.
    - PageContextBridge exports ExtractionPayload + requestExtraction + replyExtracted.
    - The timeout path rejects with a typed error carrying code === ERROR_CODES.CONTENT_EXTRACT_FAILED (assert in test).
    - `pnpm vitest run tests/core/content -x` green + `pnpm tsc --noEmit` green.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/content/PageContextBridge.test.ts -x 2>/dev/null || pnpm vitest run tests/core/content -x</automated>
  </verify>
  <done>MessageType + bridge contract in place; roundtrip, correlation, and typed-timeout proven; tsc green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ContentScriptHost serialization + watcher wiring + mode reply (D-4a-07/08/09/01)</name>
  <files>src/core/content/ContentScriptHost.ts, src/entrypoints/core.content.ts</files>
  <read_first>
    - src/core/content/ContentScriptHost.ts (handleMessage L68-83, buildLiveContext L91-102, constructor/start/stop)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md (Pattern 2 serializeForExtraction — the strip set + truncate-at-boundary)
    - src/entrypoints/core.content.ts (defineContentScript main — where ctx arrives)
  </read_first>
  <behavior>
    - Test 1 (jsdom): EXTRACT_PAGE_CONTENT with mode 'default' → the host replies PAGE_CONTENT_EXTRACTED with {html, baseUrl, truncated:false}; the html contains the article markup but NOT script/style content (strip set D-4a-07).
    - Test 2: a doc whose serialized html exceeds PAGE_HTML_MAX_BYTES → truncated:true and the html ends at an element boundary (no mid-tag split).
    - Test 3: mode 'actionable' → the reply carries the walked RawNode tree (AxDomWalker output) with no password value in any form control (D-4a-20).
    - Test 4: the watcher callback rebuilds the live context + upserts the registry (D-4a-01 live-update path).
  </behavior>
  <action>
    Extend ContentScriptHost: export `PAGE_HTML_MAX_BYTES = 2_097_152` (from the host or the bridge — single home, planner picks, other files import); add `serializeForExtraction()` implementing Pattern 2 VERBATIM — clone document.documentElement, remove script/style/noscript/svg, remove cross-origin iframes (try contentWindow.origin check, catch → cross-origin → remove), remove form-action attributes (keep inputs — D-4a-07), stamp baseUrl: document.baseURI, serialize to one HTML string, truncate at element boundary when over PAGE_HTML_MAX_BYTES (walk back to the last `>` of a complete tag before the cap) setting truncated:true. Extend handleMessage's EXTRACT_PAGE_CONTENT case: keep the live upsert; for mode 'default' serialize + bridge.replyExtracted(id, {html, baseUrl, truncated}); for mode 'actionable' run AxDomWalker and reply with the RawNode payload. Wire SPANavigationWatcher in start() (constructor-injected watcher for tests; default builds with the wxt ctx) — onNavigate rebuilds buildLiveContext + registry.upsert + bridge.publishContext (D-4a-01 lightweight live update).
    Update core.content.ts to pass the wxt `ctx` into the host so the watcher registers via ctx.addEventListener.
  </action>
  <acceptance_criteria>
    - All four behavior tests pass via `pnpm vitest run tests/core/content/ContentScriptHost.test.ts -x`.
    - PAGE_HTML_MAX_BYTES exported; truncation lands at an element boundary (test asserts no dangling unclosed tag).
    - The actionable reply carries no password value (grep the RawNode payload in the test).
    - core.content.ts passes ctx; entrypoint remains ISOLATED/document_idle/<all_urls>.
    - tsc --noEmit green; no forbidden lib import in the host (grep).
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/content/ContentScriptHost.test.ts -x</automated>
  </verify>
  <done>Host serializes + replies per mode + wires the watcher; all roundtrip/truncation/password tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| content script → bridge (RuntimeEnvelope) | serialized host-page HTML crosses the messaging boundary |
| bridge reply → panel consumer | untrusted page payload arrives panel-side for parsing |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-19 | Tampering | oversized/malformed payload across the bridge | medium | mitigate | Reply payload shape-validated before resolve (sanitize precedent); PAGE_HTML_MAX_BYTES truncation caps payload size at ~2 MB (D-4a-09); bounded-wait timer always cleared (T-1-14) |
| T-4a-01 | Information Disclosure | password value in the actionable reply | critical | mitigate | AxDomWalker omits values at capture (D-4a-20); the ContentScriptHost test asserts the walked payload has no password value; FormControlSchema.refine re-validates panel-side (04a-04) |
| T-4a-20 | Information Disclosure | cross-origin iframe content captured | medium | mitigate | Cross-origin iframes are REMOVED at serialization (origin check in try/catch — D-4a-07 strip set) — foreign-site content never enters the payload |
| T-4a-21 | Spoofing | forged PAGE_CONTENT_EXTRACTED reply (id spoof) | low | mitigate | Reply correlation by opId (L57-58 precedent); MessageBus whitelist rejects unknown types (Pitfall 5) |
</threat_model>

<verification>
- `pnpm vitest run tests/core/content -x` — bridge + host suites green.
- tsc --noEmit green (ExtractionPayload contract compiles both sides).
- Truncation + strip-set + password-omission tests green.
- MessageType addition is the ONLY new canonical type (Pitfall 5).
</verification>

<success_criteria>
- PageContextBridge roundtrips extraction requests with typed timeout (D-4a-03/19).
- ContentScriptHost serializes pre-stripped HTML with base-URL stamp + boundary truncation (D-4a-07/08/09).
- Watcher wiring marks navigation (D-4a-01); actionable mode replies with walk output minus password values (D-4a-20).
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-07-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- src/core/runtime/MessageType.ts — `PAGE_CONTENT_EXTRACTED` (canonical addition)
- src/core/content/PageContextBridge.ts — `ExtractionPayload` interface, `requestExtraction()`, `replyExtracted()`
- src/core/content/ContentScriptHost.ts — `PAGE_HTML_MAX_BYTES` (2,097,152), `serializeForExtraction()`, EXTRACT_PAGE_CONTENT mode-discriminated reply, SPANavigationWatcher wiring
- src/entrypoints/core.content.ts — ctx passed into host wiring
- tests/core/content/ContentScriptHost.test.ts — extended: roundtrip, truncation, strip-set, actionable password omission
