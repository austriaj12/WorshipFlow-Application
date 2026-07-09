import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: resolve(__dirname, 'src'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        operator: resolve(__dirname, 'src/index.html'),
        projector: resolve(__dirname, 'src/projector.html'),
        stage: resolve(__dirname, 'src/stage.html'),
        remote: resolve(__dirname, 'src/remote.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
