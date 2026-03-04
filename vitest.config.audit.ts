import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * 审计测试配置
 * 
 * 只运行审计测试：
 * - 审计测试（audit-*.test.ts, *Audit.test.ts）
 * - 属性测试（*.property.test.ts）
 * 
 * 用途：代码审计、完整性检查
 * 命令：npm run test:games:audit
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
            // 只包含审计测试
            'src/games/**/__tests__/**/*audit*.test.{ts,tsx}',
            'src/games/**/__tests__/**/*Audit*.test.{ts,tsx}',
            // 包含属性测试
            'src/games/**/__tests__/**/*.property.test.{ts,tsx}',
        ],
        testTimeout: 180000,
        setupFiles: ['./vitest.setup.ts'],
    },
});
