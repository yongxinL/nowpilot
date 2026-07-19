---
phase: 08-add-ons-data-portability
reviewed: 2026-07-19T12:00:00Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - src/core/registries/AddonRegistry.ts
  - tests/core/addons/AddonRegistry.test.ts
  - src/addons/write/skills/writeSkills.ts
  - src/addons/write/components/WritePage.tsx
  - src/addons/write/registerWriteAddon.ts
  - tests/addons/write/writeSkills.test.ts
  - src/components/options/ImportExportSection.tsx
  - tests/core/data/exportSanitization.test.tsx
  - tests/core/data/importMerge.test.ts
  - src/addons/servicenow/services/CookieSessionStore.ts
  - src/addons/servicenow/services/ServiceNowSessionAdapter.ts
  - src/addons/servicenow/services/ServiceNowTableClient.ts
  - tests/addons/servicenow/CookieSessionStore.test.ts
  - tests/addons/servicenow/SessionAdapter.test.ts
  - src/addons/teamgqm/data/gqmTypes.ts
  - src/addons/teamgqm/services/GQMDataService.ts
  - src/core/storage/WriteJournalEntry.ts
  - tests/addons/teamgqm/GQMDataService.test.ts
  - src/addons/servicenow/skills/serviceNowSkills.ts
  - src/addons/servicenow/components/ServiceNowSidepanelPage.tsx
  - src/addons/servicenow/components/ServiceNowStandalonePage.tsx
  - src/addons/servicenow/registerServiceNowAddon.ts
  - tests/addons/servicenow/ServiceNowSkills.test.ts
  - src/addons/teamgqm/components/TeamGQMSidepanelPage.tsx
  - src/addons/teamgqm/components/TeamGQMStandalonePage.tsx
  - src/addons/teamgqm/registerTeamGQMAddon.ts
  - src/addons/global/ResearchSkill.ts
  - src/addons/global/registerGlobalAddons.ts
  - tests/addons/global/ResearchSkill.test.ts
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/standalone/main.tsx
  - src/core/navigation/navConfig.ts
  - src/components/options/AddonSettingsSection.tsx
  - src/core/slash/SlashCommandRegistry.ts
  - src/core/prompts/PromptManager.ts
  - tests/core/data/exportSanitization.test.tsx
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 8: Code Review Report — Add-ons & Data Portability

**Reviewed:** 2026-07-19T12:00:00Z
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

This phase introduces the add-on system (Write, ServiceNow, TeamGQM, Global) and data portability features (import/export). The codebase is well-structured with consistent patterns, proper TypeScript types, and good test coverage. However, three critical issues were identified: a mismatch between root-level entity queries and the data model that renders both GQM pages non-functional, a data corruption risk when importing exported credentials, and duplicate error alerts in the ServiceNow sidepanel page. Several warning-level concerns around error handling, redundant API calls, and type drift are also noted.

---

## Critical Issues

### CR-01: TeamGQM pages use empty string `''` for root-level query, but Goal entities have `parentId: null`

**Files:**
- `src/addons/teamgqm/components/TeamGQMSidepanelPage.tsx:21`
- `src/addons/teamgqm/components/TeamGQMStandalonePage.tsx:25`
- `src/addons/teamgqm/services/GQMDataService.ts:138-143`

**Issue:** Both TeamGQM pages call `gqmDataService.getChildren('')` to load root-level goals. However, `getChildren()` filters by exact `===` comparison on `parentId`. Goal entities have `parentId: null` (per the type definition in `gqmTypes.ts`), while the pages pass empty string `''`. Since `null !== ''`, the filter never matches any goal. **Both the sidepanel and standalone pages will always render the empty state "No goals defined yet."**, making the GQM add-on completely non-functional for reading/displaying data.

**Fix:** Change both calls to pass `null` instead of `''`. The `getChildren` method signature needs to accept `string | null`:

In `TeamGQMSidepanelPage.tsx:21`:
```typescript
const allNodes = await gqmDataService.getChildren(null as unknown as string);
```

In `TeamGQMStandalonePage.tsx:25`:
```typescript
const allNodes = await gqmDataService.getChildren(null as unknown as string);
```

Better yet, fix the type signature in `GQMDataService.ts` to accept `string | null`:
```typescript
async getChildren(parentId: string | null): Promise<GQMNode[]> {
  const db = await this.#getGqmDB();
  const tx = db.transaction(GQM_STORE, 'readonly');
  const all = (await tx.store.getAll()) as GQMNode[];
  await tx.done;
  return all.filter((n) => n.parentId === parentId && !n.deleted);
}
```

Then call with `null` in both components:
```typescript
const allNodes = await gqmDataService.getChildren(null);
```

---

### CR-02: Importing exported data corrupts provider configurations by writing redacted credentials

**File:** `src/components/options/ImportExportSection.tsx:117, 222-227`

**Issue:** The export pipeline runs all data through `traceRedactor.redactValue()` on line 117 before writing to the ZIP file. This replaces sensitive values like API keys (`sk-test-key-abc123`) with placeholder strings (`[REDACTED:API_KEY]`). The import pipeline then reads this redacted JSON and merges it back into `chrome.storage.local` without any awareness that the values have been sanitized.

Specifically, on lines 222-227, provider configs are imported with a shallow merge that overwrites existing configurations:
```typescript
const mergedProviders = { ...existingProviders, ...incomingProviders };
await chrome.storage.local.set({ np_provider_configs: mergedProviders });
```

Since the incoming providers contain `[REDACTED:API_KEY]` placeholders instead of real keys, this **destroys the user's real API credentials** during import. The provider configs would then contain unusable placeholder strings.

**Fix:** There are two approaches:

**Approach A (Skip redacted fields on import):** Before merging, check if values match redacted patterns and preserve existing values:
```typescript
if (settings.providerConfigs) {
  const existingConfigs = await chrome.storage.local.get('np_provider_configs');
  const existingProviders = (existingConfigs.np_provider_configs ?? {}) as Record<string, unknown>;
  const incomingProviders = settings.providerConfigs as Record<string, unknown>;
  const mergedProviders = { ...existingProviders };
  for (const [key, value] of Object.entries(incomingProviders)) {
    if (typeof value === 'string' && value.startsWith('[REDACTED:')) {
      continue; // Skip redacted values — keep existing
    }
    mergedProviders[key] = value;
  }
  await chrome.storage.local.set({ np_provider_configs: mergedProviders });
}
```

**Approach B (Add import-only fields to ExportData schema):** Tag the export data to indicate it has been redacted, and add a warning in the UI that credentials cannot be round-tripped. Skip all fields with `[REDACTED:...]` placeholders during import globally.

---

### CR-03: Duplicate alert rendering in ServiceNowSidepanelPage due to overlapping conditions

**File:** `src/addons/servicenow/components/ServiceNowSidepanelPage.tsx:97-121`

**Issue:** Two conditional rendering blocks have overlapping conditions that cause both to render simultaneously when there's a session error:

- Line 97: `{!session && error && (...)}` — renders a "No ServiceNow Session" warning alert
- Line 113: `{error && loading === false && !session && (...)}` — renders a "Connection Error" error alert

When `session` is `null` and `error` is set to a non-null string and `loading` is `false`, **both conditions evaluate to true**, producing two alerts with different severity levels (warning + error) showing similar information. This is confusing UX and suggests a logic error: the second block was likely intended for a different case (e.g., errors that occur after a session was already established).

**Fix:** Change the conditions to be mutually exclusive. For example, use an `if/else` structure or check for session existence differently:

```tsx
{session && !error && (
  // Case context card — shown when session is active
)}

{!session && error && (
  <Alert
    type="warning"
    message="No ServiceNow Session"
    description={error}
    showIcon
    action={
      <Button size="small" onClick={acquireSession}>
        Retry
      </Button>
    }
    style={{ marginBottom: 16 }}
  />
)}

{/* Separate block for errors that occur after session was established (e.g., during skill execution) */}
{session && error && (
  <Alert
    type="error"
    message="Connection Error"
    description={error}
    showIcon
    closable
    style={{ marginBottom: 16 }}
  />
)}
```

Alternatively, remove the redundant block entirely and use a single `Alert` with conditional properties.

---

## Warnings

### WR-01: Empty catch blocks silently swallow non-duplicate errors in several files

**Files:**
- `src/addons/write/skills/writeSkills.ts:77`
- `src/addons/servicenow/skills/serviceNowSkills.ts:47`
- `src/addons/write/registerWriteAddon.ts:8-10`

**Issue:** All three files use bare `catch {}` or `catch () {}` blocks when calling `promptManager.createTemplate()`. The stated intent is to silently skip templates that already exist (idempotent registration). However, the empty catch swallows **all** errors, not just "already exists" errors. If `promptManager.createTemplate()` fails for other reasons (IndexedDB quota exceeded, permissions revoked, storage corruption), the error is silently hidden with no logging or recovery path.

**Fix:** Log unexpected errors and rethrow, or check the error type:

In `writeSkills.ts:73-80`:
```typescript
export async function registerWriteTemplates(): Promise<void> {
  for (const template of writeSkillTemplates) {
    try {
      await promptManager.createTemplate(template);
    } catch (err) {
      // Only suppress "already exists" errors
      if (err instanceof Error && err.message.includes('already exists')) {
        continue;
      }
      throw err; // Re-throw unexpected errors
    }
  }
}
```

---

### WR-02: Duplicate `listTools()` MCP API call in ResearchSkill.execute()

**File:** `src/addons/global/ResearchSkill.ts:68-97`

**Issue:** The `execute()` method calls `this.isAvailable()` on line 69, which internally calls `this.#config.mcpClient.listTools()`. If available, it then calls `this.#config.mcpClient!.listTools()` again on line 82 to find the matching search tool. This means the MCP client's `listTools()` API is called **twice** per `execute()` invocation, doubling the latency for every research request.

**Fix:** Refactor to share the tool list between availability check and execution:

```typescript
async execute(query: string): Promise<ResearchResult> {
  if (!this.#config.mcpClient) {
    return {
      type: 'unavailable',
      message: 'Configure a web search tool in Options → MCP Servers to enable research.',
    };
  }

  try {
    const { tools } = await this.#config.mcpClient.listTools();
    const searchTool = tools.find((t) =>
      SEARCH_TOOL_PATTERNS.some(
        (p) => p.test(t.name) || p.test(t.description ?? ''),
      ),
    );

    if (!searchTool) {
      return { type: 'unavailable', message: 'Configure a web search tool in Options → MCP Servers to enable research.' };
    }

    const results = await this.#config.mcpClient.callTool(searchTool.name, { query });
    return { type: 'results', data: results };
  } catch (err) {
    debugLog('error', '[ResearchSkill] execute failed', { error: err });
    return { type: 'error', message: 'Research search failed. Please try again.' };
  }
}
```

Then `isAvailable()` can remain as a lightweight check, or `execute()` can use it only when there's no direct MCP client reference.

---

### WR-03: Type drift risk in AddonRegistry test types

**File:** `tests/core/addons/AddonRegistry.types.ts`

**Issue:** The test file defines its own local copies of `AddonSkill`, `AddonPage`, and `AddonSettingsSchema` interfaces. These are incomplete duplicates of the source types in `src/core/registries/AddonRegistry.ts`. Notably, the local `AddonSkill` is missing the `inputSchema` field that exists in the source type. Because tests import from the local `.types` file rather than from the source, if the source types are updated (e.g., adding or changing fields), the tests will not catch type mismatches — the mock objects will still compile against the stale local types.

**Fix:** Import types directly from the source module instead of maintaining a local copy:

```typescript
// Remove tests/core/addons/AddonRegistry.types.ts
// Change import in AddonRegistry.test.ts to:
import type { AddonSkill, AddonPage, AddonSettingsSchema } from '../../../src/core/registries/AddonRegistry';
```

---

### WR-04: TeamGQM inline editing silently discards changes on blur

**File:** `src/addons/teamgqm/components/TeamGQMStandalonePage.tsx:149-161`

**Issue:** The inline title editor for GQM nodes saves changes on `onPressEnter` but the `onBlur` handler calls `setEditingKey(null)` **without saving**. If a user types a new name and clicks outside the input (or tabs away), the edit is silently discarded with no feedback. This is a poor UX pattern — users expect blur to either save or at minimum prompt confirmation.

**Fix:** Save on blur as well, or add a confirmation:

```typescript
onBlur={async (e) => {
  const value = (e.target as HTMLInputElement).value;
  if (value !== (nodeTitle as string)) {
    await gqmDataService.updateNode(key, { title: value });
    message.success('Updated');
  }
  setEditingKey(null);
  loadGoals();
}}
```

---

### WR-05: Floating promise in registerServiceNowAddon — async call from sync function

**File:** `src/addons/servicenow/registerServiceNowAddon.ts:11`

**Issue:** `registerServiceNowSkills()` is an `async` function returning `Promise<void>`, but it is called from a synchronous `registerServiceNowAddon()` without `await` or `.catch()`. While the function internally catches all errors (so no unhandled rejections occur), the pattern is inconsistent with the otherwise-observant error handling in the codebase and could mask issues if the internal error handling is ever refactored. Compare with `registerWriteAddon.ts` which at least has `.catch(() => {})` on the promise.

**Fix:** Either await the call (requires making `registerServiceNowAddon` async) or add a `.catch()`:

```typescript
registerServiceNowSkills().catch((err) => {
  console.warn('ServiceNow skill registration failed (continuing):', err);
});
```

---

## Info

### IN-01: Near-identical code duplication in GQMDataService create methods

**File:** `src/addons/teamgqm/services/GQMDataService.ts:35-136`

**Issue:** The `createGoal`, `createQuestion`, and `createMetric` methods share ~90% identical logic: generate ID, timestamp, create entry, write journal start, open transaction, put entity, complete journal. Only the specific input type differs. This is ~100 lines of repeated code that could be unified into a single generic create method.

**Suggestion:** Extract a private generic method:

```typescript
async #createEntity<T extends GQMNode>(
  type: T['type'],
  input: Record<string, unknown>,
): Promise<T> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const entity = { ...input, id, type, createdAt: now, updatedAt: now } as unknown as T;

  const entry = await writeJournal.begin('save-gqm-data', { entityId: id, type }, [{ name: 'write-gqm-entity' }]);
  await writeJournal.markStepStart(entry.id, 0);
  try {
    const db = await this.#getGqmDB();
    const tx = db.transaction(GQM_STORE, 'readwrite');
    await tx.store.put(entity);
    await tx.done;
    await writeJournal.markStepComplete(entry.id, 0);
    await writeJournal.markCompleted(entry.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeJournal.markStepFailed(entry.id, 0, msg);
    await writeJournal.markFailed(entry.id);
    throw err;
  }
  return entity;
}
```

---

### IN-02: Placeholder export data for Notes and Memory sections

**File:** `src/components/options/ImportExportSection.tsx:97-101`

**Issue:** The export for `notes` and `memory` scopes uses `{ exported: true }` as placeholder data rather than actual content. The import handler (line 261) acknowledges "Chat, Notes, and Memory data import requires IndexedDB integration (future phase)." This is acceptable as a deferred implementation, but exports claiming to include these scopes will produce non-functional data.

**Suggestion:** Either add a UI note that Notes/Memory export is a placeholder, or exclude these scopes from the export until properly implemented.

---

_Reviewed: 2026-07-19T12:00:00Z_
_Reviewer: gsd-code-reviewer agent_
_Depth: standard_
