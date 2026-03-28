import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));
const rootSetupFile = path.resolve(workspaceRoot, 'vitest.setup.ts');
const apiSetupFile = path.resolve(workspaceRoot, 'apps/api/test/vitest.setup.ts');

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
        // API e2e/unit tests share Mongo and Nest app setup; run them in a single worker to avoid
        // intermittent worker OOM / startup thrash during pre-push while keeping the full suite intact.
        pool: 'threads',
        fileParallelism: false,
        maxWorkers: 1,
        include: [
            'apps/api/test/**/*.test.{ts,tsx}',
            'apps/api/test/**/*.e2e-spec.ts',
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.{idea,git,cache,output,temp}/**',
        ],
        testTimeout: 180000,
        hookTimeout: 180000,
        setupFiles: [rootSetupFile, apiSetupFile],
    },
});
