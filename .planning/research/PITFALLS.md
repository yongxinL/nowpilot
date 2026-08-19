> **⚠ PRECEDENCE NOTICE (added 2026-08-19).** Where this document conflicts with `.planning/PRODUCT_SPEC_v0_1.md`, **the spec wins** unless an ADR says otherwise. Several mitigations here add NEW scope beyond the spec (six-layer injection defense incl. dual-LLM quarantine, alias index, reserve-before-call budgets, CAS filesystem writes, ServiceNow-aware tokenizer). Each is registered with a `REQ-*` ID and a `consistent/augments/conflicts §X` tag in **`RESEARCH-RECONCILIATION.md`** — do not treat any mitigation here as authoritative until it appears there. Single-source/forward-dated claims (arXiv figures, CVE-2026-30830) are flagged `VERIFY-AT-IMPLEMENTATION` in the reconciliation doc.

# Pitfalls Research

**Domain:** Privacy-first Chrome MV3 AI assistant + local-first personal knowledge platform (ServiceNow Support Engineers)
**Researched:** 2026-08-19
**Confidence:** MEDIUM (cross-checked: Chrome official docs, Obsidian official help/forums, OWASP/Microsoft security guidance, arXiv/industry post-mortems; single-source claims flagged LOW)

> **Scope note:** This file covers **ecosystem-level failure modes** — the mistakes Chrome MV3 AI-assistant extensions and local-first knowledge tools make in the wild. The product spec already documents its own runtime edge cases (§19 Runtime Edge Cases, §20 Runtime State Models), security posture (§16), and trust-aware context (§28.3); those are NOT re-listed here. Where the spec covers a topic thinly, this file adds the ecosystem depth the spec under-specifies, cross-referenced by phase. Findings already confirmed in this codebase (CONCERNS.md) are flagged.

## Critical Pitfalls

### Pitfall 1: Service worker suspension silently kills AI streams — and every wake is a cold start

**What goes wrong:**
The extension's MV3 service worker is terminated ~30s after the last event, and a single event-handler invocation has a 5-minute wall-clock hard cap. A pending `fetch()` to an AI provider does **not** keep the worker alive (15–30s observed in the wild; the w3c/webextensions issue tracker documents local-inference extensions being killed mid-generation). The failure is **silent truncation**: the caller's `chrome.runtime.sendMessage()` promise times out, no error arrives, no partial result is delivered — the feature "just stops working." Worse, when Chrome restarts the worker on the next event, it is a **fresh execution**: every top-level variable, in-memory counter, and cache is gone.

**Why it happens:**
MV3 replaced persistent background pages with event-driven workers for memory efficiency. Developers port MV2 background-page habits (top-level state, `setInterval` timers, `setTimeout` for delayed work) directly into the worker. `setInterval` heartbeats and `localStorage` writes do NOT prevent termination — only `chrome.*` events and API calls reset the idle timer. Even the "well-known" port/offscreen tricks have caveats: alarms fire at ~1-minute granularity, ports die when the popup closes or the content-script page navigates, and offscreen documents (the most robust host) are limited to one per extension and can still be closed under memory pressure. Chrome DevTools being open hides the entire class (it keeps the worker alive), so it never reproduces locally.

**How to avoid:**
- Never run the AI stream inside the service worker. Stream from the side panel / Standalone view (extension origin pages) or an offscreen document; the SW only brokers start/stop/abort. (Spec §19.6 already mandates streams live in surfaces — extend this to ALL long operations, not just chat.)
- Design for cold start: register all listeners **synchronously at top level** (no `await` before the listener block); persist any state that must survive in `chrome.storage`; treat every wake as fresh.
- Use `chrome.alarms` (not `setInterval`/`setTimeout`) for anything time-based; checkpoint progress to storage before yielding.
- Test with DevTools **closed** and the worker forced idle; assert the worker survives a 60s+ stream.

**Warning signs:**
- Streams >30–60s randomly die with no error in the console.
- Features work in dev (DevTools open) but "randomly" fail in production.
- Top-level variables are empty on message arrival (cold-start race).
- Alarms/`setInterval`-based polling stops after ~30s of inactivity.

**Phase to address:**
Phase 1 (runtime: listener registration, no-SW-state discipline) and Phase 3 (AI runtime: stream hosting location, resume/abort contract). Verify in Phase 19 hardening with a forced-idle kill test.

---

### Pitfall 2: chrome.storage write-rate limits and quotas cause **silent data loss** — per-chunk full-store persistence is the classic vector

**What goes wrong:**
`chrome.storage.local` has a ~10MB default quota (lifted by `unlimitedStorage`) **and** a ~120 writes/min rate limit per item that **silently drops writes** when exceeded — no error, no exception. `chrome.storage.session` has a hard 10MB cap that `unlimitedStorage` does NOT lift, and it is wiped on browser restart / extension update / reload. Exceeding any quota rejects the write; the rejection is usually ignored (`runtime.lastError` unchecked). The canonical victim pattern: an AI chat app persists the entire store to `chrome.storage.local` on every streamed token — multiple writes per second — exceeding the rate limit and quota, so conversations and notes silently stop persisting. **This codebase already ships this exact pattern** (`useExtensionStore` full-blob re-serialization per chunk; unhandled `QUOTA_BYTES` in the storage adapter — CONCERNS.md Performance).

**Why it happens:**
Zustand-persist-style "whole store under one key, write on every set" is the fastest way to ship persistence, and it works fine at dev scale with few messages. `chrome.storage` docs list quotas/rate limits in prose, not in the API surface, so failures are invisible until a user's data doesn't survive a restart. Developers also conflate `session` (memory-backed, wiped on update) with `local` (persistent).

**How to avoid:**
- Persist only on stream end / debounced (flush on `onDone`/`onError`), never per chunk. Render from in-memory store during the stream.
- Adopt a per-entity key layout (`session-<id>`, `note-<id>`) so writes are delta-sized, or graduate to IndexedDB (~60% of disk, no published rate limit) for notes/sessions; keep `chrome.storage` for config + coarse checkpoints.
- Add a storage adapter that catches `runtime.lastError`/rejections, counts writes/min, and surfaces a `STORAGE_QUOTA` / `STORAGE_RATE_LIMIT` error code to diagnostics instead of swallowing it.
- Decide storage-class policy once: `local` = durable user data, `session` = in-progress stream state + tokens (wiped on update — never store anything valuable there), `sync` = tiny prefs only (100KB total / 8KB per item).

**Warning signs:**
- Data missing after browser restart / extension reload despite "persisted" state.
- `chrome.storage.local` fills toward the 10MB ceiling (audit in `chrome://extensions` → Inspect → Storage).
- Multiple `set` calls per second during streaming.
- Unhandled `QUOTA_BYTES` or `MaxWriteOperationsPerHour` errors in console.

**Phase to address:**
Phase 2 (storage/security/WriteJournal/persistence — the phase that defines the storage architecture) with a quota/rate-limit-aware adapter; Phase 3 streaming flush discipline. Verify in Phase 19 with a large-session soak test.

---

### Pitfall 3: The extraction content script cannot call AI providers — page CORS/CSP cages it (the "relay" requirement)

**What goes wrong:**
Since Chrome 85, content scripts are subject to the **page's** CORS rules and the page's `connect-src` CSP. An extraction content script on `service-now.com` that tries to `fetch()` `api.openai.com` fails even with broad `host_permissions`, because the request carries the page origin and must satisfy the provider's CORS. On pages with strict `connect-src` (ServiceNow portals and enterprise pages often set them), all external fetches from the content script are blocked outright. The converse trap: extension **pages** (popup/options/side panel/SW) bypass CORS for declared host permissions, but only if the host is in `host_permissions` — a missing host permission produces a confusing CORS-looking error from the SW context too. Additional SW constraint: no `XMLHttpRequest`, and ReadableStream request bodies are unsupported in some Chrome versions.

**Why it happens:**
The old MV2 mental model ("content scripts can fetch anything the manifest permits") still dominates tutorials and boilerplate. The extraction-only architecture (spec: content scripts never touch AI) makes the correct pattern — content script extracts → message → surface fetches → streams back — but the messaging hop introduces Pitfall 4's races, so teams "simplify" by fetching from the content script and break in production.

**How to avoid:**
- Hard rule: content scripts never fetch. Extraction returns **data only**; provider calls happen in the side panel/Standalone (extension origin) — which this spec's architecture already mandates. Enforce with an arch test that greps for `fetch(` inside content-script entrypoints (the existing isolation tests are vacuous — CONCERNS.md — make them real).
- List every provider base URL (`api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, Ollama host, user-configured custom endpoints) in `host_permissions`; for user-entered custom base URLs use `optional_host_permissions` + `chrome.permissions.request` at configuration time (also a Web Store review concern — Pitfall 15).
- Validate messages from content scripts (treat them as attacker-controllable per Chrome guidance) and never let them specify arbitrary fetch URLs (open-proxy pattern → data exfiltration).
- Keep the extension's own `content_security_policy.extension_pages` tight (`connect-src` explicit); MV3 forbids remote code/eval — no `eval`, no remote script tags, and any remote config fetched must contain data, not logic.

**Warning signs:**
- CORS errors originating from a content script in production.
- Fetches work on some sites and fail on others (page-CSP-driven).
- A user-configured custom LLM endpoint fails while built-in providers work (missing host permission).

**Phase to address:**
Phase 1 (manifest `host_permissions` + CSP baseline) and Phase 6 (PageContentService extraction boundary — relay contract). Phase 17 add-on content-script runtime must inherit the same rule.

---

### Pitfall 4: Message-channel races — the channel closes, the cold start eats the message, and the response is `undefined`

**What goes wrong:**
`chrome.runtime.sendMessage()` closes the channel at the end of the **synchronous** listener tick unless the listener `return true` (or, only from Chrome 148, returns a promise). An `async` listener that forgets to `return true` silently produces `undefined` responses. When the SW is terminated mid-async-work, the sender gets "The message port closed before a response was received" — a **non-error** (`undefined`) from the caller's perspective. Separate cold-start race: a message wakes the SW, the handler runs, but top-level async init (`await storage.get(...)` at module scope) hasn't finished, so the handler touches an uninitialized service and the message is silently dropped. Real-world instance: an MV3 extension lost click events on every cold start because `initialize()` was still awaiting config.

**Why it happens:**
The promise-based API hides that the contract is callback-flavored (`return true` + `sendResponse`). Teams write `async` listeners, return the promise by accident, or initialize at module top level without considering that a fresh SW evaluates the script on every wake. This codebase's dual messaging paths (raw `onMessage` in background + never-initialized `MessageBus` — CONCERNS.md) double the surface for this class.

**How to avoid:**
- Standardize on ONE messaging layer (wire MessageBus or delete it — CONCERNS.md) with a typed envelope, and encode the contract: every handler returns `true` synchronously and calls `sendResponse` exactly once; validate `sender.id`/sender tab before acting.
- Make initialization idempotent: `ensureInitialized()` returns a cached promise and handlers `await` it before touching services.
- Don't rely on `sendMessage` for long streams — use `runtime.connect` ports with mandatory reconnect logic on `onDisconnect` (ports die when the SW sleeps).
- For anything stateful across a wake: checkpoint to `chrome.storage.local` immediately after the fetch, before further async steps.
- Add a test that cold-starts the SW (simulate by clearing module state) and asserts the first message is handled.

**Warning signs:**
- Intermittent "message port closed before a response was received" errors.
- First interaction after idle fails, subsequent ones work.
- Responses of `undefined`/`null` when a value was expected.
- Handlers that work only when DevTools is open.

**Phase to address:**
Phase 1 (messaging contract, envelope, cold-start init). Verified by the isolation/arch tests in Phase 1 gates and re-checked in Phase 19.

### Pitfall 5: SSE parsing breaks only in production — stream boundaries, proxy buffering, and the "[DONE]" sentinel

**What goes wrong:**
Server-Sent Events arrive in arbitrary network chunks: a chunk boundary can land in the middle of a `data:` line or between the event and its terminating blank line. A parser that treats each `onmessage` chunk as one event corrupts JSON mid-token — but only under load/network variance, so it passes local testing. Related production-only failures: the upstream (OpenAI/Anthropic/Claude/Gemini/Ollama) sends `\r\n` or CR-only line endings; providers emit `: keep-alive` comment lines (e.g., Anthropic's 30s `ping`) that naive parsers misparse as events; the final `data: [DONE]` marker is **not JSON** and explodes `JSON.parse`; and a stream that ends without a `[DONE]`/terminator (provider timeout, connection drop, SW kill — Pitfall 1) must be treated as a failure, not a clean end. A secondary silent killer: a proxy between the extension and the provider that **buffers** the response (squid/nginx without SSE flags, corporate filters, Ollama's own default in some setups), so "streaming" arrives in one giant chunk or never — the UI hangs on first token.

**Why it happens:**
The `fetch`-based SSE parser looks trivial, so it ships without a spec. Chunk-vs-event confusion is the #1 bug; parsing via `JSON.parse` on every message instead of incremental parsing of the accumulated buffer is #2. The spec's own AI service already couples the parser to the private proxy's exact envelope and returns empty on real provider responses (CONCERNS.md) — a live instance of "works in the demo harness, breaks in production."

**How to avoid:**
- Implement the canonical incremental parser: `TextDecoder` with `{ stream: true }`; append to a line buffer; split on `\n` (normalize `\r\n`); a blank line delimits an event; only then parse the accumulated `data:` lines (which may be multiple) as JSON — with `[DONE]` handled as a sentinel **before** JSON parsing.
- Treat missing terminator as error: track expected terminator (`[DONE]` or provider's end token) and fire `onError` when the stream closes without it — never auto-complete a truncated response (ties into Pitfall 8's no-auto-repair rule).
- Read the provider's actual wire format during Phase 3 (OpenAI `data: [DONE]`, Anthropic event types `content_block_delta`/`message_stop`, Gemini `text/event-stream` inline data, Ollama NDJSON) — write conformance fixtures captured from each provider instead of the proxy's format.
- `reader.cancel()` in a `finally` to avoid hanging connections; keep-alive comments must be skipped, not parsed.
- Do NOT use `EventSource` (GET-only, cannot set Authorization headers — most providers require headers).
- Test with a throttle proxy that emits 1-byte chunks and CRLF endings (the CI gate for Phase 3).

**Warning signs:**
- Streaming works locally, stalls or corrupts in production.
- Corrupted JSON errors mid-stream ("Unexpected token < in JSON at position...").
- First token takes minutes on corporate networks (proxy buffering).
- Streams never terminate (missing `[DONE]` handling) or UI shows partial text as "complete".

**Phase to address:**
Phase 3 (AI runtime — provider wire-format conformance + incremental parser + truncation semantics). Phase 12 evaluations must include stream-truncation fixtures.

---

### Pitfall 6: Token-budget drift — counting the wrong text, forgetting output reservation, and the latency cliff

**What goes wrong:**
A context assembler that sums "roughly the characters" of the input data but feeds the model **serialized** prompt text (prompt templates, formatting, XML tags, system instructions, tool schemas) underestimates the true token count by 30–60%. The result: overflow at 30k "estimated" tokens of a 32k context, mid-conversation truncation, or provider 400s. Second error class: not reserving output tokens — a 32k-context model with a 4k-output generation needs the input held to ~27k, not 32k (Anthropic's documented practice: reserve ~1–2k for output, and leave margin because tokenizers are approximate; a widely-cited rule is reserving output tokens plus ~2–3% safety margin). Third: latency cliffs — a full 128k-context prompt with a long input can take 7–10x longer per generation than a compact one; heavy compaction at 60–80% context utilization is standard practice (compaction at ~70% preemptively, ~95% as a hard ceiling) and "compact at 95% then resume" is too late — the compacted summary loses fidelity.

**Why it happens:**
Teams estimate tokens from character counts or rough heuristics instead of running the provider's actual tokenizer; they count source documents but not their own prompt scaffold; they treat context-window size as the input budget. Serialization format changes (adding tags, escaping, XML wrappers) silently inflate the count. In this codebase, the token accounting lives in the context assembler while the streaming surface renders raw text — the two can drift apart (CONCERNS.md notes the split between the context assembler and the render path).

**How to avoid:**
- Count tokens of the **final serialized prompt** with the provider's tokenizer (tiktoken, Anthropic's tokenizer, or a vendored approximation with a documented error margin), not the source text. Add a small budget reserve (output reservation + 2–3% margin) and a hard input ceiling below the advertised window.
- Centralize prompt assembly in one module (Phase 5 context assembler + Phase 10 memory governance) so every formatting change re-runs the budget check; unit-test the token counter against provider docs' known counts.
- Implement two-stage compaction: preemptive at ~70% utilization, reactive ceiling at ~95%; keep the compaction summary anchored (recent turns verbatim, older turns summarized) — don't summarize the whole tail.
- Track real per-call usage from provider usage fields (prompt/completion tokens) and log drift between estimate and actual in the transaction log (Phase 11) — divergence >10% is a bug.
- Never split an incomplete tool-call/tool-result pair across the compaction boundary.

**Warning signs:**
- Provider 400s / context-overflow errors at "well under" the advertised window.
- Mid-conversation "context length exceeded" after an innocuous formatting change.
- Generation latency grows superlinearly with chat length.
- Logged `usage.prompt_tokens` consistently above the assembler's estimate.

**Phase to address:**
Phase 5 (context-adaptive execution — token budget allocator) + Phase 10 (memory governance compaction); Phase 3 must not ship a naive append-only context. Phase 11 diagnostics measure estimate-vs-actual drift.

---

### Pitfall 7: Indirect prompt injection via extracted page content — spotlighting alone is not a defense

**What goes wrong:**
The extension's core job — read the user's current page and summarize/answer — is also the attack surface: any web page (a ServiceNow KB article, a wiki, a help forum with embedded comments, an email in a web client, a PDF) can contain instructions aimed at the assistant. **Indirect prompt injection is confirmed against production assistant products** (Perplexity Comet, Gemini Deep Research, and other agentic products in 2025–2026 research), including via **URL fragments** (the "HashJack" technique: `example.com/page#instructions` — the fragment is rendered, invisible to link previews and most users, and lands in extracted text). Defense-in-depth is required because **no single control works**: SOP/CORS do not protect against injection (the page text is *supposed* to be read); spotlighting/Base64 encoding reduces but doesn't eliminate risk; even the user themselves can be socially engineered into clicking an "approved" link.

**Why it happens:**
"Trust-aware context" (spec §28.3) is the right instinct but is usually implemented as a one-layer label ("this text is from the web") — which is exactly the control that was bypassed in the Comet/Deep Research incidents (labels and even quarantined dual-LLM chains were subverted). Injection that lands in the **memory layer** is worse than in a one-shot prompt: a poisoned note/embedding persists and re-infects future sessions (spec Phase 10 memory governance must include content-screening on ingest, not just at query time).

**How to avoid:**
- Layer the defenses (OWASP LLM Prompt Injection cheat sheet, in order): (1) input **sanitization/filtering** at the extraction boundary (strip active directives heuristically — but treat as best-effort), (2) **action screening**: never let page-derived text directly determine tool calls/parameters; every tool invocation gets a separate intent-validation step against an allowlist, (3) **dual-LLM quarantine** for high-risk ops (a second model validates the first's plan — independent of instruction-following), (4) **output screening** before destructive actions, (5) **containment**: degraded privileges for page-derived context, and (6) user disclosure UI — but treat user confirmation as *one* layer, not the endpoint (see Pitfall 14).
- Handle URL fragments explicitly: log and, where feasible, strip or visually flag fragments before extraction.
- Screen **memory writes** on ingest (Phase 10): an extracted snippet with instruction-looking patterns is a flag, not a store-and-forget event.
- Red-team in Phase 19: adversarial page corpus (fragment injection, fake system prompts, encoded instructions, Unicode confusables, instructions in images) run through the full pipeline.

**Warning signs:**
- The assistant suddenly follows instructions present in a web page it quoted.
- Tool calls whose arguments are verbatim strings from extracted content.
- Memory entries containing second-person instruction sentences ("Ignore previous instructions…", "You must…", "Repeat after me…").
- An evaluated benchmark (Phase 12) that lacks an injection suite.

**Phase to address:**
Phase 6 (PageContentService extraction hygiene) + Phase 7 (trust-aware context — layering, not labeling), Phase 4 executor screening, Phase 10 memory ingest screening, Phase 19 red-team. Phase 12 evaluation suite must include an injection benchmark.

---

### Pitfall 8: Structured-output failure — syntax, schema, semantic, and drift layers, plus the no-auto-repair rule for state-changing calls

**What goes wrong:**
Tool-call JSON from LLMs fails in four distinct layers, and teams fix only the first: (1) **syntax** — truncated JSON (the classic: generation cut at max_tokens mid-object, or `stop_reason: "max_tokens"` vs `"model_context_window_exceeded"` — the two require different handling: retry-with-shorter-prompt vs. compaction); (2) **schema** — valid JSON, wrong shape (missing fields, wrong types); (3) **semantic** — schema-valid but wrong values (hallucinated IDs, wrong step numbers); (4) **drift** — the model's output format silently shifts after a provider update (new escape conventions, renamed fields). Naive "prompt it to output JSON" fails 15–20% of the time in the wild. Even with constrained decoding (OpenAI `json_schema` strict mode, Anthropic tool_use, Gemini `response_mime_type: application/json`), semantic errors remain, and **state-changing calls must never be auto-repaired**: an auto-retried "create ticket" that actually executed is a duplicate ticket; a repair loop on a `writeNote` that half-wrote is corruption.

**Why it happens:**
LLMs are next-token predictors, not JSON serializers — truncation at the token ceiling is a physical property, not a bug. Reliability math punishes chains: at 97% per-call success, a 10-call flow succeeds ~74% of the time; at 20 calls ~54% (99% per-call → 82%/82%… the gap widens superlinearly with chain length). Teams ship one-shot prompt engineering and skip validation/retry architecture because "it works in the demo."

**How to avoid:**
- Use the provider's **constrained decoding** path for structured output (OpenAI strict `json_schema`, Anthropic tool_use, Gemini `response_mime_type`) — removes the syntax layer entirely for supported providers; for text-based (Ollama local) providers, enforce a Zod/DTO validation gate instead.
- **Validate at every boundary** with a schema (Zod), distinguish `stop_reason` on failure (`max_tokens` → shrink prompt and retry once; `model_context_window_exceeded` → compact first, never blind-retry), and treat `finish_reason` as a first-class signal.
- Retry policy: **one** repair retry (~80% recovery reported); on second failure, degrade — ask the user, don't retry forever (also a cost-control issue, Pitfall 13).
- For state-changing calls: idempotency keys (a retried call carries the same `operationId` and the executor dedupes), validate-then-execute (all fields validated before ANY side effect), and log the pre- and post-state in the transaction log (Phase 11) so an executed-then-repaired mistake is auditable.
- Version the tool schema (`tools_v2` etc.) and pin provider models; when the provider updates, run the Phase 12 conformance suite against the new model before flipping default.

**Warning signs:**
- Intermittent `Unexpected end of JSON input` / `JSON.parse` errors on tool calls.
- Duplicate tickets/notes after a "retry" (missing idempotency).
- A provider model update that silently changes output format.
- Test suites that only assert happy-path valid JSON.

**Phase to address:**
Phase 3 (AI runtime: constrained decoding + validator + retry policy) and Phase 4 (agent reliability: idempotency, validate-then-execute, no-auto-repair for state changes). Phase 12 evaluation must include truncation and schema-drift fixtures.

### Pitfall 9: Filesystem sync conflicts — auto-merge corruption, silent last-write-wins loss, and double-sync loops

**What goes wrong:**
A local-first note vault synced via a filesystem folder (Obsidian Sync, iCloud Drive, Dropbox, Syncthing, or the spec's LLM-Wiki folder) has a well-documented failure catalog: (1) **auto-merge corruption** — two devices edit the same `.md` in the same sync tick and the sync engine writes a merged file with duplicated/concatenated content (Obsidian's own community reports "my note got duplicated inside itself" after iCloud/Dropbox races); (2) **silent last-write-wins loss** — no conflict marker at all, one edit vanishes (the most common and most damaging); (3) **double-sync loops** — the app watches the folder, writes a file, the watcher fires, the app re-ingests its own write, writes again — an infinite write loop that burns storage quota (Pitfall 2) and CPU; (4) **delete-vs-edit races** — a delete on device A resurrects an old version from device B's pending upload; (5) **case-only renames** on case-insensitive filesystems (macOS/Windows) that fail or split into copy+delete, breaking links.

**Why it happens:**
Sync engines are eventually-consistent by design; conflict handling is heuristic and varies per engine (iCloud and Dropbox differ from Syncthing, which differs from git). Apps assume single-writer and never build conflict resolution, so they inherit whatever the engine does — which is usually silent. The spec's Phase 9 (LLM-Wiki + Filesystem Sync) will live exactly here; the spec's §19.16/§19.17 (permission revoked, external .md change) cover *detection* but not *conflict resolution*, which is the ecosystem gap this pitfall fills.

**How to avoid:**
- Write conflict-aware, not conflict-oblivious: on **read**, detect external modification (mtime + content hash vs. last-known); on **write**, compare-and-swap by base hash; on mismatch, don't overwrite — write a conflict copy and surface a merge decision in the UI (Phase 15 workspace UX). Version history (per-file backup on write) is the recovery primitive — the spec's WriteJournal already provides this; extend it to folder-sync'd files.
- Never re-ingest your own writes: tag written files with a "this was me" marker (in-memory set of paths/hashes written this session) and skip watcher events for them; debounce watcher events (~500ms) before acting.
- Prefer **atomic rename-based writes** (write `note.tmp` → rename) — most sync engines handle rename-before-content better than in-place truncation, and it kills the "watcher sees half-written file" race.
- For case-only renames, write to an intermediate name first (rename `Note` → `Temp` → `note`) — standard Obsidian plugin practice.
- Never auto-merge content heuristically; auto-merge is how corruption happens. Resolution options: keep-both (conflict copy), keep-theirs, keep-mine — never a string concatenation.
- Test against a live sync folder (two directories + a sync engine in CI is overkill; simulate with two watchers on the same folder and adversarial mtime manipulation).

**Warning signs:**
- Notes containing their own duplicated body ("…end of note… end of note…").
- User reports "my edit disappeared" (last-write-wins).
- Endless write loops (watch file count / CPU spike in diagnostics).
- Conflict files (`note (conflicted copy)`, `note-2.md`) appearing for users.

**Phase to address:**
Phase 9 (LLM-Wiki + Filesystem Sync — CAS writes, conflict copies, watcher self-suppression) + Phase 15 (recovery UX for conflict resolution). Phase 2's WriteJournal is the version-history primitive it builds on.

---

### Pitfall 10: Wikilink breakage on rename — display-text rewrites, orphaned links, and the memory-note identity trap

**What goes wrong:**
Renaming a note breaks every `[[Old Name]]` that references it. Two ecosystem behaviors make this worse than it looks: (1) **display-text rewriting** — Obsidian 1.2.1+ automatically rewrites `[[Note|Note]]`-style links in *other files* when you rename, and plugins like Smart Rename offer the same; the rewrite is a **content mutation** of files the user didn't touch, which under sync (Pitfall 9) becomes a conflict storm and under this app's WriteJournal becomes an audit-trail noise problem; (2) **alias-based identity** — the robust pattern is to give the note an immutable ID (alias) and keep display text free; Obsidian's Smart Rename pattern is: on rename, add the old title as an alias rather than rewriting references. A third trap specific to this product: if memory entities (Phase 10) map to notes by **title**, any rename detaches the memory graph from the note — the AI then "remembers" a person/ticket whose note can't be found, producing confident citations to missing notes (feeds Pitfall 11's mis-citation class).

**Why it happens:**
Titles feel like identity, but in local-first systems they're just display strings. The spec's Phase 8/9 will create notes from memory entities and rename them (LLM-generated titles are notoriously unstable across re-generation); without a stable ID, every title change is a link-graph earthquake.

**How to avoid:**
- Give every note a stable, immutable ID (frontmatter `id:` or a slug that never changes) from Phase 8 onward — title is display-only. `[[display]]` links resolve through the ID via an alias index (this is what Obsidian's Smart Rename/alias systems converged on).
- If renaming, use the **alias pattern**: keep old title as alias, update references lazily or not at all; do NOT bulk-rewrite link text across the vault on every rename (especially not under an active sync folder).
- If display-text rewriting is ever offered, make it a user-confirmed explicit action with a preview diff, and have it write through the WriteJournal so it is auditable — never a silent background mutation.
- Block references (`[[Note#^block]]`) are even more fragile (block IDs are UUIDs that get regenerated); avoid them for anything the agent writes; prefer heading-anchored links (`[[Note#Section]]`).
- On rename: verify memory-graph edges still resolve (Phase 10 integrity check) and report dangling links in the UI rather than silently dropping them.

**Warning signs:**
- A rename followed by a flood of "orphaned link" warnings in diagnostics.
- Memory entities that reference notes which no longer exist at lookup time.
- WriteJournal entries with large diffs that are purely link-text rewrites of untouched files.
- `[[Old Name]]` links that resolve to nothing after an LLM title re-generation.

**Phase to address:**
Phase 8 (note identity model: stable IDs + alias index) and Phase 9 (rename policy under sync); Phase 10 memory-note mapping must key on ID, not title.

---

### Pitfall 11: RAG citation hallucination — the real failure is mis-citation, not fabrication

**What goes wrong:**
Research on retrieval-augmented systems shows the dominant failure is **mis-citation**: the model cites a source that does not actually support the claim (unverifiable/unsupported statements are ~80% mis-citation rather than outright fabrication in a representative analysis; measured citation accuracy in popular systems sits around ~74%). The failure is insidious because the citation *looks* legitimate — the title exists, the note exists, the quoted fragment is near-miss — and users trust it precisely because of the citation apparatus. Root causes are layered: **retrieval** returns the wrong chunk (query/chunk mismatch), **chunking** breaks the evidence (a claim split across chunk boundaries — the well-documented E1–E6 chunking error classes: mid-sentence cuts, table fragmentation, entity splitting), and **generation** invents support for a retrieved-but-irrelevant chunk. A second, spec-specific vector: the memory/notes layer itself contains **stale or AI-generated content** (titles from Pitfall 10, summarized notes), so the RAG source is polluted — "correctly cited, factually wrong."

**Why it happens:**
Citation formatting is cheap (paste the retrieved chunk's ID) and verification is expensive (cross-check claim against chunk semantics). Teams ship retrieval+format and call it RAG; nothing in the pipeline ever *checks* that the claim is entailed by the chunk. The spec's Phase 8 bundles MiniSearch retrieval with note/memory ingestion, and Phase 12's evaluation must measure citation accuracy — the ecosystem evidence says that's exactly where to aim, because a RAG system with pretty citations and 74% accuracy is worse than a system with no citations.

**How to avoid:**
- Add a **verification layer**: after generation, NLI-style entailment check (dedicated small model or heuristic) — "does the chunk support the claim?" — and either repair or **abstain** (drop the citation, downgrade confidence, say "not found in notes") when unsupported. Abstain-when-unsupported is the documented behavior of high-accuracy systems.
- Fix chunking at ingest: chunk on semantic boundaries (paragraph/section, not fixed char count); never split tables/code blocks/entity mentions; store chunk provenance (source file + heading path + position) so citations are traceable to a human-readable location.
- Cite at the **claim level**: each sentence's citation is its own retrieval hit, not one citation for the whole answer (the whole-answer citation is how near-miss mis-citations hide).
- Include **retrieval debug data** in the Phase 11 transaction log: which chunks were retrieved, scores, which were cited — so Phase 12 can audit mis-citations post-hoc instead of guessing.
- Screen memory/notes for staleness (Pitfall 10 + Phase 10): a note whose source page changed since last sync should be flagged "possibly stale" in retrieval results, not silently cited.

**Warning signs:**
- Answers where the cited note's text doesn't actually contain the claim (spot-check 10 random answers).
- The same citation repeatedly attached to different claims across queries.
- Citation accuracy below ~80% on the Phase 12 eval set.
- Chunks that start/end mid-sentence in stored search results.

**Phase to address:**
Phase 8 (chunking + provenance at ingest) and Phase 12 (evaluation: citation-accuracy benchmark, mis-citation audit) — plus Phase 10 ingest screening and Phase 11 retrieval logging. Phase 15 UI shows source excerpts next to claims (making mis-citation user-visible is a feature).

---

### Pitfall 12: Local search index staleness and main-thread blocking — MiniSearch is a radix tree in memory, not a database

**What goes wrong:**
MiniSearch (the spec's Phase 8 choice) is an **in-memory** inverted index over a radix tree. Three failure modes: (1) **staleness** — index updates require explicit `add`/`remove` calls; if the notes write path (Phase 9 filesystem sync) doesn't notify the index (or a crash/sync event bypasses it), search silently returns outdated results while the vault has new content — the user's trust in search dies quietly; (2) **main-thread blocking** — `loadJSON` (hydrating a large serialized index) and large `addAllAsync` bursts synchronously block the extension surface for seconds (a 50MB+ note vault has been measured at >10s of blocking on a busy tab in similar libraries) — the side panel freezes mid-search; (3) **default tokenization mismatch** — MiniSearch's default tokenizer (simple lowercase word split, no stemming/stopwords by default) misses ServiceNow-specific vocabulary: `incident`, `RITM12345`, `CHG0034567`, `KB0012345`, camelCase `ServiceNowNow`-style tokens, and punctuation-laden ticket IDs (`INC0012345` — a default tokenizer splits on nothing but whitespace, so it may work, but `inc0012345` vs `INC0012345` case sensitivity is a real miss). Multi-term queries with stopwords and prefix search quirks compound the mismatch.

**Why it happens:**
Search libraries look like "just call `search()`", so indexing lifecycle (when to add, when to remove, when to rebuild) is under-designed — especially in a system where notes are created by an AI agent (Phase 8/9) in addition to the user. The spec places MiniSearch in Phase 8 with the notes layer, and the sync watcher in Phase 9 — the index lifecycle spans both, which is exactly where the gap forms.

**How to avoid:**
- Make the index **derive from the vault, not track it**: on any write/delete/rename (via the WriteJournal and the sync watcher), enqueue an index mutation; on load, reconcile index vs. vault by comparing a manifest (file hash list) — rebuild-on-drift, never trust the index.
- Keep indexing off the critical path: debounce bulk updates, hydrate via `addAllAsync` in batches with `await` yields, and if hydration blocks >100ms, move it to a worker or an offscreen document.
- Customize `tokenize`/`processTerm` in MiniSearch options: lowercase-normalize, add stopword handling, and preprocess ServiceNow identifiers (strip leading `INC`/`CHG`/`KB`/`RITM` prefixes into queryable terms); document the tokenizer contract in Phase 8.
- Serialize the index with a version field; on version mismatch, rebuild instead of loading stale data.
- Expose index staleness in diagnostics (Phase 11): search result count vs. vault file count is a cheap health signal.

**Warning signs:**
- Search results missing a note that visibly exists in the vault.
- Side panel jank/freeze during search or right after opening with a large vault.
- Search for `INC0012345` fails while browsing the note works.
- Index size diverges from vault size in diagnostics.

**Phase to address:**
Phase 8 (MiniSearch integration: tokenizer contract, async hydration) and Phase 9 (index lifecycle wired to the write path + watcher). Phase 11 diagnostics surface staleness. Phase 15 UX: search-as-you-type must stay <50ms even with a warm 50MB vault.

### Pitfall 13: Unbounded agent loops — retry storms, tool-call feedback loops, and cost exhaustion without a kill switch

**What goes wrong:**
Agentic loops are the most expensive failure mode in this product class: (1) **retry storms** — a transient provider error triggers auto-retry, which fails again, which retries (Pitfall 8's "one repair retry" violated under load); (2) **tool-call feedback loops** — the agent calls a tool, the tool result *looks* like progress but changes nothing (e.g., a search that returns the same top hit, a note write that re-triggers the same analysis), and the agent loops the same call sequence; (3) **compounding context** — each loop iteration appends tool results to context, so even successful loops eventually blow the token budget (Pitfall 6) *and* cost grows superlinearly. The industrial evidence is stark: a 2026 audit (IAL-SCAN, 6,549 open-source projects) found **68 confirmed infinite agent loops in 47 projects (91.9% precision)** — infinite loops are common, not exotic; the most publicized production incident burned **$47k in 11 days** on a runaway loop. The core design flaw: **post-hoc alerts don't stop loops** — by the time a human sees the alert, the budget is spent. Only *reserve-before-call* limits stop them.

**Why it happens:**
Loops are emergent — no single line of code is "the bug." Counting iterations in the planner (spec Phase 4) is the right instinct but usually ships as a high number ("max 20 steps") that still admits runaway cost; retries are configured per-call without a global budget; and the transaction log (Phase 11) records what happened but has no authority to stop it. Spec §19.11 (abort during permission prompt) and §20 cover interruption, but the ecosystem gap is *prevention*: budget enforcement, not just interruption.

**How to avoid:**
- **Reserve-before-call budgeting**: a global per-session budget (token + cost + wall-clock + step count) checked *before* every model call; the call is refused when the budget is exhausted — the agent must degrade (summarize, ask the user, stop). Alerts are a complement, never the mechanism.
- **Per-tool guards**: every tool call gets a monotonic step counter; identical (tool, args-hash) calls in a session are deduped or rate-limited; tools that return no delta (compare result against previous result hash) are flagged as "no progress."
- **Circuit breaker on errors**: consecutive failures (3) stop auto-retry for the session; provider-level backoff (exponential, capped); a manual "kill loop" affordance in the UI that *always* works (hard abort on the message bus, not just a cancel button that the loop can swallow).
- **Cost telemetry in Phase 11**: per-step token/cost rows written as the loop runs (not after) so the budget enforcer has live data; Phase 11's transaction log is the enforcement substrate.
- Round-trip caps for multi-role collaboration (Phase 14) are a *separate* bound: N rounds between agent roles, then escalate to the user.
- Test with a deliberately looping tool fixture (a tool that returns "try again" forever) and assert the budget enforcer halts the session.

**Warning signs:**
- Session token/cost graphs that accelerate (superlinear) rather than plateau.
- The same tool call (identical args) appearing many times in the Phase 11 log.
- A "cancel" that doesn't stop the stream within ~1s.
- Production incident reports from other agents' post-mortems — they all say the same thing: alerts fired, money was already gone.

**Phase to address:**
Phase 4 (agent reliability: step counters, circuit breaker, no-delta detection) + Phase 11 (transaction log with live budget authority) + Phase 18 (tool governance: per-tool budgets). Phase 14 bounds multi-role rounds. Phase 19: chaos test with looping fixtures.

---

### Pitfall 14: Permission/confirmation fatigue — the approval UI becomes a rubber stamp, and "user confirmed" stops meaning anything

**What goes wrong:**
The spec's security posture (§16) and Phase 18 tool governance correctly require user approval for sensitive actions (ticket mutations, external writes). The ecosystem failure: **confirmation fatigue**. When approvals are frequent, low-information, and interruptive, users develop automatic behavior — click "allow" without reading (the T10 "Overwhelming Human-in-the-Loop" failure pattern, identified by a UK AI Security Committee analysis; parallel evidence from safety-critical ops: operators ignore ~67% of alerts when they exceed a few hundred per day — 4,484 alerts/day in one SOC study). Once the user is trained to rubber-stamp, the approval layer is **worse than no approval**: it provides false assurance (the user *believes* they saw a review) while adding friction that teaches the user to ignore warnings. Attackers then don't need to bypass the model — they need to produce a plausible request that the fatigued user approves: an injected action (Pitfall 7) framed as a normal workflow (a "helpful" script that happens to exfiltrate the vault). A second failure: **approval at the wrong time** — asking before an action the user has already implicitly authorized (e.g., every note save) so that real red-flag approvals are indistinguishable from noise.

**Why it happens:**
Approval prompts are added incrementally ("let's be safe, add a confirm") without counting total daily interruptions. Nobody designs the *denial* path (what the user sees when the tool is refused, how escalation works), so the UI defaults to "allow everything with a click." And because approvals are per-call, the fatigue compounds with session length.

**How to avoid:**
- **Risk-tiered approval** (the standard fix): low-risk actions (read-only searches, note drafts, extract) run unapproved but are *logged*; medium-risk (write to notes, send draft) get one-tap approval; high-risk (ticket state changes, external sends, destructive ops) get explicit review with context (what, why, to what). Target: ≤5–15% of actions escalate — if the design escalates more, the tiering is wrong, not the user.
- **Approval expiry and scope**: an approval is a lease (valid for one action or N seconds, then expired) — never "allow all X for this session" unless user-initiated (Phase 18 allowlist config).
- **Batch and contextualize**: group related micro-decisions into one review with a summary ("3 note writes, 1 search — approve all?"); every prompt shows *what changed* (diff), not just the action name.
- **Deny-by-default UX**: the denial path must be first-class (why denied, what data the tool wanted, how to escalate with full context) so users trust the gate instead of fighting it.
- **Audit receipts**: after any approved sensitive action, show a lightweight receipt in the activity feed (Phase 11) — this converts approvals from interrupts into a reviewable log and reduces the *need* for interrupts.
- Measure the escalation rate in Phase 12/19 acceptance: escalate ≤15% in normal workflows; if the eval suite produces more, redesign the tiering.

**Warning signs:**
- Users click "allow" in <1s consistently (telemetry: approval-accept time).
- Approval prompts appearing in the middle of fast, repetitive workflows (draft → approve → draft → approve).
- A user reported incident where they approved something they "didn't really look at."
- Escalation rate above ~15% in evaluation sessions.

**Phase to address:**
Phase 18 (tool governance: risk tiers, leases, batch reviews) + Phase 2 (the approval/consent storage model) + Phase 4 (executor gating). Phase 11 receipts. Phase 12 evaluation measures escalation rate as a pass criterion.

---

### Pitfall 15: Chrome Web Store review rejections — excessive permissions, missing privacy policy, and the extended-review spiral

**What goes wrong:**
The Web Store's automated + manual review rejects extensions for reasons that are easy to hit and costly to fix *after* the fact (each rejection cycle is days): (1) **excessive permissions** is the #1 rejection/removal category — requesting permissions the features don't use, or a `host_permissions` list that is broader than the visible functionality; this codebase already holds **9 manifest permissions with 5 unused** (CONCERNS.md) — exactly the profile that gets flagged; (2) **missing/insufficient privacy policy** — required for any extension that collects *or transmits* personal data, and "collection" includes sending page content to a third-party LLM API; (3) **remote code** — MV3 forbids it, and reviewers check for eval/remote scripts/remote config that behaves as code (a remote prompt file can be treated as remote code — prompts should be bundled or fetched with explicit disclosure); (4) **broad host permissions** (e.g., `<all_urls>` or generic `*://*/*`) trigger **extended review** — manual security review that is slow and can be denied on insufficient justification; (5) **single-use credentials or suspicious patterns** — hardcoded keys in the package (a real rejection/removal class). Each rejection restarts the review clock and can cascade (a removal after publish is worse: users lose the extension with no recourse).

**Why it happens:**
Permission bloat accumulates during development (permissions added for experiments, never removed); the privacy policy is written late; and teams submit with the broadest host set "to be safe" — the opposite of what the store rewards. The store's own guidance: least-privilege permissions, narrow host scopes, and disclose *every* data transmission (including LLM API calls) in the privacy policy.

**How to avoid:**
- **Permission hygiene as a Phase 1 gate**: every manifest permission maps to a feature in the spec; unused permissions are removed before submission (this codebase's 5 unused permissions are a concrete Phase 1/19 cleanup item); use `optional_permissions`/`optional_host_permissions` for anything user-gated (custom LLM endpoints, add-on sites — also the correct pattern for Pitfall 3's custom-host case).
- **Host scoping**: prefer specific sites the product actually needs (`https://*.service-now.com/*` style, per-instance) over `<all_urls>`; if broader access is genuinely required, document the use case *in the store listing* to survive extended review.
- **Privacy policy written in Phase 19 prep**, covering: page-content extraction, transmission to LLM providers (naming them), local-first storage (what stays local), and the custom-endpoint path; keep a human-readable copy in the repo so it stays truthful as features change.
- **No remote code, no eval, no remote prompts-as-code**: bundle prompts in the package; remote config must be data (validated schema) and its retrieval disclosed.
- **Review-readiness checklist in Phase 19**: run a permission-audit script (list used vs. declared API calls), a secrets scan (no API keys in the package — user-provided keys are stored locally, never baked), and a manual walkthrough video of every feature that uses each permission.
- Budget 1–2 weeks of review slack in the Phase 19 plan; a rejection is a process issue, not an end-state.

**Warning signs:**
- Manifest declares APIs/permissions with no code reference (grep the codebase — 5 today in this repo).
- No privacy policy document anywhere in the repo.
- Remote URLs in the package (prompts, config) that could be read as code.
- Any `<all_urls>` or wildcard host patterns in the manifest.

**Phase to address:**
Phase 1 (permission baseline, least-privilege gate) and Phase 19 (hardening: permission audit, privacy policy, review-readiness checklist, review slack). Phase 17 add-on permissions must follow the same optional-permission pattern.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Whole-store persistence to `chrome.storage.local` on every change (current codebase pattern) | Fast to ship, one `set` call | Rate-limit/quota silent data loss (Pitfall 2); every write re-serializes the entire vault | Never — adopt per-entity keys / IndexedDB in Phase 2, flush-on-end in Phase 3 |
| Fetching AI providers directly from content scripts | Skips the messaging hop | Page CORS/CSP breaks it in production (Pitfall 3); open-proxy exfiltration risk | Never — extraction boundary is fixed by Phase 6 architecture |
| SSE parser built against the private proxy's envelope only | Matches the demo harness | Returns empty on real provider responses (already true in this codebase — CONCERNS.md); production-only breakage (Pitfall 5) | Never — Phase 3 builds per-provider conformance fixtures |
| `async` message handlers without `return true` | Terse code, no boilerplate | Silent `undefined` responses, cold-start drops (Pitfall 4) | Never — Phase 1 messaging contract encodes it |
| Simulated AI responses baked into production code paths (`simulateStreamResponse` at aiProvider.ts:101–217 + 5 call sites; demo data in store defaults; default endpoint `http://localhost:12380/v1`) | Demo works without a provider | Users get fake answers on provider misconfig; real provider failures hidden behind "working" UI; the SSE parser is never exercised against reality | Only behind an explicit `NOVAL_ENABLE_SIMULATION` dev flag, never default-on (CONCERNS.md; Phase 3 removes) |
| One retry on any tool-call failure | Recovers ~80% of transient failures | Blind retries on state-changing calls duplicate tickets/notes; retry storms burn budget (Pitfall 8 + 13) | Only with idempotency keys and `stop_reason`-aware handling (Phase 4) |
| Title-based note identity | No ID plumbing | Rename = link-graph earthquake; memory graph detaches (Pitfall 10) | Never — stable IDs from Phase 8 |
| Trust-aware context as a single "from web" label | Cheap, demoable | Bypassed by real-world injection (Pitfall 7) | Only as layer 1 of 6 — layering is the requirement |
| Auto-merge of synced file conflicts | No user interruption | Duplicated/corrupted notes, silent loss (Pitfall 9) | Never — conflict copies + explicit resolution |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI streaming API | Parse chunks as events; `JSON.parse` the `[DONE]` sentinel | Incremental line-buffer parser; sentinel handled before JSON (Pitfall 5); constrain output with strict `json_schema` |
| Anthropic Messages API | Treat `ping`/keep-alive comments as content; read `content_block_delta` as plain text | Skip comment lines; map event types; reserve output tokens; use `tool_use` blocks for structured output |
| Gemini streaming | Assume OpenAI wire format; miss `response_mime_type` for JSON mode | Read provider's actual format per Phase 3 fixtures; use `response_mime_type: application/json` for structured output |
| Ollama (local) | No validation because "it's local" — no constrained decoding available | Zod/DTO gate on all structured output; text-format drift is a real failure mode; token counting differs (no usage fields on all paths) |
| ServiceNow instances (host permissions) | `<all_urls>` or guessing instance domains | Per-instance `optional_host_permissions` requested at config time (Pitfall 3 + 15); extraction only, never fetch (Pitfall 3) |
| Custom user-configured LLM endpoints | Assume they speak OpenAI format; never validated at save time | Format detection on first connect (a `/models` probe), schema-validated remote config as data not code (Pitfall 15); host permission requested via `chrome.permissions.request` |
| Filesystem sync folders (iCloud/Dropbox/Syncthing) | Treat the folder as a normal watchable dir; in-place truncating writes | Atomic temp-file + rename writes; CAS by base hash; self-write suppression; conflict copies (Pitfall 9) |
| MiniSearch | Default tokenizer, load on startup, no lifecycle | Custom `tokenize`/`processTerm` for ServiceNow identifiers; async hydration; reconcile-by-manifest (Pitfall 12) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-chunk full-store persistence | Jank during streaming; silent write drops; quota errors | Flush on stream end; per-entity keys or IndexedDB (Pitfall 2) | ~50 messages / ~1MB store |
| Context assembled by appending everything | Latency grows superlinearly; provider context-overflow 400s | Token-count the serialized prompt; reserve output; compact at 70% (Pitfall 6) | ~60–80% of context window |
| MiniSearch `loadJSON` / `addAllAsync` on the main thread | Side panel freeze on open/search; UI jank on vault sync | Batched async hydration; worker/offscreen if >100ms; debounced index mutations (Pitfall 12) | ~50MB+ vault / ~10k notes |
| Index updated synchronously in the note write path | Every write (incl. agent-generated) stalls the UI | Enqueue-and-reconcile model (Pitfall 12) | ~100 writes/min |
| SSE parser buffering the entire stream before rendering | First token latency grows with response size; memory spikes | Render per-event as parsed; incremental TextDecoder (Pitfall 5) | Long generations (3k+ tokens) |
| Approval prompt on every sensitive call | Interaction time per task explodes; rubber-stamping (Pitfall 14) | Risk-tiered approval targeting ≤15% escalation; batch reviews | ~10+ approvals per workflow |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating content-script messages as trusted | Malicious page drives extraction or exfiltration | Validate sender + envelope schema at every boundary (Pitfall 3/4; untrusted-input-boundary reference) |
| No injection defense beyond a "from web" label | Page content steers the agent into destructive actions; HashJack-style fragment attacks (Pitfall 7) | Six-layer defense: sanitize → action screening → dual-LLM quarantine → output screening → containment → disclosure; red-team in Phase 19 |
| Auto-repairing failed state-changing tool calls | Duplicate tickets/notes; corrupted writes (Pitfall 8) | Idempotency keys, validate-then-execute, one-retry-then-ask |
| Unlimited retry/loop budgets | Cost exhaustion, $k-scale bills (Pitfall 13) | Reserve-before-call budgets with hard stop; circuit breakers |
| Permission bloat in manifest (9 declared, 5 unused today) | Web Store rejection/removal; larger attack surface (Pitfall 15) | Least-privilege gate in Phase 1; optional permissions for user-gated hosts |
| Approvals as a rubber stamp (too many, no context) | User-approved malicious actions (Pitfall 14) | Risk tiers, expiring leases, diffs in prompts, audit receipts |
| Storing provider API keys in extension defaults/package | Key theft from package or devtools | User-entered keys only, kept local (chrome.storage.session/local, never synced, never bundled) |
| Fetching remote config/prompts as code | Remote code violation; supply-chain prompt injection (Pitfall 15) | Bundle prompts; remote config validated as data with disclosure |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Stream renders only after completion | User stares at a spinner for 30s+; believes the extension is broken | Render tokens incrementally; show partial answers with a "still generating" affordance (Pitfall 1/5) |
| Silent truncation on SW kill / stream loss | Answer looks complete but is cut mid-sentence; user acts on partial info | Terminator-aware completion (Pitfall 5); explicit "stream interrupted" state with retry |
| Search that misses notes the user can see | Trust in search collapses; user stops using the assistant's memory (Pitfall 12) | Index staleness surfaced in diagnostics; reconciliation on load |
| Rename breaks links with no warning | Broken `[[links]]` everywhere; user blames the app | Alias-based identity; dangling-link report in UI (Pitfall 10) |
| Approval prompts in the middle of fast workflows | Rubber-stamping; real risks approved unread (Pitfall 14) | Tiered approvals, batching, diffs, receipts |
| Citations that don't support the claim | User trusts wrong facts from notes (Pitfall 11) | Claim-level citations with visible source excerpts; abstain-when-unsupported |
| "Cancel" that doesn't stop the agent | User feels the product is out of control (Pitfall 13) | Hard abort on the message bus; kill-loop affordance always reachable |
| Config defaults pointing at a local mock (`localhost:12380`) | Users get simulated answers or silent failures in production | Provider-config validation with clear errors; simulation only under explicit dev flag |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Streaming:** Parser handles 1-byte chunks, CRLF, keep-alive comments, and missing `[DONE]` — verify with conformance fixtures per provider, not just the private proxy (Pitfall 5; current parser returns empty on real providers — CONCERNS.md)
- [ ] **Persistence:** Storage adapter surfaces `runtime.lastError`/quota/rate-limit failures instead of swallowing them — verify with a >10MB session soak test (Pitfall 2)
- [ ] **Messaging:** Every async handler returns `true`; cold-start `ensureInitialized()` awaited before use; single messaging layer (MessageBus wired or deleted) — verify with a forced-idle cold-start test (Pitfall 4; CONCERNS.md)
- [ ] **Agent loop safety:** Reserve-before-call budgets and circuit breakers actually halt a deliberately looping tool fixture — verify with the chaos test in Phase 4/19 (Pitfall 13)
- [ ] **Tool-call reliability:** Idempotency keys on state-changing calls; no blind auto-repair; `stop_reason` distinguishes truncation from overflow — verify with truncation + schema-drift fixtures in Phase 12 (Pitfall 8)
- [ ] **Approval UX:** Escalation rate ≤15% in eval sessions; deny path is first-class; leases expire — verify with telemetry on approval-accept time (Pitfall 14)
- [ ] **Note identity:** Stable IDs + alias index from day one; memory graph keys on ID not title — verify by renaming a note and checking all links + memory edges (Pitfall 10)
- [ ] **RAG honesty:** Citation accuracy ≥80% on the eval set; abstain-when-unsupported wired — verify with the mis-citation audit in Phase 12 (Pitfall 11)
- [ ] **Index lifecycle:** Index reconciles with vault manifest on load; writes feed the index — verify by deleting a note outside the app and searching (Pitfall 12)
- [ ] **Permissions:** Every manifest permission maps to a feature; zero unused; optional hosts for user-configured endpoints — verify with a used-vs-declared API audit script (Pitfall 15; 5 unused today — CONCERNS.md)
- [ ] **Injection defense:** Full six-layer stack, not just labels; memory writes screened on ingest — verify with the adversarial page corpus red-team (Pitfall 7)
- [ ] **Isolation tests:** Assert real boundaries (content script never fetches; no `return true` violations) — the current isolation tests are vacuous (CONCERNS.md); make them fail on violation

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Storage quota/rate-limit data loss (Pitfall 2) | MEDIUM | Detect missing writes at startup (manifest hash vs. store); restore from WriteJournal/version history; surface "N changes recovered" |
| Sync conflict corruption (Pitfall 9) | MEDIUM | Conflict copies preserved (never overwritten); WriteJournal version history enables restore; UI merge decision flow in Phase 15 |
| Truncated stream presented as complete (Pitfall 5) | LOW | Retry from checkpoint (persisted stream state in `chrome.storage.session`); mark partial answers clearly |
| Duplicate ticket/note from retried call (Pitfall 8) | HIGH | Idempotency keys make dedupe automatic at the executor; transaction log (Phase 11) shows the duplicate chain for manual cleanup |
| Runaway agent loop (Pitfall 13) | HIGH | Budget enforcer halts at reserve; hard abort in UI; transaction log exposes the loop for post-mortem; refund/credit path for provider charges is user-side |
| Mis-cited answer acted on (Pitfall 11) | HIGH | Claim-level citations with excerpts let the user verify; stale/mis-cited sources flagged in the activity feed; evaluation feedback loop into Phase 12 |
| Rename broke links (Pitfall 10) | MEDIUM | Alias index keeps old titles resolving; dangling-link report lists repairs; one-click re-link |
| Web Store rejection (Pitfall 15) | MEDIUM | Permission audit + privacy policy prepared in Phase 19 *before* submission; rejection is a checklist fix, not a rewrite; 1–2 weeks review slack budgeted |
| Provider outage mid-workflow (Pitfall 1/5) | LOW | Resume/abort contract on the message bus; queued intent survives SW restart via storage checkpoint |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. SW suspension kills streams / cold start | Phase 1 (runtime, no-SW-state discipline) + Phase 3 (stream hosting, resume contract) | Phase 19: forced-idle kill test with DevTools closed; 60s+ stream survives |
| 2. Storage quotas/rate limits silent loss | Phase 2 (storage architecture, error-surfacing adapter) + Phase 3 (flush-on-end) | Phase 19: >10MB / high-write-rate soak; restart preserves data |
| 3. Content-script CORS/CSP cage | Phase 1 (manifest hosts + CSP) + Phase 6 (extraction boundary relay) | Arch test: no `fetch(` in content-script entrypoints (Phase 1 gates) |
| 4. Messaging races / cold-start drops | Phase 1 (messaging contract, single layer, `ensureInitialized`) | Cold-start test: first message after idle is handled |
| 5. SSE parsing breaks in production | Phase 3 (per-provider conformance fixtures, incremental parser) | CI gate: throttle-proxy test (1-byte chunks, CRLF); Phase 12 truncation fixtures |
| 6. Token-budget drift / latency cliff | Phase 5 (budget allocator) + Phase 10 (two-stage compaction) | Phase 11: estimate-vs-actual usage drift logged; >10% = bug |
| 7. Indirect prompt injection | Phase 6 (extraction hygiene) + Phase 7 (layered trust) + Phase 10 (ingest screening) | Phase 19 red-team corpus; Phase 12 injection benchmark |
| 8. Structured-output failure | Phase 3 (constrained decoding, validator) + Phase 4 (idempotency, no-auto-repair) | Phase 12: truncation + schema-drift + duplicate-call fixtures |
| 9. Filesystem sync conflicts | Phase 9 (CAS writes, conflict copies, watcher self-suppression) | Phase 15: conflict-resolution UX test with adversarial sync simulation |
| 10. Wikilink/identity breakage on rename | Phase 8 (stable IDs + alias index) + Phase 9 (rename policy) | Rename-a-note test: all links + memory edges still resolve |
| 11. RAG mis-citation | Phase 8 (chunking, provenance) + Phase 12 (citation-accuracy eval) + Phase 11 (retrieval logging) | Phase 12: citation accuracy ≥80% gate; mis-citation audit |
| 12. Search index staleness / main-thread blocking | Phase 8 (tokenizer contract, async hydration) + Phase 9 (index lifecycle) | Delete-note-outside-app test; <50ms search at 50MB vault |
| 13. Unbounded agent loops | Phase 4 (step counters, circuit breaker) + Phase 11 (live budget authority) + Phase 18 (per-tool budgets) | Phase 19: looping-fixture chaos test halts within budget |
| 14. Permission fatigue | Phase 18 (risk tiers, leases, batching) + Phase 2 (consent model) + Phase 4 (gating) | Phase 12: escalation rate ≤15%; Phase 19 telemetry on accept-time |
| 15. Web Store review rejections | Phase 1 (least-privilege permission gate) + Phase 19 (permission audit, privacy policy, review slack) | Pre-submission audit script: zero unused permissions, secrets scan clean |

## Sources

- Chrome extension docs — service worker lifecycle (30s idle, 5-min invocation cap, fetch does not keep alive): https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Chrome extension storage docs — quotas (local 10MB, session 10MB hard cap, sync 100KB), write-rate limits: https://developer.chrome.com/docs/extensions/reference/api/storage
- Chrome extension network requests — content-script CORS/CSP (Chrome 85+), host permission bypass: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Chrome extension messaging — `return true`/promise contract, port lifecycle, "port closed before response": https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- Chrome Web Store review policy / troubleshooting — permissions, privacy policy, remote code, extended review: https://developer.chrome.com/docs/webstore/troubleshooting (MEDIUM, cross-checked with review-policy pages)
- SSE streaming pitfalls (chunk boundaries, keep-alives, proxy buffering): https://multigrid.ai/learn/streaming-responses (MEDIUM)
- Context-budget practice (output reservation, 60–80% compaction, latency cliffs): https://multigrid.ai/learn/context-budget (MEDIUM; Anthropic context-compaction guidance cross-checked)
- OWASP LLM Prompt Injection Prevention Cheat Sheet (layered defenses): https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html (MEDIUM)
- Structured-output reliability — validation/repair loops, retry recovery ~80%, multi-call compounding: https://claudelab.net/en/articles/api-sdk/claude-api-structured-output-schema-validation-repair-loop (MEDIUM; provider docs on constrained decoding cross-checked)
- RAG citation hallucination — mis-citation vs fabrication (~80% unverifiable facts are mis-citation, ~74% citation accuracy), chunking error classes E1–E6: https://arxiv.org/html/2601.05866v3 (MEDIUM, single-source — flag for Phase 12 calibration)
- Infinite agent loops audit — 68 confirmed loops in 47 of 6,549 projects, 91.9% precision: https://arxiv.org/html/2607.01641 (MEDIUM, single-source — flag for Phase 4 budget design)
- Obsidian sync conflict behavior (merge duplication, last-write-wins): https://github.com/obsidianmd/obsidian-help (MEDIUM, community-confirmed)
- Obsidian Smart Rename alias pattern: https://github.com/mnaoumov/obsidian-smart-rename (MEDIUM)
- MiniSearch design doc — in-memory radix tree, async addAll, tokenizer/processTerm customization: https://github.com/lucaong/minisearch/blob/master/DESIGN_DOCUMENT.md (HIGH — official)
- Permission fatigue / T10 "Overwhelming Human-in-the-Loop" and alert-ignore rates (67% ignored at 4,484 alerts/day SOC study): UK AI Security Committee report + SOC literature via web search (LOW-MEDIUM — treat as directional, verify in Phase 18 design)
- IAL-SCAN "$47k in 11 days" runaway-cost incident reporting: https://arxiv.org/html/2607.01641 + press coverage (MEDIUM)
- Codebase-specific confirmations (CONCERNS.md): simulated AI responses, demo data defaults, localhost:12380 default endpoint, SSE parser format coupling, dual messaging paths, 9 permissions/5 unused, vacuous isolation tests — verify against `src/` in Phase 1 cleanup

---
*Pitfalls research for: NowPilot — privacy-first Chrome MV3 AI assistant + local-first knowledge platform (ServiceNow Support Engineers)*
*Researched: 2026-08-19*
