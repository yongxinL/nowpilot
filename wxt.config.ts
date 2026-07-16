import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  manifest: {
    name: 'NowPilot',
    version: '0.1.0',
    manifest_version: 3,
    description: 'Privacy-first AI assistant',
    permissions: ['sidePanel', 'storage', 'tabs', 'commands'],
    host_permissions: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      'http://localhost:*/*',
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
