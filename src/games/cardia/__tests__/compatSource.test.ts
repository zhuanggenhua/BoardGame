import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readBoardSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');

describe('Cardia compatibility source guards', () => {
    it('玩家区域高度应使用 runtime viewport 变量，避免旧 WebView 丢失 dvh 导致手牌区高度失效', () => {
        const board = readBoardSource();

        expect(board).toContain("const CARDIA_PLAYER_ZONE_HEIGHT = 'clamp(8.9rem, calc(var(--runtime-viewport-height, 100vh) * 0.31), 10.6rem)'");
        expect(board).toContain('height: CARDIA_PLAYER_ZONE_HEIGHT,');
        expect(board).not.toContain('h-[clamp(8.9rem,31dvh,10.6rem)]');
    });
});
