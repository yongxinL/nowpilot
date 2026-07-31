import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  webExt: {
    disabled: true,
  },
  dev: {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  },
  vite: () => ({
    plugins: [tailwindcss() as any],
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
          if (warning.message?.includes('use client')) return;
          warn(warning);
        },
      },
    },
  }),
  manifest: {
    name: 'NowPilot',
    description: 'Privacy-first AI assistant and personal knowledge platform for Chrome',
    version: '0.1.0',
    permissions: [
      'sidePanel',
      'storage',
      'unlimitedStorage',
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
      'https://api.anthropic.com/*',
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'http://localhost:11434/*',
    ],
    action: {
      default_title: 'Open NowPilot Assistant',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_page: 'options.html',
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src http://localhost:* https://generativelanguage.googleapis.com https://api.anthropic.com https://api.openai.com",
    },
  },
});
