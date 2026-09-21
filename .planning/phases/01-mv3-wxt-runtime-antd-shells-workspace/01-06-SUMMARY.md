---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 06
subsystem: runtime-messaging
tags: [mv3, runtime-envelope, message-type-registry, zod, strict-payload-validation, sender-guard, background-router, service-worker-cold-start, scaffold-literals, tdd, content-bundle-budget, appendice]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-02's relocated `src/entrypoints/**` tree and the synchronous `BackgroundRouter.register()` call site in `src/entrypoints/background.ts`
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-01's resolved hand-off ledger OQ6/OQ7, which fixes the canonical literals and the BroadcastBus-vs-envelope split this plan executes
provides:
  - "`MessageType` — the Appendix E const object — with `MessageTypeValues` derived from it (one source, no parallel list) and the canonical `OPEN_SIDE_PANEL` / `OPEN_STANDALONE` literals"
  - "`ScaffoldMessageType` — the five scaffold-local literals separated, validated by their own strict schemas, and unhandled in Phase 1 (T-1-29)"
  - "`validateEnvelope(value)` — structural + strict per-type Zod payload validation returning a typed result; `isEnvelope` is its boolean wrapper"
  - "`RuntimeEnvelopeValidation.ts` — the payload schemas and validator kept out of the content-script import graph (content bundle stays zod-free)"
  - "`MessageBus.init`'s sender guard: a foreign `sender.id`, an absent sender and an absent `sender.id` are all rejections; dispatch validates before any handler runs"
  - "Cold-start contract proven: listeners attach synchronously, re-registration is idempotent, handlers are isolated, and a valid + invalid envelope pair is asserted through the captured listener"
  - "`OperationId` bound into the envelope path: `generateOperationId` is the factory's id source, `isOperationId` + `OPERATION_ID_MAX_CHARS` serve the validator"
affects: [01-07, 01-08, 01-09, 01-13, 02, 03, 06, 17]

actuals:
  tokens: 13713    # chars/4 over the realized diff (git diff -U0 a3491c3..HEAD -- src tests = 54,852 chars)
  tasks: 2
  commits: 6       # measured: git rev-list --count a3491c3..HEAD
  plan_head_before: a3491c36449a041d121bc11818dc384564ffd2eb

tech-stack:
  added: []
  patterns:
    - "One registry, one derivation: the Appendix E `MessageType` const object is the source and `MessageTypeValues` is `Object.values` of it — a hand-maintained parallel list is the defect class this removes"
    - "Validation is a strict parse at the boundary: `.strict()` rejects an unknown payload field, every string field carries a maximum, and a failure is a typed result that never throws and never half-applies"
    - "Identity is `sender.id` only: the envelope's declared `source` is attacker-controlled data and is never consulted as identity (T-1-27)"
    - "Declared-but-unowned capabilities get no handler: scaffold-local literals are validated and dropped, so no surface can claim an extraction or SPA-navigation capability Phase 1 does not implement"
    - "A registry module that a tiny entrypoint imports stays dependency-free; expensive validation lives behind a module boundary the tiny entrypoint never crosses"
    - "A grep-shaped gate must name the exact literal, not a substring another canonical identifier contains (a `STANDALONE_OPEN` pattern also matches the canonical `STANDALONE_OPEN_FAILED` code, §21.6)"

key-files:
  created:
    - src/core/runtime/RuntimeEnvelopeValidation.ts
  modified:
    - src/core/runtime/RuntimeEnvelope.ts
    - src/core/runtime/OperationId.ts
    - src/core/messaging/MessageBus.ts
    - src/core/messaging/BackgroundRouter.ts
    - tests/core/runtime/RuntimeEnvelope.test.ts
    - tests/background/background-router.test.ts
    - tests/background/message-bus-cold-start.test.ts
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md (own rows + status notes)

key-decisions:
  - "`MessageType` is the *complete* Appendix E registry (15 types), not just the renamed prototype subset. Later phases (`PROXY_FETCH`, `PORT_STREAM_*`, `ADDON_EVENT`, `WORKSPACE_*`) find their literal already declared and schema-bounded instead of re-editing the registry."
  - "The two dead prototype literals — `GET_ACTIVE_TAB_CONTEXT` and `STREAM_STATE_CHANGED` — are removed: neither is in Appendix E nor among the five scaffold-local literals the plan preserves, and no production code consumed either (their only consumers were the two suite cases this plan rewrites)."
  - "Envelope structural fields stay `operationId` / `timestamp` exactly as the plan requires ('construction verbatim'). Appendix C writes `id` / `createdAt`; that divergence is now isolated in one interface and recorded here so the phase acceptance review can decide whether to realign it."
  - "The strict payload schemas live in `RuntimeEnvelopeValidation.ts`, not in `RuntimeEnvelope.ts`. The plan's artifact table names one file; the measured bundle cost (content 4.07 kB → 73.76 kB) makes the split a correctness requirement for §22's content-bundle budget, and the registry module documents the reason beside the export."
  - "`validateEnvelope` returns the *original* value on success rather than a parsed copy, so envelope identity survives dispatch (`handler).toHaveBeenCalledWith(envelope, …)` remains a real assertion)."
  - "Scaffold envelopes are validated too: `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` keep bounded strict schemas so a content-script message is still a validated envelope, it simply has no Phase-1 handler."
  - "`BackgroundRouter`'s advisory handlers log the envelope's `operationId` and never read the payload — no narrowing, no cast, no unvalidated data in a handler (the plan's handler-boundary rule)."
  - "The listener validates once and calls a module-private `dispatchEnvelope`; the exported `dispatch` validates for any other caller. A malformed message returns `false` from the listener and is never answered as if accepted."
  - "`tests/background` constructs its own `chrome.runtime.id` per test (`np-test-extension-id`) instead of touching `tests/setup.ts`, so the change stays inside this plan's file set."

patterns-established:
  - "RED evidence for a new-API TDD task must be assertion-level: the first draft failed as a module-load crash (fixtures built at module scope from the not-yet-existing export) and was restructured so the suite collects and each target case fails on its own assertion"
  - "A bundle budget is a gate: the zod-in-content regression was caught by measuring the built entrypoints against the pre-plan ledger commit in a detached worktree, not by trusting the source graph"
  - "Verification gates that cannot pass as written are corrected to name their exact instrument, with both the raw and the scoped count recorded (see Deviations)"

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "The message-type registry is Appendix E shaped and single-sourced: `MessageType` is a const object, `MessageTypeValues` is derived from it, `OPEN_SIDE_PANEL` / `OPEN_STANDALONE` are the literals, and no prototype spelling remains in the registry or its consumers."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/core/runtime/RuntimeEnvelope.test.ts#exposes the canonical OPEN_SIDE_PANEL and OPEN_STANDALONE literals / #MessageTypeValues carries no prototype literal spelling / #derives MessageTypeValues from MessageType (one source, no parallel list)"
        status: pass
      - kind: other
        ref: "grep -rn \"'SIDE_PANEL_OPEN'|'STANDALONE_OPEN'\" src/core/runtime src/core/messaging → 0 (production registry and its consumers)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Payloads are schema-validated and strict: a valid envelope of every canonical type parses; a wrong-shape payload, an unknown extra payload field, an unknown extra envelope field, an oversized payload string, a bad operation id, a bad timestamp and a bad source are all rejections."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/core/runtime/RuntimeEnvelope.test.ts (26 cases: per-type fixture acceptance + 8 rejection shapes)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit → exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The envelope factory and the canonical operation-id helper are bound together: `createEnvelope` generates its `operationId` through `OperationId.generateOperationId()` (crypto.randomUUID) and keeps the given type/source with a numeric timestamp."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/core/runtime/RuntimeEnvelope.test.ts#createEnvelope returns the given type/source with a generated operationId and numeric timestamp / #generates a distinct operationId per envelope; tests/core/runtime/OperationId.test.ts (3 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Scaffold-local literals are preserved, separated and unimplemented: `ScaffoldMessageType` carries the five literals, `MessageType` carries none of them, their envelopes validate, and no Phase-1 handler is registered for any of them."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/core/runtime/RuntimeEnvelope.test.ts#exposes ScaffoldMessageType separately …; tests/background/background-router.test.ts#register() leaves the scaffold-local literals unhandled; tests/background/message-bus-cold-start.test.ts#a scaffold-local envelope is validated but has no Phase-1 handler"
        status: pass
    human_judgment: false
  - id: D5
    description: "A foreign or anonymous sender cannot reach a handler: the listener rejects a different extension id, an absent sender and an absent `sender.id`, returning `false` with no handler invocation and no response."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/background/message-bus-cold-start.test.ts#the listener rejects a message from a foreign extension id … / #the listener rejects a message with an absent sender … / #the listener rejects a message with an absent sender.id …; tests/background/background-router.test.ts#a foreign sender cannot reach a registered handler through the listener"
        status: pass
      - kind: other
        ref: "grep -rn 'sender' src/core/messaging/MessageBus.ts | grep -c 'runtime.id' → 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "Dispatch validates before any handler runs and handler isolation is preserved: an invalid envelope runs no handler (including two concurrent dispatches, where the rejected one leaves no side effect), a synchronous throw is caught, and init() re-registration keeps one listener and stable ordering."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/background/message-bus-cold-start.test.ts (19 cases: validation-before-handler, concurrent dispatch isolation, allSettled + sync-throw isolation, init() idempotency + ordering)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Background listeners register synchronously and the router is bound to the canonical literals: `BackgroundRouter.register()` registers `OPEN_SIDE_PANEL` / `OPEN_STANDALONE` handlers, attaches in the same tick on a fresh module instance, stays idempotent, and `BackgroundRouter.register()` remains the first synchronous call in `main()` before any await."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/background/background-router.test.ts (9 cases); tests/background/message-bus-cold-start.test.ts#cold start: the listener is attached synchronously …"
        status: pass
      - kind: other
        ref: "grep -n 'BackgroundRouter.register' src/entrypoints/background.ts → line 29; no `await` precedes it in the file"
        status: pass
    human_judgment: false
  - id: D8
    description: "The content-script bundle stays zod-free and the extension builds: the strict schemas are unreachable from `createEnvelope`, so `content-scripts/content.js` carries no zod while the background (where validation runs) does."
    requirement: "CORE-01"
    verification:
      - kind: integration
        ref: "pnpm run build:ext → content-scripts/content.js 4.88 kB with 0 zod markers; background.js 73.0 kB with the validation graph"
        status: pass
      - kind: other
        ref: "bash scripts/verify-no-tailwind.sh → exit 0; npx vitest run → 22 files / 269 tests passed"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 06: Canonical Runtime Envelope and Sender-Guarded Message Path Summary

**Appendix-E message registry with strict Zod payload validation, a `sender.id`-only trust boundary on `chrome.runtime.onMessage`, cold-start-proven synchronous registration — and the zod graph kept out of the content-script bundle (4.88 kB, zero zod markers)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-21T12:56:51Z
- **Completed:** 2026-09-21T13:07:39Z
- **Tasks:** 2
- **Files modified:** 8 tracked paths across 6 commits (1,064 insertions / 162 deletions), plus the inventory status reconciliation

## Accomplishments

- **The registry is canonical and single-sourced.** `MessageType` is the Appendix E const object and `MessageTypeValues` is `Object.values(MessageType)` — the prototype's `SIDE_PANEL_OPEN` / `STANDALONE_OPEN` spellings are gone from the registry and from every consumer (`MessageBus`, `BackgroundRouter`, `tests/background/**`, `tests/core/runtime/**`). `MessageType.OPEN_SIDE_PANEL === 'OPEN_SIDE_PANEL'` and `MessageType.OPEN_STANDALONE === 'OPEN_STANDALONE'` are asserted.
- **Malformed envelopes fail closed through a typed path.** `validateEnvelope` checks the five structural fields and parses the payload against a per-type `.strict()` Zod schema with bounded string lengths. A missing operation id, an unknown type, an unknown payload field, an unknown structural field, a wrong-shape payload, a bad timestamp/source and an oversized payload string (one char over the §26.6 2 MB cap) are each a distinct test. Nothing is truncated and nothing half-applies.
- **The trust boundary is `sender.id`, nothing else.** `MessageBus.init`'s listener rejects a foreign extension id, an absent `sender`, and an absent `sender.id` — returning `false` with no handler run and no response — and rejects an envelope that fails validation before dispatch. The declared `source` field is never consulted as identity (T-1-27); the envelope's payload is never unvalidated when a handler sees it (T-1-26).
- **Cold-start and idempotency are proven, not asserted.** The suites capture the actual `chrome.runtime.onMessage` listener: a valid envelope reaches its handler and gets `{ ok: true }`, an invalid one returns `false`, `init()` twice attaches exactly one listener, handler ordering is stable, and a synchronous handler throw is converted to a rejection that `allSettled` absorbs.
- **The router is bound to the canonical literals and claims no later-phase capability.** `BackgroundRouter.register()` registers `OPEN_SIDE_PANEL` / `OPEN_STANDALONE` advisory handlers (logging the envelope's `operationId`, no payload read) and no longer registers the scaffold-local `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` handlers. Those literals stay declared, validated and unhandled, so no surface can claim a page-extraction or SPA-navigation capability Phase 1 does not implement (T-1-29).
- **The content-script bundle stayed tiny.** The regression this plan initially introduced — zod in every importer — was caught by measuring the built entrypoints against the pre-plan ledger commit in a detached worktree: content 4.07 kB → 73.76 kB. After moving the schemas behind their own module: 4.88 kB with zero zod markers, while `background.js` (where validation actually runs) carries the graph.

## Task Commits

Each task was committed atomically; both TDD tasks carry their RED then GREEN commit:

1. **Task 1 RED: failing envelope registry and payload-validation suite** — `6e15c53` (test)
2. **Task 1 GREEN: `MessageType` registry, strict validation, `OperationId` binding** — `cb9bae4` (feat)
3. **Task 2 RED: failing sender-guard and canonical-router suites** — `2ec8b03` (test)
4. **Task 2 GREEN: sender-guarded dispatch and canonical router literals** — `328859d` (feat)
5. **Bundle fix: keep the zod schemas out of the content-script bundle** — `da4607a` (fix)
6. **Concurrent dispatch isolation case (must-have backstop)** — `55716ae` (test)

**Plan metadata:** committed separately as `docs(01-06): complete … plan`.

## Files Created/Modified

- `src/core/runtime/RuntimeEnvelope.ts` — the Appendix E `MessageType` const object, derived `MessageTypeValues`, the separated `ScaffoldMessageType` (five literals, no handler), `EnvelopeType` / `EnvelopeSource` / `RuntimeEnvelope` / `PageHtmlPayload`, and the verbatim `createEnvelope` (now through `generateOperationId()`). Zod-free by design; the validation split is documented in-file.
- `src/core/runtime/RuntimeEnvelopeValidation.ts` — **new**: one `.strict()` Zod payload schema per canonical type (Appendix E; `PROXY_FETCH` to §10.7, `PORT_STREAM_*` to Appendix E's port protocol) plus the five scaffold schemas, `validateEnvelope` (typed result, ordered structural checks, bounded lengths), `isEnvelope`, and the per-type schema lookup.
- `src/core/runtime/OperationId.ts` — `generateOperationId` (unchanged contract) plus `isOperationId` and `OPERATION_ID_MAX_CHARS`, now the validator's operation-id check.
- `src/core/messaging/MessageBus.ts` — the sender guard in `init()`'s listener; `dispatch` routes through `validateEnvelope`; the listener validates once and calls a module-private `dispatchEnvelope`; handler isolation (`allSettled` + sync-throw wrapper) and one-listener idempotency preserved.
- `src/core/messaging/BackgroundRouter.ts` — registrations realigned to `MessageType.OPEN_SIDE_PANEL` / `MessageType.OPEN_STANDALONE` (advisory, `operationId` only); scaffold-literal handlers removed; synchronous top-level `register()` and `__resetForTests()` unchanged.
- `tests/core/runtime/RuntimeEnvelope.test.ts` — 11 → 26 cases: canonical literals, a valid payload fixture per canonical type, per-shape rejections, the typed failure path, and the preserved frozen-extraction suite re-pointed at `ScaffoldMessageType`.
- `tests/background/message-bus-cold-start.test.ts` — 9 → 19 cases: cold-start attachment, valid + invalid dispatch through the captured listener, foreign/absent-sender rejections, validation-before-handler, concurrent-dispatch isolation, init() idempotency and ordering.
- `tests/background/background-router.test.ts` — 6 → 9 cases: canonical handler dispatch, synchronous attachment, double-register no-op, type isolation, scaffold literals unhandled, foreign-sender rejection.
- `01-MIGRATION-INVENTORY.md` — seven rows `pending` → `implemented` with `01-06` status notes, plus a new row for `RuntimeEnvelopeValidation.ts`.

## Decisions Made

- **The full Appendix E registry (15 types) is adopted, not a renamed subset.** Later phases find their literal already declared and schema-bounded. The registry keeps the prototype's `source` union verbatim (`background | sidepanel | standalone | content | popup`) rather than Appendix C's `addon` variant, because no Phase-1 code produces an addon source and the plan asks for the constructor to stay verbatim.
- **`GET_ACTIVE_TAB_CONTEXT` and `STREAM_STATE_CHANGED` are removed.** Neither is canonical (Appendix E) nor scaffold-owned (the plan's five), and no production code consumed them — only the two suite cases this plan rewrites.
- **`operationId` / `timestamp` are kept (not Appendix C's `id` / `createdAt`).** The plan states "keep `createEnvelope`'s construction verbatim" and asserts the field names in its acceptance criteria. The divergence is now one interface wide and recorded for the phase acceptance review.
- **The zod schemas live in `RuntimeEnvelopeValidation.ts`, and the registry does not re-export them.** A re-export keeps the schema module in the content entry's module graph and the schemas' top-level `z.object(...)` calls are not tree-shakeable — measured, not assumed. `MessageBus` and the suite import the validator from the validation module; every other consumer keeps importing the registry from `RuntimeEnvelope.ts`.
- **`validateEnvelope` returns the original object on success.** Validation is a gate, not a transform, so `handler).toHaveBeenCalledWith(envelope, …)` stays a real identity assertion.
- **Scaffold envelopes are validated but unhandled.** `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` keep bounded strict schemas (a content-script message is still a validated envelope) and are dropped by dispatch because no handler exists.
- **The listener validates once.** The listener validates and passes the validated envelope to a module-private dispatch; the exported `dispatch` validates independently so any future in-process caller gets the same guarantee.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The plan's Zod-in-the-registry layout put zod into the content-script bundle**
- **Found during:** Plan-level verification (Task 2 GREEN), checking `pnpm run build:ext` against §22's content-bundle budget
- **Issue:** Declaring the payload schemas in `RuntimeEnvelope.ts` made the zod runtime reachable from every importer of `createEnvelope`. Measured against the pre-plan ledger commit in a detached worktree: `content-scripts/content.js` 4,069 B → 73,757 B and `background.js` 2,381 B → 73,028 B. The content script is the extraction-only tiny entrypoint §22 budgets under 50 KB.
- **Fix:** the strict schemas, `validateEnvelope` and `isEnvelope` moved to the new `src/core/runtime/RuntimeEnvelopeValidation.ts`; the registry module stays zod-free and deliberately does not re-export them (a re-export was tried first and measured — it still pulled the schemas' top-level initializers into the content graph). `MessageBus` and the suite import the validator from the validation module.
- **Files modified:** `src/core/runtime/RuntimeEnvelopeValidation.ts` (new), `src/core/runtime/RuntimeEnvelope.ts`, `src/core/messaging/MessageBus.ts`, `tests/core/runtime/RuntimeEnvelope.test.ts`
- **Verification:** `pnpm run build:ext` → `content-scripts/content.js` 4,881 B with 0 `ZodError` markers; `background.js` 73,028 B (validation runs there); `npx tsc --noEmit` exit 0; 269 tests green.
- **Committed in:** `da4607a`

**2. [Rule 1 - Gate defect] The plan's prototype-literal grep cannot return zero**
- **Found during:** Task 1 verification
- **Issue:** the plan requires `grep -rn "SIDE_PANEL_OPEN\|STANDALONE_OPEN" src/ tests/ | wc -l` to be 0, but three independent, correct facts keep it non-zero: (a) the canonical §21.6 error identifier `STANDALONE_OPEN_FAILED` contains `STANDALONE_OPEN` as a substring and is used by `src/entrypoints/sidepanel/main.tsx`; (b) `src/core/workspace/{WorkspaceSync,WorkspaceRouter}.ts` carry a **BroadcastBus** union member spelled `'STANDALONE_OPEN'` — a different domain, owned by plan `01-07`, which replaces that union with the handoff protocol; (c) the plan's own `<behavior>` case 8 requires the suite to assert `MessageTypeValues` does **not** contain the prototype spellings, so the test file must name them. Touching (a) would contradict the spec and touching (b) would not even make the count zero.
- **Fix:** the gate's intent is applied with a production-scoped instrument — `grep -rn "'SIDE_PANEL_OPEN'\|'STANDALONE_OPEN'" src/core/runtime src/core/messaging` returns 0 — and the provenance comment that named the old spellings in `RuntimeEnvelope.ts` was reworded so no source file in the registry/consumer scope carries the tokens. Both counts are recorded in the coverage evidence.
- **Files modified:** `src/core/runtime/RuntimeEnvelope.ts` (comment wording)
- **Verification:** production-scoped count 0; raw count 5 (the three facts above plus the two required negative assertions).
- **Committed in:** `cb9bae4` (comment rewording) with the deviation recorded here

**3. [Rule 3 - Blocking] The first RED suite failed as a module-load crash, not as an intentional RED**
- **Found during:** Task 1 RED
- **Issue:** the suite built `RESERVED_TYPES` at module scope from `ScaffoldMessageType`, which does not exist yet, so Vitest reported a collection error and zero tests ran — an INVALID_RED that cannot authorize GREEN.
- **Fix:** the fixture list uses the string literals typed by the (erased) type import, so the suite collects and each target case fails on its own assertion (10 failures of 26 in RED).
- **Files modified:** `tests/core/runtime/RuntimeEnvelope.test.ts`
- **Verification:** RED run: 26 collected, 10 failed, 16 passed, no load error; GREEN run: 26 passed.
- **Committed in:** `6e15c53` (RED) and `cb9bae4` (GREEN)

---

**Total deviations:** 3 auto-fixed (1 missing critical functionality, 1 gate defect, 1 blocking)
**Impact on plan:** Deviation 1 is the only structural departure from the plan's artifact table and was required by a measured §22 budget breach; it adds one file and changes no call-site contract beyond the validator's import path. Deviation 2 is a verification-instrument correction with evidence for both readings. No dependency was added or bumped (`zod@4.4.3` was already installed and untouched), and no other plan's owned file was modified.

## Issues Encountered

- **The bundler does not tree-shake unused re-exports of a schema module.** The first fix attempt (split + re-export from `RuntimeEnvelope.ts`) still produced a 73.7 kB content bundle — Rollup keeps the schema module's top-level `z.object(...).strict()` initializers once the module is in the graph. The working shape is a hard module boundary: the registry never imports the validator.
- **The background bundle carries zod (~73 kB).** That is the deliberate cost of validating at the message boundary; the spec sets no background size target, and `zod/mini` was not an option because the plan fixes `z.object(...).strict()`.
- **`chrome.runtime.id` is not in `tests/setup.ts`.** The background suites set it per test (`np-test-extension-id`) rather than editing the shared setup file, keeping the change inside this plan's file set.

## Known Stubs

None — no placeholder value, empty collection or unwired data source was introduced. The scaffold-local literals having no handler is a stated disposition (T-1-29, Phase 6/17 claim them), not a stub; `PageHtmlPayload` remains a declared-only shape exactly as the plan requires.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: scaffold_envelope_acceptance | `src/core/runtime/RuntimeEnvelopeValidation.ts` | The validator accepts the five scaffold-local envelope types (bounded, strict schemas) even though no Phase-1 handler consumes them. This is deliberate — the content script legitimately emits `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` — but it means the accepted-type surface is wider than the handler surface until Phase 6/17 claim those literals. Recorded in the inventory row and asserted by the "no Phase-1 handler" cases. |

## User Setup Required

None — no external service configuration required, no dependency installed or bumped.

## Next Phase Readiness

- **`01-07` (workspace/handoff)**: import the validator from `src/core/runtime/RuntimeEnvelopeValidation.ts`, not the registry. The BroadcastBus `'STANDALONE_OPEN'` union member it owns is untouched and still greps positive — the `01-06` scoped gate deliberately excludes it; replacing that union with the `HandoffEnvelope` protocol is the clean end state.
- **`01-08` (palette/commands)**: `focus-side-panel` opens the panel from the surface root; the background's `OPEN_SIDE_PANEL` / `OPEN_STANDALONE` handlers are advisory only (log the `operationId`) and claim no open behaviour.
- **`01-13` (gates)**: the production-scoped literal gate used here is the instrument to extend; a raw substring grep for `STANDALONE_OPEN` will always trip on the canonical §21.6 `STANDALONE_OPEN_FAILED` code.
- **Phase 2/3**: `PORT_STREAM_*`, `PROXY_FETCH`, `ADDON_EVENT`, `WORKSPACE_*` already have declaration + strict schema; extending a payload shape means editing exactly one schema entry and its fixture.
- **Phase acceptance review**: the `operationId` / `timestamp` vs Appendix C `id` / `createdAt` divergence is isolated to one interface and is the only envelope-shape question this plan leaves open.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Files created (1 of 1): `src/core/runtime/RuntimeEnvelopeValidation.ts`.
- Files modified present (7 of 7): `src/core/runtime/{RuntimeEnvelope,OperationId}.ts`, `src/core/messaging/{MessageBus,BackgroundRouter}.ts`, `tests/core/runtime/RuntimeEnvelope.test.ts`, `tests/background/{background-router,message-bus-cold-start}.test.ts`.
- Commits present: `6e15c53`, `cb9bae4`, `2ec8b03`, `328859d`, `da4607a`, `55716ae` (6 of 6, measured with `git rev-list --count a3491c3..HEAD`).
- Fresh verification on the committed tree: `npx tsc --noEmit` exit 0; `npx vitest run` 22 files / 269 tests passed; `npx vitest run tests/background tests/core/runtime` 57 passed; production-scoped prototype-literal grep 0; sender-guard grep 1; `pnpm run build:ext` emits `content-scripts/content.js` 4.88 kB (0 zod markers) and `background.js` 73.0 kB; `bash scripts/verify-no-tailwind.sh` exit 0.
