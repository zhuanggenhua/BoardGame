import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  cacheDir: 'temp/betrayal-3d-vite',
  resolve: {
    alias: {
      pathfinding: fileURLToPath(new URL('../node_modules/pathfinding/index.js', import.meta.url)),
    },
  },
  optimizeDeps: { include: ['pathfinding'] },
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
  build: {
    outDir: 'temp/betrayal-3d-dist',
    rollupOptions: { input: fileURLToPath(new URL('../betrayal-3d.html', import.meta.url)) },
  },
});
