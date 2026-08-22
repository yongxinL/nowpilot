import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('@ant-design/icons')) {
              return 'vendor-icons';
            }
            if (id.includes('@ant-design/x-markdown') || id.includes('markdown') || id.includes('katex') || id.includes('prism')) {
              return 'vendor-markdown';
            }
            if (id.includes('@ant-design/x')) {
              return 'vendor-antx';
            }
            if (id.includes('rc-') || id.includes('@rc-component')) {
              return 'vendor-rc';
            }
            if (id.includes('antd') || id.includes('@ant-design/colors') || id.includes('@ant-design/cssinjs')) {
              return 'vendor-antd';
            }
            if (id.includes('motion')) {
              return 'vendor-motion';
            }
            if (id.includes('zod') || id.includes('zustand') || id.includes('immer')) {
              return 'vendor-state';
            }
            return 'vendor-common';
          }
        },
      },
    },
  },
});
