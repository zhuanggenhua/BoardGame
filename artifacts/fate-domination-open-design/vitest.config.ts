import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'artifacts/fate-domination-open-design/open-design-v6.contract.test.ts',
    ],
  },
});
