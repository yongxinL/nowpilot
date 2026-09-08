import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'NowPilot',
    description: 'AI-native Chrome Side Panel + Standalone view assistant',
    permissions: [
      'sidePanel',
      'storage',
      'cookies',
      'alarms',
      'tabs',
      'scripting',
      'contextMenus',
      'notifications',
    ],
    optional_permissions: ['webNavigation'],
    host_permissions: [
      '*://*.service-now.com/*',
      '*://support.servicenow.com/*',
    ],
    optional_host_permissions: ['*://*/*'],
    side_panel: { default_path: 'sidepanel.html' },
    action: { default_title: 'Open NowPilot' },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src *",
    },
    web_accessible_resources: [
      { resources: ['assets/*'], matches: ['<all_urls>'] },
    ],
  },
  vite: () => ({
    build: {
      target: 'chrome120',
      sourcemap: 'inline',
    },
  }),
});
