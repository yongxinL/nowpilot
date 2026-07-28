# Coding Conventions

**Analysis Date:** 2026-07-28

## Language & Framework Conventions

- **TypeScript 5.8** with `ESNext` module resolution and bundler-mode — all source files are `.ts` or `.tsx`
- **React 19** with automatic JSX runtime (`"jsx": "react-jsx"`) — no manual `import React` needed for JSX, though many files still include it
- **Ant Design 6.x** (`antd`) is the UI component library — theme configured via `src/styles/theme.ts`
- **Tailwind CSS v4** using `@import "tailwindcss"` directive in `src/index.css` — utility classes used extensively for layout and styling
- **WXT v0.20** Chrome extension framework — entry points in `entrypoints/` (background, content, sidepanel, options, standalone)
- **Vite 6** as bundler for frontend, **esbuild** server bundle in `server.ts`
- **Type checking** is the only lint pass (`tsc --noEmit`) — no ESLint, Prettier, or Biome configuration detected

## Naming Patterns

- **Files** — PascalCase for React components (`SidepanelChat.tsx`, `AttachmentBar.tsx`, `NowPilotAvatar.tsx`); camelCase for modules and utilities (`useExtensionStore.ts`, `aiProvider.ts`, `theme.ts`)
- **React Components** — declared as `export const ComponentName: React.FC<Props> = ({ ... }) => { ... }` using named exports
- **Props interfaces** — `ComponentName + Props` suffix, defined directly above the component in the same file (e.g., `AttachmentBarProps`, `ThoughtProcessBlockProps`, `TabContextSelectorProps`)
- **Functions** — camelCase, descriptive names like `handleSend`, `handleStopGenerating`, `handleCopy`, `toggleStarSession`, `renderFormattedLines`
- **Constants** — `UPPER_SNAKE_CASE` for module-level constants (`DEFAULT_CONFIG`, `INITIAL_SESSIONS`, `INITIAL_PROMPTS`, `TOOLS_LIST`, `AVAILABLE_MODELS`, `PROVIDER_INFO`, `LANGUAGES`, `INITIAL_NOTES`)
- **Types/Interfaces** — PascalCase, exported from `src/types/index.ts` (e.g., `ProviderConfig`, `ChatSession`, `Message`, `Attachment`, `PromptItem`, `TabItem`, `ToolItem`, `CustomProviderId`, `ProviderType`, `HistoryGroup`)
- **Custom hooks** — `use` prefix (`useExtensionStore`)
- **CSS classes** — Tailwind utility classes applied inline, no module CSS or styled-components

## Code Organization

**File layout pattern for components:**

```typescript
import React, { useState, useRef, useEffect } from 'react';          // React + hooks
import { /* antd named imports */ } from 'antd';                      // antd UI
import { /* icon imports */ } from '@ant-design/icons';               // Icons
import { /* sibling/child components */ } from '../path/Component';   // Internal components
import { /* types/interfaces */ } from '../../types';                 // Types
```

**Module structure:**
- Types: `src/types/index.ts` — all `interface` and `type` definitions in a single file
- Store: `src/store/useExtensionStore.ts` — single custom hook managing all app state via `useState` + `useEffect` for `localStorage` persistence
- Services: `src/services/aiProvider.ts` — `streamChatResponse` async function and `AVAILABLE_MODELS` constant
- Theme: `src/styles/theme.ts` — `getAppTheme()` function returning an Ant Design `ThemeConfig`
- Components: `src/components/<feature>/` — grouped by feature area (chat, common, history, notes, options, standalone)
- Entry points: `entrypoints/<view>/main.tsx` — thin entry files that render the root component

**Import ordering within files:**
1. React (and hooks)
2. Third-party (antd, @ant-design/icons, motion, etc.)
3. Internal components (relative paths, e.g., `../../store/useExtensionStore`)
4. Types (relative path to `../../types`)
5. CSS (last, e.g., `'../../index.css'`)

## Error Handling

- **User-facing errors**: Use `antMessage` from `App.useApp()` — call `antMessage.success()`, `antMessage.error()`, `antMessage.info()`, `antMessage.warning()`, `antMessage.loading()` for all user feedback
- **API/streaming errors**: The `StreamChatParams` interface in `src/services/aiProvider.ts` defines `onError: (err: Error) => void` callback pattern
- **Console logging**: `console.error('AI Stream Error:', err)` for debugging, no structured logging framework
- **Silent catches**: Empty `catch {}` blocks used for validation errors (e.g., `PromptManagerModal.tsx` lines 51-53, `OptionsPage.tsx` lines 324-326)
- **Abort handling**: `src/services/aiProvider.ts` (lines 93-95) — `AbortError` is silently returned without calling `onError`
- **Error type casting**: `err instanceof Error ? err : new Error(String(err))` pattern in `src/services/aiProvider.ts` line 97
- **TypeScript `any`**: Several places use `any` type for catch variables (`err: any`), message sender types, and generic state setters (`setActiveView(val as any)`, `setActiveMenu(item.key as any)`)

## TypeScript Patterns

- **Path aliases**: `@/*` maps to `./*` in `tsconfig.json` — though not observed in current imports (all relative)
- **`interface` over `type`**: Interfaces are used for all data shapes; `type` is used for union types (`ProviderType`, `HistoryGroup`, `PromptCategory`, `ToolCategory`)
- **Optional properties**: Used extensively with `?:` syntax (e.g., `description?: string`, `thumbnail?: string`, `isStarred?: boolean`)
- **Component return types**: Implicit return types from JSX, no explicit `JSX.Element` annotations
- **Generic `React.FC<Props>`**: All functional components typed with `React.FC<Props>` pattern
- **Default parameter values**: Components use default destructured parameter values: `isStandalone = false`, `type = 'ai'`, `isLatest = false`, `isThinking = false`, `className = ''`

## State Management

- **Local component state**: `useState` for UI state (modals open/closed, editing states)
- **App-level state**: Custom `useExtensionStore()` hook in `src/store/useExtensionStore.ts` — encapsulates all global state with `localStorage` persistence via `useEffect`
- **State updates**: Functional `setState(prev => ...)` pattern used consistently to avoid stale closures
- **Refs**: `useRef` for DOM references (scroll container, file inputs, AbortController)
- **No external state library**: No Redux, Zustand, or other state manager — all state is React `useState` within the custom hook

## Comments and Documentation

- **Minimal JSDoc/TSDoc**: No formal documentation comments on functions or components
- **Inline comments**: Used sparingly for section markers (e.g., `// Extension Preview Top Bar`, `// View Mode Segmented Switcher`, `// Chat Messages Area`, `// Bottom Composer Bar`)
- **No generated documentation tooling**: No typedoc or similar

## Async Patterns

- **Async/await**: Used for all async operations (`streamChatResponse`, `handleSave`, `handleSavePrompt`)
- **Promises**: `.then()` not observed; all async code uses `async/await`
- **AbortController**: Used for canceling streaming responses (`AbortController` + `signal` pattern in `SidepanelChat.tsx`)
- **Event streams**: SSE parsing in `streamChatResponse` with `ReadableStream.getReader()` — manual buffer splitting on `\n`

---

*Convention analysis: 2026-07-28*
