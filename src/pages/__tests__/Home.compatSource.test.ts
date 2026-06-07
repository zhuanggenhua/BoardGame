import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readHomeSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'Home.tsx'), 'utf8');
const readCategoryPillsSource = () =>
    readFileSync(resolve(TEST_DIR, '..', '..', 'components', 'layout', 'CategoryPills.tsx'), 'utf8');

describe('Home compatibility source guards', () => {
    it('首页主容器应使用 runtime viewport 变量，而不是直接依赖 100dvh', () => {
        const home = readHomeSource();

        expect(home).toContain("style={{ minHeight: 'var(--runtime-viewport-height, 100vh)' }}");
        expect(home).not.toContain('min-h-[100dvh]');
    });

    it('首页分类栏在窄屏下应允许换行，而不是依赖横向滚动才能看到后半段分类', () => {
        const categoryPills = readCategoryPillsSource();

        expect(categoryPills).toContain('flex-wrap');
        expect(categoryPills).not.toContain('overflow-x-auto');
        expect(categoryPills).not.toContain('min-w-max');
    });
});
