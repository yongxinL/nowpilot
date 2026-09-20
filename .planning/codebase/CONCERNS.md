---
last_mapped_commit: fa9f6508dff633ac15be7548c3cde08535e4bab5
last_mapped_at: 2026-09-20
---
# Codebase Concerns

**Analysis Date:** 2026-09-20

**Scope note:** The repository is a committed prototype seed (`fa9f650 prototype: establish NowPilot UI seed and authorities`) on branch `aurora`, with a 6,791-line product spec and design system under `.planning/`. Most UI surfaces exist; most planned runtime engines do not. The findings below separate "prototype stub that will be replaced by a planned phase" from "defect that will silently ship". Highest-severity items first.

**Top risks:**

1. The content script is silently not built into the extension — `entrypoints/content/core.content.ts` matches no WXT entrypoint glob and the generated manifest has no `content_scripts` key (verified by `pnpm build:ext` + `.output/chrome-mv3/manifest.json`).
2. Provider API keys and full chat/notes content are persisted unencrypted in one `chrome.storage.local` blob; the project's own security skill requires encrypted key storage and forbids large bodies in Chrome local storage.
3. The streaming parser only understands a bespoke proxy shape (`data.textChunk` / `data.thoughtChunk`); standard OpenAI/Gemini/Anthropic SSE payloads produce an empty response with no error.
4. The Write surface and Regenerate action return hardcoded canned text, never calling a provider — with no DEMO_MODE gate (unlike `src/services/aiProvider.ts`).
5. Verification scripts are unreliable: 4 of 10 `verify:phase-*` scripts silently pass while running far fewer tests than named, and 5 fail outright because their target test directories do not exist.

## Tech Debt

**Prototype stubs masquerading as features:**

- Issue: `src/components/standalone/StandaloneWritePage.tsx:144-197` builds `generatedResponse` from hardcoded template strings per format (Paragraph/Essay/Email/Outline/Comment/Twitter), waits `setTimeout(600)`, then stores it as a `WriteHistoryItem` with `model: config.selectedModel`. The provider is never called, and this path is not gated by `demoMode`/`import.meta.env.DEV`.
- Files: `src/components/standalone/StandaloneWritePage.tsx`, `src/components/standalone/ToolsGridPanel.tsx:49-51` (fake "Done!" toast), `src/store/useExtensionStore.ts:259-275` (`regenerateMessageInActiveSession` injects `"Here is alternative response variant N…"`), `src/components/chat/useChatStreaming.ts:48-52` (hardcoded follow-up suggestions), `src/services/aiProvider.ts:458-464` (`AVAILABLE_MODELS` lists fictional models such as `gemma-4-E2B-it-MLX-4bit`, `Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx`).
- Impact: users receive fabricated AI output attributed to the selected model; regeneration is unusable; fixture data leaks into product defaults (`src/store/useExtensionStore.ts:20-87`).
- Fix approach: route Write/Regenerate through `streamChatResponse` (or hide the surfaces behind a feature flag until Phase wiring lands); remove fictional defaults in favor of an empty model list + explicit "configure a provider" state. Track as its own phase before any external build.

**Entire planned-era modules are dead code:**

- Issue: modules with zero consumers: `src/core/input/KeymapRegistry.ts`, `src/core/registry/Registry.ts`, `src/core/registry/AddonRegistry.ts`, `src/core/registry/AddonSettingsStore.ts` (in-memory only — loses add-on settings on reload, contrary to the spec's `np_addon_<id>` storage requirement), `src/core/events/EventBus.ts` (test only), `src/core/prompts/index.ts`, `src/core/runtime/PortReader.ts`, `src/core/runtime/workerState.ts`, `src/core/runtime/OperationId.ts` (test only; `RuntimeEnvelope` calls `crypto.randomUUID()` instead), `src/core/components/ErrorBoundary.tsx` (never mounted), `src/core/i18n/strings.ts` (only used by dead pages), `src/theme/index.ts`, `src/theme/algorithms.ts`, `src/theme/tailwindEquivalents.ts`, and `src/components/pages/{ChatPage,AgentPage,OptionsPage,NotesPage}.tsx` (duplicates of live surfaces; `NotesPage` says "will be implemented in Phase 5" while `src/components/notes/NotesWorkspace.tsx` already exists).
- Impact: false sense of implemented capability; navigation/search noise; untested code paths; risk that a future phase wires the wrong duplicate (two `OptionsPage.tsx` files).
- Fix approach: delete or move to an explicit `src/scaffold/` holding area with a header comment; wire `AddonSettingsStore` to `chrome.storage.local` with `np_addon_` prefix when add-ons land.

**Verification scripts are misleading:**

- Issue: `package.json` defines `verify:phase-2`…`verify:phase-9` against test paths that do not exist. Measured on 2026-09-20:
  - Exit 0 while silently under-verifying: `verify:phase-2` (ran 1 file / 7 tests of 4 named suites), `phase-3`, `phase-7`, `phase-8` (`tests/core/security`, `tests/core/utils`, `tests/core/workspace/WorkspacePersistence.test.ts`, `tests/core/ai/persona`, `tests/hooks`, `tests/components/rich`, `tests/core/intent`, `tests/core/notes`, `tests/core/content`, `tests/addons` all missing — vitest positional filters simply match nothing).
  - Exit 1 with "No test files found": `verify:phase-4`, `phase-4a`, `phase-5`, `phase-5a`, `phase-6`. `test:perf` (`tests/perf`) also fails.
- Files: `package.json:18-38`, missing dirs under `tests/`.
- Impact: a phase can report PASS with almost nothing executed, directly undermining GSD verification and release gates.
- Fix approach: make each verify script assert its expected test-file count, or replace path filters with `vitest run --dir tests/<phase>` plus a non-zero assertion; add a meta-test that fails when a referenced path is absent.

**Duplicated feature implementations:**

- Issue: prompt management exists twice (`src/components/options/PromptsOptionsTab.tsx` + `src/components/options/PromptModal.tsx` for Options, `src/components/common/PromptManagerModal.tsx` + `src/components/chat/SlashCommandModal.tsx` for chat); two dev/DOM shells (`src/main.tsx` Vite harness registers its own commands, duplicating `src/core/commands/registerWorkspaceCommands.ts` used by real entrypoints); two markdown stacks historically (`@ant-design/x-markdown` now canonical).
- Impact: behavior drift between surfaces; fixing a prompt bug in one path leaves the other.
- Fix approach: consolidate on the live path (`PromptsOptionsTab` + `SlashCommandModal`) and delete the unused modal; have `src/main.tsx` import the real command registrations instead of re-declaring them.

**No linter or formatter is installed:**

- Issue: `"lint": "tsc --noEmit"` only. There is no `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, or `biome.json`, and no eslint/prettier dependency. Yet source files contain `// eslint-disable-next-line no-console` and `@typescript-eslint/no-explicit-any` comments (e.g., `src/core/log/debugLog.ts:25`, `src/core/messaging/MessageBus.ts:55`, `tests/core/theme/ThemeSync.test.tsx:35`).
- Impact: style/quality rules are unenforced and the disable comments are purely decorative; the Tailwind ban (`scripts/verify-no-tailwind.sh`) is the only style gate.
- Fix approach: add ESLint flat config (react-hooks, no-console, no-explicit-any) + Prettier, or strip the inert comments so they don't imply enforcement.

**Generated WXT artifacts are tracked in git:**

- Issue: `.wxt/` is committed (7 files: `.wxt/tsconfig.json`, `.wxt/types/*.d.ts`, `.wxt/wxt.d.ts`) and is not in `.gitignore` (`.output/` and `dist` are ignored). `.wxt/types/paths.d.ts` currently lacks any content-script path, mirroring the content-script defect below.
- Impact: churn on every WXT run; stale generated types can mask entrypoint regressions; reviewers see generated diffs.
- Fix approach: add `.wxt/` to `.gitignore` and `git rm -r --cached .wxt`.

**Manifest config vs. output discrepancy:**

- Issue: `wxt.config.ts` sets `options_ui.open_in_tab: true`, but the generated manifest contains `"options_ui": {"open_in_tab": false, "page": "options.html"}` plus the legacy `options_page` key.
- Files: `wxt.config.ts:41-56`, `.output/chrome-mv3/manifest.json`.
- Impact: options likely opens in Chrome's embedded dialog instead of a tab; the duplicate legacy key is redundant.
- Fix approach: reconcile the WXT entrypoint/config (`entrypoints/options/index.html` vs `manifest.options_ui`) and assert the generated manifest in a test.

## Known Bugs

**Content script is never built into the extension:**

- Symptoms: `pnpm build:ext` succeeds, but `.output/chrome-mv3/manifest.json` has no `content_scripts` entry, no `content-scripts/` output directory exists, and `.wxt/types/paths.d.ts` has no content-script public path. `CONTENT_SCRIPT_READY`/`SPA_NAVIGATION` messages can therefore never be produced by a real install.
- Files: `entrypoints/content/core.content.ts:4-8`; WXT glob table in `node_modules/wxt/dist/core/utils/building/find-entrypoints.mjs` only recognizes `content.[jt]s`, `content/index.[jt]s`, `*.content.[jt]s`, `*.content/index.[jt]s` relative to the entrypoints root. `content/core.content.ts` (nested inside a directory named `content`) matches none of these, so it is treated as a non-entrypoint file.
- Trigger: any `pnpm build:ext`; no test asserts manifest contents.
- Workaround: rename to `entrypoints/content.ts` (or `entrypoints/content/index.ts`), and add a build-inspection test asserting `content_scripts` exists.
- Priority: High — Phase 6 extraction depends on it, and the defect is silent.

**Streaming responses from real providers are dropped:**

- Symptoms: assistant bubble stays empty; no error is surfaced.
- Files: `src/services/aiProvider.ts:431-443` only reads `data.textChunk` / `data.thoughtChunk` from each SSE `data:` frame. Standard payloads are OpenAI `data.choices[0].delta.content`, Anthropic `content_block_delta.delta.text`, Gemini `candidates[0].content.parts[0].text`. None are handled. `src/services/aiProvider.ts:173-181` even points Gemini at `streamGenerateContent?alt=sse`, whose frames are Gemini-shaped.
- Impact: chat appears broken for every direct provider; only a proxy emitting the bespoke `{textChunk}` contract works.
- Fix approach: normalize per provider in the SSE loop (switch on `config.activeProvider`) or make the proxy contract explicit and enforce it; add fixture-based tests with captured OpenAI/Gemini SSE frames.

**The user's prompt is sent twice per request:**

- Symptoms: doubled prompt tokens and duplicated instructions; cost/behavior anomalies.
- Files: `src/components/chat/useChatStreaming.ts:68-74` passes `currentHistory` that already contains the just-added user message; `src/services/aiProvider.ts:352-360` appends `{ role: 'user', content: prompt }` again.
- Fix approach: either pass history without the trailing user message, or drop the appended `prompt`; add a unit test on the assembled request body.

**Anthropic connection test targets a non-existent endpoint:**

- Symptoms: "Check connection" for Claude always fails.
- Files: `src/services/aiProvider.ts:43-48, 88` — base `https://api.anthropic.com` + `/models` = `https://api.anthropic.com/models`; the real endpoint is `/v1/models`. (OpenAI works because its base already ends in `/v1`.)
- Also: direct browser calls to Anthropic require the `anthropic-dangerous-direct-browser-access: true` header, which is never set (`src/services/aiProvider.ts:81-86`), and `https://api.anthropic.com` is absent from `host_permissions` (`wxt.config.ts:33-36`) so the request is subject to CORS preflight.
- Fix approach: insert `/v1` for Claude, add the browser-access header, and add `https://api.anthropic.com/*` to `host_permissions` (or route through the local proxy by design and document it).

**Provider key routing is inconsistent and silently ignores configured keys:**

- Symptoms: users save a Claude/Ollama key in Options and requests still go to the local OpenAI-compatible proxy using `openAiKey`.
- Files: `src/components/options/OptionsPage.tsx:220-234` saves `modalApiKey` into `providers[id].apiKey` (and mirrors only OpenAI into `openAiKey`/`openAiBaseUrl`); `src/services/aiProvider.ts:342-350` builds the request from `config.openAiBaseUrl` (default `http://localhost:12380/v1`) and sends `Authorization: Bearer ${config.openAiKey}` regardless of `activeProvider`; `buildEndpointUrl` (`src/services/aiProvider.ts:173-181`) only special-cases Gemini — Claude and Ollama both fall through to the OpenAI path.
- Impact: provider selection in the UI does not match the transport; keys appear "saved" but unused; `config.geminiKey` is never written by the UI.
- Fix approach: single `resolveProviderRequest(config)` function that returns `{ url, headers, body }` per provider, plus a test matrix over all four providers.

**Attachments are sent in a non-standard body field:**

- Symptoms: providers that reject unknown top-level parameters (OpenAI) may return HTTP 400 for attachment-bearing requests; providers that ignore them silently lose the attachment.
- Files: `src/services/aiProvider.ts:359` adds top-level `attachments` to an OpenAI-shaped chat-completions body.
- Fix approach: convert attachments to provider-native content parts, or keep attachments proxy-only and document the contract.

**`np_theme` has two writers with two formats — cross-surface mode corruption:**

- Symptoms: toggling theme on one surface flips the other surface back to light ~300 ms later; on some shutdown paths the persisted theme resets to defaults on next load.
- Files: `src/core/theme/ThemeStore.ts:104-112` persists a JSON blob (`{"state":{...},"version":1}`) under `np_theme` via `syncStorageAdapter`; `src/core/theme/ThemeSync.ts:104-116` (`applyThemeToSync`) writes the raw string `"dark"|"light"|"auto"` to the same key. `src/core/theme/ThemeSync.ts:140-155` (`startThemeOnChangedSync`) casts `changes.np_theme.newValue` directly to `ThemeMode`, so the JSON blob from the peer's debounced persist is interpreted as a mode value. The hydration path then JSON.parses a raw mode string; zustand catches the parse error silently (`.catch` in `middleware.js` hydrate) and falls back to defaults, losing `colorTheme`/`pack`. `tests/core/theme/ThemeSync.test.tsx:104-124` codifies the raw-string contract, so tests pass while the two designs conflict.
- Impact: visible theme flapping across Side Panel/Standalone; loss of color-theme settings.
- Fix approach: pick one representation for `np_theme` (recommend JSON blob, since zustand owns the key); have `applyThemeToSync` write a `StorageChange`-shaped payload or funnel through `ThemeStore.setMode`; have `startThemeOnChangedSync` detect/ignore non-mode values; add a two-surface simulation test with the persisted blob shape.

**`WorkspaceStore.reset` shares module-level arrays:**

- Issue: `src/core/workspace/WorkspaceStore.ts:135-137` does `Object.assign(state, { ...initialState, workspaceId: ... })`, spreading the module-level `initialState` object, whose `pinnedTabs` array reference is reused across resets.
- Impact: latent state aliasing if any non-immer path mutates `pinnedTabs`; a future election/leader feature is the likely trigger.
- Fix approach: deep-copy or use a `createInitialState()` factory.

**`options_ui.open_in_tab` mismatch (see Tech Debt) is a user-visible config bug.**

## Security Considerations

**API keys and all user content are stored unencrypted in one `chrome.storage.local` blob:**

- Risk: any code with the `storage` permission (and any future add-on routed through this store) can read plaintext provider keys, every chat session, notes, and write history. The project's own security skill (`.opencode/skills/nowpilot-security-review/SKILL.md`) requires "API keys use approved encrypted storage; large bodies do not use Chrome local/sync".
- Files: `src/store/useExtensionStore.ts:522-544` (`name: 'np_store'`, `partialize` strips only `activeSession`/`activeAttachments`/`availableTabs`), `src/core/theme/chromeStorageAdapter.ts:126-158`, `src/types/index.ts:104-140` (keys live in `ProviderConfig`), `src/components/OnboardingModal.tsx:120-141` (key handed to `onComplete` → persisted).
- Current mitigation: `Input.Password` masked UI only; no encryption, no `chrome.storage.session`, no device-key derivation.
- Recommendations: store keys in `chrome.storage.session` (or encrypt with WebCrypto AES-GCM using a non-exportable key) and keep keys out of the persisted zustand blob; split large bodies (sessions/notes) out of the config blob.

**No sender/source/target validation on the message bus:**

- Risk: `MessageBus.dispatch` passes `sender` to handlers but never verifies `sender.id === chrome.runtime.id`, envelope `source`, or payload shape (`isEnvelope` in `src/core/runtime/RuntimeEnvelope.ts:64-75` checks only the four key names and type membership). `BackgroundRouter.ts:13-15` documents the requirement for future state-mutating handlers but no enforcement utility exists. The security skill requires checks that "fail closed".
- Files: `src/core/messaging/MessageBus.ts:14-70`, `src/core/messaging/BackgroundRouter.ts`, `src/core/runtime/RuntimeEnvelope.ts`.
- Current mitigation: only advisory `console.debug` handlers exist today; `PROXY_FETCH`/`EXTRACT_PAGE_CONTENT` handlers are not yet registered.
- Recommendations: add a `requireInternalSender(envelope, sender)` guard used by every handler; validate payloads with Zod (see dependency note) before mutation; add the sender-validation test the WXT skill requires.

**No redaction layer despite spec mandate:**

- Risk: `TraceRedactor` is referenced only in comments (`src/core/theme/chromeStorageAdapter.ts:152`, `src/components/chat/StructuredErrorCard.tsx`), and logs can carry raw provider/handler data: `src/core/messaging/MessageBus.ts:55` (`console.error('[MessageBus] handler errors:', errors)`), `src/services/aiProvider.ts:453` (`console.error('AI Stream Error:', err)`), `src/core/log/debugLog.ts:22` (200-entry ring buffer with arbitrary `context`).
- Files: `src/core/log/debugLog.ts`, `src/core/messaging/MessageBus.ts`, `src/services/aiProvider.ts`.
- Current mitigation: error strings are key-free by construction (checked in `src/services/aiProvider.ts:100-104, 363-367`).
- Recommendations: implement a redaction pass before `debugLog`/`console.*`/diagnostics export; broaden `StructuredErrorCard` usage (it exists but is only used in `src/components/chat/ChatMessageItem.tsx`) instead of appending raw `err.message` into assistant markdown (`src/components/chat/useChatStreaming.ts:88-90`).

**Extension CSP allows any localhost port:**

- Risk: `connect-src http://localhost:*` permits probing/using any local service from extension pages (SSRF-like surface), and — conversely — user-configured non-allowlisted proxy hosts are blocked because the policy is a fixed allowlist.
- Files: `wxt.config.ts:58-60`.
- Recommendations: narrow localhost to the documented proxy ports, or move provider proxying to the background service worker with a host-permission-reviewed allowlist; document the custom-proxy limitation in Options.

**`host_permissions` and content-script scope are in tension:**

- Risk: the manifest advertises ServiceNow-only host permissions (`wxt.config.ts:33-36`), while `entrypoints/content/core.content.ts:5` declares `matches: ['<all_urls>']` (spec § content-script example also uses `<all_urls>`). If the content-script bug is fixed naively, the shipped build gains DOM access to every page, contradicting the "privacy-first, least privilege" posture and the "DO NOT render UI in content scripts" rule.
- Recommendations: scope extraction `matches` to ServiceNow domains for v0.1 (or gate all-URLs injection behind optional permissions), and add a manifest-inspection test that asserts the approved permission/match set.

**BroadcastChannel messages are unauthenticated:**

- Risk: any same-extension page can `publish` a `WORKSPACE_HANDOFF` on `np_workspace` and drive the Side Panel into mirror mode; listeners swallow handler errors.
- Files: `src/core/runtime/BroadcastBus.ts:23-37`, `src/core/workspace/WorkspaceSync.ts`.
- Recommendations: include workspace/conversation IDs and validate them before applying handoff state; treat broadcast payloads as untrusted input.

**Dev servers bind to all interfaces:**

- Risk: `host: '0.0.0.0'` exposes the Vite dev harness to the LAN (and, in dev, the extension points at localhost proxies).
- Files: `vite.config.ts:8-14`, `wxt.config.ts:6-11`, `package.json:8-13`.
- Recommendations: bind `127.0.0.1` by default; make LAN binding an explicit opt-in.

## Performance Bottlenecks

**Whole-store serialization on every debounce window:**

- Problem: `useExtensionStore` persists the entire state (all sessions, messages, notes, prompts, config) as one JSON blob under `np_store`. Every streamed chunk triggers an immer set and schedules a full re-serialization; 300 ms trailing debounce caps frequency but not payload size, which grows with history.
- Files: `src/store/useExtensionStore.ts:238-257` (per-chunk mutation), `src/core/theme/chromeStorageAdapter.ts:14, 141-158`.
- Cause: single-blob persistence design; no IndexedDB (spec §20.4 is not implemented).
- Improvement path: move sessions/notes to IndexedDB with per-record writes; persist config separately; keep only lightweight UI state in the blob.

**Re-render amplification from streaming state:**

- Problem: each token updates `activeSession` (recomputed via `computeActiveSession` on every mutation), and subscribers re-render `ChatMessageList` → `ChatMessageItem` → `PortableMarkdown` for large message trees.
- Files: `src/store/useExtensionStore.ts:100-102, 238-257`, `src/components/chat/ChatMessageItem.tsx`, `src/components/chat/ChatMessageList.tsx`.
- Improvement path: memoize message items on `(id, content, isThinking)`, throttle UI updates (e.g., rAF batching) while streaming.

**Oversized components:**

- Problem: single-file components of 921–2,564 lines with heavy inline `.map` rendering.
- Files: `src/components/notes/NotesWorkspace.tsx` (2,564), `src/components/options/OptionsPage.tsx` (1,977), `src/components/history/ChatHistoryModal.tsx` (921), `src/components/options/PromptsOptionsTab.tsx` (831), `src/components/chat/ChatMessageItem.tsx` (626).
- Impact: change risk, re-render hotspots, no tests.
- Improvement path: extract list rows/panels into memoized subcomponents before adding features; add tests per extracted unit.

**Bundle size and suppressed warnings:**

- Problem: WXT build totals 2.04 MB; a 773.63 kB app chunk (`chunks/src-*.js`); `chunkSizeWarningLimit: 1500` in both `vite.config.ts:30` and `wxt.config.ts:13-21` silences Vite's warning instead of addressing size.
- Improvement path: audit antd/x imports for per-component imports, lazy-load Options/Notes surfaces, and remove unused dependencies (`zod`, `motion` — see Dependencies).

## Fragile Areas

**Theme synchronization (`np_theme` dual-writer):**

- Files: `src/core/theme/ThemeStore.ts`, `src/core/theme/ThemeSync.ts`, `src/core/theme/chromeStorageAdapter.ts`.
- Why fragile: two writers, two formats, one key; onChanged listener casts any value to `ThemeMode`; hydration failures are swallowed by zustand with no `onRehydrateStorage` hook.
- Safe modification: centralize writes through `ThemeStore`; treat `np_theme` as owned by zustand persist; add a two-surface test with the real blob shape before changing it.
- Test coverage: unit tests assert the conflicting raw-string contract (`tests/core/theme/ThemeSync.test.tsx`), which will mask real regressions.

**`chromeStorageAdapter` failure semantics:**

- Files: `src/core/theme/chromeStorageAdapter.ts:56-92, 141-171, 202-224`.
- Why fragile: write failures are logged only (`debugLog('STORAGE_DEBOUNCE_FLUSH_FAILED', ...)`); quota-exceeded or sync-throttle errors are invisible to callers. When `chrome.storage` is absent, writes fall back to `localStorage` (line 81/87), producing split-brain state between extension contexts and the dev shell. `removeItem` bypasses the debounce intentionally but can race a pending write for the same key.
- Safe modification: surface a callback/toast on flush failure; disable the localStorage fallback inside extension contexts; add quota handling.
- Test coverage: `tests/core/storage/chromeStorageAdapter.test.ts` covers debounce/target routing, not failure paths.

**`useWorkspaceStore` + `WorkspaceRouter` tab coordination:**

- Files: `src/core/workspace/WorkspaceStore.ts`, `src/core/workspace/WorkspaceRouter.ts`, `src/core/workspace/WorkspaceSync.ts`.
- Why fragile: `isPrimaryWriter()` always returns `true` (documented swap point), `openedStandaloneTabId` is persisted and can go stale after the tab closes, and `hydrateFromURL` trusts query params.
- Safe modification: implement election before any index/write engine gates on it; validate `workspaceId`/`conversationId` on hydration.
- Test coverage: `tests/core/workspace/WorkspaceRouter.test.ts` and `WorkspaceStore.test.ts` exist; tab-close/stale-id paths are untested.

**MessageBus initialization across service-worker wakeups:**

- Files: `src/core/messaging/MessageBus.ts:52-70`, `src/core/messaging/BackgroundRouter.ts:18-23`.
- Why fragile: idempotency relies on module-level booleans that reset on every SW wake; `onMessage` listener always returns `true`, keeping the channel open for every message; unknown envelope types are dropped without a response path other than `{ok:true}`.
- Safe modification: keep registration synchronous in `main()`; add explicit response contracts per message type before adding mutation handlers.
- Test coverage: `tests/background/background-router.test.ts`, `tests/background/message-bus-cold-start.test.ts` cover cold start; no test covers invalid envelopes or sender rejection.

**`ErrorBoundary` is never mounted:**

- Files: `src/core/components/ErrorBoundary.tsx`; entrypoints (`entrypoints/sidepanel/main.tsx`, `entrypoints/standalone/main.tsx`, `entrypoints/options/main.tsx`) render `ThemeProvider` without it.
- Impact: any render error in a 2,000-line surface blanks the whole side panel/standalone view.
- Safe modification: wrap each surface's root and add a fallback UI test.

## Scaling Limits

**`chrome.storage.local` quota (10 MB) with no `unlimitedStorage` permission:**

- Current capacity: all sessions, notes, write history, prompts, and config share the 10 MB local quota (`wxt.config.ts:28` permissions are exactly `sidePanel`, `storage`, `tabs`).
- Limit: note/session content is unbounded (`src/store/useExtensionStore.ts:415-519` appends with no cap); once the quota is hit, flush errors are swallowed and data silently stops persisting.
- Scaling path: IndexedDB for notes/sessions (spec §20.4), retention caps per surface, and surfaced quota errors.

**Request history is unbounded:**

- Current capacity: `useChatStreaming` sends every prior message in the session plus the current prompt (`src/components/chat/useChatStreaming.ts:68-74`), including injected error text.
- Limit: provider context windows; oversized payloads fail with 400/413 after a long session.
- Scaling path: token-budgeted trimming/summarization, per-provider limits, and a visible context indicator.

**Pinned tabs, model lists, and sessions have no hard caps** beyond `pinnedTabs.length < 10` (`src/core/workspace/WorkspaceStore.ts:118-126`).

## Dependencies at Risk

**`zod@^4.4.3` is declared but never imported:**

- Risk: spec requires Zod validation for add-on settings and message payloads; today there is no runtime schema validation anywhere.
- Impact: unused dependency masks the missing validation layer; payloads (envelopes, persisted blobs, add-on settings) are trusted as-is.
- Migration plan: either wire Zod at trust boundaries (envelope payloads, persisted-state migration, add-on settings) or remove the dependency until the owning phase lands.

**`motion@^12.23.24` is declared but never imported:**

- Risk: dead dependency; the design system bans framer-motion-style libraries in favor of CSS (spec §0.2).
- Impact: dependency/bundle hygiene; a future import would violate the Tailwind/CSS-only motion rule.
- Migration plan: remove from `package.json`.

**`@ant-design/x@2.9.0` + `antd@6.5.2` under `wxt@0.20.27`:**

- Risk: fast-moving major versions (antd v6, X 2.x) with peer ranges that are not pinned; XMarkdown's sanitization behavior comes from its own DOMPurify config, so an upgrade can change HTML handling silently.
- Impact: markdown rendering/XSS posture and theming tokens may shift on minor bumps.
- Migration plan: pin exact versions or use pnpm overrides; add a markdown sanitization regression test around `src/core/components/PortableMarkdown.tsx`.

**No CI pipeline:**

- Risk: no `.github/` (or other CI) exists; all gates are manual `pnpm` invocations.
- Impact: broken verify scripts and the missing content script can persist indefinitely.
- Migration plan: add a workflow running `pnpm lint`, `pnpm test`, `pnpm build:ext`, `bash scripts/verify-no-tailwind.sh`, plus a manifest-inspection step.

## Missing Critical Features

**Real provider-backed writing:** `src/components/standalone/StandaloneWritePage.tsx` never calls `streamChatResponse`; `streamChatResponse` is only reachable from `src/components/chat/useChatStreaming.ts` (Side Panel / Standalone Chat tab). Blocks: Write, Reply, and Regenerate features cannot be validated against a real provider.

**Content extraction pipeline:** Phase 6 services (`PageContentService`, `Defuddle` decision, `PAGE_HTML_PAYLOAD` handling) do not exist; the content script is not even registered (see Known Bugs). Blocks: page context, ServiceNow extraction, memory indexing.

**Redaction (`TraceRedactor`):** spec-mandated before logging/diagnostics/persistence/export; only comments exist. Blocks: release-gate and security-review passage.

**Encrypted key storage / session-storage tokens:** not implemented (`chrome.storage.session` unused). Blocks: security-skill compliance and enterprise review.

**Memory/Search/Notes engines:** `tests/core/memory`, `tests/core/search`, `tests/core/notes`, `tests/core/extraction`, `tests/core/context`, `tests/core/telemetry`, `tests/hooks` are all absent; Notes UI is a static prototype over `useExtensionStore.notes`.

**i18n runtime:** `src/core/i18n/strings.ts` is used only by dead pages; live surfaces hardcode English strings despite `config.language` in `src/store/useExtensionStore.ts:75`.

## Test Coverage Gaps

**Untested runtime surfaces (no tests at all):**

- What's not tested: streaming request assembly and SSE parsing (`src/services/aiProvider.ts`, streaming branch), `src/components/chat/useChatStreaming.ts`, `src/components/chat/SidepanelChat.tsx`, `src/components/notes/NotesWorkspace.tsx`, all `src/components/standalone/*`, `src/components/options/OptionsPage.tsx`, `src/components/options/PromptsOptionsTab.tsx`, `src/components/history/ChatHistoryModal.tsx`, `src/components/common/{ActionPanel,CommandPalette,ModelSelector,PromptManagerModal}` (ThemeToggle itself is covered via `tests/core/theme/ThemeSync.test.tsx`), `src/components/chat/{ChatComposer,TabContextSelector,StructuredErrorCard,ChatMessageList,ChatMessageItem}`.
- Files: above; only 18 test files exist for ~85 `src/` + 5 `entrypoints/` TypeScript files.
- Risk: the stream parser, duplicate-prompt, and Anthropic endpoint defects above are exactly the kind of bug existing tests cannot catch.
- Priority: High for `aiProvider` stream parsing and `useChatStreaming` request assembly; Medium for the large UI surfaces.

**Manifest/build output is untested:**

- What's not tested: generated `manifest.json` (permissions, hosts, `content_scripts`, `options_ui`), content-script bundle existence, bundle isolation under the real build (the isolation test only greps source for cross-surface imports and `fetch(` under `entrypoints/content/**`).
- Risk: the content-script defect and `open_in_tab` mismatch shipped through a passing test suite and a successful build.
- Priority: High — one small test reading `.output/chrome-mv3/manifest.json` after `wxt build` would have caught both.

**Verification-script gaps:**

- What's not tested: everything named in the failing/skipped `verify:phase-*` scripts (storage migrations, security, extraction/content, notes, telemetry/diagnostics, hooks, rich components, intent, addons, perf).
- Risk: phases can be marked verified without their suites existing; see Tech Debt.
- Priority: High — fix the scripts to fail loudly on missing suites before trusting phase verification.

---

*Concerns audit: 2026-09-20*
