import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readBoardSource = () => readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');
const readMarketSectionSource = () => readFileSync(resolve(TEST_DIR, '..', 'ui', 'MarketSection.tsx'), 'utf8');

describe('Splendor compatibility source guards', () => {
    it('联机开局浮层应保留稳定的测试锚点，便于移动端兼容验收', () => {
        const board = readBoardSource();

        expect(board).toContain('data-testid="splendor-pregame-panel"');
        expect(board).toContain('data-testid="splendor-starting-player"');
        expect(board).toContain('data-testid="splendor-start-game"');
        expect(board).toContain('bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]');
        expect(board).toContain('sm:bottom-4');
    });

    it('牌堆槽位应同时保留 paddingTop 和 aspectRatio，避免旧 WebView 丢失比例后塌高', () => {
        const marketSection = readMarketSectionSource();

        expect(marketSection).toContain("style={{ height: 0, paddingTop: `${100 / 0.7}%`, aspectRatio: '0.7 / 1' }}");
    });

    it('手机横屏主态应提前切到双区和三列布局，避免公开牌与玩家区掉到首屏下方', () => {
        const board = readBoardSource();

        expect(board).toContain('min-[820px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
        expect(board).toContain('min-[820px]:grid-cols-[minmax(0,1.55fr)_minmax(7rem,0.46fr)_minmax(0,0.99fr)]');
        expect(board).not.toContain('grid gap-4 xl:grid-cols-[50%_50%] xl:items-start');
        expect(board).not.toContain('grid gap-4 xl:grid-cols-[60%_12%_28%] xl:items-stretch');
    });
});
