import { defineConfig } from 'wxt';

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
    // Least-privilege manifest permissions per D-19a (REQ-R21) +
    // Phase-2 ADR-STACK-02 (REQ-R06, unlimitedStorage).
    // Authoritative Phase-2 permission set is exactly the 4 entries below.
    // Do NOT re-add any non-Phase-2 permission to this array in a later
    // wave; the spec's six forbidden permissions re-add at their owning
    // phases ONLY via chrome.permissions.request() / optional_permissions,
    // never as a blanket manifest re-add (see 01-CONTEXT.md D-19a).
    //
    // unlimitedStorage scope (Pitfall 7): exempts ONLY the extension
    // origin's `chrome.storage.local` quota + IndexedDB origin quota
    // and eviction policy. It does NOT lift the `chrome.storage.session`
    // 10 MB cap — np_workspace_primary records stay tiny and continue
    // to fit under the session cap. Phase 19's CWS review must justify
    // the permission per the Chromium storage permission policy.
    //
    // host_permissions stays limited to ServiceNow domains only — never all_urls.
    permissions: ['sidePanel', 'storage', 'tabs', 'unlimitedStorage'],
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
