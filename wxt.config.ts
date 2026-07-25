import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  manifestVersion: 3,
  webExt: {
    disabled: true,
  },
  vite: () => ({
    build: {
      chunkSizeWarningLimit: 2000,
    },
  }),
  manifest: {
    name: 'NowPilot',
    version: '0.1.0',
    description: 'Privacy-first AI assistant',
    permissions: ['sidePanel', 'storage', 'tabs', 'commands', 'activeTab', 'scripting'],
    host_permissions: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      'http://localhost:*/*',
      // Needed for chrome.scripting.executeScript to read/search tabs the
      // user hasn't focused (OnDemandExtractor) — activeTab only covers the
      // tab active during a user gesture, not arbitrary background tabs.
      'http://*/*',
      'https://*/*',
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    commands: {
      'open-command-palette': {
        description: 'Open the NowPilot command palette',
        suggested_key: {
          default: 'Ctrl+Shift+K',
          mac: 'Command+Shift+K',
        },
      },
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    web_accessible_resources: [
      {
        resources: ['standalone.html'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
