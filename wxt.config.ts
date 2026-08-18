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
      chunkSizeWarningLimit: 1500,
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
      default_icon: 'assets/icons/icon-role-ai-avatar.png',
    },
    icons: {
      16: 'assets/icons/icon-role-ai-avatar.png',
      32: 'assets/icons/icon-role-ai-avatar.png',
      48: 'assets/icons/icon-role-ai-avatar.png',
      128: 'assets/icons/icon-role-ai-avatar.png',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    options_page: 'options.html',
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src http://localhost:* https://generativelanguage.googleapis.com https://api.anthropic.com https://api.openai.com",
    },
  },
});
