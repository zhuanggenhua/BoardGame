import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

describe('Fate Domination board-shell icon guards', () => {
    it('手牌检视图标应抵消 board-shell 缩放', () => {
        const board = readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');

        expect(board).toContain('<Eye className="board-shell-fixed-icon" size={14} />');
    });
});
