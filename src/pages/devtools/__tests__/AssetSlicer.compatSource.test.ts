import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () => readFileSync(resolve(TEST_DIR, '..', 'AssetSlicer.tsx'), 'utf8');

describe('AssetSlicer compatibility source guards', () => {
    it('移动窄屏收起侧栏时应保留完整可点拉手，并暴露稳定 test id', () => {
        const source = readSource();

        expect(source).toContain('data-testid="asset-slicer-sidebar-toggle"');
        expect(source).toContain("(isCompactViewport ? 8 : 0)");
        expect(source).toContain('isSidebarOpen ? "border-l-0 rounded-r-md" : "rounded-md"');
    });
});
