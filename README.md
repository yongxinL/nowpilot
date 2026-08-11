# NowPilot

The All-in-One Productivity Extension for ServiceNow Support Engineers

An AI-native Chrome extension (Side Panel + Standalone view) built with [WXT](https://wxt.dev), React 19, and Ant Design 6.

## Requirements

- Node.js >= 18
- [pnpm](https://pnpm.io/installation)
- Google Chrome (or another Chromium-based browser)

## Install dependencies

```bash
pnpm install
```

## Build the extension

```bash
pnpm run build
```

The production build is output to `.output/chrome-mv3/`.

To also produce a distributable `.zip` (written to `.output/`), run:

```bash
pnpm run zip
```

## Install into Chrome

1. Run `pnpm run build` (or open `chrome://extensions` and load the dev build while `pnpm run dev` is running).
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `.output/chrome-mv3/` folder.
6. The **NowPilot** extension is now installed. Click its toolbar icon (or pin it) to open the Side Panel.

## Development

Start the dev server with hot reload:

```bash
pnpm run dev
```

Each rebuild loads automatically; refresh `chrome://extensions` if needed.

## Useful scripts

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `pnpm run dev`     | Dev server with hot reload                   |
| `pnpm run build`   | Production build to `.output/chrome-mv3/`    |
| `pnpm run zip`     | Package the build into a `.zip` in `.output` |
| `pnpm run compile` | TypeScript type check (`tsc --noEmit`)       |
| `pnpm run lint`    | ESLint                                       |
| `pnpm run test`    | Run unit tests (Vitest)                      |