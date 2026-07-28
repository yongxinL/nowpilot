# Architecture Patterns

**Domain:** Chrome MV3 AI Assistant Extension + Personal Knowledge Platform
**Researched:** 2026-07-28

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome MV3 Extension                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Service       │  │ Side Panel   │  │ Full App Tab          │ │
│  │ Worker        │  │ (sidepanel/)  │  │ (app.html)            │ │
│  │              │  │              │  │                       │ │
│  │ chrome.storage│  │ React 19     │  │ React 19              │ │
│  │ chrome.alarms │  │ antd 6       │  │ antd 6                │ │
│  │ fetch()       │  │ @antd/x 2    │  │ @antd/x 2             │ │
│  │ (NO IndexedDB)│  │ XMarkdown    │  │ XMarkdown             │ │
│  │ (NO DOM)      │  │ Motion 12    │  │ Motion 12             │ │
│  │ (NO React)    │  │              │  │                       │ │
│  │              │  │ Zustand v5    │  │ Zustand v5            │ │
│  │              │  │ (PRIMARY      │  │ (secondary,           │ │
│  │              │  │  Workspace)   │  │  mirror r/o)          │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
│         │                 │                       │              │
│         └────────┬────────┴───────────────┬───────┘              │
│                  │   Message Passing      │                      │
│                  │   (chrome.runtime)     │                      │
│         ┌────────┴───────────────────────┴───────┐              │
│         │            Content Scripts              │              │
│         │  (extraction only, no UI, <50KB)       │              │
│         │                                        │              │
│         │  defuddle v0.19  →  MiniSearch (ephem) │              │
│         │  PageContent → Service Worker → Chat   │              │
│         └────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Runtime Context | Responsibility | Communicates With |
|-----------|----------------|---------------|-------------------|
| **AgentOrchestrator** | Side Panel / Full App | Orchestrates AI interactions: PlannerService→ExecutorService→RendererService pipeline. Owns all AI data flow (NOT @ant-design/x-sdk). | ProviderRouter, ContextOptimizer, MemoryEngine, ToolRegistry |
| **ProviderRouter** | Side Panel / Full App | Routes AI requests to configured providers with fallback (OpenAI → Anthropic → Google → Ollama). Circuit breaker pattern. | AI SDK streamText/generateText |
| **PlannerService** | Side Panel / Full App | Sends cheap model (Haiku/Flash) call to decide: answer / run_tool / ask_clarification. Returns PlannerDecision (Zod discriminated union). | ProviderRouter, AgentOrchestrator |
| **ExecutorService** | Side Panel / Full App | Deterministically validates and executes tool calls. No AI involvement — pure validation against Zod schemas. | ToolRegistry, AgentOrchestrator |
| **RendererService** | Side Panel / Full App | Renders final answer with concise flash response. Formats for Bubble + XMarkdown display. | AgentOrchestrator, DOMPurify |
| **ContextOptimizer** | Side Panel / Full App | Dynamic token budgets, degradation pipeline, minimal mode for tiny models. PromptCacheManager for per-provider cache hints. | AgentOrchestrator, ProviderRouter |
| **MemoryEngine** | Side Panel / Full App | Conversation memory (summary + recent turns), UserMemory (cross-session facts, scored retrieval), PreferenceMemory (response style, persona). Memory writes only from primary surface. | AgentOrchestrator, IndexedDB |
| **WorkspaceStore** | Side Panel / Full App | Zustand store shared across both surfaces. Single-writer primary election via BroadcastBus. AI state, notes state, UI state. | BroadcastBus, chrome.storage.local (persistence) |
| **PageContentService** | Content Script + Side Panel | Layered extraction (defuddle → APC-lite → ServiceNow API). Ephemeral MiniSearch index. Per-tab cache with SPA-nav invalidation. | Content Script, AgentOrchestrator |
| **NoteStore** | Side Panel / Full App | Atomic notes CRUD. MiniSearch full-text index. Wikilink resolution. Backlink computation. Cosine similarity for link suggestions. | MiniSearch, IndexedDB (idb), yaml (filesystem sync) |
| **FilesystemSync** | Side Panel / Full App | One-way app→FS export as .md with YAML frontmatter. Restore from folder with additive upsert. | NoteStore, yaml, File System Access API |
| **ToolRegistry** | Side Panel / Full App | 12 built-in MCP tools + external MCP client (StreamableHTTP). Permission-gated tool execution. | ExecutorService, External MCP servers |
| **AITransactionLog** | Side Panel | Logs every AI interaction: prompt, tool calls, provider, timing. TraceRedactor for secret redaction. | AgentOrchestrator, IndexedDB, DiagnosticsPanel |
| **DOMPurify** | Side Panel / Full App | Sanitizes ALL AI-generated content before rendering. XSS prevention gate. | RendererService, Bubble/XMarkdown components |

### Data Flow

```
User Input → IntentClassifier (URL pattern, no LLM)
  → AgentOrchestrator
    → PersonaInjector (prepend persona block)
    → ContextOptimizer (token budget, degradation)
    → MemoryEngine (inject relevant memories)
    → PlannerService (haiku: answer/run_tool/ask_clarification?)
      ├── answer → RendererService → DOMPurify → Bubble/XMarkdown
      ├── run_tool → ExecutorService (validate + execute)
      │   → PlannerService (incorporate tool result)
      │   → (loop until answer or step limit)
      └── ask_clarification → ClarificationChipper → User Response
```

### Storage Architecture

```
┌─────────────────────────────────────────────┐
│  chrome.storage.session (Memory, ephemeral)  │
│  ├── API keys (AES-GCM encrypted)            │
│  └── Session tokens                          │
├─────────────────────────────────────────────┤
│  chrome.storage.local (Disk, ~10MB)          │
│  ├── Workspace state (serialized Zustand)    │
│  ├── User preferences                        │
│  └── Extension settings                      │
├─────────────────────────────────────────────┤
│  IndexedDB (Disk, unlimited*)                │
│  ├── Chat messages (idb, conversations store)│
│  ├── Notes + wikilinks (idb, notes store)    │
│  ├── AI transaction logs (idb, logs store)   │
│  ├── Memory facts (idb, memory store)        │
│  └── MiniSearch index (ephemeral, rebuild)   │
│  *Available only in extension pages          │
│   (Side Panel, Full App), NOT service worker │
└─────────────────────────────────────────────┘
```

## Patterns to Follow

### Pattern 1: Slices Pattern for Shared State

**What:** Compose Zustand store from independent slices using `StateCreator`, with single-writer primary election via BroadcastBus.

**When:** Any state that must be shared across Side Panel and Full App Tab surfaces.

**Rationale:** MV3 allows multiple extension pages to be open simultaneously. Without a single-writer pattern, both surfaces could mutate the same IndexedDB data, causing conflicts. The BroadcastBus elects the most recently active surface as primary writer; the secondary surface mirrors read-only.

```typescript
// WorkspaceStore composition pattern
import { create, StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ChatSlice { /* ... */ }
interface NotesSlice { /* ... */ }
interface UISlice { /* ... */ }

const createChatSlice: StateCreator<ChatSlice & NotesSlice & UISlice, [['zustand/immer', never]], [], ChatSlice> = (set, get) => ({
  // chat state + actions
});

// Combine slices
const useWorkspaceStore = create<ChatSlice & NotesSlice & UISlice>()(
  immer((...a) => ({
    ...createChatSlice(...a),
    ...createNotesSlice(...a),
    ...createUISlice(...a),
  }))
);
```

### Pattern 2: MV3 Service Worker Synchronous Listeners

**What:** Register all event listeners at the top level of the service worker script, never inside promises or callbacks.

**When:** Every service worker event listener (`chrome.runtime.onMessage`, `chrome.alarms.onAlarm`, `chrome.action.onClicked`).

**Rationale:** MV3 service workers terminate when idle. When Chrome restarts a worker to handle an event, only top-level listeners are registered before the event fires. Listeners registered inside async callbacks or `.then()` chains may not exist yet when the event arrives — resulting in silently dropped events.

```typescript
// CORRECT: Top-level synchronous registration
chrome.action.onClicked.addListener(handleActionClick);
chrome.runtime.onMessage.addListener(handleMessage);

// Load async config AFTER registering listeners
chrome.storage.local.get(['settings'], ({ settings }) => {
  applySettings(settings);
});

// WRONG: Listener inside async callback
chrome.storage.local.get(['settings'], ({ settings }) => {
  chrome.runtime.onMessage.addListener(handleMessage); // MISSED EVENTS!
});
```

### Pattern 3: AI SDK Tool Calling with Zod v4 Discriminated Union

**What:** Define tool schemas with Zod v4, use `stopWhen: isStepCount(n)` for multi-step execution, validate tool results with `ExecutorService`.

**When:** Any AI interaction that involves tool calling (PlannerService→ExecutorService pipeline).

**Rationale:** The PlannerDecisionSchema is a 3-branch discriminated union (answer/run_tool/ask_clarification) — safe for cheap models because the ExecutorService validates all tool calls deterministically before execution. Zod v4's `z.strictObject()` ensures no unexpected keys pass validation.

```typescript
import { z } from 'zod';
import { generateText, tool, isStepCount } from 'ai';

const PlannerDecision = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('answer'), content: z.string() }),
  z.strictObject({ action: z.literal('run_tool'), tool: z.string(), args: z.record(z.unknown()) }),
  z.strictObject({ action: z.literal('ask_clarification'), question: z.string() }),
]);

const tools = {
  searchNotes: tool({
    description: 'Search user notes',
    inputSchema: z.strictObject({ query: z.string() }),
    execute: async ({ query }) => { /* validated by ExecutorService first */ },
  }),
};

const result = await generateText({
  model: provider.languageModel('haiku'),
  instructions: 'You are a helpful assistant.',
  messages: [...],
  tools,
  stopWhen: isStepCount(5),
});
```

### Pattern 4: DOMPurify Gate for All AI Content

**What:** Run ALL AI-generated content through `DOMPurify.sanitize()` before passing to antd-x Bubble/XMarkdown components.

**When:** Every time AI content is rendered. No exceptions.

**Rationale:** AI-generated content is untrusted input. Even markdown rendered through XMarkdown can contain embedded HTML/scripts. DOMPurify strips dangerous elements while preserving safe formatting. Use `addHook()` to allow-list specific attributes (e.g., `target="_blank"` on links).

```typescript
import DOMPurify from 'dompurify';

function sanitizeAiContent(rawContent: string): string {
  return DOMPurify.sanitize(rawContent, {
    ALLOWED_TAGS: ['a', 'code', 'pre', 'strong', 'em', 'ul', 'ol', 'li', 'p', 'br', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: IndexedDB in Service Worker

**What:** Attempting to use IndexedDB (`idb`/`openDB()`) inside the MV3 service worker.

**Why bad:** MV3 service workers do NOT have access to IndexedDB. The `indexedDB` global is undefined. Any code that tries to open a database from the service worker will throw.

**Instead:** Use `chrome.storage.session` for ephemeral session data, `chrome.storage.local` for persisted configuration. All IndexedDB operations (chat history, notes, logs) must happen in extension pages (Side Panel or Full App Tab). The service worker communicates with extension pages via `chrome.runtime.sendMessage`.

### Anti-Pattern 2: @ant-design/x-sdk in Data Flow

**What:** Using `useXChat`, `OpenAIChatProvider`, or `XRequest` from `@ant-design/x-sdk` to handle AI requests.

**Why bad:** The x-sdk would let UI components call AI providers directly, bypassing the entire AgentOrchestrator pipeline: ProviderRouter (fallback/circuit breaker), ContextOptimizer (token budgets), MemoryEngine (memory injection), PlannerService→ExecutorService→RendererService (tier caps and tool validation). This would break the cost-effective runtime architecture and the security model.

**Instead:** Use antd-x UI components (Bubble, Sender, Conversations) as presentational components only. Wire them to Zustand state that the AgentOrchestrator controls. The AgentOrchestrator uses AI SDK's `streamText`/`generateText` directly.

### Anti-Pattern 3: Async Listener Registration in Service Worker

**What:** Registering `chrome.runtime.onMessage.addListener()` inside a `.then()` callback or async function.

**Why bad:** The service worker may be terminated and re-started between the time the async operation completes and the event arrives. The listener registration never happens, and events are silently dropped.

**Instead:** Register ALL listeners at the top level of the service worker script. Move any async initialization logic after listener registration, or use `chrome.storage` to persist state that must survive worker restarts.

### Anti-Pattern 4: framer-motion Instead of motion

**What:** Installing `framer-motion` (the old npm package) instead of `motion`.

**Why bad:** The `framer-motion` package was rebranded to `motion` and is no longer the canonical distribution. It receives no updates and may have compatibility issues with React 19. The import path changed from `framer-motion` to `motion/react`.

**Instead:** Install `motion` and import from `motion/react`. The API is identical but the package is actively maintained.

## Scalability Considerations

| Concern | At 100 notes | At 1K notes | At 10K notes |
|---------|--------------|-------------|--------------|
| MiniSearch index | Instant search, <1MB memory | Fast search, ~5MB memory | May need pagination, ~30MB memory. Consider lazy-loading note content. |
| IndexedDB storage | <10MB total | ~50MB total | ~500MB total. Request `unlimitedStorage` permission. |
| AI token budgets | Full context fits | ContextOptimizer degradation kicks in | Minimal mode for tiny models. Memory retrieval scoring critical. |
| WorkspaceStore | Single store, <1MB serialized | Single store, ~5MB serialized | Consider store splitting (notes slice loads on demand). |
| Filesystem sync | Instant export | Seconds to export | May need progress indicator for 10K+ notes. |
| Chat history | All conversations load fast | Conversations list pagination needed | Archive old conversations. Search across conversations. |

## Sources

- Context7 `/pmndrs/zustand` — Slices pattern, Immer middleware (HIGH)
- Context7 `/vercel/ai` — Tool calling, multi-step execution, streamText API (HIGH)
- Context7 `/jakearchibald/idb` — IndexedDB type-safe API, transactions (HIGH)
- `developer.chrome.com` — Service worker lifecycle, synchronous listener registration, storage API (HIGH)
- NowPilot PROJECT.md — Architecture decisions, Planner→Executor→Renderer pipeline, component boundaries (HIGH)
