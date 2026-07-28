import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'NowPilot',
    description: 'Privacy-first AI assistant and personal knowledge platform for Chrome',
    version: '0.1.0',
    permissions: [
      'sidePanel',
      'storage',
      'cookies',
      'alarms',
      'tabs',
      'scripting',
      'contextMenus',
      'notifications',
      'declarativeNetRequest',
    ],
    host_permissions: [
      '*://*.service-now.com/*',
      '*://support.servicenow.com/*',
    ],
    action: {
      default_title: 'Open NowPilot Assistant',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_page: 'options.html',
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src *",
    },
  },
});
