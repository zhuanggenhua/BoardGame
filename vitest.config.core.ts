import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));
const rootSetupFile = path.resolve(workspaceRoot, 'vitest.setup.ts');

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
    server: {
        fs: {
            strict: false,
        },
    },
    resolve: {
        alias: {
            '@locales': path.resolve(workspaceRoot, 'public/locales'),
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
        // Windows 下大套件使用 forks 更稳，避免 threads worker 初始化失败连带打断 esbuild service。
        pool: 'forks',
        fileParallelism: false,
        maxWorkers: 1,
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
        setupFiles: [rootSetupFile],
    },
});
