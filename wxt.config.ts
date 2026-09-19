import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'NowPilot',
    version: '0.1.0',
    description: 'Privacy-first Chrome extension for support engineers.',
    permissions: ['sidePanel', 'storage'],
    action: {
      default_title: 'NowPilot',
    },
  },
});
