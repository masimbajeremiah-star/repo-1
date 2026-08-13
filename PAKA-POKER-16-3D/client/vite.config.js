import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    strictPort: false,
    host: '127.0.0.1',
  },
  build: {
    // Three.js is intentionally substantial; keep it out of the application
    // entry chunk so browsers can cache it independently.
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
});
