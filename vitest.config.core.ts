import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * 核心功能测试配置
 * 
 * 排除以下测试：
 * - 审计测试（audit-*.test.ts, *Audit.test.ts）
 * - 属性测试（*.property.test.ts）
 * - E2E 测试（*.e2e.test.ts）
 * 
 * 用途：快速验证核心功能是否正常工作
 * 命令：npm run test:games:core
 */
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
            'src/games/**/__tests__/**/*.test.{ts,tsx}',
        ],
        exclude: [
            // 排除审计测试
            '**/*audit*.test.{ts,tsx}',
            '**/*Audit*.test.{ts,tsx}',
            // 排除属性测试
            '**/*.property.test.{ts,tsx}',
            // 排除 E2E 测试
            '**/*.e2e.test.{ts,tsx}',
            '**/*E2E*.test.{ts,tsx}',
            // 排除调试测试
            '**/*debug*.test.{ts,tsx}',
            '**/*Debug*.test.{ts,tsx}',
            // 默认排除
            '**/node_modules/**',
            '**/dist/**',
            '**/.{idea,git,cache,output,temp}/**',
        ],
        testTimeout: 180000,
        setupFiles: ['./vitest.setup.ts'],
    },
});
