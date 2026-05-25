import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () => readFileSync(resolve(TEST_DIR, '..', 'AudioBrowser.tsx'), 'utf8');

describe('AudioBrowser compatibility source guards', () => {
    it('移动窄屏应把三栏布局切成纵向堆叠，避免顶层横向溢出', () => {
        const source = readSource();

        expect(source).toContain('max-[900px]:flex-col');
        expect(source).toContain('max-[900px]:w-full');
        expect(source).toContain('max-[900px]:max-h-48');
    });

    it('移动窄屏搜索条应允许换行，避免筛选控件把文档宽度撑出视口', () => {
        const source = readSource();

        expect(source).toContain('max-[900px]:flex-wrap');
        expect(source).toContain('min-w-[180px] flex-1');
    });

    it('移动窄屏历史面板应给右下 HUD 留出底部安全区', () => {
        const source = readSource();

        expect(source).toContain('data-testid="audio-browser-history-panel"');
        expect(source).toContain('data-testid="audio-browser-history-surface"');
        expect(source).toContain('max-[900px]:pb-[calc(env(safe-area-inset-bottom)+6rem)]');
        expect(source).toContain('max-[900px]:w-[calc(100%_-_5.5rem)]');
        expect(source).toContain('max-[900px]:self-start');
    });
});
