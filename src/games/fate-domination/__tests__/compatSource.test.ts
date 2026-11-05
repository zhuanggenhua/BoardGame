import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

describe('Fate Domination board-shell icon guards', () => {
    it('牌堆与确认图标应抵消 board-shell 缩放', () => {
        const board = readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');

        const self = readFileSync(resolve(TEST_DIR, '..', 'ui', 'FateSelfDock.tsx'), 'utf8');
        expect(self).toContain('<Layers className="board-shell-fixed-icon" size={22}/>');
        expect(self).toContain('<Archive className="board-shell-fixed-icon" size={22}/>');
        expect(board).toContain('<ArrowRight className="board-shell-fixed-icon" size={18}/>');
    });
});
