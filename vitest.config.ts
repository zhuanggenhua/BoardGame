import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));
const rootSetupFile = path.resolve(workspaceRoot, 'vitest.setup.ts');

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
        // Windows 下大套件使用 forks 更稳，避免 threads worker 初始化失败连带打断 esbuild service。
        pool: 'forks',
        fileParallelism: false,
        maxWorkers: 1,
        include: [
            'src/core/**/__tests__/**/*.test.{ts,tsx}',
            'src/components/**/__tests__/**/*.test.{ts,tsx}',
            'src/api/**/__tests__/**/*.test.{ts,tsx}',
            'src/hooks/**/__tests__/**/*.test.{ts,tsx}',
            'src/lib/**/__tests__/**/*.test.{ts,tsx}',
            'src/shared/**/__tests__/**/*.test.{ts,tsx}',
            'src/game-config/**/__tests__/**/*.test.{ts,tsx}',
            'src/games/**/__tests__/**/*.test.{ts,tsx}',
            'src/engine/**/__tests__/**/*.test.{ts,tsx}',
            'src/server/**/__tests__/**/*.test.{ts,tsx}',
            'src/ugc/**/__tests__/**/*.test.{ts,tsx}',
            'src/pages/**/__tests__/**/*.test.{ts,tsx}',
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
        hookTimeout: 180000, // 首次拉起 mongodb-memory-server 可能需要下载/解压二进制，60 秒不够稳定。
        setupFiles: [rootSetupFile],
    },
});
