# Testing

**Analysis Date:** 2026-07-28

## Test Framework

**No test framework is configured.** The project has zero test files, zero test dependencies in `package.json`, and no test configuration files (no `jest.config.*`, `vitest.config.*`, `.mocharc*`, or similar).

## Test Structure

**Not applicable.** No tests exist in the codebase. The project directory was searched for:
- `**/*.test.*` — no matches
- `**/*.spec.*` — no matches
- `**/__tests__/**` — no directory found

## Test Commands

No test scripts are defined in `package.json`. The available scripts are:
```bash
npm run dev          # tsx server.ts (development server)
npm run build        # vite build + esbuild (production build)
npm run start        # node dist/server.cjs (production start)
npm run clean        # rm -rf dist server.js
npm run lint         # tsc --noEmit (type-check only)
npm run dev          # TypeScript type-check pass
```

There is no `npm test`, `npm run test`, `npm run coverage`, or `npm run test:watch` script.

## Mocking

**Not applicable.** No test mocking setup exists.

## Coverage

**No coverage tooling or requirements detected.**

## Component Architecture (Testability Profile)

While no tests exist, the codebase follows patterns that affect testability:

**Easily testable patterns:**
- Components are pure function components with typed props (`React.FC<Props>`) — standard for React Testing Library
- Service layer (`src/services/aiProvider.ts`) exports pure functions (`streamChatResponse`)
- State logic is extracted into a custom hook (`useExtensionStore`) — could be tested independently
- Types are centralized in `src/types/index.ts`

**Challenges for adding tests:**
- **No dependency injection**: `useExtensionStore()` is called directly inside components rather than injected — makes unit testing components harder without mocking the hook
- **Ant Design `App.useApp()`**: Components use `App.useApp()` for `message` API — requires wrapping in `App` provider for tests
- **LocalStorage coupling**: `useExtensionStore` reads/writes `localStorage` directly — tests would need localStorage mocking
- **Browser APIs**: Components use `window.getSelection()`, `navigator.clipboard`, `SpeechSynthesis`, `FileReader` — require browser environment mocking
- **Inline SVG icons**: Components embed raw SVG markup (e.g., `OptionsPage.tsx` lines 31-55) — not extracted to separate files
- **`chrome` API**: Background and content scripts (`entrypoints/background.ts`, `entrypoints/content.ts`) use `chrome.*` APIs — require extension API mocking
- **`any` type usage**: Several `as any` type casts (e.g., `val as any` in `Segmented` onChange) reduce type safety

## Recommendations for Adding Tests

1. **Choose a framework**: Vitest is recommended as it integrates natively with Vite (already in the project)
2. **Add test dependencies**: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
3. **Add test command** to `package.json` scripts
4. **Configure vitest** in `vite.config.ts` (already has Vite config)
5. **Place tests**: Co-locate `*.test.tsx` files next to components (e.g., `src/components/chat/SidepanelChat.test.tsx`)
6. **Test priority**: Start with the store hook (`src/store/useExtensionStore.ts`) and service layer (`src/services/aiProvider.ts`) as they have no UI dependencies
7. **Component tests**: Wrap in both `ConfigProvider` (theme) and Ant Design `App` (for message API) when testing components

---

*Testing analysis: 2026-07-28*
