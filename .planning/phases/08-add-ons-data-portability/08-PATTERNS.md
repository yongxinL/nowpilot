# Phase 8: Add-ons & Data Portability - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 32 (21 new, 8 modified, 3 extended)
**Analogs found:** 29 / 32

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/registries/AddonRegistry.ts` | registry | request-response | `src/core/ai/tools/ToolRegistry.ts` | exact |
| `src/addons/write/components/WritePage.tsx` | component | request-response | `src/components/options/ImportExportSection.tsx` | role-match |
| `src/addons/write/skills/writeSkills.ts` | utility | transform | `src/core/prompts/PromptManager.ts` (PromptTemplate type) | role-match |
| `src/addons/write/registerWriteAddon.ts` | utility | transform | `src/core/registries/registerNowPilotCorePages.ts` | exact |
| `src/addons/servicenow/services/CookieSessionStore.ts` | service | request-response | `src/core/permissions/PermissionStore.ts` | role-match |
| `src/addons/servicenow/services/ServiceNowSessionAdapter.ts` | service | request-response | `src/core/ai/followUp/FollowUpService.ts` | role-match |
| `src/addons/servicenow/services/ServiceNowTableClient.ts` | service | request-response | `src/core/stores/workspaceStore.ts` (WriteJournal flow) | role-match |
| `src/addons/servicenow/components/ServiceNowSidepanelPage.tsx` | component | request-response | `src/core/pages/ChatPage.tsx` | role-match |
| `src/addons/servicenow/components/ServiceNowStandalonePage.tsx` | component | request-response | `src/core/pages/NotesPage.tsx` | exact |
| `src/addons/servicenow/skills/serviceNowSkills.ts` | utility | transform | `src/addons/write/skills/writeSkills.ts` | N/A (co-new) |
| `src/addons/servicenow/registerServiceNowAddon.ts` | utility | transform | `src/core/registries/registerNowPilotCorePages.ts` | exact |
| `src/addons/teamgqm/data/gqmTypes.ts` | model | CRUD | `src/core/content/PageContext.ts` | exact |
| `src/addons/teamgqm/services/GQMDataService.ts` | service | CRUD | `src/core/storage/WriteJournal.ts` | role-match |
| `src/addons/teamgqm/components/TeamGQMSidepanelPage.tsx` | component | request-response | `src/core/pages/ChatPage.tsx` (side panel) | role-match |
| `src/addons/teamgqm/components/TeamGQMStandalonePage.tsx` | component | request-response | `src/core/pages/NotesPage.tsx` | exact |
| `src/addons/teamgqm/registerTeamGQMAddon.ts` | utility | transform | `src/core/registries/registerNowPilotCorePages.ts` | exact |
| `src/addons/global/ResearchSkill.ts` | service | event-driven | `src/core/ai/quickActions/QuickActionService.ts` | role-match |
| `src/addons/global/registerGlobalAddons.ts` | utility | transform | `src/core/registries/registerNowPilotCorePages.ts` | exact |
| `src/entrypoints/sidepanel/main.tsx` | config | config | Self — add import line | exact |
| `src/entrypoints/standalone/main.tsx` | config | config | Self — add import line | exact |
| `src/core/navigation/navConfig.ts` | config | request-response | Self — add addon nav items | exact |
| `src/components/options/AddonSettingsSection.tsx` | component | request-response | `src/components/options/ImportExportSection.tsx` | exact |
| `src/components/options/ImportExportSection.tsx` | component | file-I/O | Self — extend existing | exact |
| `src/core/slash/SlashCommandRegistry.ts` | registry | request-response | Self — already wired | exact |
| `src/core/prompts/PromptManager.ts` | registry | request-response | Self — add Write templates | exact |
| `tests/core/addons/AddonRegistry.test.ts` | test | N/A | `tests/core/slash/SlashCommandRegistry.test.ts` | exact |
| `tests/addons/servicenow/CookieSessionStore.test.ts` | test | N/A | `tests/core/ai/tools/ToolRegistry.test.ts` | role-match |
| `tests/addons/servicenow/SessionAdapter.test.ts` | test | N/A | `tests/core/slash/SlashCommandRegistry.test.ts` | role-match |
| `tests/addons/write/writeSkills.test.ts` | test | N/A | `tests/core/slash/SlashCommandRegistry.test.ts` | role-match |
| `tests/core/data/exportSanitization.test.ts` | test | N/A | `tests/core/no-addon-imports.test.ts` | role-match |
| `tests/core/data/importMerge.test.ts` | test | N/A | `tests/core/storage/WriteJournal.test.ts` | exact |
| `tests/addons/global/ResearchSkill.test.ts` | test | N/A | `tests/core/slash/SlashCommandRegistry.test.ts` | role-match |

## Pattern Assignments

---

### `src/core/registries/AddonRegistry.ts` (registry, request-response)

**Analog:** `src/core/ai/tools/ToolRegistry.ts` (primary), `src/core/slash/SlashCommandRegistry.ts` (persistence)

**Imports pattern** (ToolRegistry.ts lines 1-3):
```typescript
import type { ToolDefinition } from './ToolDefinition';
import { getPageContentTool } from './builtin/getPageContentTool';
import { pinTabTool } from './builtin/pinTabTool';
```
→ For AddonRegistry: import types from a sibling `AddonRegistryTypes.ts`, NOT circular.

**Core pattern** (ToolRegistry.ts lines 5-30):
```typescript
export class ToolRegistry {
  #tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.#tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.#tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.#tools.get(name);
  }

  has(name: string): boolean {
    return this.#tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.#tools.values());
  }
}

export const toolRegistry = new ToolRegistry();
```
→ Use JS private `#skills`, `#pages`, `#settingsSchemas`, `#enabled` Maps. Class+singleton export.

**Persistence pattern** (SlashCommandRegistry.ts lines 53-72):
```typescript
async #loadPersisted(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(SLASH_COMMANDS_KEY);
    const persisted = (result[SLASH_COMMANDS_KEY] ?? []) as SlashCommand[];
    for (const cmd of persisted) {
      this.#commands.set(cmd.name, cmd);
    }
  } catch (err) {
    debugLog('error', '[SlashCommandRegistry] loadPersisted failed', { error: err });
  }
}

async #persist(): Promise<void> {
  try {
    const commands = Array.from(this.#commands.values());
    await chrome.storage.local.set({ [SLASH_COMMANDS_KEY]: commands });
  } catch (err) {
    debugLog('error', '[SlashCommandRegistry] persist failed', { error: err });
  }
}
```
→ Persist enable/disable state to `chrome.storage.local` under `np_addon_enabled` key. Settings schemas under `np_addon_settings`.

**Error handling pattern** (SlashCommandRegistry.ts lines 21-27):
```typescript
register(command: SlashCommand): void {
  if (this.#commands.has(command.name)) {
    throw new Error(`Slash command "${command.name}" is already registered`);
  }
  this.#commands.set(command.name, command);
  this.#persist().catch(() => {});
}
```

---

### `src/addons/write/skills/writeSkills.ts` (utility, transform)

**Analog:** `src/core/prompts/PromptManager.ts` (PromptTemplate type, lines 6-18)

**PromptTemplate type** (PromptManager.ts lines 6-18):
```typescript
export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  category: string;
  variables: string[];
  isBuiltin: boolean;
  scopes?: ('chat' | 'reading' | 'writing' | 'reply')[];
  hidden?: boolean;
  icon?: string;
  order?: number;
}
```

**Registration pattern** — register via `promptManager.createTemplate()` with `displayCategory: 'Writing'` per D-07/08. Six skills: Rewrite, Summarize, Draft Customer Update, Draft Internal Note, Explain, Action Plan. Each is a PromptTemplate with pre-built system prompts.

---

### `src/addons/write/registerWriteAddon.ts` (utility, transform)

**Analog:** `src/core/registries/registerNowPilotCorePages.ts` (lines 1-40)

**Imports pattern** (registerNowPilotCorePages.ts lines 1-4):
```typescript
import { CommentOutlined, FileTextOutlined } from '@ant-design/icons';
import { ChatPage } from '../pages/ChatPage';
import { NotesPage } from '../pages/NotesPage';
import { registerCorePages } from './registerCorePages';
```

**Core pattern** (registerCorePages.ts lines 14-32):
```typescript
export function registerCorePages(options: RegisterCorePagesOptions): void {
  if (options.registerOn.includes('sidepanel')) {
    sidepanelPageRegistry.register({
      id: options.id,
      label: options.label,
      icon: options.icon,
      component: options.component,
      order: options.order,
    });
  }
  if (options.registerOn.includes('standalone')) {
    standalonePageRegistry.register({
      id: options.id,
      label: options.label,
      icon: options.icon,
      component: options.component,
      order: options.order,
    });
  }
}
```
→ Write addon: register pages via `sidepanelPageRegistry.register()` (Side Panel only per D-09; Full App deferred). Register 6 skills with `addonRegistry.registerSkill()` and 6 prompt templates with `promptManager.createTemplate()`.

**Registration call pattern** (registerNowPilotCorePages.ts lines 6-13):
```typescript
registerCorePages({
  id: 'chat',
  label: 'Chat',
  icon: CommentOutlined,
  component: ChatPage,
  order: 1,
  registerOn: ['sidepanel', 'standalone'],
});
```

---

### `src/addons/write/components/WritePage.tsx` (component, request-response)

**Analog:** `src/components/options/ImportExportSection.tsx` for Card-based layout with action buttons (lines 258-383)

**Component shell pattern** (ImportExportSection.tsx lines 34-35):
```typescript
export function ImportExportSection() {
  const { message } = App.useApp();
```

**Card with buttons pattern** (ImportExportSection.tsx lines 266-308):
```typescript
<Card title="Export" style={{ flex: 1, minWidth: 280 }} extra={<DownloadOutlined />}>
  <Paragraph type="secondary" style={{ fontSize: 12 }}>
    Select data to include in the export file.
  </Paragraph>
  {/* ... checkboxes ... */}
  <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} loading={exporting} block>
    Export
  </Button>
</Card>
```
→ WritePage: vertical stack of 6 action buttons (one per skill) in Cards. Each button populates the Sender with the corresponding PromptTemplate. Use `useWorkspaceStore` for sender integration.

---

### `src/addons/servicenow/services/CookieSessionStore.ts` (service, request-response)

**Analog:** `src/core/permissions/PermissionStore.ts` for chrome.storage API wrapper (lines 1-40)

**Imports pattern** (PermissionStore.ts line 1):
```typescript
import { debugLog } from '../utils/debugLog';
```

**Storage access pattern** (PermissionStore.ts lines 6-37):
```typescript
const PERMISSIONS_KEY = 'np_mcp_permissions';

export class PermissionStore {
  async getPermission(toolName: string): Promise<'allow-always' | 'deny' | null> {
    try {
      const result = await chrome.storage.local.get(PERMISSIONS_KEY);
      const permissions = (result[PERMISSIONS_KEY] ?? {}) as Record<string, 'allow-always' | 'deny'>;
      return permissions[toolName] ?? null;
    } catch (err) {
      debugLog('error', '[PermissionStore] getPermission failed', { error: err });
      return null;
    }
  }
  // ...
}

export const permissionStore = new PermissionStore();
```
→ CookieSessionStore: wrap `chrome.cookies.get({ url, name: 'JSESSIONID' })` with same try/catch + debugLog pattern. Export as singleton. No `chrome.storage.local` — cookies API is read-only.

---

### `src/addons/servicenow/services/ServiceNowSessionAdapter.ts` (service, request-response)

**Analog:** `src/core/ai/quickActions/QuickActionService.ts` (lines 1-69)

**Class+singleton with private Map** (QuickActionService.ts lines 12-69):
```typescript
export class QuickActionService {
  #hostnameMap: Map<string, QuickAction[]>;

  constructor() {
    this.#hostnameMap = new Map();
    this.#initMapping();
  }

  #initMapping(): void {
    this.#hostnameMap.set('servicenow.com', [
      { label: 'Summarize this case', promptText: 'Summarize this case' },
      // ...
    ]);
  }

  getActions(hostname?: string): QuickAction[] {
    if (!hostname) { return this.#getFallback(); }
    for (const [pattern, actions] of this.#hostnameMap.entries()) {
      if (hostname.includes(pattern)) { return actions; }
    }
    return this.#getFallback();
  }

  #getFallback(): QuickAction[] { /* ... */ }
}

export const quickActionService = new QuickActionService();
```
→ ServiceNowSessionAdapter: composes JSESSIONID (from CookieSessionStore) + sysparmCK (from MAIN-world bridge). Exposes `acquireSession(instanceUrl)` method. Checks cookie expiry on access; stale sessions trigger re-extraction (D-06).

---

### `src/addons/servicenow/services/ServiceNowTableClient.ts` (service, request-response)

**Analog:** workspaceStore WriteJournal flow (`src/core/stores/workspaceStore.ts` lines 42-74) + PROXY_FETCH

**WriteJournal begin pattern** (workspaceStore.ts lines 49-64):
```typescript
const entry = await writeJournal.begin(
  'update-workspace',
  { workspace: name },
  [{ name: 'persist-workspace' }],
);
await writeJournal.markStepStart(entry.id, 0);
try {
  await chrome.storage.local.set({ [name]: value });
  await writeJournal.markStepComplete(entry.id, 0);
  await writeJournal.markCompleted(entry.id);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  await writeJournal.markStepFailed(entry.id, 0, msg);
  await writeJournal.markFailed(entry.id);
  throw err;
}
```
→ ServiceNowTableClient: all API calls route through PROXY_FETCH (no bare fetch()). Rate limiting via existing RateLimiter. Session from ServiceNowSessionAdapter.

---

### `src/addons/teamgqm/data/gqmTypes.ts` (model, CRUD)

**Analog:** `src/core/content/PageContext.ts` (lines 1-85)

**Type-only exports pattern** (PageContext.ts lines 1-11):
```typescript
/**
 * PageContext and TabContext type definitions for page extraction.
 *
 * Pure interface exports — no runtime code, no classes, no default exports.
 * Products follow `src/core/navigation/navigationTypes.ts` pattern.
 */

export interface PageContext {
  // ... fields with JSDoc comments
}
```
→ GQM types: `Goal`, `Question`, `Metric` interfaces with `id`, `title`, `description`, `parentId`, `order`, `updatedAt` fields. Each has a `type: 'goal' | 'question' | 'metric'` discriminator for IndexedDB querying. Pure type exports, no runtime code.

---

### `src/addons/teamgqm/services/GQMDataService.ts` (service, CRUD)

**Analog:** `src/core/storage/WriteJournal.ts` (lines 7-47) — journal-backed CRUD pattern

**begin() call pattern** (WriteJournal.ts lines 11-46):
```typescript
async begin(
  operation: WriteJournalOperation,
  targetIds: Record<string, string>,
  steps: { name: string }[],
  execCtx?: ExecutionContext,
): Promise<WriteJournalEntry> {
  const id = crypto.randomUUID();
  const entry: WriteJournalEntry = { /* ... */ };
  validateWriteJournalEntry(entry);

  const db = await getDB();
  const tx = db.transaction('write_journal_entries', 'readwrite');
  await tx.store.put(entry);
  await tx.done;
  // ...
  return entry;
}
```
→ GQMDataService: wraps all IndexedDB writes through `writeJournal.begin()` with operation type `'save-gqm-data'` (add to WriteJournalOperation union). Each CRUD method: begin → markStepStart → perform IDB write → markStepComplete → markCompleted. Follow same try/catch with markStepFailed pattern.

**Singleton export** (WriteJournal.ts line 244):
```typescript
export const writeJournal = new WriteJournal();
```

---

### `src/addons/global/ResearchSkill.ts` (service, event-driven)

**Analog:** `src/core/ai/quickActions/QuickActionService.ts` for pattern (see above)

**Class+singleton** (QuickActionService.ts lines 12, 69):
```typescript
export class QuickActionService { /* ... */ }
export const quickActionService = new QuickActionService();
```
→ ResearchSkill: `isAvailable()` checks MCP tools via regex pattern matching. `execute()` dispatches via MCP client. Graceful degradation when no search MCP: returns an Alert message per D-13.

---

### `src/entrypoints/sidepanel/main.tsx` / `src/entrypoints/standalone/main.tsx` (config)

**Analog:** Self — existing files (sidepanel/main.tsx lines 1-15, standalone/main.tsx lines 1-15)

**Import+init pattern** (main.tsx lines 1-7):
```typescript
import '../../core/utils/chromePolyfill';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanelApp } from './App';
import '../../core/theme/global.css';
import '../../core/registries/registerNowPilotCorePages';
import { initProviderSync } from '../../core/stores/providerStore';
```
→ Add `import '../../addons/write/registerWriteAddon'` (and similar for ServiceNow, TeamGQM, global addons) BEFORE React mounts. Import has side effects — registration happens at module eval time. Follow the same pattern as `registerNowPilotCorePages`.

---

### `src/components/options/AddonSettingsSection.tsx` (component, request-response)

**Analog:** `src/components/options/ImportExportSection.tsx` (lines 258-382)

**Options section shell** (ImportExportSection.tsx lines 258-260):
```tsx
<div data-options-section="import-export" style={{ maxWidth: 720 }}>
  <Title level={4}>Import / Export</Title>
  <p style={{ marginBottom: 16 }}>Export your data for backup...</p>
```

**Empty state** (existing AddonSettingsSection.tsx lines 35-38):
```tsx
<Empty
  description="No add-ons installed. Add-ons will appear here when registered."
  style={{ padding: 48 }}
/>
```
→ Replace stub: iterate `addonRegistry.list()` to render each registered addon's settings toggle (enable/disable) and settings schema. Use AntD `Switch` for enable/disable. Persist via `chrome.storage.local` per `np_addon_enabled` key. Follow same `maxWidth: 720` + Title pattern.

---

### `src/components/options/ImportExportSection.tsx` — Extend (component, file-I/O)

**Analog:** Self — existing file (`src/components/options/ImportExportSection.tsx`)

**Export function pattern** (lines 59-118):
```typescript
const handleExport = useCallback(async () => {
  const scopes = exportScope.includes('all') ? ['chat', 'notes', 'memory', 'settings'] : exportScope;
  setExporting(true);
  setExportProgress(0);
  try {
    const data: Record<string, unknown> = {};
    // ... read scopes ...
    const exportData: ExportData = { version: '0.1.0', exportedAt: new Date().toISOString(), data };
    const zip = new JSZip();
    zip.file('export.json', JSON.stringify(exportData, null, 2));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    // ... download ...
  } catch (err) {
    message.error('Export failed');
  } finally {
    setExporting(false);
    setExportProgress(0);
  }
}, [exportScope, message]);
```
→ **DATA-01 changes:** Wrap export reads in `writeJournal.begin('export-data', ...)` for atomic snapshot. Apply `traceRedactor.redactValue(data)` safety net before writing to ZIP per D-18.

**Import pattern** (lines 169-214):
```typescript
const handleMerge = useCallback(async () => {
  if (!importData || !importValid) return;
  try {
    const data = importData.data as Record<string, unknown>;
    const promises: Promise<void>[] = [];
    // ... per-scope merge ...
    await Promise.all(promises);
    message.success('Import completed successfully');
  } catch {
    message.error('Import failed');
  }
}, [importData, importValid, message]);
```
→ **DATA-02 changes:** Replace simple `chrome.storage.local.set()` with deterministic `updatedAt` comparison (latest-wins). Read existing records, compare timestamps, write only newer records. Show merge summary Alert after import.

---

### `src/core/slash/SlashCommandRegistry.ts` (registry, modify)

**Analog:** Self — existing file (lines 74-85)

**Builtins pattern** (lines 74-85):
```typescript
#registerBuiltins(): void {
  const builtins: SlashCommand[] = [
    { name: 'write', label: 'Write', description: 'Draft a response or document', templateId: 'write' },
    { name: 'ask', label: 'Ask', description: 'Ask a general question', templateId: 'ask' },
    { name: 'research', label: 'Research', description: 'Research a topic', templateId: 'research' },
  ];
  for (const cmd of builtins) {
    if (!this.#commands.has(cmd.name)) {
      this.#commands.set(cmd.name, cmd);
    }
  }
}
```
→ Wire `/write` handler to open Write Side Panel + populate prompt template. Wire `/research` handler to ResearchSkill.isAvailable() check → execute or show Alert.

---

### `src/core/prompts/PromptManager.ts` (registry, modify)

**Analog:** Self — existing file (lines 20-30)

**Init pattern** (lines 23-30):
```typescript
constructor() {
  this.init().catch(() => {});
}

async init(): Promise<void> {
  await this.#loadPersisted();
  this.#registerBuiltins();
}
```
→ Register 6 Write add-on prompt templates with `displayCategory: 'Writing'`, `isBuiltin: false`, and appropriate template variables. Follow `createTemplate()` pattern.

---

### Test Patterns

**Analog:** `tests/core/slash/SlashCommandRegistry.test.ts` (lines 1-53)

**Test file structure** (lines 1-3):
```typescript
import { describe, it, expect } from 'vitest';
import { SlashCommandRegistry } from '../../../src/core/slash/SlashCommandRegistry';
import type { SlashCommand } from '../../../src/core/slash/SlashCommandRegistry';
```

**Test pattern** (lines 8-17):
```typescript
describe('SlashCommandRegistry', () => {
  it('register adds a command; get/has/list return it', () => {
    const registry = new SlashCommandRegistry();
    expect(registry.list()).toHaveLength(3);
    const cmd: SlashCommand = { name: 'test', label: 'Test', description: 'A test command' };
    registry.register(cmd);
    expect(registry.get('test')).toBe(cmd);
    expect(registry.has('test')).toBe(true);
    expect(registry.list()).toHaveLength(4);
  });

  it('register with duplicate name throws', () => {
    const registry = new SlashCommandRegistry();
    expect(() => registry.register({ name: 'write', label: 'Already built-in' })).toThrow('already registered');
  });
```
→ All new test files follow this `describe > it > expect` pattern. New instances per test. No shared mutable state.

**Mock pattern** (WriteJournal.test.ts lines 3-42):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDB, mockStoreMap, clearMockStore } = vi.hoisted(() => {
  const storeMap = new Map<string, Record<string, unknown>>();
  const mockStore = {
    put: vi.fn((val: Record<string, unknown>) => { /* ... */ }),
    get: vi.fn((key: string) => Promise.resolve(storeMap.get(key))),
    getAll: vi.fn(() => Promise.resolve(Array.from(storeMap.values()))),
    delete: vi.fn((key: string) => { storeMap.delete(key); return Promise.resolve(); }),
  };
  const mockGetDB = vi.fn(() => Promise.resolve({
    transaction: vi.fn(() => ({ store: mockStore, done: Promise.resolve(undefined) })),
  }));
  return { mockGetDB, mockStoreMap: storeMap, clearMockStore: () => storeMap.clear() };
});

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({ getDB: mockGetDB }));
```
→ Use `vi.hoisted()` for mocks that must be available before module loading. Export cleanup functions for `beforeEach`. Mock `chrome.cookies`, `chrome.storage.local`, etc. similarly.

**Filesystem-based test pattern** (no-addon-imports.test.ts lines 1-46):
```typescript
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');

function listFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) { results.push(...listFiles(fullPath)); }
    else if (/\.(ts|tsx)$/.test(entry)) { results.push(fullPath); }
  }
  return results;
}
```
→ Use for `tests/core/data/exportSanitization.test.ts` to parse export ZIP and assert no credential strings present.

## Shared Patterns

### Class + Singleton Export Pattern
**Sources:** `src/core/ai/tools/ToolRegistry.ts:32`, `src/core/slash/SlashCommandRegistry.ts:88`, `src/core/permissions/PermissionStore.ts:40`, `src/core/storage/WriteJournal.ts:244`, `src/core/telemetry/TraceRedactor.ts:77`
**Apply to:** AddonRegistry, CookieSessionStore, ServiceNowSessionAdapter, ServiceNowTableClient, GQMDataService, ResearchSkill
```typescript
export const myRegistry = new MyRegistry();
```

### JS Private Fields Map Pattern
**Source:** `src/core/ai/tools/ToolRegistry.ts:6`, `src/core/slash/SlashCommandRegistry.ts:14`
**Apply to:** AddonRegistry (skills, pages, settingsSchemas, enabled)
```typescript
#tools = new Map<string, ToolDefinition>();
```

### Registration-gate: throw on duplicate
**Source:** `src/core/registries/SidepanelPageRegistry.ts:15-19`, `src/core/ai/tools/ToolRegistry.ts:9-13`
**Apply to:** AddonRegistry register* methods, all page registration
```typescript
register(page: PageDefinition): void {
  if (this.pages.has(page.id)) {
    throw new Error(`Page "${page.id}" is already registered`);
  }
  this.pages.set(page.id, page);
}
```

### chrome.storage.local Key Convention
**Sources:** `src/core/permissions/PermissionStore.ts:3`, `src/core/slash/SlashCommandRegistry.ts:3`
**Apply to:** All add-on state persistence
```typescript
const STORAGE_KEY = 'np_addon_enabled';  // 'np_' prefix convention
```

### WriteJournal Atomic Operation Pattern
**Source:** `src/core/stores/workspaceStore.ts:49-64`, `src/core/storage/WriteJournal.ts:11-46`
**Apply to:** GQMDataService, data export, data import, all add-on IDB writes
```typescript
const entry = await writeJournal.begin('update-workspace', { workspace: name }, [{ name: 'persist' }]);
await writeJournal.markStepStart(entry.id, 0);
try {
  await performOperation();
  await writeJournal.markStepComplete(entry.id, 0);
  await writeJournal.markCompleted(entry.id);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  await writeJournal.markStepFailed(entry.id, 0, msg);
  await writeJournal.markFailed(entry.id);
  throw err;
}
```

### debugLog Error Pattern
**Source:** `src/core/slash/SlashCommandRegistry.ts:65-72`, `src/core/permissions/PermissionStore.ts:12`
**Apply to:** All new services, CookieSessionStore, ServiceNowTableClient
```typescript
import { debugLog } from '../utils/debugLog';

try { /* ... */ } catch (err) {
  debugLog('error', '[ComponentName] operationName failed', { error: err });
}
```

### Page Registration at Startup Pattern
**Source:** `src/entrypoints/sidepanel/main.tsx:6`, `src/entrypoints/standalone/main.tsx:6`
**Apply to:** All add-on registration functions (registerWriteAddon, registerServiceNowAddon, etc.)
```typescript
import '../../core/registries/registerNowPilotCorePages'; // existing
import '../../addons/write/registerWriteAddon';             // NEW — before React mount
```

### Options Section Component Pattern
**Source:** `src/components/options/ImportExportSection.tsx:258-260`, `src/components/options/AddonSettingsSection.tsx:28-29`
**Apply to:** AddonSettingsSection (modify)
```tsx
<div data-options-section="addons" style={{ maxWidth: 720 }}>
  <Title level={4}>Add-on Settings</Title>
```

### TraceRedactor Safety Net
**Source:** `src/core/telemetry/TraceRedactor.ts:11-19` (PATTERNS array), `src/core/telemetry/TraceRedactor.ts:62-73` (redactValue)
**Apply to:** Export operations (DATA-01, DATA-02)
```typescript
// Before writing export file, apply redaction as safety net:
const redacted = traceRedactor.redactValue(data);
// PATTERNS already cover: JSESSIONID, sysparmCK, g_ck, API keys, Bearer tokens
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/addons/servicenow/skills/serviceNowSkills.ts` | utility | transform | Co-created with writeSkills.ts — follow the same `PromptManager.createTemplate()` pattern with `displayCategory: 'ServiceNow'` |
| `src/core/data/` (export/import merge logic) | service | file-I/O | New code patterns that extend ImportExportSection inline — use WriteJournal atomic pattern + TraceRedactor pattern above |

These files follow the same patterns as their write addon counterparts. ServiceNow skills (CaseAnalyzer, CatchUp, Sentiment) follow the same PromptTemplate pattern as Write skills. The export/import data merge is an extension of the existing ImportExportSection, not a standalone file — use the WriteJournal + TraceRedactor shared patterns above.

## Metadata

**Analog search scope:** `src/core/`, `src/components/`, `src/entrypoints/`, `src/addons/`, `tests/core/`
**Files scanned:** ~80 files
**Pattern extraction date:** 2026-07-19
**Confidence:** HIGH — All analogs are in-project verified patterns with concrete line references
