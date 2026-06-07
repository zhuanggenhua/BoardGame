import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readBoardSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');

describe('TicTacToe compatibility source guards', () => {
    it('棋盘主容器应提供显式宽高，避免旧 WebView 丢失 aspect-square 后塌陷', () => {
        const board = readBoardSource();

        expect(board).toContain("const TIC_TAC_TOE_BOARD_VIEWPORT_SIZE = 'min(80vw, 60vh)'");
        expect(board).toContain('width: TIC_TAC_TOE_BOARD_VIEWPORT_SIZE,');
        expect(board).toContain('height: TIC_TAC_TOE_BOARD_VIEWPORT_SIZE,');
        expect(board).not.toContain('relative aspect-square h-full max-h-[80vw] md:max-h-[60vh] max-w-full p-4');
    });

    it('窄屏底部 HUD 应给右下调试入口预留避让空间', () => {
        const board = readBoardSource();

        expect(board).toContain('max-[640px]:pr-24');
        expect(board).toContain('max-[640px]:pb-24');
        expect(board).toContain('data-testid="tictactoe-score-right"');
        expect(board).toContain('data-testid="tictactoe-turn-status"');
    });
});
