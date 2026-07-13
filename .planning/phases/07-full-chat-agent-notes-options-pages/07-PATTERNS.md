# Phase 07: Full Chat, Agent, Notes, Options Pages - Pattern Map

**Mapped:** 2026-07-13
**Files classified:** 38 new/modified, 4 hook helpers
**Analogs found:** 35 / 38

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useStreamingLLM.ts` | hook | streaming (AsyncGenerator → React state) | `src/core/ai/streaming/ChunkBuffer.ts` + `src/core/stores/workspaceStore.ts` | composite |
| `src/hooks/useChat.ts` | hook | streaming + CRUD (AgentOrchestrator → ChatHistoryDB) | `src/core/stores/workspaceStore.ts` (Zustand pattern) | partial |
| `src/hooks/useAgent.ts` | hook | streaming + event-driven (AgentOrchestrator → ThoughtChain state) | `src/hooks/useChat.ts` (sibling pattern) | new |
| `src/hooks/useWorkspace.ts` | hook (selector) | read (WorkspaceStore) | `src/core/stores/workspaceStore.ts` useWorkspaceStore | role-match |
| `src/hooks/useTheme.ts` | hook (selector) | read (ThemeStore) | `src/core/stores/themeStore.ts` useThemeStore | role-match |
| `src/core/pages/ChatPage.tsx` | page component | request-response (hook → Shell renderActivePage) | `src/core/components/ErrorBoundary.tsx` (page wiring) | partial |
| `src/core/pages/AgentPage.tsx` | page component | request-response (hook → Shell renderActivePage) | `src/core/pages/ChatPage.tsx` (sibling pattern) | new |
| `src/core/pages/NotesPage.tsx` | page component | CRUD (NotesDB → local state) | `src/core/pages/ChatPage.tsx` (page wiring) | partial |
| `src/core/pages/OptionsPage.tsx` | page component (router) | transformation (sectionId → renderSectionContent) | `src/core/pages/OptionsPage.tsx` (existing stub — extends) | self |
| `src/core/prompts/PromptManager.ts` | core service | CRUD (chrome.storage.local) | `src/core/ai/tools/ToolRegistry.ts` | role-match |
| `src/core/prompts/TemplateEngine.ts` | core service (utility) | transform ({{var}} → value) | `src/core/context/ContextOptimizer.ts` (template-like section join) | partial |
| `src/core/prompts/builtinTemplates.ts` | config/data | static data | `src/core/navigation/navConfig.ts` (config arrays) | role-match |
| `src/core/slash/SlashCommandRegistry.ts` | core service | CRUD (registration + dispatch) | `src/core/ai/tools/ToolRegistry.ts` | exact |
| `src/core/notes/LinkParser.ts` | core service | transform (regex → MiniSearch → resolution) | `src/core/search/MiniSearchIndex.ts` | role-match |
| `src/core/notes/NoteGraph.ts` | core service | transform (NotesDB → d3-force graph data) | `src/core/search/MiniSearchIndex.ts` (class + singleton) | partial |
| `src/core/permissions/PermissionStore.ts` | core service | CRUD (chrome.storage.local `np_mcp_permissions`) | `src/core/ai/tools/PermissionService.ts` | role-match |
| `src/components/options/ProvidersSection.tsx` | options section | form (AntD Form → providerStore) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/ModelsSection.tsx` | options section | form (AntD Form.List → providerStore) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/MCPSection.tsx` | options section | form (table → chrome.storage.local) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/PromptsSection.tsx` | options section | form (rich editor → chrome.storage.local) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/SlashSection.tsx` | options section | form (Form.List → chrome.storage.local) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/MemorySection.tsx` | options section | read-only list (MemoryDB → display) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/ImportExportSection.tsx` | options section | file I/O (upload/download → jszip) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/FeatureFlagsSection.tsx` | options section | form (toggles → chrome.storage.local) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/AddonSettingsSection.tsx` | options section | form (namespaced settings) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/AppearanceSection.tsx` | options section | form (theme/density → themeStore) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/options/AboutSection.tsx` | options section | static display (package.json → markdown) | `src/components/options/DiagnosticsSection.tsx` | role-match |
| `src/components/notes/BacklinksPanel.tsx` | UI component | read (NotesDB → computed backlinks) | `src/components/options/DiagnosticsPanel.tsx` (sub-component) | partial |
| `src/components/notes/WikilinkAutocomplete.tsx` | UI component | search (MiniSearch → dropdown) | `src/components/options/OptionsRoot.tsx` (search input pattern) | partial |
| `src/components/notes/NoteGraphView.tsx` | UI component | transform (graph data → d3-force canvas) | `src/components/diagnostics/ProviderTimeline.tsx` (canvas-like UI) | partial |
| `src/components/patterns/ChatMessage.tsx` | UI component (wrapper) | render (message content → XMarkdown) | `src/components/common/WorkspaceStatusBar.tsx` (presentational) | partial |
| `src/components/patterns/HistoryListItem.tsx` | UI component (list item) | render (ConversationMeta → list item) | `src/components/sider/SiderMenuItem.tsx` | role-match |
| `src/components/patterns/ToolCard.tsx` | UI component (expandable) | render (ToolExecutionResult → ThoughtChain node) | `src/components/diagnostics/ToolCallDescriptions.tsx` | role-match |
| `src/components/patterns/SkillMessageRenderer.tsx` | UI component | render (skill output → XMarkdown) | `src/components/patterns/ChatMessage.tsx` | partial |
| `src/components/patterns/SourceCard.tsx` | UI component | render (source metadata → card) | `src/components/diagnostics/TransactionTable.tsx` (metadata display) | partial |
| `tests/hooks/useStreamingLLM.test.ts` | test | unit (AsyncGenerator mock) | `tests/core/workspaceStore.test.ts` | role-match |
| `tests/hooks/useChat.test.ts` | test | unit/integration | `tests/core/workspaceStore.test.ts` | role-match |
| `tests/hooks/useAgent.test.ts` | test | unit/integration | `tests/core/workspaceStore.test.ts` | role-match |
| `tests/hooks/useWorkspace.test.ts` | test | unit | `tests/core/workspaceStore.test.ts` | exact |
| `tests/components/ChatPage.test.tsx` | test | component | `tests/shell/optionsShell.test.tsx` | role-match |
| `tests/components/OptionsPage.test.tsx` | test | component | `tests/shell/optionsShell.test.tsx` | exact |
| `tests/components/patterns/ChatMessage.test.tsx` | test | component | `tests/shell/optionsShell.test.tsx` | role-match |
| `tests/core/notes/LinkParser.test.ts` | test | unit | `tests/core/search/MiniSearchIndex.test.ts` | role-match |

---

## Pattern Assignments

### 1. `src/hooks/useStreamingLLM.ts` (hook, streaming)

**Analog:** `src/core/ai/streaming/ChunkBuffer.ts` + `src/core/stores/workspaceStore.ts`

**State management pattern** (from workspaceStore.ts lines 1–2, 64–91):
```typescript
import { create } from 'zustand';
// For hooks, use standard React hooks (useState, useRef, useCallback, useEffect)

export interface WorkspaceState {
  // Type exported alongside hook for consumers
}
```

**ChunkBuffer integration pattern** (from ChunkBuffer.ts lines 10–48):
```typescript
export class ChunkBuffer {
  private buffer: string[] = [];
  private rafId: number | null = null;

  constructor(private onFlush: (text: string) => void) {}

  push(text: string): void {
    this.buffer.push(text);
    this.scheduleFlush();
  }

  flush(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.buffer.length > 0) {
      const combined = this.buffer.join('');
      this.buffer = [];
      this.onFlush(combined);
    }
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.buffer = [];
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flush();
    });
  }
}
```

**Core pattern for hook (from RESEARCH.md lines 420–459):**
```typescript
// AsyncGenerator consumption inside React hook
// Uses AgentOrchestrator.runWithContext() → AsyncGenerator<OrchestratorEvent>
// OrchestratorEvent types from pipelineTypes.ts lines 21–29:
type OrchestratorEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'text-complete'; fullText: string }
  | { type: 'plan-created'; decision: PlannerDecisionType }
  | { type: 'tool-called'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; result: ToolExecutionResult }
  | { type: 'error'; message: string }
  | { type: 'context-degraded'; level: 'info' | 'warning'; message: string; step?: number; tier?: ModelContextTier }
  | { type: 'context-error'; code: 'CONTEXT_TOO_LARGE'; estimatedTokens: number; budget: number; message: string };

// Singleton services imported directly:
// agentOrchestrator, contextOptimizer, memoryEngine, chatHistoryDB
```

**Hook signature (per D-01, D-02, D-04):**
```typescript
function useStreamingLLM(config: {
  orchestrator: AgentOrchestrator;
  contextOptimizer: ContextOptimizer;
  memoryEngine: MemoryEngine;
  chatHistoryDB: ChatHistoryDB;
  onTransactionStart?: (operationId: string) => void;
  onTransactionEnd?: (operationId: string) => void;
}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount (Pitfall 2)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
  // ...
}
```

---

### 2. `src/hooks/useChat.ts` (hook, streaming + CRUD)

**Analog:** `src/core/stores/workspaceStore.ts` (Zustand/React state pattern) + `src/core/storage/stores/ChatHistoryDB.ts`

**ChatHistoryDB integration pattern** (from ChatHistoryDB.ts lines 1–97):
```typescript
import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';

export class ChatHistoryDB {
  async createSession(session: { id: string; title: string; created: number; updated: number; starred: boolean; preview: string; }): Promise<void> { /* ... */ }
  async getAllSessions(): Promise<Array<{ id: string; title: string; created: number; updated: number; starred: boolean; preview: string; }>> { /* ... */ }
  async addMessage(message: { id: string; sessionId: string; role: string; content: string; timestamp: number; metadata?: unknown; }): Promise<void> { /* ... */ }
  async getMessagesBySession(sessionId: string): Promise<Array<{ id: string; sessionId: string; role: string; content: string; timestamp: number; metadata?: unknown; }>> { /* ... */ }
}
export const chatHistoryDB = new ChatHistoryDB();
```

**AgentOrchestrator.runWithContext() signature** (from AgentOrchestrator.ts lines 84–87):
```typescript
async *runWithContext(
  optimizedContext: OptimizedContext,
  preferredProviders: string[],
): AsyncGenerator<OrchestratorEvent>
```

**ContextOptimizerInput shape** (from contextTypes.ts lines 69–86):
```typescript
interface ContextOptimizerInput {
  operationId: string;
  providerId: string;
  modelId: string;
  modelContextWindow: number;
  userInput: string;
  systemPrompt: string;
  taskInstructions?: string;
  workspaceContext?: string;
  pageContext?: string;
  toolSchemas?: Array<{ name: string; schema: unknown }>;
  memory?: Array<{ id: string; content: string; score: number }>;
  preferences?: Record<string, unknown>;
  conversationHistory?: Array<{ role: string; content: string }>;
  notes?: Array<{ id: string; content: string }>;
}
```

**MemoryEngine.assemble() pattern** (for context assembly before optimization):
```typescript
// MemoryEngine.assemble(conversationId, userMessage, tier) → MemoryAssembleResult { memory[], conversationContext, preferences }
// Called by hook BEFORE contextOptimizer.optimize()
```

---

### 3. `src/hooks/useAgent.ts` (hook, event-driven + streaming)

**Analog:** `src/hooks/useChat.ts` (shared `useStreamingLLM` foundation)

**ThoughtChainStep type** (from RESEARCH.md lines 551–559):
```typescript
type ThoughtChainStep = {
  key: string;
  title: string;
  description?: string;
  status: 'loading' | 'success' | 'error' | 'abort';
  content?: React.ReactNode;
  collapsible?: boolean;
  blink?: boolean;
};
```

**Permission flow** (per D-05, D-06, D-08):
- Uses `src/core/permissions/PermissionStore.ts` for chrome.storage.local-backed persistence
- `pendingPermission` state + `resolvePermission(decision)` callback
- `Modal.confirm` rendered by page component (not hook — Pitfall 3)

---

### 4. `src/hooks/useWorkspace.ts` (hook, read-only selector)

**Analog:** `src/core/stores/workspaceStore.ts` lines 64–91 (Zustand store pattern)

**Pattern:**
```typescript
import { useWorkspaceStore } from '../core/stores/workspaceStore';

export function useWorkspace() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const conversationId = useWorkspaceStore((s) => s.conversationId);
  const activeProvider = useWorkspaceStore((s) => s.activeProvider);
  const activeSurface = useWorkspaceStore((s) => s.activeSurface);
  const setActiveProvider = useWorkspaceStore((s) => s.setActiveProvider);
  const setConversationId = useWorkspaceStore((s) => s.setConversationId);
  // ... drafts
  return { workspaceId, conversationId, activeProvider, activeSurface, setActiveProvider, setConversationId };
}
```

---

### 5. `src/hooks/useTheme.ts` (hook, read-only selector)

**Analog:** `src/core/stores/themeStore.ts` lines 1–29

**Pattern:**
```typescript
import { useThemeStore } from '../core/stores/themeStore';

export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return { mode, setMode };
}
```

---

### 6. `src/core/pages/ChatPage.tsx` (page component, request-response)

**Analog:** `src/components/standalone/StandaloneRoot.tsx` (renderActivePage schema) + `src/entrypoints/standalone/App.tsx` (page wiring)

**Shell integration pattern** (from StandaloneRoot.tsx lines 78–121, StandaloneApp.tsx lines 83–97):
```typescript
// Pages are React components with NO props contract from the shell.
// They access hooks and stores directly.
// Shell calls: renderActivePage(item: NowPilotNavItem) → returns React.ReactNode
// Page component is passed as {component: ChatPage} in registerNowPilotCorePages.ts

// From registerNowPilotCorePages.ts lines 1–14:
registerCorePages({
  id: 'chat',
  label: 'Chat',
  icon: CommentOutlined,
  component: ChatPage,  // ← This is the page component
  order: 1,
  registerOn: ['sidepanel', 'standalone'],
});
```

**Page component pattern (surface adaptation):**
```typescript
import React from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useChat } from '../../hooks/useChat';
// ... Ant Design X imports

export function ChatPage() {
  const surface = useWorkspaceStore((s) => s.activeSurface);
  const { messages, send, abort, isStreaming, conversations, /* ... */ } = useChat();

  // Surface-adaptive layout:
  // Side Panel (~400px): compact, conversation drawer
  // Full App: full layout with inline conversation sidebar
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Surface-conditional layout per D-13 */}
    </div>
  );
}
```

**ErrorBoundary wrapping** (already provided by shell — from StandaloneRoot.tsx line 54, SidepanelRoot.tsx line 81):
```typescript
// Shell wraps pages in <ErrorBoundary>
// Pages do NOT need their own ErrorBoundary
// ErrorBoundary renders AntD <Result status="error"> on failure
```

---

### 7. `src/core/pages/AgentPage.tsx` (page component, event-driven)

**Same shell integration pattern as ChatPage.** Uses `useAgent()` hook with ThoughtChain + ToolCard rendering.

---

### 8. `src/core/pages/NotesPage.tsx` (page component, CRUD — Full App only)

**Analog:** Same shell integration as ChatPage. NotesPage registered only on `['standalone']` per `registerNowPilotCorePages.ts` line 40.

**NotesDB integration** (from NotesDB.ts lines 1–118):
```typescript
import { notesDB } from '../storage/stores/NotesDB';
// CRUD: createNote, getNote, getAllNotes, updateNote, deleteNote
```

**Layout pattern** (per D-22, D-23, D-25):
```typescript
// Split-pane: note list | editor (textarea + preview) | backlinks
// Flat list with MiniSearch search bar (D-30)
// Graph button opens d3-force view (D-24)
```

---

### 9. `src/core/pages/OptionsPage.tsx` (page component, section router)

**Analog:** Self — existing stub at `src/core/pages/OptionsPage.tsx` lines 1–23

**Current pattern (extends):**
```typescript
import React from 'react';
import { Card, Typography } from 'antd';
import { DiagnosticsSection } from '../../components/options/DiagnosticsSection';

export interface OptionsPageProps {
  sectionId?: string;
}

export function OptionsPage({ sectionId = 'providers' }: OptionsPageProps) {
  // Switch on sectionId to render section components
  // Wired through OptionsApp.tsx renderSectionContent callback:
  // <OptionsRoot renderSectionContent={(id) => <OptionsPage sectionId={id} />} />
}
```

**OptionsApp wiring** (from `src/entrypoints/options/App.tsx` lines 44–48):
```typescript
const renderSectionContent = (sectionId: string) => (
  <div data-options-rendered-section={sectionId} style={{ padding: '8px 0' }}>
    <OptionsPage sectionId={sectionId} />
  </div>
);
```

---

### 10. `src/core/prompts/PromptManager.ts` (core service, CRUD)

**Analog:** `src/core/ai/tools/ToolRegistry.ts` (registration pattern) + `src/core/storage/stores/ChatHistoryDB.ts` (IndexedDB/class pattern)

**ToolRegistry pattern** (from ToolRegistry.ts lines 1–30):
```typescript
export class ToolRegistry {
  #tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void { /* ... */ }
  unregister(name: string): void { /* ... */ }
  get(name: string): ToolDefinition | undefined { /* ... */ }
  has(name: string): boolean { /* ... */ }
  list(): ToolDefinition[] { /* ... */ }
}
export const toolRegistry = new ToolRegistry();
```

**ChatHistoryDB class + singleton pattern:**
```typescript
export class ChatHistoryDB {
  async createSession(session: { ... }): Promise<void> { /* ... */ }
  async getAllSessions(): Promise<Array<{ ... }>> { /* ... */ }
  // ... more CRUD methods
}
export const chatHistoryDB = new ChatHistoryDB();
```

**PromptManager follows same pattern — class with singleton export:**
```typescript
export class PromptManager {
  async createTemplate(template: PromptTemplate): Promise<void> { /* ... */ }
  async getTemplate(id: string): Promise<PromptTemplate | undefined> { /* ... */ }
  async getAllTemplates(): Promise<PromptTemplate[]> { /* ... */ }
  async updateTemplate(template: PromptTemplate): Promise<void> { /* ... */ }
  async deleteTemplate(id: string): Promise<void> { /* ... */ }
}
export const promptManager = new PromptManager();
```

**Storage:** chrome.storage.local key `np_prompt_templates` (follows `np_` key prefix convention from workspaceStore.ts line 87: `name: 'np_workspace'`)

---

### 11. `src/core/prompts/TemplateEngine.ts` (core service, transform)

**Analog:** `src/core/context/ContextOptimizer.ts` (string manipulation + section joining)

**Pattern — simple regex-based variable interpolation:**
```typescript
export class TemplateEngine {
  render(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
  }

  extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) ?? [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  }

  validate(template: string, availableVariables: string[]): { valid: boolean; missing: string[] } {
    const extracted = this.extractVariables(template);
    const missing = extracted.filter(v => !availableVariables.includes(v));
    return { valid: missing.length === 0, missing };
  }
}
export const templateEngine = new TemplateEngine();
```

---

### 12. `src/core/prompts/builtinTemplates.ts` (config/data, static)

**Analog:** `src/core/navigation/navConfig.ts` lines 24–31 (static array config) + `src/components/options/OptionsRoot.tsx` lines 27–40 (OPTIONS_SECTIONS array)

**Pattern:**
```typescript
export interface BuiltinPromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  variables: string[];
}

export const builtinTemplates: BuiltinPromptTemplate[] = [
  { id: 'summarize', name: 'Summarize', description: 'Summarize content', template: 'Summarize the following:\n\n{{content}}', category: 'utility', variables: ['content'] },
  // ... more templates
];
```

---

### 13. `src/core/slash/SlashCommandRegistry.ts` (core service, CRUD + dispatch)

**Analog:** `src/core/ai/tools/ToolRegistry.ts` (exact — same registration/dispatch pattern)

**Pattern — class + singleton with registry map:**
```typescript
export interface SlashCommand {
  name: string;        // e.g., '/write', '/ask', '/research'
  label: string;
  description?: string;
  templateId?: string; // linked prompt template
  handler?: (input: string) => void;
}

export class SlashCommandRegistry {
  #commands = new Map<string, SlashCommand>();

  register(command: SlashCommand): void { /* ... */ }
  unregister(name: string): void { /* ... */ }
  get(name: string): SlashCommand | undefined { /* ... */ }
  list(): SlashCommand[] { /* ... */ }

  // Parse user input for slash commands
  parseCommand(input: string): { command: SlashCommand; rest: string } | null {
    const match = input.match(/^\/(\w+)\s*(.*)?/);
    if (!match) return null;
    const cmd = this.#commands.get(match[1]);
    return cmd ? { command: cmd, rest: match[2] ?? '' } : null;
  }
}
export const slashCommandRegistry = new SlashCommandRegistry();
```

**Storage:** chrome.storage.local key `np_slash_commands`

---

### 14. `src/core/notes/LinkParser.ts` (core service, transform)

**Analog:** `src/core/search/MiniSearchIndex.ts` (class + singleton with MiniSearch integration)

**MiniSearchIndex pattern** (from MiniSearchIndex.ts lines 1–63):
```typescript
import MiniSearch from 'minisearch';

export class MiniSearchIndex {
  private index: MiniSearch;

  constructor() {
    this.index = new MiniSearch({
      fields: ['content', 'tags', 'category'],
      storeFields: ['id', 'content', 'category', 'confidence', 'source', 'useCount', 'updatedAt', 'status'],
      searchOptions: { boost: { content: 2, tags: 1.5 }, prefix: true, fuzzy: 0.2 },
      idField: 'id',
    });
  }
  search(query: string, limit?: number): Array<{ id: string; content: string; score: number }> { /* ... */ }
  addFact(fact: UserMemoryFact): void { /* ... */ }
  replaceFact(fact: UserMemoryFact): void { /* ... */ }
  removeFact(id: string): void { /* ... */ }
  rebuild(facts: UserMemoryFact[]): void { /* ... */ }
}
export const miniSearchIndex = new MiniSearchIndex();
```

**LinkParser combines MiniSearch with wikilink regex:**
```typescript
const WIKILINK_REGEX = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g;

export class LinkParser {
  private index: MiniSearch;

  constructor() {
    this.index = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['id', 'title', 'updatedAt'],
      searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 },
    });
  }

  parseLinks(content: string): ParsedLink[] { /* regex extraction */ }
  async resolve(title: string, allNotes: Note[]): Promise<ResolutionResult> { /* exact → case-insensitive → fuzzy → create */ }
  buildBacklinks(allNotes: Note[]): Map<string, BacklinkEntry[]> { /* scan all notes for wikilinks */ }
  rebuildIndex(notes: Note[]): void { /* full rebuild from NotesDB */ }
}
export const linkParser = new LinkParser();
```

---

### 15. `src/core/notes/NoteGraph.ts` (core service, transform)

**Analog:** `src/core/search/MiniSearchIndex.ts` (class + singleton) + `src/core/ai/providers/providerTypes.ts` (type definitions)

**Pattern — data model + simulation setup:**
```typescript
export interface NoteGraphNode {
  id: string;
  title: string;
  // d3-force position properties added by simulation
}

export interface NoteGraphLink {
  source: string;
  target: string;
}

export class NoteGraph {
  buildGraphData(notes: Note[], links: ParsedLink[]): { nodes: NoteGraphNode[]; links: NoteGraphLink[] } {
    // Transform notes + wikilinks into d3-force compatible graph data
  }
}
export const noteGraph = new NoteGraph();
```

---

### 16. `src/core/permissions/PermissionStore.ts` (core service, CRUD)

**Analog:** `src/core/ai/tools/PermissionService.ts` (interface pattern) + `src/core/stores/workspaceStore.ts` (chrome.storage.local persistence)

**PermissionService interface** (from PermissionService.ts lines 1–16):
```typescript
import { debugLog } from '../../utils/debugLog';

export interface PermissionService {
  canExecute(toolName: string, toolInput: Record<string, unknown>): Promise<boolean>;
}

export class DefaultPermissionService implements PermissionService {
  async canExecute(toolName: string, _toolInput: Record<string, unknown>): Promise<boolean> {
    debugLog('info', `[PermissionService] Permission denied for tool: ${toolName}`);
    return false;
  }
}
export const permissionService = new DefaultPermissionService();
```

**PermissionStore extends to chrome.storage.local:**
```typescript
const PERMISSIONS_KEY = 'np_mcp_permissions'; // np_ key prefix convention

export type PermissionDecision = 'allow-once' | 'allow-always' | 'deny';

export class PermissionStore {
  async getPermission(toolName: string): Promise<'allow-always' | 'deny' | null> {
    const result = await chrome.storage.local.get(PERMISSIONS_KEY);
    const permissions = (result[PERMISSIONS_KEY] ?? {}) as Record<string, 'allow-always' | 'deny'>;
    return permissions[toolName] ?? null;
  }

  async setPermission(toolName: string, decision: 'allow-always' | 'deny'): Promise<void> {
    const result = await chrome.storage.local.get(PERMISSIONS_KEY);
    const permissions = (result[PERMISSIONS_KEY] ?? {}) as Record<string, 'allow-always' | 'deny'>;
    permissions[toolName] = decision;
    await chrome.storage.local.set({ [PERMISSIONS_KEY]: permissions });
  }

  async clearPermission(toolName: string): Promise<void> {
    const result = await chrome.storage.local.get(PERMISSIONS_KEY);
    const permissions = (result[PERMISSIONS_KEY] ?? {}) as Record<string, 'allow-always' | 'deny'>;
    delete permissions[toolName];
    await chrome.storage.local.set({ [PERMISSIONS_KEY]: permissions });
  }
}
export const permissionStore = new PermissionStore();
```

---

### 17. Options Section Components (11 sections)

**Analog (all):** `src/components/options/DiagnosticsSection.tsx` lines 1–9

**DiagnosticsSection pattern — the canonical options section:**
```typescript
import { DiagnosticsPanel } from './DiagnosticsPanel';

export function DiagnosticsSection() {
  return (
    <div data-options-section="diagnostics" style={{ padding: '8px 0' }}>
      <DiagnosticsPanel />
    </div>
  );
}
```

**Shared form pattern for standard sections (D-09):**
```typescript
import React, { useState } from 'react';
import { Form, Button, Typography, App } from 'antd';

const { Title } = Typography;

export function StandardOptionsSection() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const handleSave = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      await persistValues(values);
      message.success('Saved');
    } catch (err) {
      message.error('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-options-section="section-id" style={{ maxWidth: 720 }}>
      <Title level={4}>Section Title</Title>
      <Form form={form} layout="horizontal" labelAlign="left" onFinish={handleSave}>
        {/* form fields */}
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
        </Form.Item>
      </Form>
    </div>
  );
}
```

**Layout exceptions (D-12):**
- **ProvidersSection** — encrypted key handling + inline "Test Connection" button (D-10)
- **ImportExportSection** — file upload/merge workflow (not a form, D-12)
- **PromptsSection** — rich editor with template preview + variable management (D-12)

**Popconfirm deletion pattern (D-11):**
```typescript
import { Popconfirm, Button } from 'antd';

<Popconfirm
  title="Delete this item?"
  description="This action cannot be undone."
  onConfirm={() => handleDelete(id)}
  okText="Delete"
  okButtonProps={{ danger: true }}
>
  <Button danger>Delete</Button>
</Popconfirm>
```

---

### 18. `src/components/notes/BacklinksPanel.tsx` (UI component, read)

**Analog:** `src/components/options/DiagnosticsPanel.tsx` (sub-component rendered within a section)

**DiagnosticsPanel pattern:**
```typescript
// sub-components receive props from parent, render within a data- attributed container
export function DiagnosticsPanel() {
  return (
    <div data-diagnostics-panel="true">
      {/* child components */}
    </div>
  );
}
```

---

### 19. `src/components/notes/WikilinkAutocomplete.tsx` (UI component, search)

**Analog:** `src/components/options/OptionsRoot.tsx` (search input + filtered list + selection)

**Search input + dropdown pattern** (from OptionsRoot.tsx lines 57–63, 119–174):
```typescript
const [query, setQuery] = useState<string>('');

const visibleSections = useMemo(() => {
  const q = query.trim().toLowerCase();
  if (!q) return OPTIONS_SECTIONS;
  return OPTIONS_SECTIONS.filter(s => `${s.title} ${s.description ?? ''} ${s.id}`.toLowerCase().includes(q));
}, [query]);

<Input.Search
  aria-label="Search settings"
  placeholder="Search settings..."
  allowClear
  value={query}
  onChange={(e) => setQuery(e.target.value)}
/>
```

**Wikilink autocomplete adapts this with MiniSearch:**
```typescript
// Trigger on [[, debounced MiniSearch query (D-28, D-30)
// Arrow keys navigate, Enter/Tab completes
// "Create note" option for new titles
```

---

### 20. `src/components/notes/NoteGraphView.tsx` (UI component, transform)

**Analog:** `src/components/diagnostics/ProviderTimeline.tsx` (visualization component)

**Pattern — isolated visualization component:**
```typescript
// Uses d3-force or react-force-graph-2d for rendering
// Receives graph data as prop
// Uses theme.useToken() for colors consistent with Ant Design
// Canvas ref-based rendering (if raw d3-force) or declarative (if react-force-graph-2d)
```

---

### 21. `src/components/patterns/ChatMessage.tsx` (UI component wrapper)

**Analog:** `src/components/common/WorkspaceStatusBar.tsx` (presentational component)

**Pattern — wrapper that renders content via @ant-design/x-markdown:**
```typescript
import { XMarkdown } from '@ant-design/x-markdown';
import { Bubble } from '@ant-design/x';

export function ChatMessage({ content, role, streaming }: ChatMessageProps) {
  return (
    <Bubble
      placement={role === 'user' ? 'end' : 'start'}
      content={
        <XMarkdown
          content={content}
          streaming={{ hasNextChunk: streaming, enableAnimation: true }}
          openLinksInNewTab={true}
        />
      }
    />
  );
}
```

---

### 22. `src/components/patterns/HistoryListItem.tsx` (UI component, list item)

**Analog:** `src/components/sider/SiderMenuItem.tsx` (navigation list item with active state)

**Pattern — list item with metadata display:**
```typescript
export interface HistoryListItemProps {
  conversation: ConversationMeta; // { id, title, updatedAt, preview }
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function HistoryListItem({ conversation, isActive, onSelect, onDelete }: HistoryListItemProps) {
  // Renders: title, preview snippet, timestamp
  // Active state highlighted
  // Context menu or Popconfirm for delete
}
```

---

### 23. `src/components/patterns/ToolCard.tsx` (UI component, expandable)

**Analog:** `src/components/diagnostics/ToolCallDescriptions.tsx` (tool call display)

**Pattern — expandable card with tool metadata:**
```typescript
// Tool name + status icon + permission badge + duration
// Expandable: input preview + result summary
// ThoughtChain content child
```

---

### 24. `src/components/patterns/SkillMessageRenderer.tsx` & `SourceCard.tsx`

**Analog:** `src/components/patterns/ChatMessage.tsx` + `src/components/diagnostics/TransactionTable.tsx`

**Pattern — specialized content renderers following existing component conventions.**

---

## Shared Patterns

### Authentication / Context Assembly
**Source:** `src/core/context/ContextOptimizer.ts` lines 1–60
**Apply to:** `useStreamingLLM.ts`, `useChat.ts`, `useAgent.ts`

```typescript
// ContextOptimizerInput assembled by hook before pipeline invocation (D-04)
const input: ContextOptimizerInput = {
  operationId: crypto.randomUUID(),
  providerId: activeProvider ?? 'default',
  modelId: selectedModelId,
  modelContextWindow: modelContextWindow,
  userInput: message,
  systemPrompt: systemPrompt,
  taskInstructions: taskInstructions,
  // ... assembled from MemoryEngine, WorkspaceStore, ChatHistoryDB
};
```

### AgentOrchestrator Pipeline Integration
**Source:** `src/core/ai/pipeline/AgentOrchestrator.ts` lines 84–171
**Apply to:** `useStreamingLLM.ts`

```typescript
// The hook iterates this AsyncGenerator directly (D-01):
async *runWithContext(
  optimizedContext: OptimizedContext,
  preferredProviders: string[],
): AsyncGenerator<OrchestratorEvent>
```

### Singleton Implementation Pattern
**Source:** `src/core/ai/tools/ToolRegistry.ts` line 30, `src/core/storage/stores/ChatHistoryDB.ts` line 97
**Apply to:** `PromptManager.ts`, `TemplateEngine.ts`, `SlashCommandRegistry.ts`, `LinkParser.ts`, `NoteGraph.ts`, `PermissionStore.ts`

```typescript
export class ServiceName {
  // class implementation
}
export const serviceName = new ServiceName();
```

### Zustand Store Pattern
**Source:** `src/core/stores/workspaceStore.ts` lines 1–91, `src/core/stores/themeStore.ts` lines 1–29
**Apply to:** `workspaceStore.ts` modifications (adding `drafts` field)

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const chromeLocalStorage = createJSONStorage<StateType>(() => ({
  getItem: (name) => chrome.storage.local.get(name).then(r => (r[name] as string) ?? null),
  setItem: (name, value) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name) => chrome.storage.local.remove(name),
}));

export const useStore = create<StateType>()(
  persist(
    (set) => ({
      // state fields + setters
    }),
    { name: 'np_storage_key', storage: chromeLocalStorage },
  ),
);
```

### Error Handling
**Source:** `src/core/components/ErrorBoundary.tsx` lines 1–53
**Apply to:** All page components (wrapped by shell automatically)

```typescript
// AntD Result component with error status:
<Result
  status="error"
  title="Something went wrong"
  subTitle={error?.message}
  extra={[
    <Button key="retry" type="primary" onClick={handleReset}>Try Again</Button>,
    <Button key="reload" onClick={() => window.location.reload()}>Reload Page</Button>,
  ]}
/>
```

### Test Pattern
**Source:** `tests/core/workspaceStore.test.ts` lines 1–102, `tests/shell/optionsShell.test.tsx` lines 1–45
**Apply to:** All test files

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';

// Mock external dependencies
vi.mock('../../src/core/storage/WriteJournal', () => ({
  writeJournal: { /* mock methods */ },
}));

// Setup wrapper for Ant Design components
function setup(jsx: React.ReactElement) {
  return render(React.createElement(ConfigProvider, null, jsx));
}

describe('Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state if using Zustand:
    // useStore.setState({ /* defaults */ });
  });

  it('renders correctly', () => {
    const { container } = setup(<MyComponent />);
    expect(container).toBeTruthy();
  });
});
```

**For hook tests (React Testing Library + renderHook):**
```typescript
import { renderHook, act } from '@testing-library/react';
// Mock AgentOrchestrator with generator:
async function* mockRunWithContext() {
  yield { type: 'text-delta', text: 'Hello' };
  yield { type: 'text-complete', fullText: 'Hello World' };
}
```

### DebugLog Pattern
**Source:** `src/core/utils/debugLog.ts`
**Apply to:** All hook and service files

```typescript
import { debugLog } from '../utils/debugLog';
debugLog('info', '[ComponentName] Operation description', { context });
debugLog('error', '[ComponentName] Operation failed', { error: err });
```

### `data-` Attribute Convention
**Source:** `src/core/pages/ChatPage.tsx` line 26 (`data-page-empty-state="chat"`), `src/components/options/OptionsRoot.tsx` line 142 (`data-options-nav-item`), `src/components/options/DiagnosticsSection.tsx` line 5 (`data-options-section="diagnostics"`)
**Apply to:** All new page and section components

```typescript
// Pages: data-page-empty-state="page-name"
// Options sections: data-options-section="section-id"
// Option nav items: data-options-nav-item="section-id", data-active="true|false"
```

### Navigation Types
**Source:** `src/core/navigation/navigationTypes.ts` lines 1–27
**Apply to:** Understanding Surface type for page adaptation

```typescript
export type Surface = 'sidepanel' | 'standalone' | 'popup';

export interface NowPilotNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  group: NavGroup;
  order: number;
  surfaces: Surface[];
  // ...
}
```

### Page Registration
**Source:** `src/core/registries/registerNowPilotCorePages.ts` lines 1–41
**Apply to:** No changes needed — existing registrations cover Chat, Agent, Notes. Just replace stubs with real components.

```typescript
registerCorePages({
  id: 'chat',
  label: 'Chat',
  icon: CommentOutlined,
  component: ChatPage,  // ← Real component replaces current stub
  order: 1,
  registerOn: ['sidepanel', 'standalone'],
});
```

### WorkspaceRouter Deep Linking
**Source:** `src/entrypoints/standalone/App.tsx` lines 63–81
**Apply to:** Cross-surface navigation (D-37, D-38)

```typescript
// Parse query params for page + context:
const params = new URLSearchParams(window.location.search);
const page = params.get('page');        // 'chat', 'agent', 'notes', 'options'
const conversationId = params.get('conversationId');
const noteId = params.get('noteId');
const section = params.get('section');
const operationId = params.get('operationId');

// Clean query params from URL after consuming
if (page || conversationId || noteId || section || operationId) {
  window.history.replaceState(null, '', window.location.pathname);
}
```

### Title Generation Pattern (D-15)
**Source:** `src/core/ai/pipeline/AgentOrchestrator.ts` (AI call pattern)
**Apply to:** `useChat.ts` — non-blocking Haiku-tier call

```typescript
// Non-blocking, temperature 0, 16 tokens, 3s timeout
// Runs AFTER first successful assistant response
// Falls back to truncated first user message on failure
// Writes to ChatHistoryDB.sessions.title
```

### Send to Note Pattern (D-26)
**Source:** `src/entrypoints/options/App.tsx` (dialog/action wiring)
**Apply to:** ChatMessage context menu "Save to Note"

```typescript
// Lightweight dialog: create new note or append to existing
// Content pre-filled with selected message
// Saves directly to NotesDB without navigating away from Chat
// Uses AntD Modal or lightweight dialog pattern
```

---

## No Exact Analog Found

| File | Role | Data Flow | Recommendation |
|------|------|-----------|----------------|
| `src/hooks/useAgent.ts` | hook | event-driven (OrchestratorEvent → ThoughtChain state) | Base on `useChat.ts` sibling pattern; use RESEARCH.md Pattern 3 (lines 543–602) for ThoughtChain + Permission flow |
| `src/components/notes/NoteGraphView.tsx` | UI component | d3-force canvas rendering | Use d3-force or react-force-graph-2d; follow RESEARCH.md recommendations (lines 1072–1097). Wrap in React-friendly rendering with `useRef` for canvas |
| `src/core/notes/NoteGraph.ts` | core service | d3-force data model | Follow RESEARCH.md Pattern 5 for graph data construction (lines 1072–1076). Class + singleton export like MiniSearchIndex.ts |

---

## WorkspaceStore Extension

### New field: `drafts` (D-33, D-34)

**Add to `WorkspaceState` in `src/core/stores/workspaceStore.ts`:**
```typescript
export interface WorkspaceState {
  // ... existing fields ...
  drafts: Record<string, string>;  // conversationId → draftText
  // ... existing setters ...
  setDraft: (conversationId: string, text: string) => void;
  clearDraft: (conversationId: string) => void;
}
```

**Default value:** `drafts: {}`
**Persistence:** Automatic via existing persist middleware (`np_workspace` key)
**Cross-surface sync:** Automatic via BroadcastBus (chrome.storage.onChanged)

---

## Pipeline Extension Note

### Permission Event Type (Required Addition)

The existing `OrchestratorEvent` union in `pipelineTypes.ts` (lines 21–29) does NOT have a `waiting-permission` type. Per RESEARCH.md Risk Assessment (lines 1115–1126), this must be added:

```typescript
// Add to OrchestratorEvent union:
| { type: 'waiting-permission'; toolName: string; toolInput: unknown }
```

This is a Wave 0 task before hook implementation.

---

## New Dependencies Required

| Package | Version | Install |
|---------|---------|---------|
| `d3-force` | 3.0.0 | `pnpm add d3-force@3.0.0` |
| `react-force-graph-2d` | 1.29.1 (optional) | `pnpm add react-force-graph-2d@1.29.1` |

---

## Metadata

**Analog search scope:** `src/hooks/` (none exists — new directory), `src/core/`, `src/components/`, `src/entrypoints/`, `tests/`
**Files scanned:** 40+ analog files
**Pattern extraction date:** 2026-07-13
**Key conventions identified:**
- Class + singleton export for all core services (`export const x = new ClassName()`)
- Zustand v5 store pattern: `create<State>()(persist((set) => ({...}), { name: 'np_key', storage }))`
- `np_` key prefix for all chrome.storage.local keys
- Ant Design v6 + X 2.x components solely via ConfigProvider + XMarkdown
- Page integration via `renderActivePage` prop pattern
- Options section integration via `renderSectionContent` prop pattern
- DebugLog-based error logging throughout
- `data-` attribute convention for test selectors
