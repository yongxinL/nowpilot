import { defineConfig } from 'wxt';

export default defineConfig({
  // D-02: canonical WXT layout — every entrypoint lives under `src/`.
  // `publicDir` and `modulesDir` resolve against the repository root, not
  // `srcDir`, so `public/` needs no change here.
  srcDir: 'src',
  // D-03/RESEARCH Pattern 1: the React module is the sole React integration
  // for WXT. A second React plugin in this file would double-transform JSX.
  modules: ['@wxt-dev/module-react'],
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
    // Least-privilege Phase-1 manifest permissions per D-19a (REQ-R21).
    // Authoritative Phase-1 permission set is exactly the 3 entries below.
    // Do NOT re-add any non-Phase-1 permission to this array in a later
    // wave; the spec's six forbidden permissions re-add at their owning
    // phases ONLY via chrome.permissions.request() / optional_permissions,
    // never as a blanket manifest re-add (see 01-CONTEXT.md D-19a).
    // host_permissions stays limited to ServiceNow domains only — never all_urls.
    permissions: ['sidePanel', 'storage', 'tabs'],
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
    // `options_ui` / `options_page` are deliberately absent: an `options_ui`
    // key silently forces `"open_in_tab": false` into the generated manifest,
    // and §5.1 lists no options entrypoint. Options renders inside the
    // Standalone shell at `standalone.html?page=options`.
    content_security_policy: {
      // Phase-1 CSP (OQ5 / H-6): no Phase-1 code path performs a network
      // request (D-05 forbids provider calls; D-08 keeps secrets in component
      // memory), so any reachable host is pure attack surface. `connect-src
      // 'none'` is asserted by the manifest gate in plan `01-03`; a later
      // phase widens this deliberately.
      extension_pages: "script-src 'self'; object-src 'self'; connect-src 'none'",
    },
  },
});
