import { defineConfig } from 'vitest/config';

export default defineConfig({
    esbuild: {
        tsconfigRaw: {
            compilerOptions: {
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
            },
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: [
            'src/core/**/__tests__/**/*.test.{ts,tsx}',
            'src/components/**/__tests__/**/*.test.{ts,tsx}',
            'src/api/**/__tests__/**/*.test.{ts,tsx}',
            'src/lib/**/__tests__/**/*.test.{ts,tsx}',
            'src/games/**/__tests__/**/*.test.{ts,tsx}',
            'src/engine/**/__tests__/**/*.test.{ts,tsx}',
            'src/systems/**/__tests__/**/*.test.{ts,tsx}',
            'src/server/**/__tests__/**/*.test.{ts,tsx}',
            'src/ugc/**/__tests__/**/*.test.{ts,tsx}',
            'src/pages/**/__tests__/**/*.test.{ts,tsx}',
            'apps/api/test/**/*.test.{ts,tsx}',
            'apps/api/test/**/*.e2e-spec.ts',
        ],
        testTimeout: 180000,
        setupFiles: ['./apps/api/test/vitest.setup.ts'],
    },
});
