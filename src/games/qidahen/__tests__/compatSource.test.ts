import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readBoardSource = () => readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');

describe('Qidahen compatibility source guards', () => {
    it('桌面舞台应保留显式宽高与缩放锚点，避免宿主缩放后压扁主战区', () => {
        const board = readBoardSource();

        expect(board).toContain('const STAGE_WIDTH = 1920;');
        expect(board).toContain('const STAGE_HEIGHT = 1080;');
        expect(board).toContain('data-testid="qidahen-desktop-stage"');
        expect(board).toContain('width: STAGE_WIDTH,');
        expect(board).toContain('height: STAGE_HEIGHT,');
        expect(board).toContain("transformOrigin: 'top left',");
    });

    it('地图视口容器应保持裁切与绝对舞台定位，避免缩放后出现越界或错位', () => {
        const board = readBoardSource();

        expect(board).toContain('className="relative h-full min-h-0 overflow-hidden bg-white"');
        expect(board).toContain('className="absolute overflow-hidden bg-white"');
        expect(board).toContain('data-testid="qidahen-board"');
        expect(board).toContain('data-testid="qidahen-desktop-stage"');
        expect(board).toContain('left: stageMetrics.left,');
        expect(board).toContain('top: stageMetrics.top,');
    });

    it('底部手牌坞应固定锚到底边并限制宽度，避免抽牌堆与弃牌堆被挤出主视口', () => {
        const board = readBoardSource();

        expect(board).toContain('data-testid="qidahen-bottom-dock"');
        expect(board).toContain('className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 h-[314px]"');
        expect(board).toContain('data-testid="qidahen-hand-zone"');
        expect(board).toContain('data-ui-role="qidahen-hand-dock"');
        expect(board).toContain('max-w-[calc(100vw-360px)]');
    });
});
