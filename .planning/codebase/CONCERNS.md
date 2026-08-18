# Codebase Concerns

**Analysis Date:** 2026-08-18

## Tech Debt

**Simulated AI responses in production code:**
- Issue: Core "AI" features return canned, hardcoded text instead of calling a real model. Chat falls back to `simulateStreamResponse()` on ANY fetch failure or HTTP error; the Write/Reply generator in the standalone surface is 100% template strings behind a `setTimeout(600)`; message "regenerate" appends a hardcoded sentence; the Options "Test Connection" button is a 1s timer that always reports success.
- Files: `src/services/aiProvider.ts:101-217` (simulateStreamResponse), `src/services/aiProvider.ts:234,267,283` (fallback call sites), `src/components/standalone/StandaloneWritePage.tsx:154-179`, `src/store/useExtensionStore.ts:672-688` (`regenerateMessageInActiveSession`), `src/components/options/OptionsPage.tsx:240-257` (`handleCheckConnection`), `src/components/chat/useChatStreaming.ts:91-98`
- Impact: Out of the box the default config points at `http://localhost:12380/v1` (`src/store/useExtensionStore.ts:31`); when unreachable the user receives canned "critical thinking" / "Good morning to you too!" responses and real provider failures are masked as fake content. Users believe they are talking to an AI. Any phase that ships this is misleading and cannot be verified for correctness.
- Fix approach: Gate `simulateStreamResponse` behind an explicit dev/demo flag (e.g. `import.meta.env.DEV` + a `DEMO_MODE` config key); surface real errors (`onError` in `src/components/chat/useChatStreaming.ts:83`) instead of silently substituting content; implement real Write/Reply generation and regenerate through the provider; remove the fake connection test and call `fetchProviderModels`.

**Demo data baked into store defaults:**
- Issue: `INITIAL_SESSIONS` (6 ServiceNow demo conversations with hardcoded "critical thinking" content, fake incident INC001234, Unsplash image thumbnails), `INITIAL_WRITE_HISTORY` (3 items), and `INITIAL_NOTES` (5 ServiceNow notes with 2024 dates) ship to every first-time user because they are the zustand initial state.
- Files: `src/store/useExtensionStore.ts:84-318` (sessions), `src/store/useExtensionStore.ts:320-375` (write history), `src/store/useExtensionStore.ts:377-515` (notes)
- Impact: Real users install the extension and see someone else's fake conversation history, notes, and write history. Demo content pollutes persisted state and cannot be distinguished from user data.
- Fix approach: Make all three `INITIAL_*` arrays empty defaults; move the demo content to a separate "demo mode" module that seeds only when an explicit flag is set.

**Dead / unwired infrastructure (tested but unused):**
- Issue: A large set of core modules has tests but is never imported by any entrypoint or component. These are scaffolding for planned phases that is not wired into the runtime.
- Files: `src/core/messaging/MessageBus.ts` (no `init()` call anywhere), `src/core/runtime/RuntimeEnvelope.ts` (only used by MessageBus/tests), `src/core/runtime/OperationId.ts`, `src/core/runtime/PortReader.ts`, `src/core/runtime/workerState.ts`, `src/core/workspace/WorkspaceRouter.ts` (points at non-existent `app.html`), `src/core/workspace/WorkspaceSync.ts`, `src/core/events/EventBus.ts`, `src/core/input/KeymapRegistry.ts`, `src/core/log/debugLog.ts`, `src/core/registry/AddonRegistry.ts`, `src/core/registry/AddonSettingsStore.ts`
- Impact: Maintenance cost, confusion about the real messaging path (background.ts uses raw `chrome.runtime.onMessage` with ad-hoc message shapes, `entrypoints/background.ts:28`), and two parallel messaging architectures.
- Fix approach: Wire the MessageBus/RuntimeEnvelope path into `entrypoints/background.ts` and the surfaces (replacing raw listeners), or delete the unused modules and their tests. `WorkspaceRouter` must target `standalone.html` if kept.

**Dead UI / stubbed features presented as functional:**
- Issue: Tab Context Selector renders from `availableTabs` which is never populated anywhere (`src/store/useExtensionStore.ts:529,575` — always `[]`, reset on merge at `:946`); AgentPage is a placeholder; OnboardingWizard Step 6/7 MCP-tool and ServiceNow-permission switches mutate local state only; the AI Translator tool opens a modal but translation is a static sample preview; ToolsGridPanel tools have no behavior.
- Files: `src/components/chat/TabContextSelector.tsx`, `src/components/chat/PinnedTabsBar.tsx`, `src/components/pages/AgentPage.tsx:15-19` ("will be implemented in Phase 3 and Phase 7"), `src/components/common/OnboardingWizard.tsx:72-84` (mcpTools/snPermissions state), `src/components/options/OptionsPage.tsx:129-132` (sample translation strings), `src/components/standalone/ToolsGridPanel.tsx`
- Impact: The product premise — "contextual AI for ServiceNow" — is not implemented; the tab-context feature is a dead UI. Users see tools that do nothing.
- Fix approach: Either implement (populate `availableTabs` via `chrome.tabs.query` and wire extraction, `EXTRACT_PAGE_CONTENT` already exists as a message type) or remove the UI until implemented.

**Dual build systems and package-manager ambiguity:**
- Issue: The repo is simultaneously a WXT extension (`wxt.config.ts`, `entrypoints/`, `build:ext`/`dev:ext`) and a plain Vite web app (`vite.config.ts`, `src/main.tsx`, `index.html`, `dev`/`build`/`start`). `package-lock.json` is committed but `pnpm-lock.yaml` + `pnpm-workspace.yaml` are untracked; scripts run through either npm or pnpm with no documented canonical choice.
- Files: `wxt.config.ts`, `vite.config.ts`, `package.json`, `package-lock.json` (committed), `pnpm-lock.yaml` + `pnpm-workspace.yaml` (untracked)
- Impact: Non-reproducible installs, drift between the two configs (e.g. `chunkSizeWarningLimit: 1500` duplicated), and confusion about which artifact is canonical (`dist -> .output/chrome-mv3` symlink in repo root).
- Fix approach: Choose one build path per artifact (WXT for the extension, Vite only for the dev shell) and one package manager; commit a single lockfile and document it.

**Entire implementation is uncommitted:**
- Issue: `git ls-files` shows only 13 committed files (`.gitignore`, docs, `LICENSE`, `README.md`, `package-lock.json`). All of `src/`, `entrypoints/`, `tests/`, configs are untracked.
- Impact: Total loss of history, no rollback path, diff-based analysis and blast-radius tooling cannot see the implementation.
- Fix approach: Commit the implementation (and the tracking of `pnpm-lock.yaml`), excluding `.output/`, `dist/`, `.wxt/`.

**Stale verification scripts:**
- Issue: `package.json` `verify:phase-*` scripts reference test directories that do not exist.
- Files: `package.json:16-28` vs. existing `tests/` tree (`tests/core/{commands,events,runtime,theme,workspace}`, `tests/isolation`)
- Impact: `verify:phase-2`/`3`/`4`/`4a`/`5`/`5a`/`6`/`7`/`8` immediately fail (vitest "no test files found" / missing dirs `tests/core/storage`, `tests/core/ai`, `tests/core/context`, `tests/hooks`, `tests/components`, `tests/perf`, etc.).
- Fix approach: Regenerate the verify scripts from the tests that actually exist, or add the missing test suites.

**Unused Chrome permissions:**
- Issue: Manifest declares 9 permissions; only `sidePanel`, `storage`, `tabs` are referenced in code. `cookies`, `alarms`, `scripting`, `contextMenus`, `notifications`, `declarativeNetRequest` are unused (0 references).
- Files: `wxt.config.ts:31-45` (manifest.permissions), verified 0 usages of `chrome.cookies/alarms/scripting/contextMenus/notifications/declarativeNetRequest` across `src/` + `entrypoints/`
- Impact: Review burden and user-privacy red flags for a "privacy-first" extension; least-privilege violation.
- Fix approach: Trim the manifest to used permissions; add them back only with the features that need them.

**Template/scaffold leftovers:**
- Issue: Google AI Studio scaffolding remnants: `index.html` title "My Google AI Studio App"; `metadata.json` `majorCapabilities: ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`; dev-shell header Tag "Default AntD v6 & X" in `src/main.tsx:140`.
- Files: `index.html:6`, `metadata.json:5`, `src/main.tsx:140`
- Impact: Unprofessional artifacts visible to users/reviewers; confusing signals about platform intent.
- Fix approach: Remove or rename during cleanup.

**Duplicate theme state with drift risk:**
- Issue: Theme mode lives in both `useExtensionStore.config.themeMode` and `useThemeStore.mode`; `updateConfig` writes one and manually mirrors the other (`src/store/useExtensionStore.ts:578-588`). `ThemeStore.applyThemeDom` and the `useThemeSync` effect apply the same DOM mutation twice.
- Files: `src/store/useExtensionStore.ts:578-588`, `src/core/theme/ThemeStore.ts:18-33`, `src/core/theme/ThemeSync.ts:52-62`
- Impact: Two sources of truth that can diverge (e.g. options page writes config directly vs. ThemeToggle writes the theme store); redundant DOM writes.
- Fix approach: Make `useThemeStore` the single source of truth for theme; drop `themeMode` from the extension store or treat it as read-only mirror.

**Vestigial i18n:**
- Issue: `src/core/i18n/strings.ts` defines a string dictionary and `t()` but nearly all UI strings are hardcoded English; `t()` is used in only a handful of files (e.g. `src/components/pages/AgentPage.tsx`).
- Impact: i18n scaffolding gives false confidence; adding locales later is a full rewrite of every component.
- Fix approach: Either adopt `t()` throughout components or remove the module.

## Known Bugs

**Real provider streaming produces empty responses:**
- Symptoms: Chat returns nothing (or only the canned fallback) when pointed at real OpenAI/Anthropic/Gemini endpoints.
- Files: `src/services/aiProvider.ts:303-335`
- Trigger: The SSE parser only reads `data.textChunk` / `data.thoughtChunk` fields — a custom proxy format. Real OpenAI SSE emits `choices[].delta.content`; Gemini `streamGenerateContent` emits `candidates[].content`; neither matches, so `onDone` fires with empty text. The `[DONE]` branch is the only recognized terminator.
- Workaround: Use the local proxy at `localhost:12380` that emits the custom format.
- Fix approach: Parse standard OpenAI SSE (`data: {"choices":[{"delta":{"content":"..."}}]}`) and provider-specific formats; keep `textChunk`/`thoughtChunk` as an extension, not the only path.

**Claude provider never uses its own endpoint:**
- Symptoms: Selecting Anthropic/Claude still requests `openAiBaseUrl` (default `http://localhost:12380/v1`) and sends a Bearer header instead of `x-api-key`.
- Files: `src/services/aiProvider.ts:91-99` (`buildEndpointUrl` only special-cases gemini; all non-gemini providers share `openAiBaseUrl`), `src/services/aiProvider.ts:248-265` (only `config.openAiKey`/Bearer)
- Trigger: Set `activeProvider: 'claude'` with a Claude API key in `config.providers.claude.apiKey`.
- Workaround: None — Claude requests never reach `api.anthropic.com`.
- Fix approach: Route by `activeProvider`, apply provider-specific base URLs and auth headers (x-api-key + `anthropic-version` for Claude).

**Gemini integration is non-functional as implemented:**
- Symptoms: Gemini requests use an OpenAI-shaped body (`messages`, `stream`) against `streamGenerateContent`, which expects `contents`; the API key is appended to the URL query string.
- Files: `src/services/aiProvider.ts:92-96` (URL with `?key=`), `src/services/aiProvider.ts:249-264` (request body/headers)
- Trigger: Enable Gemini and send a message.
- Workaround: None.
- Fix approach: Use the Gemini `contents`/`generateContent` schema, move the key to a header if supported, and parse the Gemini SSE shape. Never put keys in query strings (they leak into proxies/logs).

**Connection test always succeeds:**
- Symptoms: "Test Connection" / "Connection verified successfully!" reports success even when the endpoint is unreachable or the key is invalid.
- Files: `src/components/options/OptionsPage.tsx:240-257` (1s `setTimeout`, no request), `src/services/aiProvider.ts:65-88` (on failure `fetchProviderModels` returns hardcoded fallback models, so `OnboardingWizard.handleTestConnection` at `src/components/common/OnboardingWizard.tsx:112-119` always sets `connectionTested=true`)
- Trigger: Enter a bogus endpoint/key and click test.
- Workaround: None.
- Fix approach: Make the test await a real `GET /models` (or equivalent) and report `resp.ok`/error status.

**Version switching overwrites the streamed version:**
- Symptoms: During a stream, `updateLastAssistantMessage` writes appended chunks to `versions[curIdx]` where `curIdx = currentVersionIndex`. If the user switched versions mid-generation, the new chunks overwrite the displayed (older) version rather than the one being generated.
- Files: `src/store/useExtensionStore.ts:651-670` vs `:690-703` (`switchMessageVersion`)
- Trigger: Switch to a previous version while a regeneration stream is running.
- Workaround: Avoid switching versions while streaming.
- Fix approach: Track the generating version index explicitly (a `streamingVersionIndex`) and write chunks to it.

**"Share" mislabels clipboard copy:**
- Symptoms: `onShare` copies the message text to the clipboard but the toast says "Link copied to clipboard".
- Files: `src/components/chat/SidepanelChat.tsx:327-330`
- Trigger: Click the share action on any message.
- Fix approach: Either generate a real share link or change the message to "Message copied to clipboard".

**Screen-capture attachment is fake:**
- Symptoms: "Screen cut" waits 1s then attaches a hardcoded Unsplash image as `screen_cut`.
- Files: `src/components/chat/SidepanelChat.tsx:227-238`
- Trigger: Click the screen-cut button in the composer.
- Fix approach: Implement real capture via `chrome.tabs.captureVisibleTab` + `scripting` (which is why the permission should exist) or remove the button.

**Empty assistant placeholder sent to the provider:**
- Symptoms: The freshly-added empty assistant message is included in the message history sent to the provider.
- Files: `src/components/chat/useChatStreaming.ts:68` (`activeSession?.messages` includes the empty placeholder from `:44-59`)
- Trigger: Send any message with a real provider.
- Fix approach: Build history as `messages.filter(m => m.content)` or exclude the last assistant placeholder.

**Vacuous isolation test:**
- Symptoms: `tests/isolation/cross-entrypoint-imports.test.ts` greps for `components/app/` and `components/sidepanel/` directories that do not exist, so all three assertions always pass.
- Files: `tests/isolation/cross-entrypoint-imports.test.ts:5-39`
- Trigger: Run the test suite; the guard gives false confidence.
- Fix approach: Point the greps at the real surface dirs (`src/components/chat/`, `src/components/standalone/`, `src/components/options/`) and assert no cross-imports.

**Onboarding auto-advances on a timer:**
- Symptoms: Step 4 of the wizard advances to step 5 after 10s regardless of user input or completion.
- Files: `src/components/common/OnboardingWizard.tsx:99-108`
- Fix approach: Advance only on explicit "Next" or successful connection test.

## Security Considerations

**API keys stored plaintext in extension storage:**
- Risk: `ProviderConfig` (including `apiKey`, `geminiKey`, `openAiKey`) is persisted by zustand `persist` into `chrome.storage.local` as part of the `np_store` JSON blob, unencrypted; also duplicated at top-level `config.openAiKey`/`config.geminiKey`.
- Files: `src/store/useExtensionStore.ts:20-82,935-948`; `src/core/theme/chromeStorageAdapter.ts:14-20`
- Current mitigation: `partialize` excludes only runtime fields (`activeSession`, `activeAttachments`, `availableTabs`) — API keys ARE persisted.
- Recommendations: Store provider secrets separately (e.g. dedicated keys), add an options-page visibility toggle (already exists for the modal), consider a master-password/OS-keychain flow for v0.2, and never log config.

**Gemini API key exposed in URL query string:**
- Risk: `?key=${apiKey}` appears in the request URL and can be captured by proxies, caches, or the tab's network panel; the key is also rendered in the URL even in error paths.
- Files: `src/services/aiProvider.ts:31,95`
- Current mitigation: HTTPS-only endpoints in the CSP (`wxt.config.ts:65`).
- Recommendations: Use an `Authorization`/`x-goog-api-key` header where the API allows it; otherwise keep query-string keys only for Gemini's documented requirement and strip from logs.

**Unused broad permissions requested by the manifest:**
- Risk: `cookies`, `tabs`, `scripting`, `declarativeNetRequest`, `contextMenus`, `notifications`, `alarms`, plus `host_permissions` for `*://*.service-now.com/*` and `*://support.servicenow.com/*` are declared even though only `sidePanel`/`storage`/`tabs` are exercised. Store-review and user-trust risk for a privacy-focused extension; any future bug in these modules inherits broad capability.
- Files: `wxt.config.ts:31-45`
- Current mitigation: None beyond code not using them.
- Recommendations: Remove unused permissions; add `scripting`/`captureVisibleTab` only when the screen-capture feature is actually implemented.

**AI response / prompt-injection surface:**
- Risk: Page content (from `Attachment`/quoted text and tab context) is forwarded to LLM providers (`src/services/aiProvider.ts:255-263`); a malicious page can prompt-inject. Rendered markdown goes through `@ant-design/x-markdown` (`src/core/components/PortableMarkdown.tsx:12`) — confirm it sanitizes raw HTML (no `dangerouslySetInnerHTML` bypass) before shipping.
- Files: `src/services/aiProvider.ts:255-263`, `src/core/components/PortableMarkdown.tsx`
- Current mitigation: `XMarkdown` is the only renderer in use; no direct `dangerouslySetInnerHTML` found.
- Recommendations: Sanitize provider output before rendering; treat page-derived content as untrusted input; consider a system-prompt boundary instruction.

**External image hotlinks in a privacy-first extension:**
- Risk: Hardcoded `images.unsplash.com` URLs are used as attachment fallbacks, causing outbound requests to a third party and demonstrating that "screen shots" are fake.
- Files: `src/components/chat/ChatMessageItem.tsx:99`, `src/components/chat/SidepanelChat.tsx:234`, `src/store/useExtensionStore.ts:174`
- Recommendations: Remove the Unsplash fallbacks; never display a stock photo as if it were the user's capture.

## Performance Bottlenecks

**Full-store re-serialization on every streamed chunk:**
- Problem: Every chunk triggers `updateLastAssistantMessage` → zustand set → `persist` serializes the entire `np_store` (sessions, notes, write history, prompts) to JSON and writes it all to `chrome.storage.local` — multiple times per second during streaming.
- Files: `src/store/useExtensionStore.ts:651-670`, `src/core/theme/chromeStorageAdapter.ts:14-20`
- Cause: Zustand persist has no per-slice granularity or debounce; the adapter writes the full blob per set.
- Improvement path: Debounce/throttle persistence during streaming (flush on `onDone`/`onError`), or migrate to a key-per-entity storage layout (`chrome.storage.local` per session/message) so only deltas are written.

**`chrome.storage.local` quota as chat/notes grow:**
- Problem: Default `chrome.storage.local` quota is ~10MB (unlimited storage requires a permission). Unbounded sessions + notes + write history in one key will exceed it; `setItem` throws `QUOTA_BYTES` errors that are unhandled in the adapter.
- Files: `src/store/useExtensionStore.ts:935-948`, `src/core/theme/chromeStorageAdapter.ts:14-20`
- Improvement path: Add `unlimitedStorage` permission (privacy tradeoff), or cap/evict old sessions and move large notes to per-key storage with quota handling.

**Content script MutationObserver overhead on every page:**
- Problem: `content.core.ts` attaches a `subtree: true` MutationObserver on `<all_urls>` and runs `detectNavigation()` (a URL comparison) on every DOM mutation, on every page the user visits.
- Files: `entrypoints/content.core.ts:25-32`
- Cause: `MutationObserver` with `subtree` fires on all descendant changes; each callback does at least a string compare; on DOM-heavy sites this is a constant cost.
- Improvement path: Only run on the extension's target domains (`matches` for service-now.com), use `history`-patch/popstate detection, and compare via a cheap cached URL check with a guard (ignore empty mutations).

**Large monolithic source files:**
- Problem: Component/store files exceed 1000 lines, concentrating complexity and diff churn in single files.
- Files: `src/components/notes/NotesWorkspace.tsx` (1140), `src/components/options/OptionsPage.tsx` (1063), `src/components/common/OnboardingWizard.tsx` (1006), `src/store/useExtensionStore.ts` (951), `src/components/options/PromptsOptionsTab.tsx` (574), `src/components/options/defaultPromptsData.ts` (531)
- Improvement path: Split the god-store into slice stores (config, sessions, notes, prompts, writeHistory) and split the 1000-line components into subcomponents/hooks.

**`any` usage and loose typing:**
- Problem: 33 occurrences of `as any`/`@ts-ignore`/`@ts-expect-error` plus `tsconfig` `strict: false`; `wxt.config.ts` casts the tailwind plugin `as any`.
- Files: `src/components/options/OptionsPage.tsx`, `src/core/runtime/BroadcastBus.ts` (`event.data as any`), `tsconfig.json:8` (`strict: false`), `wxt.config.ts:15`
- Improvement path: Enable `strict`, type the plugin via `defineConfig` typing, and replace `any` casts with real types (e.g. `MessageEvent<ThemeSyncMessage>`).

## Fragile Areas

**`useExtensionStore` persist merge without schema versioning:**
- Files: `src/store/useExtensionStore.ts:935-948`
- Why fragile: `merge` does `{ ...current, ...(persisted) }` shallow merge with no `version`/`migrate` in the persist config. Any shape change to `sessions`, `notes`, `prompts`, or `config` silently breaks or corrupts existing users' stored state on upgrade (e.g. the current demo-data arrays are already frozen into every existing install).
- Safe modification: Add `version` + `migrate` functions now, before any real users; on schema changes provide migrations rather than relying on defaults.
- Test coverage: None — no test exercises persistence round-trip or migration.

**SSE parsing coupled to a custom proxy format:**
- Files: `src/services/aiProvider.ts:303-335`
- Why fragile: Parser assumes `data: {textChunk, thoughtChunk}` from a private proxy; any provider change breaks it silently (empty responses, see Known Bugs). Chunk boundaries are line-based; CRLF, keep-alive `:` comments, and partial JSON across lines are not handled robustly.
- Safe modification: Extract parsing into a small pure function (unit-testable) handling OpenAI + Gemini SSE; keep the custom format as an optional extension.
- Test coverage: None — `aiProvider.ts` has no tests.

**Background messaging has two parallel paths:**
- Files: `entrypoints/background.ts:28-34` (raw `chrome.runtime.onMessage` for `CONTENT_SCRIPT_READY`/`SPA_NAVIGATION`), `src/core/messaging/MessageBus.ts` (envelope dispatcher, never initialized)
- Why fragile: A future contributor may add a handler to `MessageBus` and expect background to receive it — it won't; or extend the raw listener and break `isEnvelope`'s fixed `MessageTypeValues` list (`src/core/runtime/RuntimeEnvelope.ts:1-10`).
- Safe modification: Pick one path; if keeping MessageBus, call `init()` in background and register the content-script message types.

**`BroadcastBus` silently swallows handler errors:**
- Files: `src/core/runtime/BroadcastBus.ts:25-37`
- Why fragile: Listener exceptions are caught and dropped, so a broken cross-surface sync (theme, workspace) fails invisibly; the same file uses an `any` cast for `_sender`.
- Safe modification: Log swallowed errors (respecting `no-console` rules via `debugLog`), and type the payload.

**Hardcoded Unsplash/demo content across UI:**
- Files: `src/components/chat/ChatMessageItem.tsx:99`, `src/components/chat/SidepanelChat.tsx:234`, `src/store/useExtensionStore.ts:174`
- Why fragile: Removing or renaming the assets/URLs or switching to real captures breaks the fallback path; the stock-photo placeholder is visually indistinguishable from real captures.

**Vacuous arch-guard test gives false confidence:**
- Files: `tests/isolation/cross-entrypoint-imports.test.ts`
- Why fragile: Greps non-existent directories; refactors that break real entry-point isolation would not be caught.
- Safe modification: Point at the real directories and assert both directions per surface.

## Scaling Limits

**Storage growth:**
- Current capacity: Single `np_store` key in `chrome.storage.local` (default ~10MB) holding all sessions/notes/prompts/write-history; full blob rewritten on each state change.
- Limit: A few large chat sessions or notes exceed the quota; `chrome.storage.local.set` rejects with an unhandled `QUOTA_BYTES` error.
- Scaling path: Per-entity keys, eviction of old sessions, and/or `unlimitedStorage`; debounced persistence.

**Cross-surface writes:**
- Current capacity: Sidepanel, standalone tab, and options each hold their own zustand instance writing the same `np_store` key.
- Limit: Last-writer-wins races; two surfaces writing concurrently can lose updates (no `chrome.storage.onChanged` merge on this store).
- Scaling path: Subscribe to `chrome.storage.onChanged` in each surface and reconcile, or move authoritative state to the background service worker.

**Streaming throughput:**
- Current capacity: ~40ms interval fake-stream default; real streams write every chunk to storage (see Performance).
- Limit: With long sessions, per-chunk full-store writes add visible latency/UI jank and eventually quota failures.
- Scaling path: Persist only on stream end; render from in-memory store during the stream.

## Dependencies at Risk

**`@ant-design/x-markdown` (^2.8.0):**
- Risk: Newer library family (Ant Design X); rendering behavior, security posture (raw HTML), and API are still stabilizing.
- Impact: Markdown rendering (all assistant messages) depends on it; breaking changes or sanitization gaps directly affect the chat surface.
- Migration plan: Pin exact versions; add a sanitizer around output; keep a fallback plain-markdown renderer if it proves unstable.

**`antd` v6 (^6.5.2) + `@ant-design/x` (^2.8.0):**
- Risk: Major-version churn across AntD v5→v6 recently completed (git log `0951cb4`); v6 CSS-in-JS and component APIs are recent.
- Impact: Full UI layer is coupled to antd v6 tokens/components; a forced migration is costly.
- Migration plan: Pin versions, upgrade deliberately, and use the existing theme abstraction (`src/theme/index.ts`) as the seam.

**`wxt` (^0.20.27):**
- Risk: Fast-moving framework; config/manifest generation changes frequently; `vite` plugin cast as `any` in `wxt.config.ts:15`.
- Impact: Build/extension packaging depends on it.
- Migration plan: Keep WXT pinned; validate `wxt build` output in CI.

**Unpinned transitive surface / dual lockfiles:**
- Risk: Caret ranges throughout `package.json`; `package-lock.json` committed while `pnpm-lock.yaml` is not — installs are not reproducible across environments.
- Impact: Build drift and inconsistent dependency sets.
- Migration plan: Commit exactly one lockfile (and make it the canonical install path via a documented engine/packageManager field).

## Missing Critical Features

**Real page/tab context extraction (the product premise):**
- Problem: No code extracts ServiceNow page content or populates tab context; `availableTabs` is always empty and `content.core.ts` only detects navigation. `EXTRACT_PAGE_CONTENT` exists as a message type but has no handler (`src/core/runtime/RuntimeEnvelope.ts:3`).
- Blocks: Context-aware answering, quoting live page content, "Summarize this ticket", and every ServiceNow workflow demo.
- Related: `entrypoints/content.core.ts:7-8` explicitly "extraction only — no UI rendering"; no extraction logic is present.

**Functional AI streaming for OpenAI/Gemini/Claude:**
- Problem: Only the custom localhost proxy format works (see Known Bugs); default install silently returns canned responses.
- Blocks: Any real-world use without a self-hosted proxy.

**Write/Reply, regenerate, translate, screen-capture, agent:**
- Problem: Write/Reply generation is hardcoded templates (`src/components/standalone/StandaloneWritePage.tsx:154-177`); regenerate is a canned sentence; translate is a static sample preview; screen-capture attaches a stock photo; AgentPage is a placeholder.
- Blocks: The advertised "All-in-one AI assistant" tooling.

**Workspace/conversation handoff between surfaces:**
- Problem: `WorkspaceSync`/`WorkspaceRouter` are dead code; no `np_workspace` BroadcastChannel wiring; opening the standalone tab does not share conversation state beyond the shared persisted store.
- Blocks: "Open in Full Tab → continue the same conversation" flow is not actually coordinated.

## Test Coverage Gaps

**Core application logic (highest priority):**
- What's not tested: `useExtensionStore` (951 lines: actions, persist/merge, version switching, session CRUD), `aiProvider` (SSE parsing, fallbacks, model discovery), `useChatStreaming`, chat send/stop/abort.
- Files: `src/store/useExtensionStore.ts`, `src/services/aiProvider.ts`, `src/components/chat/useChatStreaming.ts`
- Risk: The bugs listed above (empty streaming, fake regeneration, version-overwrite) ship undetected.
- Priority: High

**UI components:**
- What's not tested: SidepanelChat, ChatComposer, ChatMessageItem, NotesWorkspace (1140 lines), OptionsPage (1063 lines), OnboardingWizard (1006 lines), export flow, write generation.
- Files: `src/components/**`
- Risk: Behavioral regressions and dead-UI states (e.g. tab context) go unnoticed.
- Priority: High

**Persistence and migrations:**
- What's not tested: `chromeStorageAdapter` round-trip, quota errors, `np_store` merge against old/partial persisted data, schema migrations.
- Files: `src/core/theme/chromeStorageAdapter.ts`, `src/store/useExtensionStore.ts:935-948`
- Risk: Upgrade breaks for existing stored state.
- Priority: Medium

**Isolation guard is vacuous:**
- What's not tested: Real cross-surface import isolation (see Known Bugs — the current test greps non-existent dirs).
- Files: `tests/isolation/cross-entrypoint-imports.test.ts`
- Risk: False confidence in architectural boundaries.
- Priority: Medium

**Coverage enforcement:**
- What's missing: No coverage thresholds (`vitest.config.ts` has none); total suite is 9 files / 56 tests, all on core-infra modules (several of which are dead code) and theme.
- Risk: The suite passing says little about product behavior.
- Priority: High

---

*Concerns audit: 2026-08-18*