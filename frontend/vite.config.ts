import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port: 5173,
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'framework';
          }

          if (
            id.includes('/node_modules/@phosphor-icons/') ||
            id.includes('/node_modules/lucide-react/')
          ) {
            return 'icons';
          }

          if (
            id.includes('/node_modules/recharts/') ||
            id.includes('/node_modules/d3-')
          ) {
            return 'charts';
          }

          if (
            id.includes('/node_modules/react-markdown/') ||
            id.includes('/node_modules/remark-') ||
            id.includes('/node_modules/rehype-') ||
            id.includes('/node_modules/unified/') ||
            id.includes('/node_modules/micromark/') ||
            id.includes('/node_modules/mdast-') ||
            id.includes('/node_modules/hast-')
          ) {
            return 'markdown';
          }
        },
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
});
