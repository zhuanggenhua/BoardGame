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

    it('派系详情中的检视图标应抵消 board-shell 缩放', () => {
        const factionSelection = readUiSource('ui/FactionSelection.tsx');

        expect(factionSelection).toContain('<BookOpen className="board-shell-fixed-icon" size={14} />');
        expect(factionSelection).toContain('<ZoomIn className="board-shell-fixed-icon" size={14} />');
        expect(factionSelection).toContain('<ZoomIn className="board-shell-fixed-icon" size={16} />');
    });

    it('派系选中态应复用卡框边框，不得在卡面内部追加第二层描边', () => {
        const factionSelection = readUiSource('ui/FactionSelection.tsx');

        expect(factionSelection).toContain("'border-green-500 scale-105 -translate-y-2'");
        expect(factionSelection).toContain("borderColor: '#22c55e'");
        expect(factionSelection).toContain("borderWidth: '4px'");
        expect(factionSelection).not.toContain('data-testid="faction-selection-border"');
        expect(factionSelection).not.toContain('outlineColor:');
    });
});
