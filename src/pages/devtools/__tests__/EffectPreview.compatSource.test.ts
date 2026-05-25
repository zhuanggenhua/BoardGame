import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () => readFileSync(resolve(TEST_DIR, '..', 'EffectPreview.tsx'), 'utf8');

describe('EffectPreview compatibility source guards', () => {
    it('移动窄屏应提供抽屉式侧栏状态，而不是继续固定双栏挤压主预览区', () => {
        const source = readSource();

        expect(source).toContain('const [isCompactViewport, setIsCompactViewport] = useState');
        expect(source).toContain('const [isSidebarOpen, setIsSidebarOpen] = useState');
        expect(source).toContain("data-testid=\"fx-preview-sidebar-toggle\"");
        expect(source).toContain("data-testid=\"fx-preview-sidebar-backdrop\"");
        expect(source).toContain("data-testid=\"fx-preview-sidebar\"");
        expect(source).toContain("data-testid=\"fx-preview-sidebar-close\"");
    });

    it('移动窄屏选中特效后应自动收起侧栏，避免主预览区持续被抽屉占宽', () => {
        const source = readSource();

        expect(source).toContain('if (isCompactViewport) {');
        expect(source).toContain('setIsSidebarOpen(false);');
        expect(source).toContain("'absolute inset-y-0 left-0 z-30 w-[min(18rem,calc(100vw-3.5rem))] shadow-2xl'");
        expect(source).toContain('{(!isCompactViewport || isSidebarOpen) ? (');
        expect(source).toContain(') : null}');
    });
});
