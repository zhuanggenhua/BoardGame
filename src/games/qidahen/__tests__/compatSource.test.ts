import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readBoardSource = () => readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');

describe('Qidahen compatibility source guards', () => {
    it('地图画布应保留显式宽高，避免旧 WebView 丢失比例后压扁主战区', () => {
        const board = readBoardSource();

        expect(board).toContain('const BOARD_WIDTH = 1265;');
        expect(board).toContain('const BOARD_HEIGHT = 893;');
        expect(board).toContain('width: BOARD_WIDTH,');
        expect(board).toContain('height: BOARD_HEIGHT,');
        expect(board).toContain('className="relative w-[1265px]"');
        expect(board).toContain('className="block w-[1265px] max-w-none select-none"');
    });

    it('地图视口容器应保持 overflow hidden 与 touchAction none，避免旧端触控时整页串滚', () => {
        const board = readBoardSource();

        expect(board).toContain('className="relative h-full w-full overflow-hidden select-none"');
        expect(board).toContain("touchAction: 'none',");
        expect(board).toContain('data-testid="qidahen-map-container"');
        expect(board).toContain('data-testid="qidahen-board"');
    });

    it('移动横屏底部操作区应使用紧凑行高与紧凑按钮，避免确认取消掉出视口', () => {
        const board = readBoardSource();

        expect(board).toContain('max-[1100px]:grid-rows-[34px_minmax(0,1fr)_176px]');
        expect(board).toContain('max-[1100px]:p-2 max-[760px]:hidden');
        expect(board).toContain('max-[1100px]:px-3 max-[1100px]:py-2 max-[1100px]:text-base');
    });
});
