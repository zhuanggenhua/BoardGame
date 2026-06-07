import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readUiSource = (relativePath: string) =>
    readFileSync(resolve(TEST_DIR, '..', relativePath), 'utf8');

describe('SmashUp compatibility source guards', () => {
    it('派系详情侧栏应使用 runtime viewport 高度兜底，而不是直接依赖 42dvh', () => {
        const factionSelection = readUiSource('ui/FactionSelection.tsx');

        expect(factionSelection).toContain("const detailSidebarMaxHeight = 'calc(var(--runtime-viewport-height, 100vh) * 0.42)'");
        expect(factionSelection).toContain('style={useCompactDetailSidebarHeight ? { maxHeight: detailSidebarMaxHeight } : undefined}');
        expect(factionSelection).not.toContain('max-h-[42dvh]');
    });
});
