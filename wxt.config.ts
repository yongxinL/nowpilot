import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'NowPilot - RICH Chrome Extension AI Assistant',
    description: 'Real-time tab assistant, standalone notebook workspace, and multi-provider AI engine.',
    version: '1.0.0',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'sidePanel',
      'contextMenus',
    ],
    action: {
      default_title: 'Open NowPilot Assistant',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_page: 'options.html',
  },
});
