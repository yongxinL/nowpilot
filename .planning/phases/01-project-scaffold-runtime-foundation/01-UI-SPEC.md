---
phase: 1
slug: project-scaffold-runtime-foundation
status: verified
shadcn_initialized: false
preset: none
created: 2026-07-28
updated: 2026-07-29
---

# Phase 1 — UI Design Contract (As Implemented)

> Visual and interaction contract for frontend phases — updated to reflect actual implementation.
>
> **Phase scope:** WXT entrypoints, messaging, workspace store, theme, dual-surface shells with skeletons, command palette, onboarding on fresh install.
> **Requirements covered:** SHELL-03, SHELL-04, SHELL-05

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (shadcn explicitly excluded per PROJECT.md constraints) |
| Preset | not applicable |
| Component library | antd ^6.5.2 + @ant-design/x ^2.8.0 + @ant-design/x-markdown ^2.8.0 |
| Icon library | @ant-design/icons ^6.3.2 |
| CSS framework | Tailwind v4 (`@import "tailwindcss"`, config-free) |
| Font | System stack via `font-sans` Tailwind class |
| Animation | motion ^12.23.24 |
| State management | Zustand ^5 (ThemeStore, WorkspaceStore) |

**Theming strategy:** Custom CSS variable system via `resolveNowPilotTheme()` in `src/themes/`. Theme mode (light/dark/auto) and theme variant (liquid-glass / claude) stored in `ThemeStore` (separate from WorkspaceStore). At runtime, `AppThemeProvider` sets CSS variables `--np-*` on `document.documentElement` + applies antd `ConfigProvider` algorithm. Both surfaces sync via BroadcastChannel (`useThemeSync`).

**Two custom themes:**
- **Liquid Glass** (default): light `#f4f5f7` bg, dark `#090b0f` bg; blue accent (`--np-ring: #297cef`); radius 24px
- **Claude**: warm beige tones; `--np-primary: #c96442` (light) / `#d97757` (dark); radius 16px

**Seed tokens (antd ConfigProvider):** `colorPrimary: #1677ff`, `borderRadius: 6`, `controlHeight: 32` — overridden at runtime by `resolveNowPilotTheme` which applies theme-specific config.

---

## Spacing Scale

Tailwind v4 spacing scale (rem-based, 1 unit = 4px) + antd v6 tokens:

| Token | Value | Usage |
|-------|-------|-------|
| 1 | 4px | Icon gaps, inline padding, tight groupings |
| 2 | 8px | Compact element spacing, button groups |
| 3 | 12px | Intermediate spacing, form item gaps |
| 4 | 16px | Default element spacing, card padding |
| 5 | 20px | Section padding, panel inner spacing |
| 6 | 24px | Layout gaps, section margins |
| 8 | 32px | Major section breaks |
| 12 | 48px | Page-level spacing |

Additional layout constraints:
- Side Panel default width: ~400px (Chrome Side Panel constraint)
- Command palette width: 560px max, centered in viewport
- Standalone sidebar collapsed: 64px (w-16), expanded: 224px (w-56)

---

## Typography

| Role | Size | Weight | Class |
|------|------|--------|-------|
| Body | 14px | 400 | `text-sm` |
| Small label | 12px | 500 | `text-xs font-semibold` |
| Heading (shell) | 16px / 20px | 700 | `text-base font-bold` / `text-xl font-bold` |
| Display (welcome) | 30px / 24px | 700 | `text-3xl font-bold` / `text-2xl font-bold` |
| Tool name | 14px | 700 | `text-sm font-bold` |
| Feature card | 12px | 600 | `text-xs font-semibold` |

**Font family:** System stack via Tailwind `font-sans` (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`). No custom web fonts.

---

## Color (CSS Variable System)

All colors use CSS custom properties (`--np-*`) set by the active theme. Values differ by theme variant (Liquid Glass vs Claude) and display mode (light/dark). Accent colors are theme-dependent — not hardcoded to antd `colorPrimary`.

### Liquid Glass (default theme)

| Variable | Light | Dark | Usage |
|----------|-------|------|-------|
| `--np-bg` | `#f4f5f7` | `#090b0f` | Page background |
| `--np-fg` | `#0c121a` | `#f0f2f4` | Primary text color |
| `--np-card` | `#ffffff` | `#13161b` | Card, modal, elevated surface bg |
| `--np-card-fg` | `#0c121a` | `#f0f2f4` | Card text |
| `--np-muted` | `#eceff1` | `#181b1f` | Muted background (hover, input bg) |
| `--np-muted-fg` | `#565e69` | `#8f9aa4` | Muted text (secondary, placeholder) |
| `--np-accent` | `#d9e6f9` | `#152946` | Accent bg (user message bubble) |
| `--np-accent-fg` | `#002c78` | `#a5d0ff` | Accent text (user message text) |
| `--np-border` | `#dbdee2` | `#26292e` | Borders, dividers |
| `--np-input` | `#e2e5e8` | `#26292e` | Input field background |
| `--np-ring` | `#297cef` | `#3a8cff` | Focus rings, links, primary interactive |
| `--np-sidebar` | `#eceff1` | `#0f1216` | Sidebar background |
| `--np-sidebar-fg` | `#0c121a` | `#f0f2f4` | Sidebar text |
| `--np-radius` | `24px` | `24px` | Border radius for cards |
| `--np-shadow` | `rgba(78,86,97,0.10)` | `rgba(0,0,0,0.45)` | Shadow color |

### Claude theme

| Variable | Light | Dark |
|----------|-------|------|
| `--np-bg` | `#faf9f5` | `#262624` |
| `--np-fg` | `#3d3929` | `#f1f1ef` |
| `--np-card` | `#f5f4ef` | `#2c2c2b` |
| `--np-primary` | `#c96442` | `#d97757` |
| `--np-muted` | `#ede9de` | `#1b1b19` |
| `--np-muted-fg` | `#6e6d68` | `#b7b5a9` |
| `--np-accent` | `#c96442` | `#d97757` |
| `--np-accent-fg` | `#ffffff` | `#141413` |
| `--np-border` | `#dad9d4` | `#3e3e38` |
| `--np-input` | `#b4b2a7` | `#52514a` |
| `--np-ring` | `#c96442` | `#d97757` |
| `--np-sidebar` | `#f5f4ee` | `#1f1e1d` |
| `--np-sidebar-fg` | `#3d3d3a` | `#c3c0b6` |
| `--np-radius` | `16px` | `16px` |

**Auto mode:** Uses `window.matchMedia('(prefers-color-scheme: dark)')` — switches between light/dark CSS variable sets. `AppThemeProvider` listens for OS preference changes.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Side Panel welcome heading | "Hi," |
| Side Panel welcome subheading | "How can I assist you today?" |
| Quick action — full screen | "Full Screen Chat" |
| Quick action — research | "Deep Research" |
| Quick action — highlights | "My Highlights" |
| Quick action — slides | "AI Slides" |
| Help & Tour tooltip | "Help & Tour" |
| Settings tooltip | "Settings" |
| Open full app tooltip | "Full page workspace" |
| Chat input placeholder | "Ask anything, @ models, / prompts" |
| Command palette placeholder | "Search commands…" |
| Command palette — empty results | "No matching commands — try a different search term" |
| Theme toggle icon button | (no label) |
| Theme tooltip — light → dark | "Switch to dark mode" |
| Theme tooltip — dark → auto | "Switch to system theme" |
| Theme tooltip — auto → light | "Switch to light mode" |
| Loading state | "Loading workspace…" |
| Model/quick chip — YouTube | "For YouTube" |
| Model/quick chip — summarize | "Summarize" |
| Model/quick chip — explain | "Explain" |
| Onboarding — welcome heading | "Welcome to NowPilot" |
| Onboarding — welcome body | "Your unified ServiceNow sidekick. Stream AI replies, search the codebase, analyze cases — all from the side panel." |
| Onboarding — step 2 heading | "Choose your AI provider" |
| Onboarding — step 3 heading | "Paste your {provider} API key" |
| Onboarding — step 3 body | "Stored locally with encryption. You can rotate it any time in Settings." |
| Onboarding — connected | "Connected to {provider}" |
| Onboarding — models | "Select Models" |
| Onboarding — MCP tools | "Configure MCP Tools & Skills" |
| Onboarding — SN permissions | "Grant ServiceNow permissions" |
| Onboarding — done heading | "You're all set" |
| Onboarding — done body | 'NowPilot is ready. Open the side panel and try asking "What\'s the latest EMEA incident?" to get started.' |
| Onboarding — final CTA | "Open side panel →" |
| Onboarding — skip | "Skip for now" |
| Onboarding — rerun | "Re-run setup later" |
| Export format | "Export as TXT" / "Export as JSON" |
| Sidebar tooltip — collapsed nav | nav item name (e.g. "Chat", "Note", "Write", "Tools") |
| Sidebar — expand | "Expand" |
| Sidebar — collapse | "Collapse" |
| Switch to sidebar | "Switch to sidebar" |

---

## Visual Hierarchy

### Side Panel (~400px) — Chat-first layout

- **Focal point:** Welcome message or chat history. The chat messages area dominates the viewport. Below it, the composer bar with input field + send button anchors the interaction.
- **Hierarchy (top-to-bottom):**
  1. Header bar (56px) — left: NowPilotAvatar (28px) + "NowPilot" bold text; right: 3 icon buttons (Help & Tour, Settings, Full page workspace)
  2. Chat messages area — flex-1, scrollable. Welcome view (when no messages) shows heading + quick action pills in 2×2 grid. Message history shows user/AI bubbles with thought process, code blocks, follow-ups
  3. Composer bar — top toolbar (model selector, screenshot, attachments, chat history, new chat), textarea with quick chip buttons, floating send button
  4. Footer — provider name + help center + feedback links
- **Scan pattern:** Top header scanned quickly left-to-right → main content area scanned top-down → composer at bottom anchors action.

### Full App Tab (full viewport) — Sidebar + content

- **Focal point:** Content area to the right. The sidebar anchors navigation on the left; the content area dominates visual weight.
- **Hierarchy (left-to-right):**
  1. Sidebar (collapsed: 64px, expanded: 224px) — `rounded-[20px]`, transparent bg, 4 nav items with custom SVG icons. Active state: violet bg+text (`bg-violet-100/80` light, `dark:bg-violet-950/60` dark). Top brand area with avatar + name + "Switch to sidebar" button.
  2. Content area — `flex-1`, `rounded-[20px]`, `--np-card` background, border. Full height.
  3. Sidebar bottom — avatar with red dot + settings gear + collapse/expand chevron
- **Scan pattern:** Sidebar scan (brand → nav items → user avatar) → content area scanned top-down.

### Command Palette (Modal overlay)

- **Focal point:** Search input (auto-focused on open) → first result.
- **Hierarchy (top-to-bottom):**
  1. Backdrop overlay (antd Modal default) — reduces background distraction
  2. Modal container (560px, centered, `destroyOnHidden`)
  3. Search input — `size="large"`, auto-focused, placeholder "Search commands…"
  4. Results list — `List.Item` per result, selected item highlighted with `var(--color-primary-bg)`, command name bold, description secondary, category on right
  5. Empty state: "No matching commands — try a different search term" (centered, secondary text)

### Onboarding Wizard (Modal overlay)

- **Focal point:** Current step content — step indicator circles at top, content card in center, navigation buttons at bottom.
- **Modal:** Full-width, `maxWidth: 380px`, centered, no close button, `destroyOnHidden`
- **Step indicator:** 8 numbered circles. Completed: primary bg + checkmark. Active: dark bg + primary border. Future: gray bg.
- **Layout (top-to-bottom):**
  1. Step indicator row — circles 1-8, centered
  2. Content card (animated `motion.div` with fade+slide) — icon, heading, body copy, interactive elements (provider cards, input fields, switches)
  3. Navigation row — Back (text, left), primary CTA (right), Skip link (when applicable)
- **Animation:** motion fade (opacity 0→1) + slide (x: 8px → 0) on step change, 180ms duration

---

## UI Considerations

Applicable state considerations resolved: 8 covered, 0 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution |
|----------|------------|--------|------------|
| empty | Chat messages | ✅ covered | Welcome view shows "Hi, How can I assist you today?" + 4 quick action pills. Chat history is empty until first message. |
| empty | Command palette (results) | ✅ covered | "No matching commands — try a different search term" after filtering. |
| empty | Onboarding (fresh install) | ✅ covered | SidepanelChat reads `chrome.storage.local.get('onboardingComplete')` — null/false shows OnboardingWizard modal. |
| loading | Both surfaces (hydration) | ✅ covered | Side panel shows "Loading workspace…" text centered. Standalone shows antd `Skeleton active` + "Loading workspace…". |
| populated | Side Panel (after onboarding) | ✅ covered | Header with avatar/title/icon buttons, chat messages area with welcome view or history, composer bar, footer. |
| populated | Standalone workspace | ✅ covered | Collapsible sidebar with 4 nav items, content area with chat/note/write/tools pages. |
| overflow | Command palette | ✅ covered | Results list scrollable. Long names truncated via CSS. Modal capped at 560px wide. |
| zero-one-many | Command palette | ✅ covered | 0 results → empty state. 1 result → auto-selected, Enter executes. Many → scrollable list with keyboard nav. |
| long-text | Onboarding provider URL | ✅ covered | Provider URLs shown in `font-mono text-xs truncate` — single line with ellipsis. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable |

No shadcn/ui, no third-party registries. All components sourced from antd / @ant-design/icons / motion.

---

## Component Inventory

Phase 1 uses these antd and custom components:

| Component | Usage |
|-----------|-------|
| `ConfigProvider` | Root theme provider wrapping both entrypoints — applies antd theme config from `resolveNowPilotTheme` |
| `Skeleton` | Standalone loading state — `Skeleton active paragraph={{ rows: 3 }}` during store hydration |
| `Modal` | Command palette (560px, centered, `destroyOnHidden`), OnboardingWizard (full-width, max 380px, no close), ChatHistoryModal, PromptManagerModal, Tool Runner (540px) |
| `Input` | Command palette search (`size="large"`, autoFocus), API key entry (password type with eye toggle), custom endpoint proxy URL, model search |
| `Input.TextArea` | Write workspace editor (12 rows, monospace), Tool Runner prompt input (3 rows) |
| `Tooltip` | Sidebar nav items (collapsed state), theme toggle tooltip, settings/help/full page buttons, disabled tabs, model/config buttons |
| `Typography.Title` | Welcome view headings, page section titles, tool/modal headings |
| `Typography.Text` | Labels, descriptions, category tags, command palette item descriptions |
| `Button` | Onboarding CTAs ("Get started", "Continue", "Open side panel"), navigation (Back/Skip), test connection, tool run |
| `Switch` | Onboarding model selection, MCP tool toggles, ServiceNow permission toggles, custom endpoint toggle |
| `List` | Command palette results list (antd List.Item with List.Item.Meta) |
| `Segmented` | Web preview view switcher (workspace / sidepanel / options) |
| `Dropdown` | Export format selector (TXT/JSON) |
| `Tag` | Tool cards "NEW" badge (purple) |
| `App` | Antd App wrapper for message/toast context |
| `message` | Toast notifications for export, tool run, settings |
| Custom `ThemeToggle` | Plain `<button>` element (not antd Button). Icons: `SunOutlined` / `MoonOutlined` / `MonitorOutlined`. Same style as header icon buttons: `p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg`. |
| Custom `CommandPalette` | React.FC wrapping antd Modal + Input + List with internal search state and keyboard navigation. No external dependencies. |
| Custom `OnboardingWizard` | 8-step wizard with antd Modal + custom step indicator (8 numbered circles) + motion animations. |
| Custom `SidePanelShell` / `AppShell` | Shell wrappers that own command registration, Cmd+K keydown listeners, theme sync. |
| Custom `StandaloneWorkspace` | Full app shell with custom sidebar (not antd Layout.Sider), content page routing, tools grid, tool runner modal. |
| Custom `SidepanelChat` | Main chat UI with header, message list, composer bar, modals, onboarding integration. |

---

## Interaction Patterns

### Theme Toggle
- **Trigger:** `ThemeToggle` icon button in web preview header (not in Side Panel or Standalone headers — in those surfaces, theme is toggled via Cmd+K palette).
- **Behavior:** Cycles through light → dark → auto → light. Shows Tooltip with next-mode hint ("Switch to dark mode" / "Switch to light mode" / "Switch to system theme"). Hover bg: `hover:bg-zinc-100` light / `dark:hover:bg-zinc-800`.
- **Cross-surface sync:** Both entrypoints call `useThemeSync()` which subscribes to BroadcastChannel `np_theme`. `ThemeStore.setMode` publishes `{ type: 'THEME_CHANGED', mode }` on change. Both surfaces react immediately.
- **Auto mode:** `AppThemeProvider` listens to `window.matchMedia('(prefers-color-scheme: dark)')` via `change` event listener.
- **Persisted:** Mode saved to `chrome.storage.local` key `np_theme_store` via Zustand persist middleware.

### Command Palette (Cmd+K)
- **Trigger:** `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux) on both surfaces. Keydown listener added in `useEffect` — checks `e.metaKey || e.ctrlKey` with `e.key === 'k'`, calls `e.preventDefault()`.
- **Guard:** In Side Panel, only fires when `onboardingComplete === true`. In Standalone, only fires after theme store hydration.
- **Display:** antd `Modal` (560px, centered, `destroyOnHidden`). Auto-focused `Input` with "Search commands…" placeholder. Results shown in `List` with `List.Item.Meta`.
- **Filtering:** Case-insensitive `String.prototype.includes()` on command name + description. Resets to first result on each keystroke.
- **Keyboard navigation:** ArrowDown (select next, bounds-clamped), ArrowUp (select previous, min 0), Enter (execute + close), Escape (close via Modal.onCancel). Mouse hover also updates selection. Click executes + closes.
- **Commands Side Panel:** 3 — "Toggle Theme" (Appearance), "Open in Full Tab" (Navigation), "Reload Extension" (System).
- **Commands Standalone:** 2 — "Toggle Theme" (Appearance), "Reload Extension" (System). No "Open in Full Tab" (already in full app).

### Onboarding Flow (8-step)
- **Trigger:** First-time install — `background.ts` sets `chrome.storage.local.set({ onboardingComplete: false })` on `chrome.runtime.onInstalled` with `reason === "install"`.
- **Display:** Full-width modal (`maxWidth: 380px`, centered, no close button, `destroyOnHidden`). 8 numbered step indicator at top.
- **Steps:**
  1. Welcome — `ThunderboltOutlined` icon + "Welcome to NowPilot" + ServiceNow description + 2 feature cards (MCP tools, SN tools). "Get started →" primary / "Skip for now" text link.
  2. Choose AI Provider — 4 provider cards (OpenAI, Anthropic, Google Gemini, Ollama) with endpoint URLs. Selected state: primary border + shadow. Back / Skip (→ step 6) / Continue.
  3. API Key — Password input with eye toggle + "Enable Custom Endpoint" switch + conditional proxy URL input. "Test connection" button (calls `fetchProviderModels`). Continue disabled until tested.
  4. Connected — Green checkmark + "Connected to {provider}" + auto-advance timer (10s) + "Click here to advance immediately →" link.
  5. Select Models — Model list fetched from provider (name + context window text + enable switch each). "Select all" / refresh. Back / "Continue ({count}) →". Saves config to `useExtensionStore`.
  6. Configure MCP Tools — 3 toggles: Workspace Filesystem, Diagnostics Engine, Broadcast Message Bus. Back / Continue.
  7. ServiceNow Permissions — 3 toggles: `support.servicenow.com`, `codesearch.devsnc.com`, `hcpdemo.service-now.com`. Yellow privacy warning box. Back / Continue.
  8. All Set — Green checkmark + "You're all set" + example query + "Open side panel →" primary / "Re-run setup later" text link.
- **Navigation:** Back text button (steps 2-7). Skip text button (step 2 → step 6). Continue primary button. Final "Open side panel →" CTA calls `onComplete` which sets `onboardingComplete: true` in chrome.storage.local + localStorage.
- **Skip:** "Skip for now" on step 1, "Re-run setup later" on step 8 — both call `onComplete` immediately.

### Dual-Surface Handoff
- **Trigger:** `CodeOutlined` icon button (tooltip "Full page workspace") in Side Panel header, or Cmd+K "Open in Full Tab" command.
- **Behavior:** Calls `WorkspaceRouter.openFullApp(workspaceId, conversationId?)` which serializes state to URL params (`?workspaceId=...&conversationId=...`), opens `standalone.html` via `chrome.tabs.create`, and publishes `FULL_APP_OPEN` on BroadcastChannel `np_workspace`.
- **Deduplication:** `chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html') })` — if tab exists, `chrome.tabs.update(id, { active: true })` focuses it instead of creating new. New tab's ID tracked via `WorkspaceStore.setOpenedFullAppTabId()`.
- **Hydration:** Standalone `AppShell` calls `hydrateFromURL(new URLSearchParams(window.location.search))` on mount — restores `workspaceId` and `conversationId` from URL params.

### Shell (Post-Onboarding)
- **Side Panel (~400px):** `SidePanelShell` renders `<SidepanelChat>`. Header: avatar + "NowPilot" + 3 icon buttons (Help & Tour, Settings, Full page workspace). Main content: chat messages or welcome view. Composer: toolbar + textarea + send button. Footer: provider + help + feedback.
- **Full App Tab (full viewport):** `AppShell` renders `<StandaloneWorkspace>` with hydration guard. Custom collapsible sidebar (64px / 224px) with 4 nav items (Chat, Note, Write, Tools) using custom SVG icons. Content area renders page based on active nav. Sidebar bottom: avatar + settings + collapse toggle.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — verified against actual OnboardingWizard, SidepanelChat, StandaloneWorkspace copy
- [x] Dimension 2 Visuals: PASS — matches actual CSS variable theme system, Tailwind styling, layout structure
- [x] Dimension 3 Color: PASS — `--np-*` CSS variable system documented for both themes
- [x] Dimension 4 Typography: PASS — Tailwind text classes mapped to roles
- [x] Dimension 5 Spacing: PASS — Tailwind spacing scale + antd tokens
- [x] Dimension 6 Registry Safety: PASS — zero external component registries

**Approval:** verified — updated 2026-07-29 to reflect actual implementation
