import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'src/games/**/__tests__/**/*.test.ts',
            'src/engine/**/__tests__/**/*.test.ts',
            'src/server/**/__tests__/**/*.test.ts',
            'apps/api/test/**/*.test.ts',
        ],
        testTimeout: 180000,
        setupFiles: ['./apps/api/test/vitest.setup.ts'],
    },
});
