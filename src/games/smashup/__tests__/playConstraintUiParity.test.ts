import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('playConstraint UI parity', () => {
    it('主 Board 与 e2e Board 不应在 UI 层私自解释 playConstraint', () => {
        const boardSource = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8');
        const e2eBoardSource = readFileSync(resolve(__dirname, '../../../../e2e/src/games/smashup/Board.tsx'), 'utf-8');

        expect(boardSource).toContain('collectLegalActionPlayTargets');
        expect(boardSource).not.toContain('checkPlayConstraintUI');
        expect(boardSource).not.toContain("constraint === 'requireOwnMinion'");
        expect(boardSource).not.toContain('m.owner === playerId');

        expect(e2eBoardSource).toContain('collectLegalActionPlayTargets');
        expect(e2eBoardSource).not.toContain('checkPlayConstraintUI');
        expect(e2eBoardSource).not.toContain("constraint === 'requireOwnMinion'");
        expect(e2eBoardSource).not.toContain('m.owner === playerId');
    });
});
