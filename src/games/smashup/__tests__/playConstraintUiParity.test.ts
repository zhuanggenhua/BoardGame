import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('playConstraint UI parity', () => {
    it('requireOwnMinion 在主 Board 与 e2e Board 中都应按 controller 过滤', () => {
        const boardSource = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8');
        const e2eBoardSource = readFileSync(resolve(__dirname, '../../../../e2e/src/games/smashup/Board.tsx'), 'utf-8');

        expect(boardSource).toContain("constraint === 'requireOwnMinion'");
        expect(boardSource).toContain('m.controller === playerId');
        expect(boardSource).not.toContain('m.owner === playerId');

        expect(e2eBoardSource).toContain("constraint === 'requireOwnMinion'");
        expect(e2eBoardSource).toContain('m.controller === playerId');
        expect(e2eBoardSource).not.toContain('m.owner === playerId');
    });
});
