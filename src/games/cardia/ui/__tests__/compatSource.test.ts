import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSelectionModalSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'CardSelectionModal.tsx'), 'utf8');
const readMagnifyOverlaySource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'CardMagnifyOverlay.tsx'), 'utf8');

describe('Cardia modal compatibility source guards', () => {
    it('选卡弹层应使用 runtime viewport 变量，而不是直接依赖 100vh', () => {
        const source = readSelectionModalSource();

        expect(source).toContain("maxHeight: 'calc(var(--runtime-viewport-height, 100vh) - 1rem)'");
        expect(source).not.toContain('max-h-[calc(100vh-1rem)]');
    });

    it('卡牌放大层应保留显式宽高计算，避免旧 WebView 丢失 aspect-ratio 后只剩横条', () => {
        const source = readMagnifyOverlaySource();

        expect(source).toContain("const widthForThreeQuarterHeight = 'calc(75vh * (106 / 160))';");
        expect(source).toContain("height: '75vh'");
        expect(source).toContain("width: `min(75vw, ${widthForThreeQuarterHeight})`");
    });
});
