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
    host_permissions: [],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    commands: {
      'open-command-palette': {
        suggested_key: {
          default: 'Ctrl+Shift+K',
          mac: 'Cmd+Shift+K',
        },
      },
    },
    web_accessible_resources: [
      {
        resources: ['app.html'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
