// Keep a .js entry for tooling that probes the conventional Vite filename.
// Delegate to the canonical ESM TypeScript config to avoid stale CJS output
// being loaded under "type": "module" environments.
export { default } from './vite.config.ts';
