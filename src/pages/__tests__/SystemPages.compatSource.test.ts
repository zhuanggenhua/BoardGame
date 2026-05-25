import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readPageSource = (filename: string) =>
    readFileSync(resolve(TEST_DIR, '..', filename), 'utf8');

describe('System pages compatibility source guards', () => {
    it('BrowserCompatibility 页面应使用 runtime viewport 变量，而不是直接依赖 100dvh', () => {
        const page = readPageSource('BrowserCompatibility.tsx');

        expect(page).toContain("minHeight: 'var(--runtime-viewport-height, 100vh)'");
        expect(page).not.toContain("minHeight: '100dvh'");
    });

    it('Maintenance 页面应使用 runtime viewport 变量，而不是 min-h-[100dvh]', () => {
        const page = readPageSource('Maintenance.tsx');

        expect(page).toContain("style={{ minHeight: 'var(--runtime-viewport-height, 100vh)' }}");
        expect(page).not.toContain('min-h-[100dvh]');
    });

    it('NotFound 页面应使用 runtime viewport 变量，而不是 min-h-[100dvh]', () => {
        const page = readPageSource('NotFound.tsx');

        expect(page).toContain("style={{ minHeight: 'var(--runtime-viewport-height, 100vh)' }}");
        expect(page).not.toContain('min-h-[100dvh]');
    });
});
