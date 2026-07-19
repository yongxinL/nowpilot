# Phase 8: Add-ons & Data Portability - Research

**Researched:** 2026-07-19
**Domain:** Chrome Extension Add-on System, Session Acquisition, Data Portability
**Confidence:** MEDIUM

## Summary

Phase 8 makes the add-on system fully operational. Three add-ons (Write, TeamGQM, ServiceNow) register pages and skills through a new AddonRegistry that follows the established ToolRegistry class+singleton pattern. The registry manages three typed registrations—skills, pages, and settings schemas—allowing add-ons to participate in the existing navigation, Options, and slash-command infrastructure.

ServiceNow session acquisition uses a hybrid strategy: `chrome.cookies.get()` for the JSESSIONID cookie (requiring `"cookies"` permission + host_permissions), and a MAIN-world content script bridge for `window.g_ck` (sysparmCK). These compose into a unified session object via CookieSessionStore + ServiceNowSessionAdapter. All ServiceNow Table API calls route through the existing PROXY_FETCH pattern in the background service worker.

Data portability extends the existing ImportExportSection with WriteJournal atomic exports (consistent snapshots across all IndexedDB stores using the `export-data` operation type) and deterministic timestamp-based merge (latest-wins via `updatedAt` comparison). Credential exclusion is enforced by a dedicated test + TraceRedactor safety net. ResearchSkill detects search-capable MCP servers by iterating connected MCP client tools and checking for search-related tool names.

**Primary recommendation:** Register add-ons at startup in `main.tsx` following `registerNowPilotCorePages.ts` blueprint; AddonRegistry follows ToolRegistry's exact Map+singleton pattern with generics for skill/page/settings typing; all add-on data flows through WriteJournal and PROXY_FETCH—never invent new paths.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AddonRegistry (registration/enable/disable) | API / Backend (core) | — | Registry lives in `src/core/registries/` alongside SidepanelPageRegistry; enable state in `chrome.storage.local` |
| Write add-on skills (prompt templates) | API / Backend (core) | Browser / Client (UI) | PromptManager owns templates; UI renders action buttons in Side Panel |
| ServiceNow session acquisition (JSESSIONID) | API / Backend (core) | Browser / Client (MAIN world) | `chrome.cookies` API runs in core; MAIN-world bridge runs as content script |
| ServiceNow Table API client | API / Backend (core) | — | PROXY_FETCH in background SW; RateLimiter in core utils |
| TeamGQM data model (IndexedDB) | API / Backend (core) | — | WriteJournal writes to IndexedDB; data model in `src/addons/teamgqm/` |
| TeamGQM Side Panel (read-only tree) | Browser / Client | — | AntD Tree in SidepanelContent; reads from IndexedDB |
| TeamGQM Full App (editable tree) | Browser / Client | API / Backend (core) | AntD Tree with inline editing; writes via WriteJournal |
| ResearchSkill (MCP search detection) | API / Backend (core) | — | Detects search MCP tools via MCP client SDK; runs in Chat/Agent context |
| Data export (atomic snapshot) | API / Backend (core) | — | WriteJournal `export-data` operation; JSZip for file generation |
| Data import (merge) | API / Backend (core) | — | WriteJournal writes; `updatedAt` comparison logic in core |
| AddonSettingsSection (Options UI) | Browser / Client | — | UI renders registry data; settings in `chrome.storage.local` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `antd` (Tree, Table, Card, Switch, Drawer) | ^6.5.0 | TeamGQM hierarchy, ServiceNow case table, Write action cards, settings toggles | Already in project; AntD Tree with `titleRender`, `expandedKeys`, `selectedKeys` handles hierarchical data; Table with `size="middle"`, pagination |
| `jszip` | 3.10.1 | ZIP file creation for data export | Already in ImportExportSection; latest stable; 35M weekly downloads [VERIFIED: npm registry] |
| `@ant-design/icons` | (existing) | Icon library for add-on nav items and UI | Project-standard icon library; already mapped in `icons.tsx` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@modelcontextprotocol/sdk` [ASSUMED] | latest (v1.x) | MCP client for ResearchSkill tool detection | When Phase 7 installs it for AGNT-03 (StreamableHTTP transport); ResearchSkill calls `client.listTools()` to detect search-capable servers [ASSUMED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AddonRegistry following ToolRegistry | Build a plugin system from scratch | ToolRegistry pattern is proven in-project (Map-based, JS private `#fields`, singleton export); no need to invent |
| Custom tree component for TeamGQM | react-arborist, react-complex-tree | AntD Tree is already installed, supports `titleRender` + custom inline editing via AntD inputs, has `onExpand`/`onSelect`/`onDoubleClick` callbacks |
| Custom merge UI for data import | Interactive conflict resolution dialog | Deterministic timestamp-based latest-wins (D-17) avoids complex UI; each record has single source of truth |

**Installation:**
```bash
# No new packages needed — all dependencies already installed or coming from Phase 7
# @modelcontextprotocol/sdk installed by Phase 7 (AGNT-03) — verify after Phase 7 completes
# If not yet installed:
pnpm add @modelcontextprotocol/sdk@latest
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| jszip | npm | 14+ yrs | ~35M/wk | github.com/Stuk/jszip | OK | Approved — already in project at 3.10.1 |
| @modelcontextprotocol/sdk | npm | ~19 mo | ~39M/wk | github.com/modelcontextprotocol/typescript-sdk | OK | Approved — not yet installed; needed from Phase 7 for AGNT-03 |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

*No new packages are required for Phase 8 beyond what is already installed (jszip) or what Phase 7 will install (@modelcontextprotocol/sdk). The @modelcontextprotocol/sdk package is tagged `[ASSUMED]` because Phase 8 depends on Phase 7 installing it — the planner must verify Phase 7 completion before depending on this package.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHROME EXTENSION                               │
│                                                                          │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │  main.tsx     │    │  AddonRegistry    │    │  chrome.storage.local │  │
│  │ (sidepanel +  │───▶│  (class+singleton)│───▶│  np_addon_enabled     │  │
│  │  standalone)  │    │                    │    │  np_addon_settings    │  │
│  └──────────────┘    │  #skills: Map      │    └──────────────────────┘  │
│                      │  #pages: Map       │                              │
│  ┌──────────────┐    │  #settings: Map    │    ┌──────────────────────┐  │
│  │ Addon Pages   │◀───│  #enabled: Map     │    │  SidepanelPageRegistry│  │
│  │ - Write       │    └──────────────────┘───▶│  StandalonePageReg.   │  │
│  │ - ServiceNow  │                            └──────────────────────┘  │
│  │ - TeamGQM     │                                                      │
│  └──────────────┘    ┌──────────────────┐    ┌──────────────────────┐  │
│                      │  PromptManager    │◀───│  Write Addon Skills  │  │
│  ┌──────────────┐    │  (existing)       │    │  (6 prompt templates)│  │
│  │ SiderMenu    │    └──────────────────┘    └──────────────────────┘  │
│  │ (renders     │                                                      │
│  │  addon items │    ┌──────────────────────────────────────────────┐  │
│  │  below       │    │           ServiceNow Session Flow             │  │
│  │  separator)  │    │                                               │  │
│  └──────────────┘    │  ┌─────────────┐    ┌──────────────────────┐  │
│                      │  │ chrome.     │    │ MAIN world CS bridge  │  │
│                      │  │ cookies.    │───▶│ window.g_ck          │  │
│                      │  │ get()       │    │ (CONT-05 pattern)    │  │
│                      │  └─────────────┘    └──────────────────────┘  │
│                      │         │                     │               │
│                      │         ▼                     ▼               │
│                      │  ┌──────────────────────────────────────┐    │
│                      │  │  ServiceNowSessionAdapter             │    │
│                      │  │  (unified session: jsessionid+g_ck)   │    │
│                      │  └──────────────────────────────────────┘    │
│                      │         │                                    │
│                      │         ▼                                    │
│                      │  ┌──────────────────────────────────────┐    │
│                      │  │  ServiceNow Table API Client          │    │
│                      │  │  → PROXY_FETCH (background SW)        │    │
│                      │  │  → RateLimiter                        │    │
│                      │  └──────────────────────────────────────┘    │
│                      └──────────────────────────────────────────────┘
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    DATA PORTABILITY FLOW                          │   │
│  │                                                                   │   │
│  │  EXPORT:                                                          │   │
│  │  ImportExportSection → WriteJournal.begin('export-data')          │   │
│  │    → Read all IndexedDB stores within operation                   │   │
│  │    → TraceRedactor.redactValue() safety net                       │   │
│  │    → JSZip → download                                            │   │
│  │                                                                   │   │
│  │  IMPORT:                                                          │   │
│  │  File upload → Parse JSON → Read existing records                 │   │
│  │    → Per-store merge: updatedAt comparison (latest-wins)          │   │
│  │    → WriteJournal for consistency → Alert with merge summary      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    RESEARCH SKILL FLOW                            │   │
│  │                                                                   │   │
│  │  /research command → ResearchSkill.isAvailable()                  │   │
│  │    → MCP client.listTools()                                       │   │
│  │    → Filter: tool.name matches /search|brave|tavily|web_search/i  │   │
│  │    → Available? → execute search → stream results                │   │
│  │    → Not available? → Alert: "Configure a web search tool in      │   │
│  │       Options → Skills & MCP to enable research."                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── core/
│   └── registries/
│       └── AddonRegistry.ts          # NEW: class+singleton, Map-based
├── addons/
│   ├── write/
│   │   ├── components/
│   │   │   └── WritePage.tsx         # NEW: 6 action buttons in Card
│   │   ├── skills/
│   │   │   └── writeSkills.ts        # NEW: 6 PromptTemplate configs
│   │   └── registerWriteAddon.ts     # NEW: registers pages+skills
│   ├── servicenow/
│   │   ├── components/
│   │   │   ├── ServiceNowSidepanelPage.tsx  # NEW
│   │   │   └── ServiceNowStandalonePage.tsx # NEW
│   │   ├── services/
│   │   │   ├── CookieSessionStore.ts   # NEW: wraps chrome.cookies
│   │   │   ├── ServiceNowSessionAdapter.ts  # NEW: unified session
│   │   │   └── ServiceNowTableClient.ts     # NEW: PROXY_FETCH+RateLimiter
│   │   ├── skills/
│   │   │   └── serviceNowSkills.ts     # NEW: CaseAnalyzer, CatchUp, Sentiment
│   │   └── registerServiceNowAddon.ts  # NEW
│   ├── teamgqm/
│   │   ├── components/
│   │   │   ├── TeamGQMSidepanelPage.tsx  # NEW: read-only Tree
│   │   │   └── TeamGQMStandalonePage.tsx # NEW: editable Tree
│   │   ├── data/
│   │   │   └── gqmTypes.ts            # NEW: Goal/Question/Metric types
│   │   ├── services/
│   │   │   └── GQMDataService.ts      # NEW: WriteJournal-backed CRUD
│   │   └── registerTeamGQMAddon.ts    # NEW
│   └── global/
│       ├── ResearchSkill.ts            # NEW: MCP search detection
│       └── registerGlobalAddons.ts     # NEW
```

### Pattern 1: AddonRegistry (ToolRegistry Analog)

**What:** Map-based class+singleton managing typed add-on registrations (skills, pages, settings schemas) with enable/disable state persisted to `chrome.storage.local`.

**When to use:** Whenever an add-on needs to register capabilities that core systems consume (navigation, slash commands, settings UI, tool execution).

**Example:**
```typescript
// Pattern: JS private #fields + class + singleton export
// Source: src/core/ai/tools/ToolRegistry.ts (primary pattern)
// Adopted for: AddonRegistry

export interface AddonSkill {
  name: string;
  description: string;
  addonId: string;
  handler: (input: unknown) => Promise<unknown>;
  inputSchema?: Record<string, unknown>;
}

export interface AddonPage {
  id: string;
  label: string;
  icon?: ComponentType;
  component: ComponentType;
  order?: number;
  surface: 'sidepanel' | 'standalone' | 'both';
}

export class AddonRegistry {
  #skills = new Map<string, AddonSkill>();
  #pages = new Map<string, AddonPage>();
  #enabled = new Map<string, boolean>();
  #settingsSchemas = new Map<string, Record<string, unknown>>();

  registerSkill(addonId: string, skill: AddonSkill): void {
    const key = `${addonId}:${skill.name}`;
    if (this.#skills.has(key)) throw new Error(`Skill "${key}" is already registered`);
    this.#skills.set(key, skill);
  }

  registerPage(addonId: string, page: AddonPage): void {
    const key = `${addonId}:${page.id}`;
    if (this.#pages.has(key)) throw new Error(`Page "${key}" is already registered`);
    this.#pages.set(key, page);
  }

  async enable(addonId: string): Promise<void> {
    this.#enabled.set(addonId, true);
    await this.#persistEnabled();
  }

  isEnabled(addonId: string): boolean {
    return this.#enabled.get(addonId) ?? false;
  }

  async #persistEnabled(): Promise<void> {
    const enabled = Object.fromEntries(this.#enabled);
    await chrome.storage.local.set({ np_addon_enabled: enabled });
  }
}

export const addonRegistry = new AddonRegistry();
```

### Pattern 2: Addon Page Registration at Startup

**What:** Each add-on provides a `registerXxxAddon()` function called from `main.tsx` before React mounts. Follows `registerNowPilotCorePages.ts` blueprint.

**When to use:** All add-on page registration — must happen at module import time before React renders navigation.

**Example:**
```typescript
// Source: src/core/registries/registerNowPilotCorePages.ts (blueprint)
// Adopted for: src/addons/write/registerWriteAddon.ts

export function registerWriteAddon(): void {
  // Register pages with existing registries
  sidepanelPageRegistry.register({
    id: 'write',
    label: 'Write',
    icon: WriteIcon,
    component: WritePage,
    order: 10,
  });

  // Register skills with AddonRegistry
  addonRegistry.registerSkill('write', {
    name: 'rewrite',
    description: 'Rewrite selected text',
    addonId: 'write',
    handler: rewriteHandler,
  });
  // ... 5 more skills
}
```

### Pattern 3: CookieSessionStore + ServiceNowSessionAdapter

**What:** Two-layer session management. CookieSessionStore wraps `chrome.cookies.get()` / `getAll()`. ServiceNowSessionAdapter composes JSESSIONID (from cookies) + sysparmCK (from MAIN-world bridge) into a unified session object.

**When to use:** When a third-party service requires both standard HTTP cookies AND JavaScript-global tokens for authentication.

**Example:**
```typescript
// CookieSessionStore: wraps chrome.cookies API
// Uses chrome.cookies.get({ url: 'https://instance.service-now.com', name: 'JSESSIONID' })
// Returns Cookie type with: name, value, domain, path, session, expirationDate, secure, httpOnly

// ServiceNowSessionAdapter
interface ServiceNowSession {
  jsessionId: string;
  sysparmCk: string;
  instanceUrl: string;
  expiresAt?: number; // derived from cookie.expirationDate or default TTL
}

async function acquireSession(instanceUrl: string): Promise<ServiceNowSession> {
  const cookie = await chrome.cookies.get({ url: instanceUrl, name: 'JSESSIONID' });
  // sysparmCK obtained via MAIN-world content script bridge (CONT-05 pattern)
  const sysparmCk = await requestMainWorldValue(tabId, 'g_ck');
  return { jsessionId: cookie.value, sysparmCk, instanceUrl };
}
```

### Pattern 4: Atomic Data Export via WriteJournal

**What:** Export wraps all IndexedDB reads in a WriteJournal `export-data` operation for a consistent snapshot.

**When to use:** Any data export that must produce a consistent point-in-time snapshot across multiple stores.

**Example:**
```typescript
async function exportDataAtomically(scopes: string[]): Promise<ExportData> {
  const entry = await writeJournal.begin(
    'export-data',
    { manifest: crypto.randomUUID() },
    [{ name: 'read-all-stores' }, { name: 'redact-credentials' }, { name: 'write-zip' }],
  );

  await writeJournal.markStepStart(entry.id, 0);
  const data: Record<string, unknown> = {};
  // Read all IndexedDB stores within the journaled operation
  for (const scope of scopes) {
    data[scope] = await readStore(scope);
  }
  await writeJournal.markStepComplete(entry.id, 0);

  await writeJournal.markStepStart(entry.id, 1);
  // Apply TraceRedactor safety net
  const redacted = traceRedactor.redactValue(data);
  await writeJournal.markStepComplete(entry.id, 1);

  await writeJournal.markStepStart(entry.id, 2);
  const zip = new JSZip();
  zip.file('export.json', JSON.stringify({ version: '0.1.0', exportedAt: new Date().toISOString(), operationId: entry.id, data: redacted }));
  const blob = await zip.generateAsync({ type: 'blob' });
  await writeJournal.markStepComplete(entry.id, 2);

  await writeJournal.markCompleted(entry.id);
  return blob;
}
```

### Anti-Patterns to Avoid
- **Registering add-on pages in React effects:** Pages must be registered at module import time in `main.tsx`, not inside `useEffect` or lazy-loaded — navigation needs them synchronously available. [CITED: src/core/registries/registerNowPilotCorePages.ts pattern]
- **Using bare fetch() for external API calls:** All external requests (ServiceNow Table API) must use PROXY_FETCH via background SW messaging. Direct fetch() calls put credentials at risk and bypass RateLimiter. [CITED: CONTEXT.md D-05, RESEARCH.md §PROXY_FETCH]
- **Writing IndexedDB outside WriteJournal:** All add-on data mutations must route through WriteJournal for atomicity. Direct IndexedDB writes bypass the journal and lose crash-recovery guarantees. [CITED: CONTEXT.md D-11, WriteJournal.ts]
- **Accessing addonFields/per-addon state without null checks:** Phase 8 addonFields are optional — code consuming them must handle undefined gracefully. [CITED: PageContext.ts lines 34-37]
- **Assuming MCP SDK version or tool naming conventions:** MCP tool names vary by server implementation. ResearchSkill must use flexible pattern matching (regex against tool.name and tool.description), not hardcoded names. [CITED: Context7 MCP SDK docs — listTools() returns arbitrary tool names]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Add-on registration/discovery system | Custom plugin architecture | AddonRegistry following ToolRegistry Map-based pattern | Proven in-project; typed registrations; consistent with all other registries |
| Cookie reading from browser | Custom cookie parsing from document.cookie | `chrome.cookies.get()` / `getAll()` API | MV3 API handles HttpOnly cookies, SameSite, partitioned cookies; service worker-accessible |
| ServiceNow API authentication | Custom auth flow | CookieSessionStore (chrome.cookies) + MAIN-world bridge (g_ck) | Reuses existing CONT-05 MAIN world pattern; no user credential entry |
| ZIP file creation for export | Manual ZIP construction | `jszip@3.10.1` (already in project) | Battle-tested; handles blobs, streaming, compression levels; already integrated in ImportExportSection |
| Hierarchical tree view for GQM | Custom tree rendering | `antd` `Tree` with `treeData`, `titleRender`, `expandedKeys` | Handles expand/collapse, selection, virtual scrolling for large datasets; already installed |
| MCP tool capability detection | Hardcoded tool name lists | `client.listTools()` → iterate tools, regex match names/descriptions | MCP servers have arbitrary tool names; flexible detection is future-proof |
| Data import merge logic | Interactive conflict resolution UI | Deterministic `updatedAt` comparison (latest-wins) | Each record has single source of truth; no complex UI needed; D-17 mandates this approach |
| Credential exclusion from export | Manual filter of sensitive fields | TraceRedactor.redactValue() as safety net + dedicated test | TraceRedactor already has JSESSIONID, sysparmCK, g_ck patterns; test verifies absence |

**Key insight:** Every core mechanism needed for Phase 8 already exists in the project — AddonRegistry follows ToolRegistry, ServiceNow session uses existing chrome.cookies + MAIN-world patterns, data export uses existing WriteJournal + JSZip + TraceRedactor. Phase 8 is predominantly integration and wiring, not invention.

## Common Pitfalls

### Pitfall 1: chrome.cookies requires host_permissions for each ServiceNow instance
**What goes wrong:** `chrome.cookies.get()` fails with no clear error when host_permissions don't cover the ServiceNow instance URL.
**Why it happens:** The cookies API requires explicit host_permissions for every domain whose cookies you want to read. ServiceNow instances have custom domains (`acme.service-now.com`), not a single fixed domain.
**How to avoid:** Dynamically request host permissions via `chrome.permissions.request()` when the user adds a ServiceNow instance, OR use `<all_urls>` host permission (with appropriate justification in Chrome Web Store submission). The existing OnboardingModal Step 6 already has ServiceNow host permission UI — persist which instances are authorized and check before session extraction.
**Warning signs:** Cookie read returns `undefined` or `null`; no error thrown but cookie not found.

### Pitfall 2: MAIN-world content script lifetime — g_ck may not be available at document_start
**What goes wrong:** Content script injected at `document_start` tries to read `window.g_ck` before ServiceNow's JavaScript sets it.
**Why it happens:** ServiceNow sets `window.g_ck` during its own script initialization, which runs after `document_start` but before user interaction.
**How to avoid:** Use `run_at: 'document_idle'` for the MAIN-world script. If g_ck is still undefined, poll with a short timeout (max 5s) or use a MutationObserver / script load listener. ServiceNow typically sets g_ck synchronously in a `<script>` tag following the login redirect.
**Warning signs:** `window.g_ck` is `undefined`; sysparmCK is missing from session object.

### Pitfall 3: IndexedDB export not truly atomic across stores
**What goes wrong:** Export reads stores sequentially without a transaction, so Store 2's data reflects a later state than Store 1's.
**Why it happens:** IndexedDB transactions are per-object-store unless explicitly scoped across multiple stores in a single transaction.
**How to avoid:** Use `db.transaction([store1, store2, store3], 'readonly')` to scope a single readonly transaction across all stores, ensuring a consistent snapshot. WriteJournal.begin() marks the start, but the actual IndexedDB transaction is separate — coordinate them so the read happens after journal entry creation but before any concurrent writes.
**Warning signs:** Exported data has inconsistent foreign key references; chat messages reference conversations not in the export.

### Pitfall 4: PROXY_FETCH message shape must match background SW handler
**What goes wrong:** ServiceNow Table API client sends PROXY_FETCH message with unrecognized shape, background SW ignores or rejects it.
**Why it happens:** PROXY_FETCH handler in background SW has a fixed message interface. Custom fields or missing required fields cause silent failures.
**How to avoid:** Check the existing PROXY_FETCH message handler shape in the background SW. Match the exact `type`, `url`, `options` structure. Add ServiceNow-specific headers (JSESSIONID cookie, sysparmCK header) through the message options, not through fetch() directly.
**Warning signs:** API calls return no response; background SW logs show unhandled message types; ServiceNow data never loads.

### Pitfall 5: AddonRegistry enable/disable state not observed by SiderMenu
**What goes wrong:** User disables an add-on in Options, but its nav items still appear in the sider.
**Why it happens:** SiderMenu reads from navConfig/page registries statically; it doesn't subscribe to AddonRegistry enable state changes.
**How to avoid:** SiderMenu must subscribe to `chrome.storage.onChanged` for `np_addon_enabled` key changes, or the AddonRegistry must emit events that SiderMenu observes. Alternatively, the navigation selectors can filter by `isEnabled()` on render.
**Warning signs:** Disabled add-on pages remain visible in navigation after toggle; re-enabling a disabled add-on doesn't show its pages.

## Code Examples

Verified patterns from official sources:

### chrome.cookies.get() for JSESSIONID
```typescript
// Source: Chrome Developers docs — chrome.cookies API (verified via webfetch)
// https://developer.chrome.com/docs/extensions/reference/api/cookies
// Confidence: HIGH (official Chrome docs)

async function getServiceNowSession(instanceUrl: string): Promise<CookieSession | null> {
  const cookie = await chrome.cookies.get({
    url: instanceUrl,
    name: 'JSESSIONID',
  });

  if (!cookie) return null;

  return {
    jsessionId: cookie.value,
    domain: cookie.domain,
    session: cookie.session,   // true for session cookies
    expiresAt: cookie.expirationDate, // undefined for session cookies
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
  };
}
```

### Ant Design Tree with titleRender for inline editing
```typescript
// Source: Context7 — /ant-design/ant-design Tree component docs
// Confidence: MEDIUM (Context7 docs, not version-verified against 6.5.0)

import { Tree, Input } from 'antd';
import type { DataNode } from 'antd/es/tree';

const TeamGQMTree: React.FC = () => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const titleRender = (nodeData: DataNode) => {
    if (nodeData.key === editingKey) {
      return (
        <Input
          defaultValue={nodeData.title as string}
          onPressEnter={(e) => {
            // Save edit via WriteJournal
            setEditingKey(null);
          }}
          onBlur={() => setEditingKey(null)}
          autoFocus
        />
      );
    }
    return (
      <span onDoubleClick={() => setEditingKey(nodeData.key as string)}>
        {nodeData.title}
      </span>
    );
  };

  return (
    <Tree
      treeData={treeData}
      titleRender={titleRender}
      expandedKeys={expandedKeys}
      onExpand={(keys) => setExpandedKeys(keys as string[])}
      blockNode
      showLine
    />
  );
};
```

### MCP Tool Detection for Search Capability
```typescript
// Source: Context7 — /modelcontextprotocol/typescript-sdk docs (first-client.md)
// Confidence: MEDIUM (Context7 SDK docs)

// NOTE: Assumes MCP client is connected via Phase 7 (AGNT-03)
// The search detection pattern detects MCP tools whose names/descriptions
// indicate web or document search capability

const SEARCH_TOOL_PATTERNS = [/search/i, /brave/i, /tavily/i, /web_search/i, /google/i];

async function isSearchAvailable(client: MCPClient): Promise<boolean> {
  const { tools } = await client.listTools();
  return tools.some((tool) =>
    SEARCH_TOOL_PATTERNS.some((pattern) =>
      pattern.test(tool.name) || pattern.test(tool.description ?? '')
    )
  );
}
```

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Skills + Pages + Settings in AddonRegistry:** AddonRegistry manages three typed registrations: skills (MCP-style tools), UI pages (via existing SidepanelPageRegistry/StandalonePageRegistry), and settings schemas (rendered in Options → Add-ons). Prompts stay in PromptManager; keymaps stay in KeymapRegistry. The registry follows the existing class+singleton pattern (ToolRegistry, SlashCommandRegistry).
- **D-02 — Registered by default, execution disabled until user enables:** All add-ons are registered (visible in navigation and settings) on install. Individual add-ons are disabled for execution by default — pages don't appear in navigation and skills don't execute until the user enables the add-on in Options → Add-ons. Registration != execution permission. Separate enable/disable state persisted per add-on under `np_addon_enabled` namespace.
- **D-03 — Three-phase activation lifecycle:** (1) Registration — add-on code loads, types registered, visible in settings. (2) Enablement — user toggles add-on ON; pages appear in nav, skills activate, settings participate. (3) Permission — data access (extraction, cookies, MAIN-world) requires explicit per-add-on user consent. Enforced by the registry, not by individual add-ons.
- **D-04 — Hybrid acquisition: chrome.cookies for JSESSIONID, MAIN-world bridge for g_ck:** JSESSIONID is a standard cookie — acquired via `chrome.cookies` API (no content script needed). sysparmCK (exposed as `window.g_ck`) requires a minimal MAIN-world content script bridge (CONT-05 already allows MAIN world for domain globals). No user-provided credentials, no DevTools copy-paste.
- **D-05 — CookieSessionStore + ServiceNowSessionAdapter:** CookieSessionStore wraps `chrome.cookies` API with MV3-compatible access patterns. ServiceNowSessionAdapter composes JSESSIONID (from cookies) + sysparmCK (from MAIN-world bridge) into a unified session object consumed by the ServiceNow Table API client. All API calls route through PROXY_FETCH — no bare fetch().
- **D-06 — Session freshness handled by adapter:** ServiceNowSessionAdapter checks cookie expiry and MAIN-world token freshness on each access. Stale sessions trigger re-extraction. No polling — extraction is on-demand when a ServiceNow skill or page requests session data.
- **D-07 — Skills as prompt templates, not Agent tools:** Write skills (Rewrite, Summarize, Draft Customer Update, Draft Internal Note, Explain, Action Plan) are structured PromptManager templates with pre-built system prompts. Each skill is a prompt-transformation workflow — the AI model does the work, the skill provides the structured prompt. No ToolRegistry registration needed. Keeps architecture lightweight.
- **D-08 — `/write` slash command routes to Write sidebar:** The existing `/write` slash command opens the Write add-on Side Panel page. Each skill is accessed as a quick-action button in the Write page, or invoked via skill-specific slash commands (e.g., `/rewrite`, `/summarize`). Selecting a skill populates the Sender with the corresponding prompt template.
- **D-09 — Full App not required for Write:** Write add-on primarily targets the Side Panel with quick actions. A Full App page is optional and deferred — the Side Panel compact layout with action buttons is the primary Write surface.
- **D-10 — Side Panel = read-only dashboard, Full App = editing workspace:** Side Panel shows a condensed GQM hierarchy (Goals → Questions → Metrics) with expand/collapse for quick consumption while working. Full App provides the full editing workspace for creating, organizing, and analysing GQM structures. Single data model, two rendering modes with distinct purposes.
- **D-11 — GQM data in IndexedDB via WriteJournal:** TeamGQM stores goals, questions, and metrics in a dedicated object store (or namespaced within NotesDB). All writes go through WriteJournal for atomicity. No chrome.storage.local for GQM data — it's structured and benefits from IndexedDB querying.
- **D-12 — MCP-connected only, no built-in search:** ResearchSkill requires a configured MCP web-search server (Brave Search, Tavily, enterprise search, etc.). Does not ship with any built-in search provider. Preserves privacy-first architecture — search capabilities are fully user-controlled and user-configured.
- **D-13 — Graceful degradation when no search MCP:** When `/research` is invoked and no search-capable MCP server is connected, show a helpful prompt: "Configure a web search tool in Options → MCP Servers to enable research." The `/research` slash command remains registered and visible — discovery is preserved even when search isn't available.
- **D-14 — ResearchSkill as a global add-on:** ResearchSkill is a global add-on (not tied to any domain). Registered via AddonRegistry as a skill. Available from both Chat and Agent modes via the `/research` command.
- **D-15 — Extend existing ImportExportSection, don't rebuild:** ImportExportSection (OPT-08) already provides the UI, scope selection, ZIP generation, and import file upload/validation. DATA-01/02 adds production-readiness: atomic exports, deterministic merge, and credential exclusion verification.
- **D-16 — Atomic exports via WriteJournal:** Export operations wrap all IndexedDB reads in a WriteJournal transaction. Ensures a consistent snapshot across all stores (chat history, notes, memory, settings, telemetry). Export manifest includes operation IDs for auditability.
- **D-17 — Deterministic timestamp-based merge (latest-wins):** Import merge uses `updatedAt` timestamp comparison. Newer records overwrite older ones. Conflict-free by design — each record has a single source of truth (the latest update time). No interactive conflict resolution UI needed.
- **D-18 — Credential exclusion verified by test:** Export must never include API keys, encrypted payloads, session tokens, or any `EncryptedStorage`-backed data. A dedicated test verifies that raw API keys (`np_providers` encrypted blobs), JSESSIONID, sysparmCK, and g_ck are absent from export output. TraceRedactor patterns applied as a safety net before writing export file.

### the agent's Discretion
- AddonRegistry internal API — exact method signatures, TypeScript generics for typed skill/page/settings registration
- CookieSessionStore internal API — chrome.cookies query patterns, MV3 compatibility handling
- ServiceNowSessionAdapter internal session object shape and refresh logic
- Write add-on prompt template content — exact system prompts for each of the 6 skills
- TeamGQM data model — Goal/Question/Metric type definitions, IndexedDB store schema
- ResearchSkill MCP tool detection — how it discovers search-capable MCP servers from connected configs
- Export atomicity implementation — WriteJournal operation types, manifest schema
- Import merge implementation — per-store merge strategies, error recovery
- AddonSettingsSection wiring — how Options renders per-addon settings schemas from the registry
- ServiceNow Table API client — exact request shape, pagination, error handling
- Add-on nav registration — where in startup sequence addon pages register (main.tsx pattern)

### Deferred Ideas (OUT OF SCOPE)
- Write add-on Full App page
- ServiceNow page injection (CaseInsightBox, floating widgets)
- TeamGQM AI-powered metric suggestions
- ResearchSkill built-in search provider
- Add-on marketplace / remote add-on loading
- Add-on interop (Write calling ServiceNow data)
- ServiceNow real-time notifications / polling
- TeamGQM chart/visualization of metrics
- Export scheduling / auto-export

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADDON-01 | AddonRegistry with typed registration for skills, prompts, pages, settings | Map-based class+singleton following ToolRegistry pattern; generics for skill/page/settings types; chrome.storage.local for enable/disable state |
| ADDON-02 | ServiceNow add-on — JSESSIONID/sysparmCK extraction, case context, Table API client | chrome.cookies.get() for JSESSIONID; MAIN-world bridge for g_ck; CookieSessionStore+ServiceNowSessionAdapter; PROXY_FETCH for API calls |
| ADDON-03 | ServiceNow add-on — CaseAnalyzerSkill, CatchUpSkill, SentimentSkill | Skills registered via AddonRegistry; prompt templates populated via PromptManager; AI execution via existing pipeline |
| ADDON-04 | ServiceNow add-on — Side Panel page (case-context + skill launcher) | Page registered via sidepanelPageRegistry; AntD Card for context, Buttons for skills; PROXY_FETCH for data |
| ADDON-05 | ServiceNow add-on — Full App page (case table, comments, work notes) | AntD Table with columns, Drawer for detail view; registered via standalonePageRegistry |
| ADDON-06 | Write add-on — 6 skills (Rewrite, Summarize, Draft Customer Update, Draft Internal Note, Explain, Action Plan) | PromptManager templates with pre-built system prompts; registered as addon skills; DisplayCategory: 'Writing' |
| ADDON-07 | Write add-on — Side Panel page with quick actions | 6 action buttons in vertical Card; each populates Sender with prompt template; registered via sidepanelPageRegistry |
| ADDON-08 | TeamGQM add-on — Side Panel (compact digest) + Full App (full workspace) | AntD Tree with titleRender for inline editing; IndexedDB via WriteJournal; read-only in Side Panel, editable in Full App |
| ADDON-09 | ResearchSkill global add-on — web search via MCP or built-in tool | MCP client.listTools() for search detection; flexible regex matching on tool names/descriptions; graceful Alert when unavailable |
| DATA-01 | Data export — sanitized JSON/ZIP with scope selection (no API keys) | WriteJournal atomic export; JSZip ZIP generation; TraceRedactor safety net; scope selection from existing ImportExportSection |
| DATA-02 | Data import — merge with conflict resolution | Deterministic timestamp-based merge (latest-wins via updatedAt); WriteJournal writes; merge summary Alert |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ISOLATED-world-only content scripts | MAIN world bridge for domain globals | Phase 7.2 (CONT-05) | Enables window.g_ck extraction without user copy-paste |
| In-memory-only add-on state | chrome.storage.local with `np_addon_` prefix | Phase 8 | Persistent enable/disable state survives extension restart |
| Manual data export (read-then-zip) | WriteJournal atomic export with operation IDs | Phase 8 | Consistent snapshots; auditable export history |
| No import merge strategy | Deterministic latest-wins (updatedAt comparison) | Phase 8 | No interactive conflict resolution needed |

**Deprecated/outdated:**
- N/A — all Phase 8 patterns are new or extend existing patterns; nothing is being deprecated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@modelcontextprotocol/sdk` will be installed by Phase 7 (AGNT-03) and provides `client.listTools()` returning `{tools: [{name, description, inputSchema}]}` | Standard Stack, ResearchSkill | ResearchSkill cannot detect MCP search capabilities; must fall back to graceful degradation always or implement custom MCP server config parsing |
| A2 | ServiceNow `window.g_ck` is set synchronously before `document_idle` | ServiceNow Session | MAIN-world bridge may need polling or MutationObserver instead of immediate read |
| A3 | IndexedDB readonly transaction across multiple stores provides consistent snapshot | Data Export | May need explicit transaction coordination; sequential reads could produce inconsistent export |
| A4 | Write add-on skills use PromptManager templates with `displayCategory: 'Writing'` and follow existing builtin template structure | Write Add-on | Would need different integration if PromptManager template format doesn't support addon-specific categories or variables |

## Open Questions (RESOLVED)

1. **MCP SDK availability from Phase 7**
   - What we know: AGNT-03 requires `@modelcontextprotocol/sdk` for StreamableHTTP transport. Phase 8 depends on Phase 7.
   - What's unclear: Whether Phase 7's MCP client instance is accessible to add-on code, or whether ResearchSkill needs its own client instance.
   - Recommendation: Planner should add a checkpoint to verify Phase 7's MCP client architecture before implementing ResearchSkill. If Phase 7 provides a centralized MCP client, ResearchSkill uses it directly. If not, ResearchSkill instantiates its own client.

2. **ServiceNow instance URL discovery**
   - What we know: ServiceNow instances have custom domains (e.g., `acme.service-now.com`). The extension needs to detect when the user is on a ServiceNow page to offer session extraction.
   - What's unclear: Whether instance URLs should be auto-detected from active tab URL, manually configured in Options, or both.
   - Recommendation: Auto-detect from active tab URL matching `*.service-now.com` pattern for the MVP. Manual configuration in Options as a fallback. Use the existing OnboardingModal Step 6 host permissions UI.

3. **TeamGQM IndexedDB store design**
   - What we know: GQM data goes in IndexedDB via WriteJournal (D-11). WriteJournal supports arbitrary targetIds per operation.
   - What's unclear: Whether GQM data gets its own object store or is namespaced within NotesDB. Schema design affects query patterns.
   - Recommendation: Dedicated `gqm` object store within the existing IndexedDB database (same as ChatHistoryDB, NotesDB, MemoryDB). Follow IndexedDBMigrator pattern with versioned migrations. Each entity (Goal, Question, Metric) stored with `type` discriminator field for querying.

4. **ResearchSkill search result handling**
   - What we know: ResearchSkill calls MCP search tool, gets results.
   - What's unclear: How search results are rendered — inline streaming, separate UI card, or appended to conversation.
   - Recommendation: Results stream inline as part of the AI's response in Chat/Agent mode. The MCP tool's response is appended to the conversation context, and the AI synthesizes a response. No separate UI widget needed for v0.1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/dev | ✓ | v26.5.0 | — |
| pnpm | Package management | ✓ | 9.15.9 | — |
| jszip | Data export ZIP | ✓ | 3.10.1 | — (already in package.json) |
| antd | TeamGQM Tree, ServiceNow Table, Write Cards, Options UI | ✓ | ^6.5.0 | — (already in package.json) |
| @modelcontextprotocol/sdk | ResearchSkill MCP detection | ✗ | — | **Blocking** — must be installed by Phase 7 or Phase 8; ResearchSkill cannot detect MCP search without it |
| MCP search server (Brave/Tavily/etc.) | ResearchSkill execution | ✗ | — | Graceful degradation: show Alert with configuration instructions (D-13) |
| ServiceNow instance | ServiceNow add-on testing | ✗ | — | Manual testing required; test with mock ServiceNow API responses |

**Missing dependencies with no fallback:**
- `@modelcontextprotocol/sdk` — ResearchSkill needs this to call `client.listTools()`. Must be installed (either by Phase 7 or by Phase 8 task 0).

**Missing dependencies with fallback:**
- MCP search server — gracefully degrades with Alert message per D-13.
- ServiceNow instance — mock API for testing; real instance for manual verification.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing project standard) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `pnpm test -- --run` |
| Full suite command | `pnpm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADDON-01 | AddonRegistry register/unregister/enable/disable/isEnabled | unit | `pnpm vitest tests/core/addons/AddonRegistry.test.ts` | ❌ Wave 0 |
| ADDON-02 | CookieSessionStore reads JSESSIONID via chrome.cookies.get() | unit | `pnpm vitest tests/addons/servicenow/CookieSessionStore.test.ts` | ❌ Wave 0 |
| ADDON-02 | ServiceNowSessionAdapter composes JSESSIONID + g_ck | unit | `pnpm vitest tests/addons/servicenow/SessionAdapter.test.ts` | ❌ Wave 0 |
| ADDON-06 | Write skills register as prompt templates in PromptManager | unit | `pnpm vitest tests/addons/write/writeSkills.test.ts` | ❌ Wave 0 |
| DATA-01 | Export excludes EncryptedStorage keys, API keys, JSESSIONID | integration | `pnpm vitest tests/core/data/exportSanitization.test.ts` | ❌ Wave 0 |
| DATA-02 | Import merge — newer records overwrite older; new records inserted | unit | `pnpm vitest tests/core/data/importMerge.test.ts` | ❌ Wave 0 |
| ADDON-09 | ResearchSkill detects search MCP tools; degrades gracefully without them | unit | `pnpm vitest tests/addons/global/ResearchSkill.test.ts` | ❌ Wave 0 |
| ADDON-10 | Core never imports from addons (existing test) | unit | `pnpm vitest tests/core/no-addon-imports.test.ts` | ✅ Existing |

### Sampling Rate
- **Per task commit:** `pnpm vitest related --run` (run tests matching changed files)
- **Per wave merge:** `pnpm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/addons/AddonRegistry.test.ts` — covers ADDON-01 registration, enable/disable, typed access
- [ ] `tests/addons/servicenow/CookieSessionStore.test.ts` — covers chrome.cookies mock, JSESSIONID retrieval
- [ ] `tests/addons/servicenow/SessionAdapter.test.ts` — covers session composition, freshness checks
- [ ] `tests/addons/write/writeSkills.test.ts` — covers 6 skill prompt template registrations
- [ ] `tests/core/data/exportSanitization.test.ts` — covers credential exclusion from export
- [ ] `tests/core/data/importMerge.test.ts` — covers deterministic merge logic
- [ ] `tests/addons/global/ResearchSkill.test.ts` — covers MCP detection, graceful degradation
- [ ] Test mocks for `chrome.cookies` API (vitest stub)
- [ ] Test mocks for MCP client `listTools()`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | ServiceNow uses existing session — no new credential entry |
| V3 Session Management | Yes | CookieSessionStore handles JSESSIONID securely; session tokens never persisted to chrome.storage.local; session storage uses chrome.storage.session (memory-only) |
| V4 Access Control | Yes | AddonRegistry three-phase lifecycle (D-03): registration ≠ execution; permission gated per addon; ServiceNow data access requires explicit user consent |
| V5 Input Validation | Yes | Export/import data validated against schemas; ServiceNow API responses validated before rendering; MCP tool inputs validated per tool inputSchema |
| V6 Cryptography | Yes | Export never contains EncryptedStorage blobs or API keys (D-18); TraceRedactor applied as safety net; credential exclusion verified by dedicated test |
| V7 Error Handling | Yes | Graceful degradation for unavailable search MCP; session expiry handled with re-extraction prompt; API failures surfaced via Alert components |

### Known Threat Patterns for Chrome Extension Add-ons

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JSESSIONID leaked through export | Information Disclosure | TraceRedactor patterns for JSESSIONID, sysparmCK, g_ck (already configured); dedicated export sanitization test |
| Add-on accesses data without user consent | Elevation of Privilege | Three-phase lifecycle (D-03): permission gate enforced by AddonRegistry, not individual add-ons |
| Bare fetch() bypasses RateLimiter and SW security | Tampering | All external API calls route through PROXY_FETCH in background SW; lint rule blocks bare fetch() in addon code |
| MAIN-world bridge exposes window.g_ck to page scripts | Information Disclosure | Bridge communicates via window.postMessage with origin validation; value never written back to page globals |
| Import overwrites critical settings with malicious data | Tampering | Import validates data structure before writing; WriteJournal ensures rollback capability; merge summary alerts user |
| MCP search tool returns malicious content rendered in Chat | Spoofing | AI model synthesizes MCP results before display; no raw MCP output rendered directly to user |

## Sources

### Primary (HIGH confidence)
- [Chrome Developers — chrome.cookies API Reference] — Verified via webfetch; Cookie type, get()/getAll() signatures, permissions model, MV3 compatibility [CITED: developer.chrome.com/docs/extensions/reference/api/cookies]
- [Chrome Developers — Content Scripts Documentation] — Verified via webfetch; ISOLATED vs MAIN worlds, injection methods, static/dynamic/programmatic [CITED: developer.chrome.com/docs/extensions/develop/concepts/content-scripts]
- [Chrome Developers — chrome.storage API Reference] — Verified via webfetch; storage.local quota (10 MB), StorageArea methods, onChanged events [CITED: developer.chrome.com/docs/extensions/reference/api/storage]
- [Project Source — ToolRegistry.ts] — Primary pattern for AddonRegistry; class+singleton with JS private #fields Map [CITED: src/core/ai/tools/ToolRegistry.ts]
- [Project Source — WriteJournal.ts] — Atomic multi-store operation coordinator; existing export-data operation type [CITED: src/core/storage/WriteJournal.ts]
- [Project Source — TraceRedactor.ts] — JESSIONID, sysparmCK, g_ck redaction patterns already configured [CITED: src/core/telemetry/TraceRedactor.ts]

### Secondary (MEDIUM confidence)
- [Context7 — Ant Design Tree Component Docs] — TreeProps, titleRender, expandedKeys, onExpand, DirectoryTree [CITED: /ant-design/ant-design — Tree component documentation]
- [Context7 — MCP TypeScript SDK Docs] — Client.listTools(), tool name/description/inputSchema structure, StdioClientTransport [CITED: /modelcontextprotocol/typescript-sdk — first-client.md, low-level-server.md]

### Tertiary (LOW confidence)
- [Assumed — ResearchSkill MCP tool detection patterns] — Flexible regex matching on tool names (search, brave, tavily, web_search, google); may need adjustment per actual MCP server implementations [ASSUMED]
- [Assumed — ServiceNow window.g_ck availability timing] — Assumed set before document_idle; may need polling fallback [ASSUMED]
- [Assumed — @modelcontextprotocol/sdk from Phase 7] — Assumes Phase 7 installs the SDK and provides accessible MCP client [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — All libraries verified on npm registry except @modelcontextprotocol/sdk (depends on Phase 7)
- Architecture: HIGH — Patterns based on verified in-project code (ToolRegistry, WriteJournal, TraceRedactor, page registries)
- Pitfalls: MEDIUM — Based on Chrome Extension API docs (HIGH) and in-project patterns; some pitfalls are domain-specific inference
- Security: MEDIUM — ASVS categories mapped; threat patterns identified; mitigations based on existing project security infrastructure

**Research date:** 2026-07-19
**Valid until:** 2026-08-16 (30 days)
