// wxt.config.ts — Source: PRODUCT_SPEC Appendix G (lines 5399-5448), structure verbatim.
// Deviation (Rule 3): manualChunks is applied via the vite:build:extendConfig hook scoped to
// HTML multi-page groups ONLY. WXT 0.19 builds background/content as single-file IIFE lib-mode
// (MV3 requires no dynamic imports in the SW), where Rollup rejects manualChunks
// ("not supported for output.inlineDynamicImports"). The Appendix G isolation intent
// (antd/x/react/defuddle/yaml out of content bundles) is preserved for the HTML pages and
// enforced for content scripts by import restriction + tests/isolation/check-content-bundle.mjs.
import { defineConfig } from 'wxt';

// Appendix G manualChunks rule set — keep verbatim (applied to HTML multi-page groups only)
function manualChunks(id: string): string | undefined {
  if (id.includes('node_modules/antd')) return 'antd';
  if (id.includes('node_modules/@ant-design/x-markdown')) return 'antd-x-markdown';
  if (id.includes('node_modules/@ant-design/x')) return 'antd-x';
  if (id.includes('node_modules/@ant-design')) return 'ant-icons';
  if (id.includes('node_modules/defuddle')) return 'defuddle';
  if (id.includes('node_modules/yaml')) return 'yaml';
  if (id.includes('node_modules/react')) return 'react';
  return undefined;
}

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'NowPilot',
    description: 'AI-native Chrome Side Panel + Standalone view assistant',
    permissions: [
      'sidePanel','storage','cookies','alarms','tabs',
      'scripting','contextMenus','notifications',
    ],
    optional_permissions: ['webNavigation'],
    host_permissions: [
      '*://*.service-now.com/*',
      '*://support.servicenow.com/*',
    ],
    optional_host_permissions: ['*://*/*'],   // webhooks + user MCP hosts, granted on demand
    side_panel: { default_path: 'sidepanel.html' },
    action:     { default_title: 'Open NowPilot' },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src *",
    },
    web_accessible_resources: [
      { resources: ['assets/*'], matches: ['<all_urls>'] },
    ],
  },
  hooks: {
    'vite:build:extendConfig'(_entrypoints, config) {
      // Skip lib-mode (IIFE single-file) builds — manualChunks is invalid there
      if (config.build?.lib) return;
      const output = config.build!.rollupOptions!.output;
      if (Array.isArray(output)) {
        for (const o of output) o.manualChunks = manualChunks;
      } else if (output) {
        output.manualChunks = manualChunks;
      }
    },
  },
  vite: () => ({
    build: {
      target: 'chrome120',
      sourcemap: 'inline',
    },
  }),
});
