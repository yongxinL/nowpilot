# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

### Build & Development

```bash
# Development — Vite dev server (port 3000)
pnpm dev
pnpm start

# Extension development — WXT build/watch (generates .wxt/)
pnpm build:ext  # one-time build
pnpm dev:ext    # watch + reload

# Production build
pnpm build      # tsc + vite build (all surfaces)

# Type checking
pnpm lint       # tsc --noEmit

# Preview built output
pnpm preview
```

### Testing

```bash
# All tests
pnpm test           # run once
pnpm test:watch     # watch mode

# Run phase-specific gates (always run these before committing phase work)
pnpm verify:phase-1     # type check + tests for Phase 1 requirements
pnpm verify:phase-N     # phase N tests (defined in package.json for N=1..19)
pnpm verify:all         # full verify: type check + all tests + lint

# Specific test suites
pnpm test:perf        # performance benchmarks
pnpm test:isolation   # sandbox isolation tests
```

When implementing a phase, the corresponding `verify:phase-N` gate must pass before the phase is complete. The gate combines type checking with phase-specific tests (see package.json for exact test paths per phase).

### Common Dev Tasks

```bash
# Quick type check after editing
pnpm lint

# Run a single test file
pnpm test -- path/to/test.test.ts

# Watch a single test suite
pnpm test:watch -- path/to/test.test.ts

# Debug a test (opens inspector on Node.js runtime)
node --inspect-brk ./node_modules/vitest/vitest.mjs run tests/core/...
```

## Architecture Overview

NowPilot is a Chrome MV3 extension (built with WXT) that works as an **AI assistant + personal knowledge base for ServiceNow Support Engineers**. It runs entirely against user-configured AI providers (OpenAI, Anthropic, Gemini, Ollama) with no data leaving the machine unless explicitly opted in.

### Entry Points (in `entrypoints/`)

- **`background.ts`** — Background Service Worker: stateless typed router. **Phase 1 registers exactly:** `BackgroundRouter.register()` (single message entry symbol; internally `MessageBus.init()`), `chrome.sidePanel.setPanelBehavior(...)`, and the `onboardingComplete` flag init (D-13). NO AI, NO IndexedDB. Context menus (ContextMenuHost) → Phase 17; CORS proxy / alarms / lifecycle managers → later phases (leave Phase-N TODO comments so §5.1's final background shape is reachable additively).
- **`sidepanel/main.tsx`** — Side Panel UI: chat, command palette, compact interface; shares WorkspaceStore with Standalone.
- **`standalone/main.tsx`** — Full-tab Standalone view: complete workspace, notes, tools; persistent like side panel.
- **`options/main.tsx`** — Settings surface: AI provider config, theme, language, prompts.
- **`content/core.content.ts`** — Content script (ISOLATED world): page extraction only, <50 KB, no UI injection. Sends stripped HTML + metadata to panel via RuntimeEnvelope. (Entrypoints stay at the project ROOT `entrypoints/` per D-07a — the WXT default — but the content-script path shape is normalized to the directory form `entrypoints/content/core.content.ts`.)

### Core Subsystems (`src/core/`)

| Directory | Purpose |
|-----------|---------|
| **runtime** | RuntimeEnvelope (typed message wrapper), PortReader, workerState machine |
| **messaging** | MessageBus (one-shot dispatch), ResponseEnvelope, envelope handler registration |
| **events** | EventBus (in-surface sync), BroadcastBus (cross-surface pub/sub via BroadcastChannel) |
| **workspace** | WorkspaceStore (Zustand + immer, chrome.storage.local persistence), WorkspaceRouter (tab dedup), WorkspaceSync (cross-surface sync) |
| **theme** | ThemeStore (Zustand + chromeStorageAdapter), theme system + color tokens |
| **commands** | CommandRegistry, keybindings (Phase 1 registers the Flow 10 base set on both surfaces per D-08; the full RICH command catalog — suggestion templates, slash commands — lands in Phase 15) |
| **registry** | Registry (generic), AddonRegistry, PageRegistry, CommandRegistry (all inherit Registry base) |
| **prompts** | Prompt templates + i18n scaffolding |
| **log** | debugLog + TraceRedactor (redacts sensitive data before logging) |
| **i18n** | String catalog + locale resolution |

### Shared State Model

```
┌─────────────────────────────────────────────────────────────┐
│ chrome.storage.session (transient, ≤5 min)                  │
│  • np_workspace_primary {tabId, surface, electedAt}         │
│  • np_active_stream {conversationId, operationId}           │
│  • Auth tokens (never in local)                             │
├─────────────────────────────────────────────────────────────┤
│ chrome.storage.local (persisted, survives restart)          │
│  • np_workspace {workspaceId, conversationId, ...}          │
│  • np_providers, np_flags, np_store                         │
├─────────────────────────────────────────────────────────────┤
│ chrome.storage.sync (small, cross-device)                   │
│  • np_theme {mode, pack}  (authoritative — §15.1/APPR-03)   │
├─────────────────────────────────────────────────────────────┤
│ IndexedDB (large bodies, key-range queries)                 │
│  • ChatHistoryDB, NotesDB, MemoryDB, WriteJournalDB, etc.   │
├─────────────────────────────────────────────────────────────┤
│ BroadcastChannel (cross-surface pub/sub)                    │
│  • np_workspace (state sync)                                │
│  • np_theme (theme sync)                                    │
└─────────────────────────────────────────────────────────────┘
```

**Single-Writer Pattern:** WorkspaceStore exposes `isPrimaryWriter(): boolean`. **In Phase 1 this predicate returns `true` for any caller** — the signature/interface is owned now (D-16), but the election semantics (CAS on np_workspace_primary + heartbeat, read-only secondary mirrors, gated message-body writes) are **Phase 2**. Do NOT implement election in Phase 1; document the Phase-2 swap point in a code comment.

**Direction rule:** state flows surface → storage → BroadcastChannel → other surfaces. No surface reads another surface's in-memory store.

### AI Provider Service

Located in `src/services/aiProvider.ts`. Handles:
- SSE streaming via `fetch` + `ReadableStream` (not `EventSource` — need POST + auth headers)
- Model discovery
- Simulated fallback mode
- Runs ONLY in UI contexts (side panel, standalone), never in the background SW

## Code Organization & Conventions

### Stores (Zustand + immer)

**File pattern:** `src/store/*.ts` (or `src/core/workspace/WorkspaceStore.ts`)

Stores use Zustand with immer middleware for immutable updates. Persist to `chrome.storage.*` via adapters (e.g., `chromeStorageAdapter`). Example:

```typescript
export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set) => ({
      activeTab: null,
      setActiveTab: (id) => set({ activeTab: id }),
    }),
    {
      name: 'np_extension',
      storage: chromeStorageAdapter('local'), // or 'sync'
    }
  )
);
```

### Registries (base class: `Registry`)

Command, addon, and page registries all inherit from a generic `Registry` base. Registration is declarative and happens at module load. Query the registry when you need to discover registered commands, pages, or addons.

```typescript
// Register a command
CommandRegistry.register({
  id: 'focus-chat',
  label: 'Focus Chat Input',
  handler: () => { /* ... */ },
});

// Use in UI
const { value: commands } = useQuery(() => CommandRegistry.query());
```

### Message Envelopes (typed, async dispatch)

All cross-context messages use `RuntimeEnvelope` (background SW ↔ content scripts, surfaces). Structure:

```typescript
const envelope = createEnvelope('PAGE_EXTRACTION', operationId, {
  url: 'https://example.com',
  html: '<html>...</html>',
});

const response = await MessageBus.dispatch(envelope);
if (response.ok) {
  const payload = response.data as ExtractionResult;
} else {
  console.error(response.error);
}
```

### Workspace & Cross-Surface Sync

`WorkspaceStore` is the canonical shared state. Both side panel and standalone load from `chrome.storage.local.np_workspace`. **Phase 1:** `isPrimaryWriter()` returns true (no election). **Phase 2** adds primary election (CAS on np_workspace_primary + heartbeat on BroadcastChannel, primary:secondary = 3s heartbeat + 2-miss re-election) — not implemented in Phase 1.

When writing workspace state, use `WorkspaceStore.setState()` → automatic persist + BroadcastChannel broadcast → secondary surfaces apply via version-gated last-write-wins.

### Logging & Sensitive Data

Use `debugLog(code, data)` for all debugging, never raw `console.log`. The `TraceRedactor` strips API keys, tokens, and user content before logs are stored or sent.

```typescript
debugLog('AI_STREAM_ERROR', { providerId, error: err.message });
```

## Testing Strategy

### Setup & Mocks

Tests run in jsdom with Chrome API mocks (see `tests/setup.ts`):
- `chrome.storage.local` (Map-backed)
- `chrome.storage.session` (Map-backed)
- `BroadcastChannel` (in-memory instances)
- `ResizeObserver`, `matchMedia` (Ant Design required mocks)

Inspect or reset mocks between tests:

```typescript
const storage = (globalThis as any).__chromeStorageMap;
storage.clear();
```

### Test Structure

- **Unit tests:** Core logic, stores, utilities in `tests/core/`
- **Isolation tests:** Boundary tests (no-UI in content script, etc.) in `tests/isolation/`
- **Perf tests:** Benchmarks in `tests/perf/`

Each phase has a corresponding `verify:phase-N` gate (list in package.json) that runs only the tests for that phase.

### Writing Tests

Use vitest (with globals enabled). Example:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceStore } from '@/core/workspace/WorkspaceStore';

describe('WorkspaceStore', () => {
  beforeEach(async () => {
    // Reset mocks
    (globalThis as any).__chromeStorageMap.clear();
    // Re-init store
    await WorkspaceStore.hydrate();
  });

  it('persists to chrome.storage.local', async () => {
    WorkspaceStore.setState({ workspaceId: 'test-id' });
    await new Promise((r) => setTimeout(r, 10)); // batch persist
    const stored = (globalThis as any).__chromeStorageMap;
    expect(stored.has('np_workspace')).toBe(true);
  });
});
```

## Key Constraints & Architecture Patterns

### MV3 Boundaries

1. **Background SW is stateless & ephemeral:**
   - No AI/IndexedDB/EventSource/setInterval in background.ts
   - All persistent state → `chrome.storage.*`
   - All streaming/AI → UI contexts only (side panel, standalone)
   - SW can be killed after 30s idle or 5 min per request (Chrome's behavior)

2. **Content scripts are extraction-only, ISOLATED world:**
   - No UI injection (deferred to v0.2)
   - No host-page write-back (clipboard-only in v0.1)
   - <50 KB bundle (CWS scrutinizes large bundles)
   - Never bundle Defuddle parser; panel-side parsing instead

3. **Permission minimalism (Phase 1):**
   - Only `sidePanel`, `storage`, `tabs` in Phase 1 wxt.config.ts
   - `cookies`, `scripting`, `contextMenus` → Phase 17
   - `alarms` → when KeepAliveManager ships; `notifications` → when first used; unlimitedStorage → Phase 2 (ADR-STACK-02); `declarativeNetRequest` → never in v0.1 (§16.4)
   - Never `all_urls`; only `*://*.service-now.com/*` and `*://support.servicenow.com/*`

### Type Safety & TypeScript

- **Strict mode: ON from Phase 1** (`strict: true` in tsconfig per spec §7.8 / D-21). Phase 1 sweeps trivial casts to real types and suppresses genuinely-structural residue with `// @ts-expect-error NP-STRICT-<n>: <reason>` behind a declared ceiling enforced by a grep test. `verify:phase-1` is `tsc --noEmit` — `noEmitOnError` is a no-op, so the gate only goes green when errors are gone or suppressed. Phase 2–3 reduces the NP-STRICT ceiling to 0.
- **Path alias:** `@/*` resolves to project root (configured in tsconfig.json + vite.config.ts + vitest.config.ts)
- **Zod schemas:** All cross-boundary data (message envelopes, storage shapes, API responses) use Zod validation

### Privacy & Security

- **No data leaves the machine unless explicitly opted in** (user picks their own AI provider)
- **Secrets in `chrome.storage.session`** (session-scoped, cleared on tab close + browser restart)
- **Non-secrets in `chrome.storage.local`** (metadata, settings)
- **Sensitive data redaction:** Use TraceRedactor before any logging

### Phase Gates & Verification

Each phase of development has a corresponding `verify:phase-N` script in package.json. A phase is DONE when:
1. Code implements all phase requirements (from `.planning/PRODUCT_SPEC_v0_1.md` §18)
2. `pnpm verify:phase-N` passes (type check + phase-specific tests)
3. Progress recorded in `.planning/VERIFICATION.md` with evidence

Never reorder phases; always implement in spec §18 order (1→19).

## Reference Materials

For detailed architecture, data flows, and hard technical patterns, see:

- **`.planning/PROJECT.md`** — project context, constraints, key decisions
- **`.planning/PRODUCT_SPEC_v0_1.md`** — authoritative spec (§18 = canonical phase order, §8 = architecture)
- **`.planning/research/ARCHITECTURE.md`** — architecture validation, data flows, known-good patterns (canonical location; the research pack — ARCHITECTURE/FEATURES/PITFALLS/STACK/SUMMARY — lives directly under `.planning/`, not `.planning/research/`)
- **`.planning/RESEARCH-RECONCILIATION.md`** — stack decisions, versions, ADRs
- **`.planning/ROADMAP.md`** — 19 phases with requirements per phase
- **`.planning/STATE.md`** — current milestone, phase, decisions, blockers

## When You Get Stuck

1. **Type errors?** Check `.planning/STATE.md` — if NP-STRICT sweep is active, expect `@ts-expect-error NP-STRICT` markers.
2. **Storage not persisting?** Verify the adapter (chromeStorageAdapter vs immer). Phase 2 adds proper transaction handling.
3. **Cross-surface state sync not working?** Debug via `BroadcastChannel` heartbeat (should see `WORKSPACE_UPDATED` messages every 3s).
4. **Content script extraction failing?** Check that payload is <2 MB and base URL is stamped before parsing.
5. **Tests hanging?** Watch for missing `await` on async storage calls or BroadcastChannel mocks.

## Phase Work Template

When starting a new phase:

1. Read `.planning/PRODUCT_SPEC_v0_1.md` §18, section for your phase
2. Find phase requirements in `.planning/REQUIREMENTS.md` (anchored to spec §IDs)
3. Run `/gsd-plan-phase N` to get a detailed plan
4. Execute the plan, test each piece against phase-specific tests
5. Run `pnpm verify:phase-N` to gate completion
6. Record acceptance + evidence in `.planning/VERIFICATION.md`
