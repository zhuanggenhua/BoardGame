import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@locales': path.resolve(__dirname, './public/locales'),
        },
    },
    esbuild: {
        // Vitest 默认的 esbuild JSX 转换会走 classic runtime（React.createElement），
        // 在未显式 import React 的 TSX 测试里会触发 “React is not defined”。
        // 统一切换到 automatic runtime。
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
        exclude: [
            // 排除审计测试（只在 npm run test:games:audit 时运行）
            '**/*audit*.test.{ts,tsx}',
            '**/*Audit*.test.{ts,tsx}',
            // 排除属性测试（只在 npm run test:games:audit 时运行）
            '**/*.property.test.{ts,tsx}',
            // 排除调试测试
            '**/*debug*.test.{ts,tsx}',
            '**/*Debug*.test.{ts,tsx}',
            // 默认排除
            '**/node_modules/**',
            '**/dist/**',
            '**/.{idea,git,cache,output,temp}/**',
        ],
        testTimeout: 180000,
        setupFiles: ['./vitest.setup.ts', './apps/api/test/vitest.setup.ts'],
    },
});
