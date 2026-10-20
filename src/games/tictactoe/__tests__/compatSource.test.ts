import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readBoardSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');

describe('TicTacToe compatibility source guards', () => {
    it('棋盘尺寸应使用共享 board-shell 设计单位，不再二次读取真实视口尺寸', () => {
        const board = readBoardSource();

        expect(board).toContain("const TIC_TAC_TOE_BOARD_VIEWPORT_SIZE = 'min(calc(var(--mobile-board-shell-inline-unit) * 80), calc(var(--mobile-board-shell-block-unit) * 60))'");
        expect(board).toContain('width: TIC_TAC_TOE_BOARD_VIEWPORT_SIZE,');
        expect(board).toContain('height: TIC_TAC_TOE_BOARD_VIEWPORT_SIZE,');
        expect(board).toContain('data-testid="tictactoe-board-root"');
        expect(board).not.toMatch(/\b\d+(?:\.\d+)?(?:vw|vh)\b/);
        expect(board).not.toContain('relative aspect-square h-full max-h-[80vw] md:max-h-[60vh] max-w-full p-4');
    });

    it('壳内 HUD 保持 PC 排版，不按真实视口断点切换移动专版', () => {
        const board = readBoardSource();

        expect(board).not.toMatch(/\b(?:sm|md|lg|xl|2xl):/);
        expect(board).toContain('@container');
        expect(board).not.toMatch(/(?<!@)max-\[/);
        expect(board).toContain('@max-[640px]:flex-col');
        expect(board).toContain('data-testid="tictactoe-score-right"');
        expect(board).toContain('data-testid="tictactoe-turn-status"');
    });
});
