import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@locales': path.resolve(__dirname, './public/locales'),
        },
    },
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react',
        tsconfigRaw: {
            compilerOptions: {
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        include: [
            'src/core/**/__tests__/**/*.test.{ts,tsx}',
            'src/components/**/__tests__/**/*.test.{ts,tsx}',
            'src/api/**/__tests__/**/*.test.{ts,tsx}',
            'src/hooks/**/__tests__/**/*.test.{ts,tsx}',
            'src/lib/**/__tests__/**/*.test.{ts,tsx}',
            'src/shared/**/__tests__/**/*.test.{ts,tsx}',
            'src/games/**/__tests__/**/*.test.{ts,tsx}',
            'src/engine/**/__tests__/**/*.test.{ts,tsx}',
            'src/server/**/__tests__/**/*.test.{ts,tsx}',
            'src/ugc/**/__tests__/**/*.test.{ts,tsx}',
            'src/pages/**/__tests__/**/*.test.{ts,tsx}',
            'apps/api/test/**/*.test.{ts,tsx}',
            'apps/api/test/**/*.e2e-spec.ts',
        ],
        // 排除审计和属性测试
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/*audit*.test.{ts,tsx}',
            '**/*Audit*.test.{ts,tsx}',
            '**/*property*.test.{ts,tsx}',
            '**/properties/**/*.test.{ts,tsx}',
            '**/*Properties*.test.{ts,tsx}',
        ],
        testTimeout: 180000,
        setupFiles: ['./vitest.setup.ts', './apps/api/test/vitest.setup.ts'],
    },
});
