import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',

  plugins: [
    react(),
  ],

  server: {
    host: 'localhost',
    port: 5173,
  },

  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three-vendor';
          if (id.includes('node_modules/socket.io') || id.includes('node_modules/engine.io')) return 'socket-vendor';
          if (id.includes('node_modules/react')) return 'react-vendor';
          if (id.includes('node_modules/zustand')) return 'state-vendor';
          return undefined;
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': '/client/src',
    },
  },
});
