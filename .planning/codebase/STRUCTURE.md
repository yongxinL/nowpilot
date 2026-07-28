# Codebase Structure

**Analysis Date:** 2026-07-28

## Directory Layout

```
nowpilot/
├── entrypoints/              # WXT framework entry points
│   ├── background.ts         # Service worker (sidepanel behavior, runtime messaging)
│   ├── content.ts            # Content script injected into all pages
│   ├── sidepanel/            # Chrome Side Panel UI
│   │   ├── index.html
│   │   └── main.tsx
│   ├── options/              # Options / Settings page
│   │   ├── index.html
│   │   └── main.tsx
│   └── standalone/           # Standalone full-page workspace
│       ├── index.html
│       └── main.tsx
│
├── src/                      # Shared source code (imported by entrypoints)
│   ├── main.tsx              # Root mount for the universal App shell (dev preview)
│   ├── App.tsx               # Universal shell with view switching (sidepanel/standalone/options)
│   ├── index.css             # Global styles — Tailwind + Ant Design popover overrides
│   ├── vite-env.d.ts         # Vite environment type declarations
│   │
│   ├── types/                # Shared TypeScript type definitions
│   │   └── index.ts          # ProviderConfig, Message, ChatSession, Attachment, PromptItem, TabItem, ToolItem, etc.
│   │
│   ├── store/                # State management
│   │   └── useExtensionStore.ts  # Custom hook — app state + localStorage persistence
│   │
│   ├── services/             # External integrations
│   │   └── aiProvider.ts     # SSE streaming chat client, model listing
│   │
│   ├── styles/               # Theming
│   │   └── theme.ts          # getAppTheme() — Ant Design light/dark theme config
│   │
│   ├── assets/               # Static assets
│   │   └── avatar.png        # NowPilot avatar image
│   │
│   └── components/           # React UI components
│       ├── chat/             # Chat-related components
│       │   ├── SidepanelChat.tsx       # Main chat interface (messages, input, controls)
│       │   ├── ThoughtProcessBlock.tsx # Collapsible AI reasoning block
│       │   ├── AttachmentBar.tsx       # Renders active attachments in composer
│       │   ├── PinnedTabsBar.tsx       # Shows selected browser tabs
│       │   ├── TabContextSelector.tsx  # Popover for attaching tabs/files/images
│       │   ├── SlashCommandModal.tsx   # / command prompt picker
│       │   └── FollowupSuggestions.tsx # Suggested follow-up prompts
│       │
│       ├── common/            # Shared / reusable components
│       │   ├── ModelSelector.tsx       # AI model dropdown
│       │   ├── ActionPanel.tsx         # Message actions (copy, quote, TTS, regenerate)
│       │   ├── PromptManagerModal.tsx  # CRUD prompt templates
│       │   └── NowPilotAvatar.tsx      # Avatar image component
│       │
│       ├── history/           # Session history management
│       │   └── ChatHistoryModal.tsx    # Drawer for session list, search, star, export
│       │
│       ├── notes/             # Knowledge base / note-taking
│       │   └── NotesWorkspace.tsx      # Full notes editor with 3-panel layout
│       │
│       ├── options/           # Extension settings
│       │   └── OptionsPage.tsx         # Provider config, appearance, translate, prompts
│       │
│       └── standalone/        # Full-page workspace
│           └── StandaloneWorkspace.tsx # Nav sidebar + tool panels + chat/notes/write views
│
├── server.ts                  # Express.js backend — AI chat SSE endpoint, Vite/static serving
├── wxt.config.ts              # WXT configuration (manifest, permissions)
├── vite.config.ts             # Vite configuration (React, Tailwind, path aliases, HMR)
├── tsconfig.json              # TypeScript config (ES2022, React JSX, @ path alias)
├── package.json               # Dependencies and scripts
├── index.html                 # Dev-only entry (Vite root)
└── references/                # Design docs, mockups, specs
```

## Directory Purposes

**`entrypoints/`:**
- Purpose: WXT-idiomatic entry points for each browser extension surface
- Contains: One directory per HTML-based entry point (sidepanel, options, standalone), plus flat script files for background and content scripts
- Key files: `background.ts`, `content.ts`, `sidepanel/main.tsx`, `options/main.tsx`, `standalone/main.tsx`
- Convention: Each HTML entry point has a `main.tsx` that creates a React root and renders the appropriate component from `src/components/`

**`src/types/`:**
- Purpose: Centralized TypeScript type and interface definitions shared across the entire codebase
- Contains: `index.ts` with all domain types
- No nested subdirectories — single file for simplicity
- Key types: `ProviderConfig` (API keys, provider settings, appearance), `Message` (chat messages with versioning), `ChatSession`, `Attachment` (multimodal context), `PromptItem`, `TabItem`, `ToolItem`

**`src/store/`:**
- Purpose: Application state management using React hooks
- Contains: Single file `useExtensionStore.ts` — a custom React hook that manages all state
- Persistence: State is persisted to `localStorage` under keys `nowpilot_config`, `nowpilot_sessions`, `nowpilot_prompts`
- No external state management library — uses raw `useState` + `useEffect`

**`src/services/`:**
- Purpose: External API integration layer
- Contains: `aiProvider.ts` — SSE streaming fetch client (`streamChatResponse`), model registry (`AVAILABLE_MODELS`)
- All provider routing logic lives in `server.ts`, not in this client

**`src/components/`:**
- Purpose: All React UI components organized by domain
- Contains: 6 subdirectories (`chat/`, `common/`, `history/`, `notes/`, `options/`, `standalone/`)
- `chat/`: Components related to the chat conversation experience
- `common/`: Shared reusable components used across multiple views
- `history/`: Chat session history management
- `notes/`: Knowledge base / note-taking workspace
- `options/`: Extension configuration UI
- `standalone/`: Full-page workspace layout
- Convention: One component per file, PascalCase filename matching component name

**`entrypoints/sidepanel/`:**
- Purpose: Chrome Side Panel UI surface — opens when user clicks extension icon
- Contains: `index.html` and `main.tsx` that renders `SidepanelChat`

**`entrypoints/options/`:**
- Purpose: Chrome Extension Options page — accessed from extension management
- Contains: `index.html` and `main.tsx` that renders `OptionsPage`

**`entrypoints/standalone/`:**
- Purpose: Full-page standalone mode — opened as a separate browser tab
- Contains: `index.html` and `main.tsx` that renders `StandaloneWorkspace`

**`references/`:**
- Purpose: Design documents, mockups, specifications, and product specs
- Contains: `.md` spec files, `.png` mockups, `.zip` asset archives
- Not directly imported by source code — historical reference

## Key File Locations

**Entry Points:**
- `entrypoints/background.ts` — Chrome extension service worker
- `entrypoints/content.ts` — Page-level content script
- `entrypoints/sidepanel/main.tsx` — Side panel UI entry
- `entrypoints/options/main.tsx` — Options page entry
- `entrypoints/standalone/main.tsx` — Standalone workspace entry
- `src/main.tsx` — Universal dev preview entry (App shell with view switching)
- `server.ts` — Express.js API server entry

**Configuration:**
- `wxt.config.ts` — WXT extension manifest (permissions, sidepanel, options page)
- `vite.config.ts` — Vite bundler config (React plugin, Tailwind plugin, path alias, HMR settings)
- `tsconfig.json` — TypeScript compiler options (ES2022, JSX, `@/` path alias)
- `package.json` — Scripts (`dev`, `build`, `start`, `lint`) and dependency declarations

**Core Logic:**
- `src/store/useExtensionStore.ts` — All application state management
- `src/services/aiProvider.ts` — AI chat SSE client
- `src/types/index.ts` — All shared type definitions
- `src/styles/theme.ts` — Ant Design theming
- `src/components/chat/SidepanelChat.tsx` — Main chat logic and UI
- `src/components/options/OptionsPage.tsx` — Provider configuration logic

**Testing:**
- No test files detected. No test framework configuration found (no `jest.config.*`, `vitest.config.*`, or test directory).

## Naming Conventions

**Files:**
- PascalCase for React component files: `SidepanelChat.tsx`, `ModelSelector.tsx`, `ThoughtProcessBlock.tsx`
- camelCase for non-component modules: `aiProvider.ts`, `useExtensionStore.ts`, `theme.ts`
- kebab-case for HTML and config: `vite.config.ts`, `wxt.config.ts`, `index.html`
- No test files; no `.test.ts` or `.spec.ts` convention established

**Directories:**
- lowercase for directory names: `entrypoints/`, `components/`, `services/`, `store/`, `types/`, `styles/`
- Single-word, descriptive names: `chat/`, `common/`, `history/`, `notes/`, `options/`, `standalone/`

**Functions/Methods:**
- camelCase for all functions: `streamChatResponse`, `getAppTheme`, `handleSend`, `handleStopGenerating`
- PascalCase for component functions: `SidepanelChat`, `ModelSelector`, `ThoughtProcessBlock`

**Variables:**
- camelCase for all variables: `inputPrompt`, `activeSessionId`, `abortControllerRef`
- Boolean `is*` prefix: `isGenerating`, `isResizing`, `isEditing`, `isDarkMode`
- Ref suffix `Ref`: `scrollRef`, `abortControllerRef`, `fileInputRef`

**Types/Interfaces:**
- PascalCase for types and interfaces: `ProviderConfig`, `Message`, `ChatSession`, `Attachment`
- Props interfaces use component name + `Props` suffix: `SidepanelChatProps`, `ModelSelectorProps`

**CSS Classes:**
- Tailwind utility classes used inline in JSX via `className` prop
- No CSS Modules, CSS-in-JS, or BEM conventions
- Custom CSS classes only in `src/index.css` for scrollbar and popover overrides

## Where to Add New Code

**New Feature (Component):**
- Primary code: `src/components/{domain}/{FeatureName}.tsx`
- Create a file with the same name as the component (PascalCase)
- If a new domain, create a new subdirectory under `src/components/`

**New Entry Point:**
- Create `entrypoints/{name}/main.tsx` and `entrypoints/{name}/index.html`
- Register in `wxt.config.ts` if needed (WXT auto-discovers most entry points)

**New Type:**
- Add to `src/types/index.ts` — the single types file
- If types grow large, split into `src/types/{domain}.ts` and re-export

**New Service:**
- Add file to `src/services/{serviceName}.ts`
- Import types from `src/types/`

**New Store / State:**
- Add to `src/store/useExtensionStore.ts` if part of existing state
- Create `src/store/{hookName}.ts` for separate state domains

**New Styles:**
- Add to `src/styles/theme.ts` for Ant Design token overrides
- Use Tailwind classes directly in JSX for component-specific styles
- Add global CSS to `src/index.css` sparingly

**API Routes:**
- Add to `server.ts` — the single server file
- If server grows, split into `src/server/routes/`

**Tests:**
- Not currently established. Recommended: co-locate `{Component}.test.tsx` alongside component files, or create `__tests__/` directory at each level.

## Special Directories

**`dist/`:**
- Purpose: Build output (compiled Vite SPA + bundled server CJS)
- Generated: Yes (via `npm run build`)
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (via `npm install`)
- Committed: No (gitignored)

**`.wxt/`:**
- Purpose: WXT framework generated files (type stubs, tsconfig overrides)
- Generated: Yes (by WXT dev server)
- Committed: No (gitignored if properly configured)

**`.planning/`:**
- Purpose: Project planning artifacts (roadmaps, specs, codebase analysis documents)
- Generated: Yes (by GSD workflow)
- Committed: Yes (tracked in git for agent context continuity)

**`references/`:**
- Purpose: Design mockups, product specs, and reference documents
- Generated: No (hand-authored design assets)
- Committed: Yes

**`assets/`:**
- Purpose: Extension-level static assets (non-code)
- Contains: `.aistudio/` directory with `.gitignore`
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-07-28*
