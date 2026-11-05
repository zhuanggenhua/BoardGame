import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'artifacts/fate-domination-open-design/open-design-v6.contract.test.ts',
      'artifacts/fate-domination-open-design/open-design-current.behavior.test.ts',
      'artifacts/fate-domination-open-design/capture-image-readiness.test.ts',
    ],
  },
});
