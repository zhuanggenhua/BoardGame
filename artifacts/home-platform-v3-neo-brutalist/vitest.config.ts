import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ['artifacts/home-platform-v3-neo-brutalist/home-v9.contract.test.ts','artifacts/home-platform-v3-neo-brutalist/library-task.behavior.test.ts','artifacts/home-platform-v3-neo-brutalist/details-actions.behavior.test.ts'],
  },
});
